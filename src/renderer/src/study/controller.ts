import { now as clockNow } from '../core/clock'
import { chooseFormat, stageOf, type Stage } from '../core/formats'
import { HEARTS_PER_LESSON, levelFromXp, xpForAnswer, type Achievement } from '../core/gamify'
import { normalise, type GradeNote } from '../core/grading'
import { buildMatch, buildQuestion, isMatchable, type Question } from '../core/questions'
import { ratingFor, retrievability } from '../core/scheduler'
import { LessonQueue } from '../core/session'
import { schedulerConfig, type Settings } from '../core/settings'
import {
  MemState,
  type CardRecord,
  type Format,
  type RatingValue,
  type StudyMode,
  type Verdict
} from '../core/types'
import { shuffle, type Rng } from '../core/util'
import { buildStudyQueue, cardsForDecks, getProfile, recordAnswer } from '../db/repo'
import { awardXp, recordLessonFinished } from '../db/progress'

export type Phase = 'loading' | 'question' | 'feedback' | 'summary' | 'empty'

export interface StudyOptions {
  mode: StudyMode
  deckIds?: string[]
  topic?: string
  newOnly?: boolean
  extraNew?: number
  /** Practise every card regardless of due date (most forgotten first). */
  cram?: boolean
  settings: Settings
  rng?: Rng
}

export interface StudyItem {
  key: number
  question: Question
  format: Format
  cards: CardRecord[]
  stage: Stage
  startedAt: number
}

export interface ResultIn {
  cardId: string
  verdict: Verdict
  selfRating?: RatingValue
  hintUsed?: boolean
  /** Items scored (points recalled), for XP. */
  units?: number
  note?: GradeNote
  /** What the student typed or picked, shown back in feedback. */
  given?: string
}

export interface Feedback {
  verdict: Verdict
  results: ResultIn[]
  xp: number
  combo: number
  comboMilestone: boolean
  note?: GradeNote
  /** Typed answers marked wrong or close can be overridden ("I was right"). */
  overridable: boolean
  /** First exposure to a new card: a wrong guess is expected and useful. */
  pretest: boolean
  heartLost: boolean
  leveledUp: boolean
  goalJustMet: boolean
}

export interface LessonSummary {
  cards: number
  firstTryCorrect: number
  accuracy: number
  xp: number
  bestCombo: number
  durationMs: number
  newCards: number
  missed: CardRecord[]
  perfect: boolean
  level: number
  leveledUp: boolean
  achievements: Achievement[]
  outOfHearts: boolean
  remaining: number
}

export interface StudyState {
  phase: Phase
  item?: StudyItem
  feedback?: Feedback
  progress: { done: number; total: number }
  combo: number
  sessionXp: number
  hearts: number | null
  summary?: LessonSummary
  lessonNumber: number
  nextDue?: number
  newWaiting: number
}

interface LessonStats {
  startedAt: number
  firstTry: Map<string, boolean>
  xp: number
  bestCombo: number
  newIds: Set<string>
  startLevel: number
}

const overall = (results: ResultIn[]): Verdict =>
  results.every((r) => r.verdict === 'correct')
    ? 'correct'
    : results.some((r) => r.verdict === 'wrong')
      ? 'wrong'
      : 'close'

export class StudyController {
  private state: StudyState = {
    phase: 'loading',
    progress: { done: 0, total: 0 },
    combo: 0,
    sessionXp: 0,
    hearts: null,
    lessonNumber: 0,
    newWaiting: 0
  }
  private listeners = new Set<() => void>()
  private cards = new Map<string, CardRecord>()
  private byDeck = new Map<string, CardRecord[]>()
  private queue: string[] = []
  private lesson: LessonQueue | null = null
  private stats: LessonStats | null = null
  private itemKey = 0
  private prevCombo = 0
  private disposed = false
  private generation = 0
  private readonly rng: Rng

  constructor(private readonly opts: StudyOptions) {
    this.rng = opts.rng ?? Math.random
  }

  // ----- store plumbing for useSyncExternalStore -----

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  getState = (): StudyState => this.state

  private set(patch: Partial<StudyState>): void {
    if (this.disposed) return
    this.state = { ...this.state, ...patch }
    this.listeners.forEach((l) => l())
  }

  // ----- lifecycle -----

  async start(): Promise<void> {
    // React StrictMode mounts, unmounts and remounts: only the latest start may proceed.
    const generation = ++this.generation
    this.disposed = false
    const pool = await cardsForDecks(this.opts.deckIds)
    if (generation !== this.generation) return
    this.setPool(pool)
    await this.refillQueue()
    if (generation !== this.generation) return
    await this.startLesson()
  }

  dispose(): void {
    this.disposed = true
    this.generation++
  }

  private setPool(pool: CardRecord[]): void {
    this.cards = new Map(pool.map((c) => [c.id, c]))
    this.byDeck = new Map()
    for (const c of pool) {
      const list = this.byDeck.get(c.deckId)
      if (list) list.push(c)
      else this.byDeck.set(c.deckId, [c])
    }
  }

  private async refillQueue(): Promise<void> {
    const { settings } = this.opts
    const now = clockNow()
    if (this.opts.cram) {
      const cfg = schedulerConfig(settings)
      const all = [...this.cards.values()].filter(
        (c) => !c.suspended && (!this.opts.topic || c.topic === this.opts.topic)
      )
      const seen = all.filter((c) => c.mem.state !== MemState.New)
      const fresh = all.filter((c) => c.mem.state === MemState.New)
      seen.sort((a, b) => retrievability(a.mem, now, cfg) - retrievability(b.mem, now, cfg))
      this.queue = [...seen, ...shuffle(fresh, this.rng)].map((c) => c.id)
      return
    }
    const planned = await buildStudyQueue({
      deckIds: this.opts.deckIds,
      topic: this.opts.topic,
      newOnly: this.opts.newOnly,
      extraNew: this.opts.extraNew,
      now,
      settings
    })
    this.queue = planned.map((c) => c.id)
  }

  private async startLesson(): Promise<void> {
    const ids = this.queue.splice(0, this.opts.settings.lessonSize)
    if (!ids.length) {
      this.showEmpty()
      return
    }
    this.lesson = new LessonQueue(ids, this.rng)
    const startLevel = levelFromXp((await getProfile()).totalXp).level
    this.stats = {
      startedAt: clockNow(),
      firstTry: new Map(),
      xp: 0,
      bestCombo: 0,
      newIds: new Set(ids.filter((id) => this.cards.get(id)?.mem.state === MemState.New)),
      startLevel
    }
    this.set({
      lessonNumber: this.state.lessonNumber + 1,
      hearts: this.opts.settings.hardcore ? HEARTS_PER_LESSON : null,
      combo: 0,
      summary: undefined,
      feedback: undefined
    })
    await this.next()
  }

  private showEmpty(): void {
    const now = clockNow()
    const live = [...this.cards.values()].filter((c) => !c.suspended)
    const upcoming = live
      .filter((c) => c.mem.state !== MemState.New && c.due > now)
      .map((c) => c.due)
    this.set({
      phase: 'empty',
      item: undefined,
      feedback: undefined,
      nextDue: upcoming.length ? Math.min(...upcoming) : undefined,
      newWaiting: live.filter((c) => c.mem.state === MemState.New).length
    })
  }

  // ----- questions -----

  private peersFor(card: CardRecord): CardRecord[] {
    return this.byDeck.get(card.deckId) ?? []
  }

  private async next(): Promise<void> {
    const lesson = this.lesson
    if (!lesson) return
    const id = lesson.current
    if (!id) {
      await this.finishLesson(false)
      return
    }
    const card = this.cards.get(id)!
    const { formats } = this.opts.settings
    const peers = this.peersFor(card)
    const peerCount = peers.filter((p) => p.kind === 'qa' && p.id !== card.id).length
    let format = chooseFormat(card, peerCount, formats, this.rng)
    const stage = stageOf(card)

    let cards = [card]
    if (
      (format === 'mcq' || format === 'truefalse') &&
      formats.enabled.match &&
      !formats.classic &&
      isMatchable(card) &&
      this.rng() < 0.35
    ) {
      const answers = new Set([normalise(card.a)])
      const prompts = new Set([normalise(card.q)])
      const candidates = lesson.upcoming.slice(1).filter((otherId) => {
        const c = this.cards.get(otherId)
        if (!c || !isMatchable(c) || c.deckId !== card.deckId) return false
        const st = stageOf(c)
        if (st !== 'new' && st !== 'scaffold') return false
        const a = normalise(c.a)
        const q = normalise(c.q)
        if (answers.has(a) || prompts.has(q)) return false
        answers.add(a)
        prompts.add(q)
        return true
      })
      if (candidates.length >= 2) {
        const pick = new Set(candidates.slice(0, 4))
        const pulled = lesson.pullAlong(4, (otherId) => pick.has(otherId))
        cards = [card, ...pulled.map((p) => this.cards.get(p)!)]
        format = 'match'
      }
    }
    const question: Question =
      format === 'match'
        ? buildMatch(cards, this.rng)
        : buildQuestion(card, format, peers, this.rng)

    this.set({
      phase: 'question',
      item: { key: ++this.itemKey, question, format, cards, stage, startedAt: clockNow() },
      feedback: undefined,
      progress: lesson.progress
    })
  }

  /** The student answered. Grade, score and show feedback; saving happens on continue. */
  async answer(results: ResultIn[]): Promise<void> {
    const item = this.state.item
    const lesson = this.lesson
    if (!item || !lesson || this.state.phase !== 'question') return
    const verdict = overall(results)
    const correct = verdict !== 'wrong'
    this.prevCombo = this.state.combo
    const combo = correct ? this.state.combo + 1 : 0
    const units =
      item.format === 'match'
        ? results.filter((r) => r.verdict !== 'wrong').length
        : results.reduce((n, r) => n + (r.units ?? 0), 0) || undefined
    const firstTry = results.every((r) => lesson.attemptsFor(r.cardId) === 0)
    const xp = xpForAnswer({ format: item.format, verdict, combo, firstTry, units })
    for (const r of results) {
      if (!this.stats!.firstTry.has(r.cardId))
        this.stats!.firstTry.set(r.cardId, r.verdict !== 'wrong')
    }
    this.stats!.xp += xp
    this.stats!.bestCombo = Math.max(this.stats!.bestCombo, combo)
    let hearts = this.state.hearts
    const heartLost = hearts !== null && !correct
    if (heartLost && hearts !== null) hearts = Math.max(0, hearts - 1)

    const feedback: Feedback = {
      verdict,
      results,
      xp,
      combo,
      comboMilestone: combo > 0 && combo % 5 === 0,
      note: results.length === 1 ? results[0].note : undefined,
      overridable: (item.format === 'typed' || item.format === 'cloze') && verdict !== 'correct',
      pretest: item.stage === 'new' && results.length === 1,
      heartLost,
      leveledUp: false,
      goalJustMet: false
    }
    this.set({ phase: 'feedback', feedback, combo, hearts, sessionXp: this.state.sessionXp + xp })

    if (xp > 0) {
      const res = await awardXp(xp, clockNow(), this.opts.settings, {
        combo,
        typedCorrect: item.format === 'typed' && verdict === 'correct' ? 1 : 0,
        blurts: item.format === 'blurt' ? 1 : 0
      })
      if (this.state.feedback === feedback && (res.leveledUp || res.goalJustMet)) {
        this.set({
          feedback: { ...feedback, leveledUp: res.leveledUp, goalJustMet: res.goalJustMet }
        })
      }
    } else if (item.format === 'blurt') {
      await awardXp(0, clockNow(), this.opts.settings, { blurts: 1 })
    }
  }

  /** "I was right": accept a typed answer the grader rejected. */
  async override(): Promise<void> {
    const fb = this.state.feedback
    const item = this.state.item
    if (!fb || !item || !fb.overridable) return
    const results = fb.results.map((r) => ({
      ...r,
      verdict: 'correct' as Verdict,
      note: undefined
    }))
    const combo = this.prevCombo + 1
    const firstTry = results.every((r) => (this.lesson?.attemptsFor(r.cardId) ?? 0) === 0)
    const xp = xpForAnswer({ format: item.format, verdict: 'correct', combo, firstTry })
    const delta = xp - fb.xp
    for (const r of results) this.stats!.firstTry.set(r.cardId, true)
    this.stats!.xp += delta
    this.stats!.bestCombo = Math.max(this.stats!.bestCombo, combo)
    const hearts =
      fb.heartLost && this.state.hearts !== null ? this.state.hearts + 1 : this.state.hearts
    this.set({
      feedback: {
        ...fb,
        results,
        verdict: 'correct',
        xp,
        combo,
        overridable: false,
        heartLost: false,
        note: undefined
      },
      combo,
      hearts,
      sessionXp: this.state.sessionXp + delta
    })
    if (delta > 0) await awardXp(delta, clockNow(), this.opts.settings, { combo })
  }

  /** Save the answer and move on. */
  async continue(): Promise<void> {
    const fb = this.state.feedback
    const item = this.state.item
    const lesson = this.lesson
    if (!fb || !item || !lesson || this.state.phase !== 'feedback') return
    this.set({ phase: 'loading' })
    const now = clockNow()
    const perCardMs = (now - item.startedAt) / Math.max(1, fb.results.length)
    for (const r of fb.results) {
      const card = this.cards.get(r.cardId)
      if (!card) continue
      const rating = ratingFor({
        format: item.format,
        verdict: r.verdict,
        responseMs: perCardMs,
        answerChars: card.a.length,
        hintUsed: r.hintUsed,
        selfRating: r.selfRating
      })
      const updated = await recordAnswer({
        card,
        rating,
        format: item.format,
        verdict: r.verdict,
        responseMs: perCardMs,
        mode: this.opts.cram ? 'practice' : this.opts.mode,
        now,
        settings: this.opts.settings
      })
      this.cards.set(updated.id, updated)
      const list = this.byDeck.get(updated.deckId)
      if (list) {
        const i = list.findIndex((c) => c.id === updated.id)
        if (i !== -1) list[i] = updated
      }
    }
    lesson.answer(fb.results.map((r) => ({ cardId: r.cardId, correct: r.verdict !== 'wrong' })))
    if (this.state.hearts === 0) {
      await this.finishLesson(true)
      return
    }
    await this.next()
  }

  private async finishLesson(outOfHearts: boolean): Promise<void> {
    const stats = this.stats!
    const lesson = this.lesson!
    const now = clockNow()
    const ids = [...stats.firstTry.keys()]
    const firstTryCorrect = [...stats.firstTry.values()].filter(Boolean).length
    const missed = ids.filter((id) => lesson.wasMissed(id)).map((id) => this.cards.get(id)!)
    const perfect = !outOfHearts && missed.length === 0 && ids.length > 0
    const achievements = await recordLessonFinished(perfect, now, this.opts.settings)
    const profile = await getProfile()
    const level = levelFromXp(profile.totalXp).level
    if (outOfHearts) {
      // Unanswered cards go back to the front of the queue for next time.
      this.queue = [...lesson.upcoming, ...this.queue]
    }
    this.set({
      phase: 'summary',
      item: undefined,
      feedback: undefined,
      progress: lesson.progress,
      summary: {
        cards: ids.length,
        firstTryCorrect,
        accuracy: ids.length ? firstTryCorrect / ids.length : 0,
        xp: stats.xp,
        bestCombo: stats.bestCombo,
        durationMs: now - stats.startedAt,
        newCards: [...stats.newIds].filter((id) => stats.firstTry.has(id)).length,
        missed,
        perfect,
        level,
        leveledUp: level > stats.startLevel,
        achievements,
        outOfHearts,
        remaining: this.queue.length
      }
    })
  }

  /** Start the next lesson, picking up anything that has come due meanwhile. */
  async keepGoing(): Promise<void> {
    this.set({ phase: 'loading' })
    if (!this.opts.cram) {
      const pool = await cardsForDecks(this.opts.deckIds)
      this.setPool(pool)
      await this.refillQueue()
    }
    await this.startLesson()
  }

  /** From the empty state: allow more new cards today, or practise everything. */
  async extend(kind: 'more-new' | 'cram'): Promise<void> {
    if (kind === 'more-new') this.opts.extraNew = (this.opts.extraNew ?? 0) + 10
    else this.opts.cram = true
    this.set({ phase: 'loading' })
    await this.refillQueue()
    await this.startLesson()
  }
}

import { retrievability, type SchedulerConfig } from './scheduler'
import { MemState, type CardRecord } from './types'
import type { Rng } from './util'

export interface QueueInput {
  /** Cards already in progress whose due time has arrived (learning, relearning, review). */
  due: CardRecord[]
  /** New cards allowed today, in the order they should be introduced. */
  fresh: CardRecord[]
  now: number
  /** Introduce one new card after this many due cards. */
  newEvery?: number
  scheduler?: SchedulerConfig
}

/**
 * Spread cards so the same topic (or deck) rarely appears twice in a row. Interleaving
 * forces the brain to work out which idea applies, which improves discrimination.
 */
export function interleave(cards: CardRecord[], lookahead = 6): CardRecord[] {
  const pending = cards.slice()
  const out: CardRecord[] = []
  const groupOf = (c: CardRecord): string => `${c.deckId}:${c.topic ?? ''}`
  while (pending.length) {
    const prev = out[out.length - 1]
    let idx = 0
    if (prev) {
      const limit = Math.min(lookahead, pending.length)
      const found = pending.slice(0, limit).findIndex((c) => groupOf(c) !== groupOf(prev))
      if (found !== -1) idx = found
    }
    out.push(pending.splice(idx, 1)[0])
  }
  return out
}

/**
 * Order a study session: overdue learning steps first, then reviews most at risk of being
 * forgotten, with new cards mixed in. A card's reverse sibling is held back for another day.
 */
export function planQueue(input: QueueInput): CardRecord[] {
  const { now, scheduler } = input
  const newEvery = input.newEvery ?? 3
  const learning = input.due
    .filter((c) => c.mem.state === MemState.Learning || c.mem.state === MemState.Relearning)
    .sort((a, b) => a.due - b.due)
  const reviews = input.due
    .filter((c) => c.mem.state === MemState.Review)
    .map((c) => ({ c, r: retrievability(c.mem, now, scheduler) }))
    .sort((a, b) => a.r - b.r)
    .map((x) => x.c)

  const seen = new Set<string>()
  const keep = (c: CardRecord): boolean => {
    if (seen.has(c.id) || (c.pairId && seen.has(c.pairId))) return false
    seen.add(c.id)
    return true
  }
  const dueOrdered = [...learning, ...interleave(reviews)].filter(keep)
  const fresh = input.fresh.filter(keep)

  const out: CardRecord[] = []
  let sinceNew = 0
  let fi = 0
  for (const card of dueOrdered) {
    out.push(card)
    sinceNew++
    if (sinceNew >= newEvery && fi < fresh.length) {
      out.push(fresh[fi++])
      sinceNew = 0
    }
  }
  while (fi < fresh.length) out.push(fresh[fi++])
  return out
}

/**
 * One bite-size lesson. Each card must be answered correctly once before the lesson ends;
 * a miss sends it back a few questions later (successive relearning, retrieval to criterion).
 */
export class LessonQueue {
  private queue: string[]
  private readonly total: number
  private readonly completed = new Set<string>()
  private readonly missed = new Set<string>()
  private readonly attempts = new Map<string, number>()

  constructor(
    cardIds: string[],
    private readonly rng: Rng,
    private readonly gap: [number, number] = [3, 5]
  ) {
    this.queue = [...new Set(cardIds)]
    this.total = this.queue.length
  }

  get current(): string | undefined {
    return this.queue[0]
  }

  get upcoming(): readonly string[] {
    return this.queue
  }

  get finished(): boolean {
    return this.queue.length === 0
  }

  get progress(): { done: number; total: number } {
    return { done: this.completed.size, total: this.total }
  }

  /** Has this card been answered before in this lesson? */
  attemptsFor(cardId: string): number {
    return this.attempts.get(cardId) ?? 0
  }

  wasMissed(cardId: string): boolean {
    return this.missed.has(cardId)
  }

  /**
   * Take up to `max` more upcoming cards that satisfy `test`, to share one question
   * (a matching round). They are removed from the queue until answered.
   */
  pullAlong(max: number, test: (cardId: string) => boolean): string[] {
    const taken: string[] = []
    for (let i = 1; i < this.queue.length && taken.length < max; i++) {
      if (test(this.queue[i])) taken.push(this.queue[i])
    }
    this.queue = this.queue.filter((id) => !taken.includes(id))
    return taken
  }

  /** Record results for the current question (one card, or several for a matching round). */
  answer(results: { cardId: string; correct: boolean }[]): void {
    const ids = new Set(results.map((r) => r.cardId))
    this.queue = this.queue.filter((id) => !ids.has(id))
    for (const { cardId, correct } of results) {
      this.attempts.set(cardId, this.attemptsFor(cardId) + 1)
      if (correct) {
        this.completed.add(cardId)
        continue
      }
      this.missed.add(cardId)
      const [lo, hi] = this.gap
      const offset = lo + Math.floor(this.rng() * (hi - lo + 1))
      this.queue.splice(Math.min(offset, this.queue.length), 0, cardId)
    }
  }
}

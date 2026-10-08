import {
  fsrs,
  createEmptyCard,
  type Card as FsrsCard,
  type FSRS,
  type Grade,
  type StepUnit
} from 'ts-fsrs'
import {
  MemState,
  Rating,
  RECOGNITION_FORMATS,
  type Format,
  type Memory,
  type MemStateValue,
  type RatingValue,
  type Verdict
} from './types'

export interface SchedulerConfig {
  /** Target probability of recalling a card when it comes due (FSRS "desired retention"). */
  retention: number
  maxIntervalDays: number
  fuzz: boolean
  learningSteps: StepUnit[]
  relearningSteps: StepUnit[]
}

export const DEFAULT_SCHEDULER: SchedulerConfig = {
  retention: 0.9,
  maxIntervalDays: 3650,
  fuzz: true,
  learningSteps: ['1m', '10m'],
  relearningSteps: ['10m']
}

const cache = new Map<string, FSRS>()

function getFsrs(cfg: SchedulerConfig): FSRS {
  const key = JSON.stringify(cfg)
  let f = cache.get(key)
  if (!f) {
    f = fsrs({
      request_retention: cfg.retention,
      maximum_interval: cfg.maxIntervalDays,
      enable_fuzz: cfg.fuzz,
      enable_short_term: true,
      learning_steps: cfg.learningSteps,
      relearning_steps: cfg.relearningSteps
    })
    cache.set(key, f)
  }
  return f
}

export function toFsrsCard(mem: Memory): FsrsCard {
  return {
    due: new Date(mem.due),
    stability: mem.stability,
    difficulty: mem.difficulty,
    elapsed_days: mem.elapsedDays,
    scheduled_days: mem.scheduledDays,
    learning_steps: mem.learningSteps,
    reps: mem.reps,
    lapses: mem.lapses,
    state: mem.state,
    last_review: mem.lastReview !== undefined ? new Date(mem.lastReview) : undefined
  }
}

export function fromFsrsCard(card: FsrsCard): Memory {
  return {
    due: card.due.getTime(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsedDays: card.elapsed_days,
    scheduledDays: card.scheduled_days,
    learningSteps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state as number as MemStateValue,
    lastReview: card.last_review ? card.last_review.getTime() : undefined
  }
}

export function newMemory(now: number): Memory {
  return fromFsrsCard(createEmptyCard(new Date(now)))
}

export function applyRating(
  mem: Memory,
  rating: RatingValue,
  now: number,
  cfg: SchedulerConfig = DEFAULT_SCHEDULER
): Memory {
  const f = getFsrs(cfg)
  const result = f.next(toFsrsCard(mem), new Date(now), rating as number as Grade)
  return fromFsrsCard(result.card)
}

/** Probability (0-1) that the card is currently remembered. New cards return 0. */
export function retrievability(
  mem: Memory,
  now: number,
  cfg: SchedulerConfig = DEFAULT_SCHEDULER
): number {
  if (mem.state === MemState.New) return 0
  return getFsrs(cfg).get_retrievability(toFsrsCard(mem), new Date(now), false)
}

/** Preview the next interval for each rating, for the flip-card buttons. */
export function previewIntervals(
  mem: Memory,
  now: number,
  cfg: SchedulerConfig = DEFAULT_SCHEDULER
): Record<RatingValue, number> {
  const preview = getFsrs(cfg).repeat(toFsrsCard(mem), new Date(now))
  const out = {} as Record<RatingValue, number>
  for (const r of [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy]) {
    out[r] = preview[r as number as Grade].card.due.getTime() - now
  }
  return out
}

export interface Outcome {
  format: Format
  verdict: Verdict
  responseMs: number
  /** Length of the expected answer in characters, used to scale time thresholds. */
  answerChars: number
  hintUsed?: boolean
  /** Explicit rating from the student (flip and blurt formats). */
  selfRating?: RatingValue
}

/** Seconds of thinking time after which a correct recall is treated as effortful ("Hard"). */
function slowThresholdMs(format: Format, answerChars: number): number {
  const typing = format === 'typed' || format === 'cloze' ? answerChars * 350 : 0
  return 20_000 + typing
}

/** Recall this fast (on a recall format) earns "Easy". */
function fastThresholdMs(format: Format, answerChars: number): number {
  const typing = format === 'typed' || format === 'cloze' ? answerChars * 220 : 0
  return 3_500 + typing
}

/**
 * Turn what happened into an FSRS rating. Auto-graded where possible because
 * students' self-ratings are systematically overconfident.
 */
export function ratingFor(outcome: Outcome): RatingValue {
  if (outcome.selfRating) return outcome.selfRating
  if (outcome.verdict === 'wrong') return Rating.Again
  if (outcome.verdict === 'close' || outcome.hintUsed) return Rating.Hard
  if (outcome.responseMs > slowThresholdMs(outcome.format, outcome.answerChars)) {
    return Rating.Hard
  }
  const recognition = RECOGNITION_FORMATS.includes(outcome.format)
  if (!recognition && outcome.responseMs < fastThresholdMs(outcome.format, outcome.answerChars)) {
    return Rating.Easy
  }
  return Rating.Good
}

/** Rating for blurt (free recall) from the share of key points recalled. */
export function ratingForCoverage(coverage: number): RatingValue {
  if (coverage >= 0.95) return Rating.Easy
  if (coverage >= 0.7) return Rating.Good
  if (coverage >= 0.4) return Rating.Hard
  return Rating.Again
}

/** A card counts as mastered once it is stable for 3+ weeks and still likely remembered. */
export function isMastered(mem: Memory, now: number, cfg?: SchedulerConfig): boolean {
  return (
    mem.state === MemState.Review && mem.stability >= 21 && retrievability(mem, now, cfg) >= 0.9
  )
}

export function formatInterval(ms: number): string {
  const min = ms / 60_000
  if (min < 1) return '<1m'
  if (min < 60) return `${Math.round(min)}m`
  const h = min / 60
  if (h < 24) return `${Math.round(h)}h`
  const d = h / 24
  if (d < 30) return `${Math.round(d)}d`
  const mo = d / 30.4
  if (mo < 12) return `${Math.round(mo)}mo`
  return `${(d / 365).toFixed(1)}y`
}

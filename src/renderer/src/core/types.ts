// Domain types shared by the engine, the database and the UI.

export type CardKind = 'qa' | 'steps' | 'essay'

export type Format = 'mcq' | 'truefalse' | 'match' | 'cloze' | 'typed' | 'order' | 'flip' | 'blurt'

export const RECOGNITION_FORMATS: readonly Format[] = ['mcq', 'truefalse', 'match']

/** FSRS state values, mirroring ts-fsrs `State`. */
export const MemState = { New: 0, Learning: 1, Review: 2, Relearning: 3 } as const
export type MemStateValue = (typeof MemState)[keyof typeof MemState]

/** FSRS ratings, mirroring ts-fsrs `Rating` (Manual excluded). */
export const Rating = { Again: 1, Hard: 2, Good: 3, Easy: 4 } as const
export type RatingValue = (typeof Rating)[keyof typeof Rating]

/** Persisted memory state for one card. Dates are epoch milliseconds. */
export interface Memory {
  due: number
  stability: number
  difficulty: number
  elapsedDays: number
  scheduledDays: number
  learningSteps: number
  reps: number
  lapses: number
  state: MemStateValue
  lastReview?: number
}

/** The learnable content of a card: one question plus optional "ingredients". */
export interface CardContent {
  kind: CardKind
  q: string
  /** Main answer. For steps cards it is the steps joined; for essay cards the points joined. */
  a: string
  answers: string[]
  distractors: string[]
  cloze?: string
  falseStatements: string[]
  explain?: string
  points: string[]
  steps: string[]
  topic?: string
  tags: string[]
}

export interface CardRecord extends CardContent {
  id: string
  deckId: string
  extId?: string
  hash: string
  /** True for the generated "other direction" card of a reverse pair. */
  reversed?: boolean
  pairId?: string
  mem: Memory
  /** Denormalised copy of mem.due so Dexie can index it. */
  due: number
  suspended: 0 | 1
  flagged: 0 | 1
  leech: 0 | 1
  lastFormat?: Format
  createdAt: number
  updatedAt: number
}

export interface Deck {
  id: string
  name: string
  emoji: string
  color: DeckColor
  subject?: string
  level?: string
  description?: string
  /** Overrides the global new-cards-per-day limit when set. */
  newPerDay?: number
  createdAt: number
  updatedAt: number
}

export const DECK_COLORS = [
  'coral',
  'tangerine',
  'sunflower',
  'lime',
  'emerald',
  'teal',
  'sky',
  'cobalt',
  'grape',
  'rose'
] as const
export type DeckColor = (typeof DECK_COLORS)[number]

export type Verdict = 'correct' | 'close' | 'wrong'

export type StudyMode = 'review' | 'learn' | 'practice' | 'test' | 'game'

export interface ReviewRecord {
  id?: number
  cardId: string
  deckId: string
  ts: number
  format: Format
  verdict: Verdict
  rating: RatingValue
  responseMs: number
  stateBefore: MemStateValue
  stabilityAfter: number
  dueAfter: number
  mode: StudyMode
}

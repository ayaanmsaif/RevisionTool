import { daysBetween } from './clock'
import type { Format, Verdict } from './types'

/** Base XP per correct answer. Harder (recall) formats pay more. */
export const XP_BASE: Record<Format, number> = {
  truefalse: 3,
  mcq: 5,
  match: 2,
  cloze: 8,
  typed: 10,
  order: 8,
  flip: 6,
  blurt: 3
}

export const HEARTS_PER_LESSON = 5
export const MAX_FREEZES = 2

export function comboMultiplier(combo: number): number {
  if (combo >= 10) return 3
  if (combo >= 5) return 2
  return 1
}

export interface XpInput {
  format: Format
  verdict: Verdict
  /** Correct answers in a row, including this one. */
  combo: number
  firstTry: boolean
  /** Pairs matched or points recalled, for formats that score per item. */
  units?: number
}

export function xpForAnswer(input: XpInput): number {
  if (input.verdict === 'wrong') return 0
  const units = Math.max(1, input.units ?? 1)
  let xp = XP_BASE[input.format] * units
  if (input.verdict === 'close') xp = Math.ceil(xp / 2)
  xp *= comboMultiplier(input.combo)
  if (input.firstTry && input.verdict === 'correct') xp += 2
  return xp
}

/** XP needed to go from `level` to `level + 1`. */
export function levelCost(level: number): number {
  return 100 + 30 * (level - 1)
}

export function levelFromXp(totalXp: number): { level: number; into: number; needed: number } {
  let level = 1
  let remaining = Math.max(0, totalXp)
  while (remaining >= levelCost(level)) {
    remaining -= levelCost(level)
    level++
  }
  return { level, into: remaining, needed: levelCost(level) }
}

export interface StreakState {
  current: number
  best: number
  lastGoalDay?: string
  freezes: number
}

export const EMPTY_STREAK: StreakState = { current: 0, best: 0, freezes: 0 }

/**
 * Called once when today's XP first reaches the daily goal. Missed days are covered by
 * streak freezes if there are enough; every 7-day milestone earns a freeze (max 2).
 */
export function registerGoalMet(state: StreakState, today: string): StreakState {
  if (state.lastGoalDay === today) return state
  let { current, freezes } = state
  if (!state.lastGoalDay) {
    current = 1
  } else {
    const gap = daysBetween(state.lastGoalDay, today)
    const missed = gap - 1
    if (gap <= 0) return state
    if (missed === 0) current += 1
    else if (missed <= freezes) {
      freezes -= missed
      current += 1
    } else current = 1
  }
  if (current % 7 === 0) freezes = Math.min(MAX_FREEZES, freezes + 1)
  return { current, best: Math.max(state.best, current), lastGoalDay: today, freezes }
}

export interface StreakView {
  count: number
  doneToday: boolean
  /** Goal not met yet today and the streak will break (or burn freezes) at rollover. */
  atRisk: boolean
}

export function viewStreak(state: StreakState, today: string): StreakView {
  if (!state.lastGoalDay) return { count: 0, doneToday: false, atRisk: false }
  const gap = daysBetween(state.lastGoalDay, today)
  if (gap <= 0) return { count: state.current, doneToday: true, atRisk: false }
  if (gap - 1 <= state.freezes) return { count: state.current, doneToday: false, atRisk: true }
  return { count: 0, doneToday: false, atRisk: false }
}

// ---------- achievements ----------

export interface AchievementStats {
  totalXp: number
  bestStreak: number
  decks: number
  cardsImported: number
  reviews: number
  mastered: number
  lessons: number
  perfectLessons: number
  bestCombo: number
  typedCorrect: number
  blurts: number
  nightOwl: boolean
  earlyBird: boolean
  matchBestMs?: number
  blitzBest: number
}

export interface Achievement {
  id: string
  title: string
  description: string
  icon:
    | 'seed'
    | 'stack'
    | 'fire'
    | 'lightning'
    | 'target'
    | 'trophy'
    | 'brain'
    | 'keyboard'
    | 'moon'
    | 'sun'
    | 'star'
    | 'crown'
    | 'timer'
    | 'chat'
  test: (s: AchievementStats) => boolean
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first-deck',
    title: 'First deck',
    description: 'Import your first deck',
    icon: 'seed',
    test: (s) => s.decks >= 1
  },
  {
    id: 'library',
    title: 'Librarian',
    description: 'Have 5 decks',
    icon: 'stack',
    test: (s) => s.decks >= 5
  },
  {
    id: 'big-import',
    title: 'Big brain energy',
    description: 'Import 500 cards',
    icon: 'brain',
    test: (s) => s.cardsImported >= 500
  },
  {
    id: 'first-lesson',
    title: 'Warm up',
    description: 'Finish your first lesson',
    icon: 'target',
    test: (s) => s.lessons >= 1
  },
  {
    id: 'perfect',
    title: 'Flawless',
    description: 'Finish a lesson with no mistakes',
    icon: 'star',
    test: (s) => s.perfectLessons >= 1
  },
  {
    id: 'perfect-10',
    title: 'Precision',
    description: 'Finish 10 flawless lessons',
    icon: 'crown',
    test: (s) => s.perfectLessons >= 10
  },
  {
    id: 'combo-10',
    title: 'On fire',
    description: 'Hit a 10 answer combo',
    icon: 'lightning',
    test: (s) => s.bestCombo >= 10
  },
  {
    id: 'combo-25',
    title: 'Unstoppable',
    description: 'Hit a 25 answer combo',
    icon: 'lightning',
    test: (s) => s.bestCombo >= 25
  },
  {
    id: 'streak-3',
    title: 'Habit forming',
    description: 'Reach a 3 day streak',
    icon: 'fire',
    test: (s) => s.bestStreak >= 3
  },
  {
    id: 'streak-7',
    title: 'One week strong',
    description: 'Reach a 7 day streak',
    icon: 'fire',
    test: (s) => s.bestStreak >= 7
  },
  {
    id: 'streak-30',
    title: 'Monthly machine',
    description: 'Reach a 30 day streak',
    icon: 'trophy',
    test: (s) => s.bestStreak >= 30
  },
  {
    id: 'mastered-50',
    title: 'Locked in',
    description: 'Master 50 cards',
    icon: 'brain',
    test: (s) => s.mastered >= 50
  },
  {
    id: 'mastered-500',
    title: 'Walking textbook',
    description: 'Master 500 cards',
    icon: 'trophy',
    test: (s) => s.mastered >= 500
  },
  {
    id: 'typist',
    title: 'Total recall',
    description: 'Type 100 answers correctly',
    icon: 'keyboard',
    test: (s) => s.typedCorrect >= 100
  },
  {
    id: 'blurter',
    title: 'Brain dump',
    description: 'Complete 10 blurts',
    icon: 'chat',
    test: (s) => s.blurts >= 10
  },
  {
    id: 'night-owl',
    title: 'Night owl',
    description: 'Study after 11pm',
    icon: 'moon',
    test: (s) => s.nightOwl
  },
  {
    id: 'early-bird',
    title: 'Early bird',
    description: 'Study before 7am',
    icon: 'sun',
    test: (s) => s.earlyBird
  },
  {
    id: 'xp-1000',
    title: 'Grinder',
    description: 'Earn 1,000 XP',
    icon: 'star',
    test: (s) => s.totalXp >= 1000
  },
  {
    id: 'xp-10000',
    title: 'Legend',
    description: 'Earn 10,000 XP',
    icon: 'crown',
    test: (s) => s.totalXp >= 10000
  },
  {
    id: 'match-fast',
    title: 'Speed matcher',
    description: 'Clear a Match game in under 20 seconds',
    icon: 'timer',
    test: (s) => (s.matchBestMs ?? Infinity) < 20_000
  },
  {
    id: 'blitz-20',
    title: 'Blitz master',
    description: 'Score 20 in Blitz',
    icon: 'lightning',
    test: (s) => s.blitzBest >= 20
  }
]

export function newlyUnlocked(stats: AchievementStats, unlocked: readonly string[]): Achievement[] {
  return ACHIEVEMENTS.filter((a) => !unlocked.includes(a.id) && a.test(stats))
}

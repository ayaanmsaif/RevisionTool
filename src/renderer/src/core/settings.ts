import { DEFAULT_FORMAT_SETTINGS, type FormatSettings } from './formats'
import { EMPTY_STREAK, type StreakState } from './gamify'
import type { TypoTolerance } from './grading'
import { DEFAULT_PROMPT_OPTIONS, type PromptOptions } from './prompt'
import { DEFAULT_SCHEDULER, type SchedulerConfig } from './scheduler'

export type ThemeSetting = 'system' | 'light' | 'dark'

export interface Settings {
  retention: number
  newPerDay: number
  maxReviewsPerDay: number
  /** Cards per bite-size lesson. */
  lessonSize: number
  formats: FormatSettings
  accentStrict: boolean
  typoTolerance: TypoTolerance
  sound: boolean
  volume: number
  theme: ThemeSetting
  /** Hearts mode: lose a heart per mistake, lesson ends at zero. */
  hardcore: boolean
  /** Daily XP goal that keeps the streak alive. */
  dailyGoal: number
  rolloverHour: number
  inboxEnabled: boolean
  /** Developer time travel, in days. */
  clockOffsetDays: number
}

export const DEFAULT_SETTINGS: Settings = {
  retention: 0.9,
  newPerDay: 20,
  maxReviewsPerDay: 250,
  lessonSize: 12,
  formats: DEFAULT_FORMAT_SETTINGS,
  accentStrict: false,
  typoTolerance: 'normal',
  sound: true,
  volume: 0.6,
  theme: 'system',
  hardcore: false,
  dailyGoal: 50,
  rolloverHour: 4,
  inboxEnabled: true,
  clockOffsetDays: 0
}

export function schedulerConfig(s: Settings): SchedulerConfig {
  return { ...DEFAULT_SCHEDULER, retention: s.retention }
}

export interface ProfileStats {
  lessons: number
  perfectLessons: number
  bestCombo: number
  typedCorrect: number
  blurts: number
  nightOwl: boolean
  earlyBird: boolean
  blitzBest: number
  matchBestMs?: number
  cardsImported: number
}

export interface Profile {
  totalXp: number
  streak: StreakState
  /** XP earned per study day (YYYY-MM-DD). */
  xpByDay: Record<string, number>
  achievements: { id: string; at: number }[]
  stats: ProfileStats
  promptOptions: PromptOptions
  onboarded: boolean
}

export const DEFAULT_PROFILE: Profile = {
  totalXp: 0,
  streak: EMPTY_STREAK,
  xpByDay: {},
  achievements: [],
  stats: {
    lessons: 0,
    perfectLessons: 0,
    bestCombo: 0,
    typedCorrect: 0,
    blurts: 0,
    nightOwl: false,
    earlyBird: false,
    blitzBest: 0,
    cardsImported: 0
  },
  promptOptions: DEFAULT_PROMPT_OPTIONS,
  onboarded: false
}

/** Deep-ish merge so settings saved by older versions pick up new defaults. */
export function withDefaults<T extends object>(defaults: T, saved: Partial<T> | undefined): T {
  if (!saved) return defaults
  const out = { ...defaults } as Record<string, unknown>
  for (const [k, v] of Object.entries(saved)) {
    const d = (defaults as Record<string, unknown>)[k]
    if (v && d && typeof v === 'object' && typeof d === 'object' && !Array.isArray(d)) {
      out[k] = withDefaults(d as object, v as object)
    } else if (v !== undefined) {
      out[k] = v
    }
  }
  return out as T
}

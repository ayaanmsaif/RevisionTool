import { studyDay } from '../core/clock'
import {
  levelFromXp,
  newlyUnlocked,
  registerGoalMet,
  type Achievement,
  type AchievementStats
} from '../core/gamify'
import { isMastered } from '../core/scheduler'
import { schedulerConfig, type Profile, type Settings } from '../core/settings'
import { db } from './db'
import { getProfile, updateProfile } from './repo'

export interface XpResult {
  profile: Profile
  leveledUp: boolean
  level: number
  goalJustMet: boolean
}

export interface XpExtras {
  combo?: number
  typedCorrect?: number
  blurts?: number
}

/** Add XP to today's total, extending the streak when the daily goal is first reached. */
export async function awardXp(
  xp: number,
  now: number,
  settings: Settings,
  extras: XpExtras = {}
): Promise<XpResult> {
  let leveledUp = false
  let goalJustMet = false
  const profile = await updateProfile((p) => {
    const today = studyDay(now, settings.rolloverHour)
    const before = p.xpByDay[today] ?? 0
    const after = before + xp
    goalJustMet = before < settings.dailyGoal && after >= settings.dailyGoal
    leveledUp = levelFromXp(p.totalXp).level < levelFromXp(p.totalXp + xp).level
    const hour = new Date(now).getHours()
    return {
      ...p,
      totalXp: p.totalXp + xp,
      xpByDay: { ...p.xpByDay, [today]: after },
      streak: goalJustMet ? registerGoalMet(p.streak, today) : p.streak,
      stats: {
        ...p.stats,
        bestCombo: Math.max(p.stats.bestCombo, extras.combo ?? 0),
        typedCorrect: p.stats.typedCorrect + (extras.typedCorrect ?? 0),
        blurts: p.stats.blurts + (extras.blurts ?? 0),
        nightOwl: p.stats.nightOwl || hour >= 23 || hour < 4,
        earlyBird: p.stats.earlyBird || (hour >= 4 && hour < 7)
      }
    }
  })
  return { profile, leveledUp, level: levelFromXp(profile.totalXp).level, goalJustMet }
}

export async function achievementStats(
  profile: Profile,
  now: number,
  settings: Settings
): Promise<AchievementStats> {
  const cfg = schedulerConfig(settings)
  const [decks, cards, reviews] = await Promise.all([
    db.decks.count(),
    db.cards.toArray(),
    db.reviews.count()
  ])
  return {
    totalXp: profile.totalXp,
    bestStreak: profile.streak.best,
    decks,
    cardsImported: profile.stats.cardsImported,
    reviews,
    mastered: cards.filter((c) => isMastered(c.mem, now, cfg)).length,
    lessons: profile.stats.lessons,
    perfectLessons: profile.stats.perfectLessons,
    bestCombo: profile.stats.bestCombo,
    typedCorrect: profile.stats.typedCorrect,
    blurts: profile.stats.blurts,
    nightOwl: profile.stats.nightOwl,
    earlyBird: profile.stats.earlyBird,
    matchBestMs: profile.stats.matchBestMs,
    blitzBest: profile.stats.blitzBest
  }
}

/** Unlock any achievements the student now qualifies for. */
export async function checkAchievements(now: number, settings: Settings): Promise<Achievement[]> {
  const profile = await getProfile()
  const stats = await achievementStats(profile, now, settings)
  const unlocked = newlyUnlocked(
    stats,
    profile.achievements.map((a) => a.id)
  )
  if (unlocked.length) {
    await updateProfile((p) => ({
      ...p,
      achievements: [...p.achievements, ...unlocked.map((a) => ({ id: a.id, at: now }))]
    }))
  }
  return unlocked
}

export async function recordLessonFinished(
  perfect: boolean,
  now: number,
  settings: Settings
): Promise<Achievement[]> {
  await updateProfile((p) => ({
    ...p,
    stats: {
      ...p.stats,
      lessons: p.stats.lessons + 1,
      perfectLessons: p.stats.perfectLessons + (perfect ? 1 : 0)
    }
  }))
  return checkAchievements(now, settings)
}

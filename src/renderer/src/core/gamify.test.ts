import { describe, expect, it } from 'vitest'
import { daysBetween, endOfStudyDay, studyDay } from './clock'
import {
  EMPTY_STREAK,
  comboMultiplier,
  levelFromXp,
  newlyUnlocked,
  registerGoalMet,
  viewStreak,
  xpForAnswer,
  type AchievementStats
} from './gamify'

describe('xp', () => {
  it('rewards harder formats, combos and first tries', () => {
    expect(xpForAnswer({ format: 'mcq', verdict: 'correct', combo: 1, firstTry: false })).toBe(5)
    expect(xpForAnswer({ format: 'typed', verdict: 'correct', combo: 1, firstTry: true })).toBe(12)
    expect(xpForAnswer({ format: 'typed', verdict: 'close', combo: 1, firstTry: true })).toBe(5)
    expect(xpForAnswer({ format: 'typed', verdict: 'wrong', combo: 9, firstTry: true })).toBe(0)
    expect(xpForAnswer({ format: 'mcq', verdict: 'correct', combo: 10, firstTry: false })).toBe(15)
    expect(
      xpForAnswer({ format: 'match', verdict: 'correct', combo: 1, firstTry: false, units: 5 })
    ).toBe(10)
  })

  it('multiplies at 5 and 10 in a row', () => {
    expect([1, 4, 5, 9, 10, 30].map(comboMultiplier)).toEqual([1, 1, 2, 2, 3, 3])
  })

  it('computes levels', () => {
    expect(levelFromXp(0)).toEqual({ level: 1, into: 0, needed: 100 })
    expect(levelFromXp(100)).toEqual({ level: 2, into: 0, needed: 130 })
    expect(levelFromXp(250).level).toBe(3)
  })
})

describe('streaks', () => {
  it('counts consecutive days', () => {
    let s = registerGoalMet(EMPTY_STREAK, '2026-10-01')
    s = registerGoalMet(s, '2026-10-02')
    s = registerGoalMet(s, '2026-10-02')
    expect(s.current).toBe(2)
    expect(viewStreak(s, '2026-10-02')).toEqual({ count: 2, doneToday: true, atRisk: false })
    expect(viewStreak(s, '2026-10-03')).toEqual({ count: 2, doneToday: false, atRisk: true })
    expect(viewStreak(s, '2026-10-04').count).toBe(0)
  })

  it('resets after a missed day without freezes', () => {
    let s = registerGoalMet(EMPTY_STREAK, '2026-10-01')
    s = registerGoalMet(s, '2026-10-03')
    expect(s.current).toBe(1)
    expect(s.best).toBe(1)
  })

  it('earns a freeze every 7 days and spends it on a missed day', () => {
    let s = EMPTY_STREAK
    for (let d = 1; d <= 7; d++) s = registerGoalMet(s, `2026-10-0${d}`)
    expect(s.current).toBe(7)
    expect(s.freezes).toBe(1)
    expect(viewStreak(s, '2026-10-09')).toMatchObject({ count: 7, atRisk: true })
    s = registerGoalMet(s, '2026-10-09')
    expect(s.current).toBe(8)
    expect(s.freezes).toBe(0)
  })
})

describe('study days', () => {
  it('rolls over at 4am local time', () => {
    const lateNight = new Date(2026, 9, 8, 2, 30).getTime()
    const morning = new Date(2026, 9, 8, 9, 0).getTime()
    expect(studyDay(lateNight)).toBe('2026-10-07')
    expect(studyDay(morning)).toBe('2026-10-08')
    expect(daysBetween('2026-10-07', '2026-10-08')).toBe(1)
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1)
    expect(new Date(endOfStudyDay(morning)).getHours()).toBe(4)
    expect(endOfStudyDay(morning)).toBeGreaterThan(morning)
  })
})

describe('achievements', () => {
  it('unlocks only new achievements', () => {
    const stats: AchievementStats = {
      totalXp: 1200,
      bestStreak: 3,
      decks: 1,
      cardsImported: 40,
      reviews: 100,
      mastered: 0,
      lessons: 2,
      perfectLessons: 0,
      bestCombo: 4,
      typedCorrect: 0,
      blurts: 0,
      nightOwl: false,
      earlyBird: false,
      blitzBest: 0
    }
    const ids = newlyUnlocked(stats, ['first-deck']).map((a) => a.id)
    expect(ids).toEqual(expect.arrayContaining(['first-lesson', 'streak-3', 'xp-1000']))
    expect(ids).not.toContain('first-deck')
  })
})

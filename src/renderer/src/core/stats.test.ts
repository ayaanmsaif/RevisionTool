import { describe, expect, it } from 'vitest'
import { studyDay } from './clock'
import {
  dueForecast,
  heatLevel,
  lastDays,
  niceTicks,
  reviewsByDay,
  trueRetention,
  weeklyXp
} from './stats'
import { makeCard } from './test-helpers'
import { MemState, Rating, type ReviewRecord } from './types'

const NOW = new Date(2026, 9, 8, 12, 0).getTime() // Thursday
const DAY = 86_400_000

function review(over: Partial<ReviewRecord>): ReviewRecord {
  return {
    cardId: 'c',
    deckId: 'd',
    ts: NOW,
    format: 'typed',
    verdict: 'correct',
    rating: Rating.Good,
    responseMs: 4000,
    stateBefore: MemState.Review,
    stabilityAfter: 10,
    dueAfter: NOW + DAY,
    mode: 'review',
    ...over
  }
}

describe('stats', () => {
  it('counts reviews per day, ignoring games', () => {
    const m = reviewsByDay([
      review({}),
      review({}),
      review({ mode: 'game' }),
      review({ ts: NOW - DAY })
    ])
    expect(m.get(studyDay(NOW))).toBe(2)
    expect(m.get(studyDay(NOW - DAY))).toBe(1)
  })

  it('lists the last n days oldest first', () => {
    const d = lastDays(NOW, 3)
    expect(d).toHaveLength(3)
    expect(d[2]).toBe(studyDay(NOW))
  })

  it('computes true retention from review-state cards only', () => {
    const r = trueRetention(
      [
        review({ rating: Rating.Good }),
        review({ rating: Rating.Again }),
        review({ rating: Rating.Hard }),
        review({ rating: Rating.Again, stateBefore: MemState.New })
      ],
      NOW - DAY
    )
    expect(r.count).toBe(3)
    expect(r.rate).toBeCloseTo(2 / 3)
    expect(trueRetention([], 0).rate).toBeNull()
  })

  it('forecasts due cards, counting overdue as today', () => {
    const cards = [
      makeCard({ mem: { state: MemState.Review, due: NOW - 5 * DAY } }),
      makeCard({ mem: { state: MemState.Review, due: NOW + 2 * DAY } }),
      makeCard({ mem: { state: MemState.New, due: NOW } }),
      makeCard({ mem: { state: MemState.Review, due: NOW + 40 * DAY } })
    ]
    const f = dueForecast(cards, NOW, 30)
    expect(f).toHaveLength(30)
    expect(f[0].count).toBe(1)
    expect(f[2].count).toBe(1)
    expect(f.reduce((n, d) => n + d.count, 0)).toBe(2)
  })

  it('splits XP into this week and last week', () => {
    const xp = { [studyDay(NOW)]: 40, [studyDay(NOW - 7 * DAY)]: 25 }
    const w = weeklyXp(xp, NOW)
    expect(w.thisWeek[3]).toBe(40)
    expect(w.lastWeek[3]).toBe(25)
    expect(w.thisWeek[4]).toBe(0)
  })

  it('makes clean ticks', () => {
    expect(niceTicks(37)).toEqual([0, 20, 40])
    expect(niceTicks(0)).toEqual([0, 1])
    expect(niceTicks(100)).toEqual([0, 50, 100])
  })

  it('buckets heat levels', () => {
    expect([0, 1, 5, 7, 10].map((c) => heatLevel(c, 10))).toEqual([0, 1, 2, 3, 4])
  })
})

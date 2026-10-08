import { describe, expect, it } from 'vitest'
import {
  applyRating,
  formatInterval,
  isMastered,
  newMemory,
  previewIntervals,
  ratingFor,
  ratingForCoverage,
  retrievability
} from './scheduler'
import { MemState, Rating } from './types'

const NOW = 1_700_000_000_000
const DAY = 86_400_000

describe('FSRS wrapper', () => {
  it('starts new cards in the New state, due now', () => {
    const m = newMemory(NOW)
    expect(m.state).toBe(MemState.New)
    expect(m.due).toBe(NOW)
    expect(retrievability(m, NOW)).toBe(0)
  })

  it('moves through learning steps into review', () => {
    let m = newMemory(NOW)
    m = applyRating(m, Rating.Again, NOW)
    expect(m.state).toBe(MemState.Learning)
    expect(m.learningSteps).toBe(0)
    expect(m.due - NOW).toBeLessThanOrEqual(60_000)

    m = applyRating(m, Rating.Good, NOW + 60_000)
    expect(m.state).toBe(MemState.Learning)
    expect(m.learningSteps).toBe(1)

    m = applyRating(m, Rating.Good, NOW + 11 * 60_000)
    expect(m.state).toBe(MemState.Review)
    expect(m.due).toBeGreaterThan(NOW + DAY / 2)
  })

  it('grows intervals with successful reviews and shrinks after a lapse', () => {
    let m = applyRating(newMemory(NOW), Rating.Easy, NOW)
    expect(m.state).toBe(MemState.Review)
    const first = m.scheduledDays
    let t = m.due
    m = applyRating(m, Rating.Good, t)
    expect(m.scheduledDays).toBeGreaterThan(first)
    t = m.due
    const before = m.stability
    m = applyRating(m, Rating.Again, t)
    expect(m.state).toBe(MemState.Relearning)
    expect(m.lapses).toBe(1)
    expect(m.stability).toBeLessThan(before)
  })

  it('reports falling retrievability over time', () => {
    const m = applyRating(newMemory(NOW), Rating.Easy, NOW)
    expect(retrievability(m, NOW + DAY)).toBeGreaterThan(retrievability(m, NOW + 30 * DAY))
  })

  it('previews an interval for each rating', () => {
    const p = previewIntervals(newMemory(NOW), NOW)
    expect(p[Rating.Again]).toBeLessThan(p[Rating.Easy])
  })

  it('recognises mastered cards', () => {
    let m = applyRating(newMemory(NOW), Rating.Easy, NOW)
    let t = NOW
    for (let i = 0; i < 4; i++) {
      t = m.due
      m = applyRating(m, Rating.Good, t)
    }
    expect(m.stability).toBeGreaterThan(21)
    expect(isMastered(m, t)).toBe(true)
  })
})

describe('ratingFor', () => {
  const base = { answerChars: 10, responseMs: 6000 }
  it('maps wrong to Again and close to Hard', () => {
    expect(ratingFor({ ...base, format: 'typed', verdict: 'wrong' })).toBe(Rating.Again)
    expect(ratingFor({ ...base, format: 'typed', verdict: 'close' })).toBe(Rating.Hard)
    expect(ratingFor({ ...base, format: 'typed', verdict: 'correct', hintUsed: true })).toBe(
      Rating.Hard
    )
  })

  it('gives Good for a normal correct answer and Hard for a very slow one', () => {
    expect(ratingFor({ ...base, format: 'typed', verdict: 'correct' })).toBe(Rating.Good)
    expect(ratingFor({ ...base, format: 'typed', verdict: 'correct', responseMs: 60_000 })).toBe(
      Rating.Hard
    )
  })

  it('only gives Easy for fast recall, never for recognition', () => {
    expect(ratingFor({ ...base, format: 'typed', verdict: 'correct', responseMs: 2000 })).toBe(
      Rating.Easy
    )
    expect(ratingFor({ ...base, format: 'mcq', verdict: 'correct', responseMs: 1000 })).toBe(
      Rating.Good
    )
  })

  it('uses self ratings when given', () => {
    expect(
      ratingFor({ ...base, format: 'flip', verdict: 'correct', selfRating: Rating.Hard })
    ).toBe(Rating.Hard)
  })

  it('maps blurt coverage to ratings', () => {
    expect(ratingForCoverage(1)).toBe(Rating.Easy)
    expect(ratingForCoverage(0.75)).toBe(Rating.Good)
    expect(ratingForCoverage(0.5)).toBe(Rating.Hard)
    expect(ratingForCoverage(0.2)).toBe(Rating.Again)
  })
})

describe('formatInterval', () => {
  it('formats durations compactly', () => {
    expect(formatInterval(30_000)).toBe('<1m')
    expect(formatInterval(10 * 60_000)).toBe('10m')
    expect(formatInterval(3 * DAY)).toBe('3d')
    expect(formatInterval(400 * DAY)).toBe('1.1y')
  })
})

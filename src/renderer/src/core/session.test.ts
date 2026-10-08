import { describe, expect, it } from 'vitest'
import { applyRating } from './scheduler'
import { LessonQueue, interleave, planQueue } from './session'
import { makeCard } from './test-helpers'
import { MemState, Rating } from './types'
import { seededRng } from './util'

const NOW = 1_700_000_000_000

describe('interleave', () => {
  it('avoids the same topic back to back when possible', () => {
    const cards = ['A', 'A', 'A', 'B', 'B', 'C'].map((topic) => makeCard({ topic }))
    const out = interleave(cards).map((c) => c.topic)
    for (let i = 1; i < out.length - 1; i++) expect(out[i]).not.toBe(out[i - 1])
  })
})

describe('planQueue', () => {
  it('puts learning first, then most-forgotten reviews, mixing in new cards', () => {
    const learning = makeCard({ id: 'learn', mem: { state: MemState.Learning, due: NOW - 1000 } })
    const strongMem = applyRating(
      applyRating(makeCard().mem, Rating.Easy, NOW - 40 * 86_400_000),
      Rating.Good,
      NOW - 20 * 86_400_000
    )
    const weakMem = applyRating(makeCard().mem, Rating.Good, NOW - 30 * 86_400_000)
    const strong = makeCard({ id: 'strong', topic: 'x', mem: strongMem })
    const weak = makeCard({ id: 'weak', topic: 'y', mem: { ...weakMem, state: MemState.Review } })
    const fresh = [makeCard({ id: 'new1' }), makeCard({ id: 'new2' })]
    const q = planQueue({ due: [strong, weak, learning], fresh, now: NOW, newEvery: 2 }).map(
      (c) => c.id
    )
    expect(q[0]).toBe('learn')
    expect(q.indexOf('weak')).toBeLessThan(q.indexOf('strong'))
    expect(q).toContain('new1')
    expect(q.indexOf('new1')).toBe(2)
    expect(q).toHaveLength(5)
  })

  it('holds back reverse siblings', () => {
    const fwd = makeCard({ id: 'fwd', pairId: 'back' })
    const back = makeCard({ id: 'back', pairId: 'fwd', reversed: true })
    const q = planQueue({ due: [], fresh: [fwd, back], now: NOW })
    expect(q.map((c) => c.id)).toEqual(['fwd'])
  })
})

describe('LessonQueue', () => {
  it('re-asks missed cards until they are answered correctly', () => {
    const lesson = new LessonQueue(['a', 'b', 'c', 'd', 'e'], seededRng(3), [3, 3])
    expect(lesson.current).toBe('a')
    lesson.answer([{ cardId: 'a', correct: false }])
    expect(lesson.upcoming).toEqual(['b', 'c', 'd', 'a', 'e'])
    expect(lesson.progress).toEqual({ done: 0, total: 5 })
    for (const id of ['b', 'c', 'd']) lesson.answer([{ cardId: id, correct: true }])
    expect(lesson.current).toBe('a')
    expect(lesson.attemptsFor('a')).toBe(1)
    lesson.answer([{ cardId: 'a', correct: true }])
    lesson.answer([{ cardId: 'e', correct: true }])
    expect(lesson.finished).toBe(true)
    expect(lesson.progress).toEqual({ done: 5, total: 5 })
    expect(lesson.wasMissed('a')).toBe(true)
  })

  it('re-asks immediately when the missed card is the last one', () => {
    const lesson = new LessonQueue(['a'], seededRng(1))
    lesson.answer([{ cardId: 'a', correct: false }])
    expect(lesson.current).toBe('a')
    expect(lesson.finished).toBe(false)
  })

  it('pulls cards along for a matching round', () => {
    const lesson = new LessonQueue(['a', 'b', 'c', 'd', 'e'], seededRng(1))
    const extra = lesson.pullAlong(3, (id) => id !== 'c')
    expect(extra).toEqual(['b', 'd', 'e'])
    expect(lesson.upcoming).toEqual(['a', 'c'])
    lesson.answer([
      { cardId: 'a', correct: true },
      { cardId: 'b', correct: true },
      { cardId: 'd', correct: false },
      { cardId: 'e', correct: true }
    ])
    expect(lesson.upcoming).toEqual(['c', 'd'])
  })
})

import { describe, expect, it } from 'vitest'
import { makeCard } from '../core/test-helpers'
import { seededRng } from '../core/util'
import { pickMatchSet } from './pool'

describe('pickMatchSet', () => {
  it('never puts two cards with the same answer in one grid', () => {
    const cards = [
      makeCard({ q: 'Capital of France', a: 'Paris' }),
      makeCard({ q: 'City of light', a: 'paris' }),
      makeCard({ q: 'Capital of Spain', a: 'Madrid' }),
      makeCard({ q: 'Capital of Italy', a: 'Rome' }),
      makeCard({ q: 'A very long question '.repeat(10), a: 'Too long to match' })
    ]
    for (let seed = 1; seed < 20; seed++) {
      const set = pickMatchSet(cards, 6, seededRng(seed))
      expect(set).toHaveLength(3)
      expect(new Set(set.map((c) => c.a.toLowerCase())).size).toBe(3)
    }
  })
})

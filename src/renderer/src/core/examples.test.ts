import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, expect, it } from 'vitest'
import { parseImport } from './parse'

describe('examples/sample-deck.json', () => {
  it('imports cleanly and exercises every card kind', () => {
    const text = readFileSync(resolve(__dirname, '../../../../examples/sample-deck.json'), 'utf8')
    const r = parseImport(text)
    expect(r.errors).toEqual([])
    expect(r.decks).toHaveLength(1)
    const deck = r.decks[0]
    expect(deck.warnings).toEqual([])
    expect(new Set(deck.cards.map((c) => c.kind))).toEqual(new Set(['qa', 'steps', 'essay']))
    expect(deck.cards.find((c) => c.extId === 'c9')?.a).toBe('$M = \\frac{I}{A}$')
  })
})

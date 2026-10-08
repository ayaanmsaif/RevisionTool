import { describe, expect, it } from 'vitest'
import { defaultColor, defaultEmoji, planImport } from './importer'
import { parseImport } from './parse'
import { applyRating } from './scheduler'
import { MemState, Rating, type CardRecord } from './types'

const NOW = 1_700_000_000_000

function parsedDeck(
  cards: object[],
  name = 'Biology'
): ReturnType<typeof parseImport>['decks'][number] {
  return parseImport(JSON.stringify({ deck: { name }, cards })).decks[0]
}

describe('planImport', () => {
  it('creates a new deck with new cards', () => {
    const plan = planImport(
      parsedDeck([
        { q: 'Q1', a: 'A1' },
        { q: 'Q2', a: 'A2' }
      ]),
      { cards: [] },
      NOW
    )
    expect(plan.isNewDeck).toBe(true)
    expect(plan.deck.name).toBe('Biology')
    expect(plan.deck.emoji).toBe('🧬')
    expect(plan.add).toHaveLength(2)
    expect(plan.add[0]).toMatchObject({ deckId: plan.deck.id, suspended: 0, due: NOW })
    expect(plan.add[0].mem.state).toBe(MemState.New)
  })

  it('updates changed cards in place and keeps their memory', () => {
    const first = planImport(
      parsedDeck([
        { id: 'c1', q: 'Q1', a: 'A1' },
        { q: 'Q2', a: 'A2' }
      ]),
      { cards: [] },
      NOW
    )
    const studied: CardRecord[] = first.add.map((c) => {
      const mem = applyRating(c.mem, Rating.Good, NOW)
      return { ...c, mem, due: mem.due }
    })
    const second = planImport(
      parsedDeck([
        { id: 'c1', q: 'Q1 reworded', a: 'A1' },
        { q: 'Q2', a: 'A2 improved' },
        { q: 'Q3', a: 'A3' }
      ]),
      { deck: first.deck, cards: studied },
      NOW + 1000
    )
    expect(second.isNewDeck).toBe(false)
    expect(second.add.map((c) => c.q)).toEqual(['Q3'])
    expect(second.update).toHaveLength(2)
    const byId = new Map(second.update.map((c) => [c.id, c]))
    for (const old of studied) {
      expect(byId.get(old.id)?.mem).toEqual(old.mem)
    }
    expect(second.unchanged).toBe(0)
  })

  it('does not duplicate identical cards on re-import', () => {
    const deck = parsedDeck([{ q: 'Q1', a: 'A1' }])
    const first = planImport(deck, { cards: [] }, NOW)
    const again = planImport(deck, { deck: first.deck, cards: first.add }, NOW)
    expect(again.add).toHaveLength(0)
    expect(again.update).toHaveLength(0)
    expect(again.unchanged).toBe(1)
  })

  it('creates linked reverse cards for vocabulary', () => {
    const plan = planImport(
      parsedDeck([{ q: 'le chat', a: 'the cat', reverse: true }], 'French'),
      { cards: [] },
      NOW
    )
    expect(plan.add).toHaveLength(2)
    const [fwd, back] = plan.add
    expect(back).toMatchObject({ q: 'the cat', a: 'le chat', reversed: true })
    expect(fwd.pairId).toBe(back.id)
    expect(back.pairId).toBe(fwd.id)

    const again = planImport(
      parsedDeck([{ q: 'le chat', a: 'the cat', reverse: true }], 'French'),
      { deck: plan.deck, cards: plan.add },
      NOW
    )
    expect(again.add).toHaveLength(0)
    expect(again.update).toHaveLength(0)
    expect(again.unchanged).toBe(2)
  })
})

describe('card order', () => {
  it('keeps the deck order for new cards', () => {
    const cards = Array.from({ length: 30 }, (_, i) => ({ q: `Q${i}`, a: `A${i}` }))
    const plan = planImport(parsedDeck(cards), { cards: [] }, NOW)
    const sorted = [...plan.add].sort((a, b) => a.createdAt - b.createdAt).map((c) => c.q)
    expect(sorted).toEqual(cards.map((c) => c.q))
  })
})

describe('deck defaults', () => {
  it('picks a subject emoji and a stable colour', () => {
    expect(defaultEmoji('Organic Chemistry')).toBe('⚗️')
    expect(defaultEmoji('Random stuff')).toBe('📚')
    expect(defaultColor('Physics')).toBe(defaultColor('physics'))
  })
})

import { describe, expect, it } from 'vitest'
import { deckToJson, fileSafe, isBackupFile } from './exporter'
import { planImport } from './importer'
import { parseImport } from './parse'

const NOW = 1_700_000_000_000

describe('deckToJson', () => {
  it('round-trips through the importer without losing content', () => {
    const source = JSON.stringify({
      deck: { name: 'French', emoji: '🗣️', subject: 'French' },
      cards: [
        {
          id: 'v1',
          q: 'le chat',
          a: 'the cat',
          reverse: true,
          distractors: ['the dog'],
          explain: 'Masculine'
        },
        { id: 's1', kind: 'steps', q: 'Order', steps: ['a', 'b', 'c'] },
        { id: 'e1', kind: 'essay', q: 'Discuss', points: ['x', 'y'] }
      ]
    })
    const parsed = parseImport(source).decks[0]
    const plan = planImport(parsed, { cards: [] }, NOW)
    const exported = deckToJson(plan.deck, plan.add)
    const reparsed = parseImport(JSON.stringify(exported)).decks[0]
    expect(reparsed.cards).toEqual(parsed.cards)
    expect(reparsed.deck).toMatchObject({ name: 'French', emoji: '🗣️', subject: 'French' })
  })
})

describe('helpers', () => {
  it('recognises backup files', () => {
    expect(
      isBackupFile({ format: 'revisiontool-backup', decks: [], cards: [], reviews: [], kv: [] })
    ).toBe(true)
    expect(isBackupFile({ format: 'revisiontool', cards: [] })).toBe(false)
  })

  it('makes safe file names', () => {
    expect(fileSafe('Cell Biology: Starter!')).toBe('cell-biology-starter')
    expect(fileSafe('???')).toBe('deck')
  })
})

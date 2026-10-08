import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { parseImport } from '../core/parse'
import { DEFAULT_SETTINGS } from '../core/settings'
import { MemState, Rating } from '../core/types'
import { db } from './db'
import {
  buildStudyQueue,
  deckSummaries,
  deleteDeck,
  getProfile,
  getSettings,
  importDeck,
  recordAnswer,
  saveSettings
} from './repo'

const NOW = new Date(2026, 9, 8, 12, 0).getTime()

function deckOf(n: number, name = 'Chemistry'): ReturnType<typeof parseImport>['decks'][number] {
  const cards = Array.from({ length: n }, (_, i) => ({ id: `c${i}`, q: `Q${i}`, a: `A${i}` }))
  return parseImport(JSON.stringify({ deck: { name }, cards })).decks[0]
}

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('settings and profile', () => {
  it('returns defaults and saves patches', async () => {
    expect((await getSettings()).newPerDay).toBe(DEFAULT_SETTINGS.newPerDay)
    await saveSettings({ newPerDay: 5 })
    const s = await getSettings()
    expect(s.newPerDay).toBe(5)
    expect(s.formats.enabled.mcq).toBe(true)
  })
})

describe('importDeck', () => {
  it('stores a new deck and merges re-imports by name', async () => {
    const first = await importDeck(deckOf(3), NOW)
    expect(first).toMatchObject({ isNewDeck: true, added: 3 })
    const second = await importDeck(deckOf(5, 'chemistry'), NOW)
    expect(second).toMatchObject({ isNewDeck: false, deckId: first.deckId, added: 2, unchanged: 3 })
    expect(await db.cards.count()).toBe(5)
    expect((await getProfile()).stats.cardsImported).toBe(5)
  })
})

describe('study queue', () => {
  it('limits new cards per day and counts what was already introduced', async () => {
    await saveSettings({ newPerDay: 4 })
    const settings = await getSettings()
    await importDeck(deckOf(10), NOW)
    const queue = await buildStudyQueue({ now: NOW, settings })
    expect(queue).toHaveLength(4)

    for (const card of queue.slice(0, 2)) {
      await recordAnswer({
        card,
        rating: Rating.Good,
        format: 'mcq',
        verdict: 'correct',
        responseMs: 3000,
        mode: 'review',
        now: NOW,
        settings
      })
    }
    const later = await buildStudyQueue({ now: NOW + 60_000, settings })
    expect(later.filter((c) => c.mem.state === MemState.New)).toHaveLength(2)
    // The two answered cards are in learning and due within the learn-ahead window.
    expect(later.filter((c) => c.mem.state === MemState.Learning)).toHaveLength(2)

    const more = await buildStudyQueue({ now: NOW + 60_000, settings, extraNew: 5 })
    expect(more.filter((c) => c.mem.state === MemState.New).length).toBeGreaterThan(2)
  })

  it('records answers, updates memory and flags leeches', async () => {
    const settings = await getSettings()
    await importDeck(deckOf(1), NOW)
    let [card] = await buildStudyQueue({ now: NOW, settings })
    let t = NOW
    card = await recordAnswer({
      card,
      rating: Rating.Easy,
      format: 'mcq',
      verdict: 'correct',
      responseMs: 2000,
      mode: 'review',
      now: t,
      settings
    })
    expect(card.mem.state).toBe(MemState.Review)
    for (let i = 0; i < 6; i++) {
      t = card.due + 1000
      card = await recordAnswer({
        card,
        rating: Rating.Again,
        format: 'typed',
        verdict: 'wrong',
        responseMs: 5000,
        mode: 'review',
        now: t,
        settings
      })
      t += 15 * 60_000
      card = await recordAnswer({
        card,
        rating: Rating.Good,
        format: 'typed',
        verdict: 'correct',
        responseMs: 5000,
        mode: 'review',
        now: t,
        settings
      })
    }
    expect(card.mem.lapses).toBe(6)
    expect(card.leech).toBe(1)
    expect(await db.reviews.count()).toBe(13)
  })

  it('summarises decks', async () => {
    const settings = await getSettings()
    await importDeck(deckOf(3), NOW)
    const [s] = await deckSummaries(NOW, settings)
    expect(s).toMatchObject({ total: 3, fresh: 3, due: 0, mastered: 0 })
  })
})

describe('deleteDeck', () => {
  it('removes the deck, its cards and its reviews', async () => {
    const settings = await getSettings()
    const { deckId } = await importDeck(deckOf(2), NOW)
    const [card] = await buildStudyQueue({ now: NOW, settings })
    await recordAnswer({
      card,
      rating: Rating.Good,
      format: 'mcq',
      verdict: 'correct',
      responseMs: 1000,
      mode: 'review',
      now: NOW,
      settings
    })
    await deleteDeck(deckId)
    expect(await db.decks.count()).toBe(0)
    expect(await db.cards.count()).toBe(0)
    expect(await db.reviews.count()).toBe(0)
  })
})

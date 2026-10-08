import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { parseImport } from '../core/parse'
import { DEFAULT_SETTINGS, type Settings } from '../core/settings'
import { MemState } from '../core/types'
import { seededRng } from '../core/util'
import { db } from '../db/db'
import { getProfile, importDeck } from '../db/repo'
import { StudyController, type ResultIn } from './controller'

const settings: Settings = { ...DEFAULT_SETTINGS, lessonSize: 3, newPerDay: 5 }

async function seed(n: number): Promise<string> {
  const cards = Array.from({ length: n }, (_, i) => ({
    id: `c${i}`,
    q: `Question ${i}?`,
    a: `Answer ${i}`,
    distractors: [`Wrong ${i}a`, `Wrong ${i}b`, `Wrong ${i}c`]
  }))
  const parsed = parseImport(JSON.stringify({ deck: { name: 'Test' }, cards })).decks[0]
  return (await importDeck(parsed, Date.now())).deckId
}

function allResults(c: StudyController, verdict: ResultIn['verdict']): ResultIn[] {
  return c.getState().item!.cards.map((card) => ({ cardId: card.id, verdict }))
}

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('StudyController', () => {
  it('runs a perfect lesson and awards XP', async () => {
    const deckId = await seed(5)
    const c = new StudyController({
      mode: 'review',
      deckIds: [deckId],
      settings,
      rng: seededRng(1)
    })
    await c.start()
    expect(c.getState().phase).toBe('question')
    expect(c.getState().progress.total).toBe(3)
    let guard = 0
    while (c.getState().phase !== 'summary' && guard++ < 20) {
      await c.answer(allResults(c, 'correct'))
      expect(c.getState().phase).toBe('feedback')
      await c.continue()
    }
    const summary = c.getState().summary!
    expect(summary.cards).toBe(3)
    expect(summary.accuracy).toBe(1)
    expect(summary.perfect).toBe(true)
    expect(summary.xp).toBeGreaterThan(0)
    expect((await getProfile()).totalXp).toBe(summary.xp)
    const learned = await db.cards.where('deckId').equals(deckId).toArray()
    expect(learned.filter((x) => x.mem.state !== MemState.New)).toHaveLength(3)
  })

  it('brings missed cards back until they are right', async () => {
    const deckId = await seed(3)
    const c = new StudyController({
      mode: 'review',
      deckIds: [deckId],
      settings,
      rng: seededRng(2)
    })
    await c.start()
    const firstIds = c.getState().item!.cards.map((x) => x.id)
    await c.answer(allResults(c, 'wrong'))
    expect(c.getState().feedback?.verdict).toBe('wrong')
    expect(c.getState().combo).toBe(0)
    await c.continue()
    const seen: string[] = []
    let guard = 0
    while (c.getState().phase !== 'summary' && guard++ < 20) {
      seen.push(...c.getState().item!.cards.map((x) => x.id))
      await c.answer(allResults(c, 'correct'))
      await c.continue()
    }
    expect(seen).toEqual(expect.arrayContaining(firstIds))
    const summary = c.getState().summary!
    expect(summary.perfect).toBe(false)
    expect(summary.missed.map((m) => m.id).sort()).toEqual([...firstIds].sort())
    expect(summary.accuracy).toBeCloseTo((3 - firstIds.length) / 3)
  })

  it('ends the lesson when hearts run out in hardcore mode', async () => {
    const deckId = await seed(4)
    const c = new StudyController({
      mode: 'review',
      deckIds: [deckId],
      settings: { ...settings, hardcore: true, lessonSize: 4 },
      rng: seededRng(3)
    })
    await c.start()
    expect(c.getState().hearts).toBe(5)
    let guard = 0
    while (c.getState().phase !== 'summary' && guard++ < 30) {
      await c.answer(allResults(c, 'wrong'))
      await c.continue()
    }
    expect(c.getState().hearts).toBe(0)
    expect(c.getState().summary?.outOfHearts).toBe(true)
  })

  it('lets a rejected typed answer be overridden', async () => {
    const deckId = await seed(1)
    const c = new StudyController({
      mode: 'review',
      deckIds: [deckId],
      settings,
      rng: seededRng(4)
    })
    await c.start()
    // Force the typed format for this check.
    const state = c.getState()
    ;(state.item as { format: string }).format = 'typed'
    await c.answer(allResults(c, 'wrong'))
    expect(c.getState().feedback?.overridable).toBe(true)
    await c.override()
    expect(c.getState().feedback?.verdict).toBe('correct')
    expect(c.getState().combo).toBe(1)
    await c.continue()
    expect(c.getState().phase).toBe('summary')
  })

  it('reports an empty state with options when nothing is due', async () => {
    const deckId = await seed(2)
    const c = new StudyController({
      mode: 'review',
      deckIds: [deckId],
      settings: { ...settings, newPerDay: 0 },
      rng: seededRng(5)
    })
    await c.start()
    expect(c.getState().phase).toBe('empty')
    expect(c.getState().newWaiting).toBe(2)
    await c.extend('more-new')
    expect(c.getState().phase).toBe('question')
  })
})

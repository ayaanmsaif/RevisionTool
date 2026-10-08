import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { parseImport } from '../core/parse'
import { db } from './db'
import { exportAll, restoreAll } from './backup'
import { importDeck, saveSettings } from './repo'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('backup', () => {
  it('exports and restores everything', async () => {
    const parsed = parseImport(JSON.stringify({ deck: 'D', cards: [{ q: 'Q', a: 'A' }] })).decks[0]
    await importDeck(parsed, 1000)
    await saveSettings({ newPerDay: 7 })
    const file = JSON.parse(JSON.stringify(await exportAll(2000)))

    await db.cards.clear()
    await db.decks.clear()
    const r = await restoreAll(file)
    expect(r).toEqual({ decks: 1, cards: 1 })
    expect(await db.cards.count()).toBe(1)
    expect((await db.kv.get('settings'))?.value).toMatchObject({ newPerDay: 7 })
  })

  it('refuses files that are not backups', async () => {
    await expect(restoreAll({ format: 'revisiontool', cards: [] })).rejects.toThrow(
      /not a RevisionTool backup/
    )
  })
})

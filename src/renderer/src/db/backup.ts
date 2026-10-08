import { studyDay } from '../core/clock'
import { isBackupFile, type BackupFile } from '../core/exporter'
import { db } from './db'

export async function exportAll(now: number): Promise<BackupFile> {
  const [decks, cards, reviews, kv] = await Promise.all([
    db.decks.toArray(),
    db.cards.toArray(),
    db.reviews.toArray(),
    db.kv.toArray()
  ])
  return {
    format: 'revisiontool-backup',
    version: 1,
    exportedAt: now,
    decks,
    cards,
    reviews,
    kv: kv.filter((row) => row.key !== 'lastBackupDay')
  }
}

/** Replace everything with the contents of a backup file. */
export async function restoreAll(file: unknown): Promise<{ decks: number; cards: number }> {
  if (!isBackupFile(file)) throw new Error('This is not a RevisionTool backup file.')
  await db.transaction('rw', db.decks, db.cards, db.reviews, db.kv, async () => {
    await Promise.all([db.decks.clear(), db.cards.clear(), db.reviews.clear(), db.kv.clear()])
    await db.decks.bulkPut(file.decks)
    await db.cards.bulkPut(file.cards)
    await db.reviews.bulkPut(file.reviews)
    await db.kv.bulkPut(file.kv)
  })
  return { decks: file.decks.length, cards: file.cards.length }
}

export function backupName(now: number): string {
  return `revisiontool-backup-${studyDay(now, 0)}.json`
}

/** Write one automatic backup per day (the main process keeps the latest 10). */
export async function maybeDailyBackup(now: number): Promise<string | null> {
  if (!window.api?.writeBackup) return null
  const today = studyDay(now, 0)
  const last = (await db.kv.get('lastBackupDay'))?.value
  if (last === today || (await db.decks.count()) === 0) return null
  const file = await exportAll(now)
  const path = await window.api.writeBackup(backupName(now), JSON.stringify(file))
  await db.kv.put({ key: 'lastBackupDay', value: today })
  return path
}

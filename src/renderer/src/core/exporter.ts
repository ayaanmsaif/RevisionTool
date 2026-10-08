import type { CardRecord, Deck, ReviewRecord } from './types'

/** A deck in the public import format, ready to share or re-import. */
export function deckToJson(deck: Deck, cards: CardRecord[]): object {
  const forward = cards.filter((c) => !c.reversed)
  return {
    format: 'revisiontool',
    version: 1,
    deck: {
      name: deck.name,
      emoji: deck.emoji,
      color: deck.color,
      subject: deck.subject,
      level: deck.level,
      description: deck.description
    },
    cards: forward.map((c) => {
      const base: Record<string, unknown> = {
        id: c.extId ?? c.id.slice(0, 8),
        topic: c.topic,
        q: c.q
      }
      if (c.kind === 'steps')
        return { ...base, kind: 'steps', steps: c.steps, explain: c.explain, tags: c.tags }
      if (c.kind === 'essay')
        return { ...base, kind: 'essay', points: c.points, explain: c.explain, tags: c.tags }
      return {
        ...base,
        a: c.a,
        answers: c.answers,
        distractors: c.distractors,
        cloze: c.cloze,
        false: c.falseStatements,
        explain: c.explain,
        tags: c.tags,
        reverse: c.pairId ? true : undefined
      }
    })
  }
}

export interface BackupFile {
  format: 'revisiontool-backup'
  version: 1
  exportedAt: number
  decks: Deck[]
  cards: CardRecord[]
  reviews: ReviewRecord[]
  kv: { key: string; value: unknown }[]
}

export function isBackupFile(value: unknown): value is BackupFile {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Partial<BackupFile>
  return (
    v.format === 'revisiontool-backup' &&
    Array.isArray(v.decks) &&
    Array.isArray(v.cards) &&
    Array.isArray(v.reviews) &&
    Array.isArray(v.kv)
  )
}

/** Safe file name from a deck name. */
export function fileSafe(name: string): string {
  return (
    name
      .normalize('NFKD')
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .toLowerCase() || 'deck'
  )
}

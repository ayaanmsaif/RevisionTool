import Dexie, { type EntityTable } from 'dexie'
import type { CardRecord, Deck, ReviewRecord } from '../core/types'

export interface KvRow {
  key: string
  value: unknown
}

export class RevisionDb extends Dexie {
  decks!: EntityTable<Deck, 'id'>
  cards!: EntityTable<CardRecord, 'id'>
  reviews!: EntityTable<ReviewRecord, 'id'>
  kv!: EntityTable<KvRow, 'key'>

  constructor(name = 'revisiontool') {
    super(name)
    this.version(1).stores({
      decks: 'id, name, updatedAt',
      cards: 'id, deckId, due, hash, extId, topic, *tags, pairId, leech, [deckId+due]',
      reviews: '++id, cardId, deckId, ts, [deckId+ts]',
      kv: 'key'
    })
  }
}

export const db = new RevisionDb()

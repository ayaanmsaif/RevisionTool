import { newMemory } from './scheduler'
import type { CardRecord, Memory } from './types'

let n = 0

/** Build a card record for tests with sensible defaults. */
export function makeCard(
  over: Omit<Partial<CardRecord>, 'mem'> & { mem?: Partial<Memory> } = {}
): CardRecord {
  const now = 1_700_000_000_000
  const id = over.id ?? `card-${++n}`
  const mem = { ...newMemory(now), ...over.mem }
  return {
    kind: 'qa',
    q: `Question ${id}`,
    a: `Answer ${id}`,
    answers: [],
    distractors: [],
    falseStatements: [],
    points: [],
    steps: [],
    tags: [],
    deckId: 'deck-1',
    hash: id,
    suspended: 0,
    flagged: 0,
    leech: 0,
    createdAt: now,
    updatedAt: now,
    ...over,
    id,
    mem,
    due: mem.due
  }
}

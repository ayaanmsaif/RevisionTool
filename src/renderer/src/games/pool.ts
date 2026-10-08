import { useLiveQuery } from 'dexie-react-hooks'
import { normalise } from '../core/grading'
import { isMatchable } from '../core/questions'
import type { CardRecord, Deck } from '../core/types'
import { shuffle, type Rng } from '../core/util'
import { db } from '../db/db'

export interface GamePool {
  decks: Deck[]
  cards: CardRecord[]
}

/** Cards available to games: question-and-answer cards that are not suspended. */
export function useGamePool(deckIds: string[] | undefined): GamePool | undefined {
  const key = deckIds?.join(',') ?? 'all'
  return useLiveQuery(async () => {
    const decks = await db.decks.toArray()
    const cards = deckIds?.length
      ? await db.cards.where('deckId').anyOf(deckIds).toArray()
      : await db.cards.toArray()
    return { decks, cards: cards.filter((c) => !c.suspended && c.kind === 'qa') }
  }, [key])
}

/** Pick cards for a matching grid: short, with distinct questions and answers. */
export function pickMatchSet(cards: CardRecord[], n: number, rng: Rng = Math.random): CardRecord[] {
  const seenQ = new Set<string>()
  const seenA = new Set<string>()
  const out: CardRecord[] = []
  for (const c of shuffle(cards.filter(isMatchable), rng)) {
    const q = normalise(c.q)
    const a = normalise(c.a)
    if (seenQ.has(q) || seenA.has(a) || seenQ.has(a) || seenA.has(q)) continue
    seenQ.add(q)
    seenA.add(a)
    out.push(c)
    if (out.length === n) break
  }
  return out
}

export function deckParam(ids: string[] | undefined): string {
  return ids?.length ? `?decks=${ids.join(',')}` : ''
}

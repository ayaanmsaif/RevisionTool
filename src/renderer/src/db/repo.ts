import { startOfStudyDay } from '../core/clock'
import { planImport } from '../core/importer'
import { applyRating, isMastered, retrievability } from '../core/scheduler'
import type { ParsedDeck } from '../core/schema'
import { planQueue } from '../core/session'
import {
  DEFAULT_PROFILE,
  DEFAULT_SETTINGS,
  schedulerConfig,
  withDefaults,
  type Profile,
  type Settings
} from '../core/settings'
import {
  MemState,
  type CardRecord,
  type Deck,
  type Format,
  type RatingValue,
  type ReviewRecord,
  type StudyMode,
  type Verdict
} from '../core/types'
import { db } from './db'

export const LEECH_LAPSES = 6
/** Learning cards due within this window are pulled into the current session. */
export const LEARN_AHEAD_MS = 20 * 60_000

// ---------- settings & profile ----------

export async function getSettings(): Promise<Settings> {
  const row = await db.kv.get('settings')
  return withDefaults(DEFAULT_SETTINGS, row?.value as Partial<Settings> | undefined)
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  return db.transaction('rw', db.kv, async () => {
    const next = { ...(await getSettings()), ...patch }
    await db.kv.put({ key: 'settings', value: next })
    return next
  })
}

export async function getProfile(): Promise<Profile> {
  const row = await db.kv.get('profile')
  return withDefaults(DEFAULT_PROFILE, row?.value as Partial<Profile> | undefined)
}

export async function updateProfile(fn: (p: Profile) => Profile): Promise<Profile> {
  return db.transaction('rw', db.kv, async () => {
    const next = fn(await getProfile())
    await db.kv.put({ key: 'profile', value: next })
    return next
  })
}

// ---------- decks ----------

export async function findDeckByName(name: string): Promise<Deck | undefined> {
  const key = name.trim().toLowerCase()
  return (await db.decks.toArray()).find((d) => d.name.trim().toLowerCase() === key)
}

export interface ImportSummary {
  deckId: string
  deckName: string
  isNewDeck: boolean
  added: number
  updated: number
  unchanged: number
}

export async function importDeck(parsed: ParsedDeck, now: number): Promise<ImportSummary> {
  return db.transaction('rw', db.decks, db.cards, db.kv, async () => {
    const existing = await findDeckByName(parsed.deck.name)
    const cards = existing ? await db.cards.where('deckId').equals(existing.id).toArray() : []
    const plan = planImport(parsed, { deck: existing, cards }, now)
    await db.decks.put(plan.deck)
    if (plan.add.length) await db.cards.bulkAdd(plan.add)
    if (plan.update.length) await db.cards.bulkPut(plan.update)
    await updateProfile((p) => ({
      ...p,
      stats: { ...p.stats, cardsImported: p.stats.cardsImported + plan.add.length }
    }))
    return {
      deckId: plan.deck.id,
      deckName: plan.deck.name,
      isNewDeck: plan.isNewDeck,
      added: plan.add.length,
      updated: plan.update.length,
      unchanged: plan.unchanged
    }
  })
}

export async function updateDeck(id: string, patch: Partial<Deck>): Promise<void> {
  await db.decks.update(id, { ...patch, updatedAt: Date.now() })
}

export async function deleteDeck(id: string): Promise<void> {
  await db.transaction('rw', db.decks, db.cards, db.reviews, async () => {
    await db.cards.where('deckId').equals(id).delete()
    await db.reviews.where('deckId').equals(id).delete()
    await db.decks.delete(id)
  })
}

export interface DeckSummary {
  deck: Deck
  total: number
  fresh: number
  due: number
  learning: number
  mastered: number
  suspended: number
  topics: string[]
}

export function summarise(
  deck: Deck,
  cards: CardRecord[],
  now: number,
  settings: Settings
): DeckSummary {
  const cfg = schedulerConfig(settings)
  const s: DeckSummary = {
    deck,
    total: cards.length,
    fresh: 0,
    due: 0,
    learning: 0,
    mastered: 0,
    suspended: 0,
    topics: []
  }
  const topics = new Set<string>()
  for (const c of cards) {
    if (c.topic) topics.add(c.topic)
    if (c.suspended) {
      s.suspended++
      continue
    }
    if (c.mem.state === MemState.New) s.fresh++
    else if (c.due <= now + (c.mem.state === MemState.Review ? 0 : LEARN_AHEAD_MS)) s.due++
    if (c.mem.state === MemState.Learning || c.mem.state === MemState.Relearning) s.learning++
    if (isMastered(c.mem, now, cfg)) s.mastered++
  }
  s.topics = [...topics]
  return s
}

export async function deckSummaries(now: number, settings: Settings): Promise<DeckSummary[]> {
  const [decks, cards] = await Promise.all([db.decks.toArray(), db.cards.toArray()])
  const byDeck = new Map<string, CardRecord[]>()
  for (const c of cards) {
    const list = byDeck.get(c.deckId)
    if (list) list.push(c)
    else byDeck.set(c.deckId, [c])
  }
  return decks
    .map((d) => summarise(d, byDeck.get(d.id) ?? [], now, settings))
    .sort((a, b) => b.deck.updatedAt - a.deck.updatedAt)
}

// ---------- study queue ----------

export interface QueueOptions {
  deckIds?: string[]
  now: number
  settings: Settings
  /** Extra new cards beyond today's limit ("learn more"). */
  extraNew?: number
  /** Only new cards (deck "Learn" button). */
  newOnly?: boolean
  topic?: string
}

async function todaysCounts(
  now: number,
  rolloverHour: number
): Promise<{ newByDeck: Map<string, number>; newTotal: number; reviews: number }> {
  const since = startOfStudyDay(now, rolloverHour)
  const rows = await db.reviews.where('ts').aboveOrEqual(since).toArray()
  const newByDeck = new Map<string, number>()
  const seenNew = new Set<string>()
  let reviews = 0
  for (const r of rows) {
    if (r.mode === 'game') continue
    if (r.stateBefore === MemState.New && !seenNew.has(r.cardId)) {
      seenNew.add(r.cardId)
      newByDeck.set(r.deckId, (newByDeck.get(r.deckId) ?? 0) + 1)
    } else if (r.stateBefore === MemState.Review) reviews++
  }
  return { newByDeck, newTotal: seenNew.size, reviews }
}

export async function cardsForDecks(deckIds?: string[]): Promise<CardRecord[]> {
  if (!deckIds) return db.cards.toArray()
  return db.cards.where('deckId').anyOf(deckIds).toArray()
}

/** Build today's study queue: due cards first (capped), new cards within the daily limit. */
export async function buildStudyQueue(opts: QueueOptions): Promise<CardRecord[]> {
  const { now, settings } = opts
  const [cards, decks, today] = await Promise.all([
    cardsForDecks(opts.deckIds),
    db.decks.toArray(),
    todaysCounts(now, settings.rolloverHour)
  ])
  const usable = cards.filter((c) => !c.suspended && (!opts.topic || c.topic === opts.topic))

  const due = opts.newOnly
    ? []
    : usable
        .filter((c) => c.mem.state !== MemState.New)
        .filter((c) => c.due <= now + (c.mem.state === MemState.Review ? 0 : LEARN_AHEAD_MS))
  // Learning steps that are due now go first; ones due within the learn-ahead window
  // only fill in after everything else, so a just-answered card is not asked again at once.
  const learning = due.filter((c) => c.mem.state !== MemState.Review && c.due <= now)
  const ahead = due
    .filter((c) => c.mem.state !== MemState.Review && c.due > now)
    .sort((a, b) => a.due - b.due)
  const reviewCap = Math.max(0, settings.maxReviewsPerDay - today.reviews)
  const cfg = schedulerConfig(settings)
  const reviews = due
    .filter((c) => c.mem.state === MemState.Review)
    .sort((a, b) => retrievability(a.mem, now, cfg) - retrievability(b.mem, now, cfg))
    .slice(0, reviewCap)

  const deckLimit = new Map(decks.map((d) => [d.id, d.newPerDay ?? settings.newPerDay]))
  const globalLeft = Math.max(0, settings.newPerDay - today.newTotal) + (opts.extraNew ?? 0)
  const fresh: CardRecord[] = []
  const takenPerDeck = new Map<string, number>()
  const newCards = usable
    .filter((c) => c.mem.state === MemState.New)
    .sort((a, b) => a.createdAt - b.createdAt)
  for (const c of newCards) {
    if (fresh.length >= globalLeft) break
    const used = (today.newByDeck.get(c.deckId) ?? 0) + (takenPerDeck.get(c.deckId) ?? 0)
    const limit = (deckLimit.get(c.deckId) ?? settings.newPerDay) + (opts.extraNew ?? 0)
    if (used >= limit) continue
    takenPerDeck.set(c.deckId, (takenPerDeck.get(c.deckId) ?? 0) + 1)
    fresh.push(c)
  }

  const planned = planQueue({ due: [...learning, ...reviews], fresh, now, scheduler: cfg })
  const inPlan = new Set(planned.map((c) => c.id))
  return [...planned, ...ahead.filter((c) => !inPlan.has(c.id))]
}

// ---------- answering ----------

export interface AnswerInput {
  card: CardRecord
  rating: RatingValue
  format: Format
  verdict: Verdict
  responseMs: number
  mode: StudyMode
  now: number
  settings: Settings
}

/** Apply an answer to a card's memory and log it. Returns the updated card. */
export async function recordAnswer(input: AnswerInput): Promise<CardRecord> {
  const { card, now } = input
  const mem = applyRating(card.mem, input.rating, now, schedulerConfig(input.settings))
  const updated: CardRecord = {
    ...card,
    mem,
    due: mem.due,
    lastFormat: input.format,
    leech: mem.lapses >= LEECH_LAPSES ? 1 : card.leech,
    updatedAt: now
  }
  const review: ReviewRecord = {
    cardId: card.id,
    deckId: card.deckId,
    ts: now,
    format: input.format,
    verdict: input.verdict,
    rating: input.rating,
    responseMs: Math.round(input.responseMs),
    stateBefore: card.mem.state,
    stabilityAfter: mem.stability,
    dueAfter: mem.due,
    mode: input.mode
  }
  await db.transaction('rw', db.cards, db.reviews, async () => {
    await db.cards.put(updated)
    await db.reviews.add(review)
  })
  return updated
}

/** Log a game answer without touching the schedule. */
export async function recordGameAnswer(
  card: CardRecord,
  format: Format,
  verdict: Verdict,
  responseMs: number,
  now: number
): Promise<void> {
  await db.reviews.add({
    cardId: card.id,
    deckId: card.deckId,
    ts: now,
    format,
    verdict,
    rating: verdict === 'wrong' ? 1 : 3,
    responseMs: Math.round(responseMs),
    stateBefore: card.mem.state,
    stabilityAfter: card.mem.stability,
    dueAfter: card.due,
    mode: 'game'
  })
}

export async function updateCard(id: string, patch: Partial<CardRecord>): Promise<void> {
  await db.cards.update(id, { ...patch, updatedAt: Date.now() })
}

export async function deleteCards(ids: string[]): Promise<void> {
  await db.transaction('rw', db.cards, db.reviews, async () => {
    await db.cards.bulkDelete(ids)
    await db.reviews.where('cardId').anyOf(ids).delete()
  })
}

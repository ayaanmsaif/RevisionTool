import { normalise } from './grading'
import { newMemory } from './scheduler'
import type { ImportCard, ParsedDeck } from './schema'
import { DECK_COLORS, type CardContent, type CardRecord, type Deck, type DeckColor } from './types'
import { hashString, uid } from './util'

const SUBJECT_EMOJI: [RegExp, string][] = [
  [/bio|cell|genetic|ecolog|anatom/i, '🧬'],
  [/chem/i, '⚗️'],
  [/physic|mechanic|electric/i, '⚛️'],
  [/math|calculus|algebra|statistic|geometry/i, '📐'],
  [/history|war|revolution/i, '🏛️'],
  [/geog|climate|earth/i, '🌍'],
  [/english|literature|poetry|novel|shakespeare/i, '📖'],
  [/french|spanish|german|italian|language|vocab|latin|mandarin|japanese/i, '🗣️'],
  [/computer|programming|coding|software|algorithm/i, '💻'],
  [/econ|business|finance|account/i, '📈'],
  [/psych|neuro|brain/i, '🧠'],
  [/medic|pharma|nursing|clinical|patholog/i, '🩺'],
  [/law|legal/i, '⚖️'],
  [/art|design/i, '🎨'],
  [/music/i, '🎵'],
  [/philosoph|ethic|religio|theolog/i, '💭']
]

export function defaultEmoji(name: string, subject?: string): string {
  const text = `${subject ?? ''} ${name}`
  return SUBJECT_EMOJI.find(([re]) => re.test(text))?.[1] ?? '📚'
}

export function defaultColor(name: string): DeckColor {
  const h = parseInt(hashString(name.toLowerCase()).slice(-6), 16)
  return DECK_COLORS[h % DECK_COLORS.length]
}

export function cardHash(kind: string, q: string, reversed = false): string {
  return (reversed ? 'r:' : '') + hashString(`${kind}|${normalise(q, true)}`)
}

function contentOf(c: ImportCard): CardContent {
  return {
    kind: c.kind,
    q: c.q,
    a: c.a,
    answers: c.answers,
    distractors: c.distractors,
    cloze: c.cloze,
    falseStatements: c.falseStatements,
    explain: c.explain,
    points: c.points,
    steps: c.steps,
    topic: c.topic,
    tags: c.tags
  }
}

function reverseContent(c: ImportCard): CardContent {
  return {
    kind: 'qa',
    q: c.a,
    a: c.q,
    answers: [],
    distractors: [],
    cloze: undefined,
    falseStatements: [],
    explain: c.explain,
    points: [],
    steps: [],
    topic: c.topic,
    tags: c.tags
  }
}

const CONTENT_KEYS: (keyof CardContent)[] = [
  'kind',
  'q',
  'a',
  'answers',
  'distractors',
  'cloze',
  'falseStatements',
  'explain',
  'points',
  'steps',
  'topic',
  'tags'
]

function sameContent(a: CardContent, b: CardContent): boolean {
  return CONTENT_KEYS.every((k) => JSON.stringify(a[k] ?? null) === JSON.stringify(b[k] ?? null))
}

export interface ImportPlan {
  deck: Deck
  isNewDeck: boolean
  add: CardRecord[]
  update: CardRecord[]
  unchanged: number
}

/**
 * Work out how an imported deck merges into what is already stored. Cards are matched by
 * their import id, then by question text, so re-importing an improved deck updates cards
 * in place and keeps their review history.
 */
export function planImport(
  parsed: ParsedDeck,
  existing: { deck?: Deck; cards: CardRecord[] },
  now: number
): ImportPlan {
  const meta = parsed.deck
  const deck: Deck = existing.deck
    ? {
        ...existing.deck,
        emoji: meta.emoji ?? existing.deck.emoji,
        color: meta.color ?? existing.deck.color,
        subject: meta.subject ?? existing.deck.subject,
        level: meta.level ?? existing.deck.level,
        description: meta.description ?? existing.deck.description,
        updatedAt: now
      }
    : {
        id: uid(),
        name: meta.name,
        emoji: meta.emoji ?? defaultEmoji(meta.name, meta.subject),
        color: meta.color ?? defaultColor(meta.name),
        subject: meta.subject,
        level: meta.level,
        description: meta.description,
        createdAt: now,
        updatedAt: now
      }

  const byExt = new Map<string, CardRecord>()
  const byHash = new Map<string, CardRecord>()
  for (const c of existing.cards) {
    if (c.extId) byExt.set((c.reversed ? 'r:' : '') + c.extId, c)
    byHash.set(c.hash, c)
  }

  const add: CardRecord[] = []
  const update: CardRecord[] = []
  let unchanged = 0
  const claimed = new Set<string>()

  const upsert = (
    content: CardContent,
    extId: string | undefined,
    reversed: boolean
  ): CardRecord => {
    const hash = cardHash(content.kind, content.q, reversed)
    const match =
      (extId && byExt.get((reversed ? 'r:' : '') + extId)) || byHash.get(hash) || undefined
    if (match && !claimed.has(match.id)) {
      claimed.add(match.id)
      if (sameContent(match, content)) {
        unchanged++
        return match
      }
      const updated: CardRecord = {
        ...match,
        ...content,
        extId: extId ?? match.extId,
        hash,
        updatedAt: now
      }
      update.push(updated)
      return updated
    }
    const mem = newMemory(now)
    const created: CardRecord = {
      ...content,
      id: uid(),
      deckId: deck.id,
      extId,
      hash,
      reversed: reversed || undefined,
      mem,
      due: mem.due,
      suspended: 0,
      flagged: 0,
      leech: 0,
      createdAt: now,
      updatedAt: now
    }
    add.push(created)
    claimed.add(created.id)
    return created
  }

  /** Point a card at its sibling, cloning stored records rather than mutating them. */
  const setPair = (self: CardRecord, otherId: string): void => {
    if (self.pairId === otherId) return
    if (add.includes(self) || update.includes(self)) {
      self.pairId = otherId
      return
    }
    unchanged--
    update.push({ ...self, pairId: otherId, updatedAt: now })
  }

  for (const card of parsed.cards) {
    const forward = upsert(contentOf(card), card.extId, false)
    if (card.reverse && card.kind === 'qa') {
      const back = upsert(reverseContent(card), card.extId, true)
      setPair(forward, back.id)
      setPair(back, forward.id)
    }
  }

  return { deck, isNewDeck: !existing.deck, add, update, unchanged }
}

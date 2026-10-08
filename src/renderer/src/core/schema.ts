import { z } from 'zod'
import { DECK_COLORS, type CardKind, type DeckColor } from './types'
import { normalise } from './grading'

/** A card as read from an import file, before it becomes a database record. */
export interface ImportCard {
  extId?: string
  kind: CardKind
  q: string
  a: string
  answers: string[]
  distractors: string[]
  cloze?: string
  falseStatements: string[]
  explain?: string
  points: string[]
  steps: string[]
  topic?: string
  tags: string[]
  reverse: boolean
}

export interface ImportDeckMeta {
  name: string
  emoji?: string
  color?: DeckColor
  subject?: string
  level?: string
  description?: string
}

export interface ParsedDeck {
  deck: ImportDeckMeta
  cards: ImportCard[]
  /** Non-fatal problems: cards that were skipped or fixed up. */
  warnings: string[]
}

type Raw = Record<string, unknown>

const isObj = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v)

function str(v: unknown): string | undefined {
  if (typeof v === 'string') return v.trim() || undefined
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  return undefined
}

function strList(v: unknown): string[] {
  if (v === undefined || v === null) return []
  const arr = Array.isArray(v) ? v : [v]
  return arr
    .map((x) => (isObj(x) ? str(x.text ?? x.value) : str(x)))
    .filter((x): x is string => !!x)
}

/** First defined value among several alias keys (case-insensitive). */
function field(raw: Raw, ...keys: string[]): unknown {
  const lower = new Map(Object.keys(raw).map((k) => [k.toLowerCase().replace(/[\s_-]/g, ''), k]))
  for (const key of keys) {
    const real = lower.get(key.toLowerCase().replace(/[\s_-]/g, ''))
    if (real !== undefined && raw[real] !== undefined && raw[real] !== null) return raw[real]
  }
  return undefined
}

/** Accept "{{c1::term}}", "[[term]]" and plain sentences that contain the answer. */
export function normaliseCloze(cloze: string | undefined, answer: string): string | undefined {
  if (!cloze) return undefined
  let c = cloze
    .replace(/\{\{c\d+::([^}]*?)(?:::[^}]*)?\}\}/g, '{{$1}}')
    .replace(/\[\[([^\]]+)\]\]/g, '{{$1}}')
  if (!/\{\{[^}]+\}\}/.test(c)) {
    if (!answer) return undefined
    const idx = c.toLowerCase().indexOf(answer.toLowerCase())
    if (idx === -1) return undefined
    c =
      c.slice(0, idx) +
      '{{' +
      c.slice(idx, idx + answer.length) +
      '}}' +
      c.slice(idx + answer.length)
  }
  return c
}

const cardSchema = z.object({
  kind: z.enum(['qa', 'steps', 'essay']),
  q: z.string().min(1, 'missing a question ("q")'),
  a: z.string().min(1, 'missing an answer ("a")'),
  steps: z.array(z.string()),
  points: z.array(z.string())
})

function inferKind(raw: Raw, hasAnswer: boolean): CardKind {
  const k = str(field(raw, 'kind', 'type', 'cardType'))?.toLowerCase()
  if (k) {
    if (/step|sequence|order|process|timeline/.test(k)) return 'steps'
    if (/essay|long|blurt|points|extended/.test(k)) return 'essay'
    return 'qa'
  }
  if (!hasAnswer && strList(field(raw, 'steps', 'sequence', 'order')).length > 1) return 'steps'
  if (!hasAnswer && strList(field(raw, 'points', 'keyPoints')).length > 1) return 'essay'
  return 'qa'
}

/** Map one raw card object onto the canonical shape, or explain why it can't be used. */
export function readCard(raw: unknown, label: string): { card?: ImportCard; problem?: string } {
  if (!isObj(raw)) {
    if (Array.isArray(raw) && raw.length >= 2) {
      return readCard({ q: raw[0], a: raw[1], explain: raw[2] }, label)
    }
    return { problem: `${label}: not a card object` }
  }
  const q = str(field(raw, 'q', 'question', 'front', 'term', 'prompt')) ?? ''
  let a = str(field(raw, 'a', 'answer', 'back', 'definition', 'correct', 'correctAnswer')) ?? ''
  const kind = inferKind(raw, !!a)
  const steps = kind === 'steps' ? strList(field(raw, 'steps', 'sequence', 'order', 'items')) : []
  const points = kind === 'essay' ? strList(field(raw, 'points', 'keyPoints', 'markScheme')) : []
  if (kind === 'steps' && !a) a = steps.join(' → ')
  if (kind === 'essay' && !a) a = points.join('; ')

  const parsed = cardSchema.safeParse({ kind, q, a, steps, points })
  if (!parsed.success) {
    return { problem: `${label}: ${parsed.error.issues[0].message}` }
  }
  if (kind === 'steps' && steps.length < 2)
    return { problem: `${label}: a steps card needs at least 2 steps` }
  if (kind === 'essay' && points.length < 2)
    return { problem: `${label}: an essay card needs at least 2 points` }

  const answerNorm = normalise(a)
  let distractors = strList(
    field(
      raw,
      'distractors',
      'wrong',
      'wrongAnswers',
      'incorrect',
      'incorrectAnswers',
      'options',
      'choices'
    )
  )
  distractors = [...new Map(distractors.map((d) => [normalise(d), d])).entries()]
    .filter(([n]) => n && n !== answerNorm)
    .map(([, d]) => d)
    .slice(0, 6)

  const answers = strList(
    field(raw, 'answers', 'accept', 'accepted', 'alternatives', 'alt', 'aliases', 'synonyms')
  )
  const rawTags = field(raw, 'tags', 'tag')
  const tags =
    typeof rawTags === 'string'
      ? rawTags
          .split(/[,;]/)
          .map((t) => t.trim())
          .filter(Boolean)
      : strList(rawTags)

  const card: ImportCard = {
    extId: str(field(raw, 'id', 'uid', 'key')),
    kind,
    q,
    a,
    answers,
    distractors,
    cloze:
      kind === 'qa'
        ? normaliseCloze(str(field(raw, 'cloze', 'fill', 'fillInTheBlank', 'blank', 'gap')), a)
        : undefined,
    falseStatements: strList(
      field(raw, 'false', 'falseStatements', 'falsehoods', 'falseStatement', 'misconceptions')
    ),
    explain: str(field(raw, 'explain', 'explanation', 'why', 'notes', 'extra', 'context')),
    points,
    steps,
    topic: str(field(raw, 'topic', 'section', 'category', 'chapter', 'subtopic')),
    tags,
    reverse: field(raw, 'reverse', 'bidirectional', 'bothWays', 'reversible') === true
  }
  return { card }
}

function readDeckMeta(raw: unknown, fallbackName: string): ImportDeckMeta {
  if (typeof raw === 'string' && raw.trim()) return { name: raw.trim() }
  if (!isObj(raw)) return { name: fallbackName }
  const color = str(field(raw, 'color', 'colour'))?.toLowerCase()
  const emoji = str(field(raw, 'emoji', 'icon'))
  return {
    name: str(field(raw, 'name', 'title', 'deck', 'deckName')) ?? fallbackName,
    emoji: emoji && [...emoji].length <= 4 ? emoji : undefined,
    color: (DECK_COLORS as readonly string[]).includes(color ?? '')
      ? (color as DeckColor)
      : undefined,
    subject: str(field(raw, 'subject', 'course')),
    level: str(field(raw, 'level', 'grade', 'stage')),
    description: str(field(raw, 'description', 'summary'))
  }
}

function readCards(rawCards: unknown[], warnings: string[], offset = 0): ImportCard[] {
  const out: ImportCard[] = []
  rawCards.forEach((raw, i) => {
    const { card, problem } = readCard(raw, `Card ${offset + i + 1}`)
    if (card) out.push(card)
    else if (problem) warnings.push(problem)
  })
  return out
}

/**
 * Turn any parsed JSON value into decks. Accepts the documented format plus the common
 * shapes chatbots drift into (bare arrays, deck name as a string, nested cards, several decks).
 */
export function readImportJson(value: unknown, fallbackName: string): ParsedDeck[] {
  if (Array.isArray(value)) {
    if (value.length && value.every((v) => isObj(v) && Array.isArray(field(v, 'cards')))) {
      return value.flatMap((v) => readImportJson(v, fallbackName))
    }
    const warnings: string[] = []
    return [{ deck: { name: fallbackName }, cards: readCards(value, warnings), warnings }]
  }
  if (!isObj(value)) return []
  const decks = field(value, 'decks')
  if (Array.isArray(decks)) return decks.flatMap((d) => readImportJson(d, fallbackName))

  const deckField = field(value, 'deck')
  let rawCards = field(value, 'cards', 'flashcards', 'questions', 'items')
  if (!Array.isArray(rawCards) && isObj(deckField))
    rawCards = field(deckField, 'cards', 'flashcards')
  const meta = readDeckMeta(deckField ?? value, fallbackName)
  if (!deckField && !field(value, 'name', 'title')) meta.name = fallbackName
  if (!Array.isArray(rawCards)) {
    // A single card on its own.
    if (field(value, 'q', 'question', 'front')) {
      const warnings: string[] = []
      return [{ deck: meta, cards: readCards([value], warnings), warnings }]
    }
    return []
  }
  const warnings: string[] = []
  return [{ deck: meta, cards: readCards(rawCards, warnings), warnings }]
}

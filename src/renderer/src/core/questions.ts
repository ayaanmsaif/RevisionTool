import { normalise } from './grading'
import type { CardRecord, Format } from './types'
import { shuffle, type Rng } from './util'

export type ClozePart = { text: string } | { blank: number }

export type Question =
  | { type: 'mcq'; cardId: string; prompt: string; options: string[]; correctIndex: number }
  | {
      type: 'truefalse'
      cardId: string
      /** Present in "pair" mode: the question, with `statement` as a proposed answer. */
      prompt?: string
      statement: string
      isTrue: boolean
      /** What is actually true, shown after answering. */
      correction: string
    }
  | { type: 'cloze'; cardId: string; parts: ClozePart[]; blanks: string[][] }
  | { type: 'typed'; cardId: string; prompt: string; accepted: string[] }
  | { type: 'flip'; cardId: string; prompt: string; answer: string }
  | { type: 'order'; cardId: string; prompt: string; items: { key: number; text: string }[] }
  | { type: 'blurt'; cardId: string; prompt: string; points: string[] }
  | { type: 'match'; cardIds: string[]; pairs: { cardId: string; left: string; right: string }[] }

export const FORMAT_LABEL: Record<Format, string> = {
  mcq: 'Multiple choice',
  truefalse: 'True or false',
  match: 'Match up',
  cloze: 'Fill the gap',
  typed: 'Type it',
  order: 'Put in order',
  flip: 'Recall',
  blurt: 'Blurt it out'
}

const isNumeric = (s: string): boolean => /^[-+]?\d/.test(s.trim())

/** The answer a peer card offers as a wrong option, respecting reverse direction. */
function peerAnswer(card: CardRecord, peer: CardRecord): string {
  return !!peer.reversed === !!card.reversed ? peer.a : peer.q
}

/**
 * Plausible wrong options: the card's own distractors first, then answers from other
 * cards, preferring the same topic, similar length and the same kind (number vs words).
 */
export function pickDistractors(
  card: CardRecord,
  pool: CardRecord[],
  count: number,
  rng: Rng
): string[] {
  const taken = new Set([card.a, ...card.answers].map((s) => normalise(s)))
  const out: string[] = []
  for (const d of shuffle(card.distractors, rng)) {
    const n = normalise(d)
    if (!n || taken.has(n)) continue
    taken.add(n)
    out.push(d)
    if (out.length === count) return out
  }
  const scored = pool
    .filter((p) => p.id !== card.id && p.id !== card.pairId && p.kind === 'qa')
    .map((p) => {
      const text = peerAnswer(card, p)
      const lenRatio =
        Math.min(text.length, card.a.length) / Math.max(text.length, card.a.length, 1)
      let score = rng() * 0.75 + lenRatio
      if (p.topic && p.topic === card.topic) score += 1.5
      if (isNumeric(text) === isNumeric(card.a)) score += 1
      return { text, score }
    })
    .sort((x, y) => y.score - x.score)
  for (const { text } of scored) {
    const n = normalise(text)
    if (!n || taken.has(n)) continue
    taken.add(n)
    out.push(text)
    if (out.length === count) break
  }
  return out
}

export function parseCloze(cloze: string): { parts: ClozePart[]; blanks: string[][] } {
  const parts: ClozePart[] = []
  const blanks: string[][] = []
  const re = /\{\{([^}]+)\}\}/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(cloze))) {
    if (m.index > last) parts.push({ text: cloze.slice(last, m.index) })
    blanks.push(
      m[1]
        .split('|')
        .map((s) => s.trim())
        .filter(Boolean)
    )
    parts.push({ blank: blanks.length - 1 })
    last = m.index + m[0].length
  }
  if (last < cloze.length) parts.push({ text: cloze.slice(last) })
  return { parts, blanks }
}

export function fillCloze(cloze: string): string {
  return cloze.replace(/\{\{([^}|]+)(?:\|[^}]*)?\}\}/g, '$1')
}

export function buildQuestion(
  card: CardRecord,
  format: Format,
  pool: CardRecord[],
  rng: Rng
): Question {
  switch (format) {
    case 'mcq': {
      const wrong = pickDistractors(card, pool, 3, rng)
      const options = shuffle([card.a, ...wrong], rng)
      return {
        type: 'mcq',
        cardId: card.id,
        prompt: card.q,
        options,
        correctIndex: options.indexOf(card.a)
      }
    }
    case 'truefalse': {
      const fillable = card.cloze ? fillCloze(card.cloze) : undefined
      const falseOptions: { prompt?: string; statement: string }[] = [
        ...card.falseStatements.map((s) => ({ statement: s })),
        ...pickDistractors(card, pool, 2, rng).map((d) => ({ prompt: card.q, statement: d }))
      ]
      const isTrue = falseOptions.length === 0 || rng() < 0.5
      const correction = fillable ?? card.a
      if (isTrue) {
        if (fillable && rng() < 0.5) {
          return { type: 'truefalse', cardId: card.id, statement: fillable, isTrue, correction }
        }
        return {
          type: 'truefalse',
          cardId: card.id,
          prompt: card.q,
          statement: card.a,
          isTrue,
          correction: card.a
        }
      }
      const chosen = falseOptions[Math.floor(rng() * falseOptions.length)]
      return {
        type: 'truefalse',
        cardId: card.id,
        ...chosen,
        isTrue: false,
        correction: chosen.prompt ? card.a : correction
      }
    }
    case 'cloze': {
      const { parts, blanks } = parseCloze(card.cloze ?? `{{${card.a}}}`)
      return { type: 'cloze', cardId: card.id, parts, blanks }
    }
    case 'typed':
      return { type: 'typed', cardId: card.id, prompt: card.q, accepted: [card.a, ...card.answers] }
    case 'order': {
      const items = card.steps.map((text, key) => ({ key, text }))
      let shuffled = shuffle(items, rng)
      for (
        let i = 0;
        i < 5 && items.length > 1 && shuffled.every((it, idx) => it.key === idx);
        i++
      ) {
        shuffled = shuffle(items, rng)
      }
      return { type: 'order', cardId: card.id, prompt: card.q, items: shuffled }
    }
    case 'blurt':
      return { type: 'blurt', cardId: card.id, prompt: card.q, points: card.points }
    case 'match':
      return buildMatch([card], rng)
    case 'flip':
    default:
      return { type: 'flip', cardId: card.id, prompt: card.q, answer: card.a }
  }
}

/** A matching round across several cards (left: question, right: answer). */
export function buildMatch(cards: CardRecord[], rng: Rng): Question {
  const pairs = shuffle(cards, rng).map((c) => ({ cardId: c.id, left: c.q, right: c.a }))
  return { type: 'match', cardIds: pairs.map((p) => p.cardId), pairs }
}

/** Cards short enough to sit in a matching grid. */
export function isMatchable(card: CardRecord): boolean {
  return card.kind === 'qa' && card.q.length <= 90 && card.a.length <= 60 && !card.a.includes('\n')
}

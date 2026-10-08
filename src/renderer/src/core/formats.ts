import { isTypeable } from './grading'
import { MemState, type CardRecord, type Format } from './types'
import type { Rng } from './util'

export interface FormatSettings {
  enabled: Record<Format, boolean>
  /** Anki-style: every card is a flip card with self-rating. */
  classic: boolean
}

export const DEFAULT_FORMAT_SETTINGS: FormatSettings = {
  enabled: {
    mcq: true,
    truefalse: true,
    match: true,
    cloze: true,
    typed: true,
    order: true,
    flip: true,
    blurt: true
  },
  classic: false
}

export type Stage = 'new' | 'scaffold' | 'recall' | 'review-early' | 'review-late'

/** Where a card sits on the difficulty ladder. */
export function stageOf(card: CardRecord): Stage {
  const { state, learningSteps, stability } = card.mem
  if (state === MemState.New) return 'new'
  if (state === MemState.Learning || state === MemState.Relearning) {
    return learningSteps === 0 ? 'scaffold' : 'recall'
  }
  return stability < 7 ? 'review-early' : 'review-late'
}

/** Formats this card has the ingredients for (before user settings are applied). */
export function capableFormats(card: CardRecord, peerCount: number): Set<Format> {
  const out = new Set<Format>(['flip'])
  if (card.kind === 'steps') {
    out.add('order')
    return out
  }
  if (card.kind === 'essay') {
    out.add('blurt')
    return out
  }
  if (card.distractors.length + peerCount >= 2) out.add('mcq')
  if (card.falseStatements.length || card.distractors.length || peerCount >= 1) out.add('truefalse')
  if (card.cloze) out.add('cloze')
  if (isTypeable(card.a)) out.add('typed')
  return out
}

interface Weighted {
  format: Format
  weight: number
}

function ladder(stage: Stage): { main: Weighted[]; neighbour: Weighted[] } {
  switch (stage) {
    case 'new':
      // Pretesting: guess first, then learn from the feedback.
      return {
        main: [{ format: 'mcq', weight: 1 }],
        neighbour: [{ format: 'truefalse', weight: 1 }]
      }
    case 'scaffold':
      return {
        main: [
          { format: 'mcq', weight: 0.6 },
          { format: 'truefalse', weight: 0.4 }
        ],
        neighbour: [{ format: 'cloze', weight: 1 }]
      }
    case 'recall':
      return {
        main: [
          { format: 'cloze', weight: 0.5 },
          { format: 'typed', weight: 0.5 }
        ],
        neighbour: [{ format: 'mcq', weight: 1 }]
      }
    case 'review-early':
      return {
        main: [
          { format: 'cloze', weight: 0.5 },
          { format: 'typed', weight: 0.5 }
        ],
        neighbour: [{ format: 'flip', weight: 1 }]
      }
    case 'review-late':
      return {
        main: [
          { format: 'typed', weight: 0.65 },
          { format: 'flip', weight: 0.35 }
        ],
        neighbour: [{ format: 'cloze', weight: 1 }]
      }
  }
}

function weightedPick(options: Weighted[], rng: Rng): Format | undefined {
  const total = options.reduce((s, o) => s + o.weight, 0)
  if (total <= 0) return undefined
  let r = rng() * total
  for (const o of options) {
    r -= o.weight
    if (r <= 0) return o.format
  }
  return options[options.length - 1].format
}

/**
 * Pick the question format for a card. Recognition formats only appear while a card is
 * being learned; reviews always use recall, so an easy multiple-choice question can never
 * inflate a card's interval.
 */
export function chooseFormat(
  card: CardRecord,
  peerCount: number,
  settings: FormatSettings,
  rng: Rng
): Format {
  if (settings.classic) return 'flip'
  const capable = capableFormats(card, peerCount)
  const allowed = (f: Format): boolean => capable.has(f) && settings.enabled[f]

  if (card.kind === 'steps') return allowed('order') ? 'order' : 'flip'
  if (card.kind === 'essay') return allowed('blurt') ? 'blurt' : 'flip'

  const stage = stageOf(card)
  const { main, neighbour } = ladder(stage)
  const usable = (list: Weighted[]): Weighted[] =>
    list.filter((w) => allowed(w.format) && !(w.format === card.lastFormat && list.length > 1))

  const tryNeighbour = rng() < 0.3
  const order = tryNeighbour ? [neighbour, main] : [main, neighbour]
  for (const list of order) {
    const f = weightedPick(usable(list), rng)
    if (f) return f
  }
  // Nothing on the ladder fits: fall back sensibly for the stage.
  const fallbacks: Format[] =
    stage === 'new' || stage === 'scaffold'
      ? ['mcq', 'truefalse', 'flip']
      : ['cloze', 'typed', 'flip']
  return fallbacks.find(allowed) ?? 'flip'
}

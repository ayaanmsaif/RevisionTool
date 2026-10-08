import { describe, expect, it } from 'vitest'
import {
  DEFAULT_FORMAT_SETTINGS,
  capableFormats,
  chooseFormat,
  stageOf,
  type FormatSettings
} from './formats'
import { makeCard } from './test-helpers'
import { MemState, RECOGNITION_FORMATS, type Format } from './types'
import { seededRng } from './util'

const rich = {
  a: 'Mitochondria',
  distractors: ['Ribosome', 'Nucleus', 'Golgi'],
  cloze: 'Respiration happens in the {{mitochondria}}.',
  falseStatements: ['Respiration happens in the nucleus.']
}

function formatsFor(
  over: Parameters<typeof makeCard>[0],
  settings: FormatSettings = DEFAULT_FORMAT_SETTINGS,
  n = 200
): Set<Format> {
  const rng = seededRng(42)
  const card = makeCard(over)
  const out = new Set<Format>()
  for (let i = 0; i < n; i++) out.add(chooseFormat(card, 10, settings, rng))
  return out
}

describe('stageOf', () => {
  it('places cards on the ladder', () => {
    expect(stageOf(makeCard())).toBe('new')
    expect(stageOf(makeCard({ mem: { state: MemState.Learning, learningSteps: 0 } }))).toBe(
      'scaffold'
    )
    expect(stageOf(makeCard({ mem: { state: MemState.Learning, learningSteps: 1 } }))).toBe(
      'recall'
    )
    expect(stageOf(makeCard({ mem: { state: MemState.Review, stability: 3 } }))).toBe(
      'review-early'
    )
    expect(stageOf(makeCard({ mem: { state: MemState.Review, stability: 30 } }))).toBe(
      'review-late'
    )
  })
})

describe('capableFormats', () => {
  it('uses ingredients and peers', () => {
    expect([...capableFormats(makeCard(rich), 0)].sort()).toEqual([
      'cloze',
      'flip',
      'mcq',
      'truefalse',
      'typed'
    ])
    const bare = capableFormats(makeCard({ a: 'Paris' }), 0)
    expect([...bare].sort()).toEqual(['flip', 'typed'])
    expect(capableFormats(makeCard({ a: 'Paris' }), 5).has('mcq')).toBe(true)
  })

  it('handles steps and essay cards', () => {
    expect(capableFormats(makeCard({ kind: 'steps', steps: ['a', 'b'] }), 5).has('order')).toBe(
      true
    )
    expect(capableFormats(makeCard({ kind: 'essay', points: ['a', 'b'] }), 5).has('blurt')).toBe(
      true
    )
  })
})

describe('chooseFormat', () => {
  it('pretests new cards with recognition formats', () => {
    const f = formatsFor({ ...rich })
    expect([...f].every((x) => x === 'mcq' || x === 'truefalse')).toBe(true)
  })

  it('never uses recognition formats for review cards', () => {
    const f = formatsFor({ ...rich, mem: { state: MemState.Review, stability: 3 } })
    expect([...f].some((x) => RECOGNITION_FORMATS.includes(x))).toBe(false)
    const late = formatsFor({ ...rich, mem: { state: MemState.Review, stability: 40 } })
    expect([...late].some((x) => RECOGNITION_FORMATS.includes(x))).toBe(false)
    expect(late.has('typed')).toBe(true)
  })

  it('falls back to flip for long answers in review', () => {
    const f = formatsFor({
      a: 'A long multi part answer that could never sensibly be typed out from memory',
      mem: { state: MemState.Review, stability: 40 }
    })
    expect([...f]).toEqual(['flip'])
  })

  it('respects classic mode and disabled formats', () => {
    expect([...formatsFor({ ...rich }, { ...DEFAULT_FORMAT_SETTINGS, classic: true })]).toEqual([
      'flip'
    ])
    const noMcq: FormatSettings = {
      ...DEFAULT_FORMAT_SETTINGS,
      enabled: { ...DEFAULT_FORMAT_SETTINGS.enabled, mcq: false }
    }
    expect(formatsFor({ ...rich }, noMcq).has('mcq')).toBe(false)
  })

  it('avoids repeating the last format when there is a choice', () => {
    const f = formatsFor({
      ...rich,
      lastFormat: 'typed',
      mem: { state: MemState.Review, stability: 3 }
    })
    expect(f.has('typed')).toBe(false)
  })

  it('uses order and blurt for steps and essay cards', () => {
    expect([...formatsFor({ kind: 'steps', steps: ['a', 'b', 'c'] })]).toEqual(['order'])
    expect([...formatsFor({ kind: 'essay', points: ['a', 'b'] })]).toEqual(['blurt'])
  })
})

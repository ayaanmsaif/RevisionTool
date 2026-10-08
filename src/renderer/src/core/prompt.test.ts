import { describe, expect, it } from 'vitest'
import { parseImport } from './parse'
import {
  DEFAULT_PROMPT_OPTIONS,
  buildDeckPrompt,
  buildLeechPrompt,
  buildRepairPrompt
} from './prompt'

describe('buildDeckPrompt', () => {
  it('includes the chosen options', () => {
    const p = buildDeckPrompt({
      ...DEFAULT_PROMPT_OPTIONS,
      level: 'GCSE',
      count: 40,
      vocab: true,
      focus: 'AQA spec only'
    })
    expect(p).toContain('GCSE')
    expect(p).toContain('about 40 cards')
    expect(p).toContain('"reverse": true')
    expect(p).toContain('AQA spec only')
  })

  it('omits optional card types when switched off', () => {
    const p = buildDeckPrompt({ ...DEFAULT_PROMPT_OPTIONS, steps: false, essay: false })
    expect(p).not.toContain('"kind": "steps"')
    expect(p).not.toContain('"kind": "essay"')
  })

  it('contains no em or en dashes (house style)', () => {
    const p = buildDeckPrompt({ ...DEFAULT_PROMPT_OPTIONS, vocab: true })
    expect(p).not.toMatch(/[—–]/)
  })

  it('shows example cards that the importer itself accepts', () => {
    const p = buildDeckPrompt(DEFAULT_PROMPT_OPTIONS)
    const examples = [...p.matchAll(/^\{ "id"[\s\S]*?\}$/gm)].map((m) => m[0])
    expect(examples.length).toBe(3)
    const r = parseImport(
      JSON.stringify({ deck: { name: 'Example' }, cards: examples.map((e) => JSON.parse(e)) })
    )
    expect(r.errors).toEqual([])
    expect(r.decks[0].warnings).toEqual([])
    expect(r.decks[0].cards.map((c) => c.kind)).toEqual(['qa', 'steps', 'essay'])
  })
})

describe('follow-up prompts', () => {
  it('lists problems to fix', () => {
    expect(buildRepairPrompt(['Card 3: missing an answer ("a")'])).toContain(
      'Card 3: missing an answer'
    )
  })

  it('lists leech cards with ids', () => {
    const p = buildLeechPrompt([{ q: 'Q', a: 'A', extId: 'c9', explain: 'why' }])
    expect(p).toContain('[id c9] Q: Q')
  })
})

import { describe, expect, it } from 'vitest'
import { buildMatch, buildQuestion, fillCloze, parseCloze, pickDistractors } from './questions'
import { makeCard } from './test-helpers'
import { seededRng } from './util'

const rng = seededRng(7)

describe('pickDistractors', () => {
  it('prefers the card’s own distractors', () => {
    const card = makeCard({ a: 'Paris', distractors: ['Lyon', 'Nice', 'Lille'] })
    expect(pickDistractors(card, [], 3, rng).sort()).toEqual(['Lille', 'Lyon', 'Nice'])
  })

  it('fills from peers, favouring the same topic and never the answer', () => {
    const card = makeCard({ id: 'x', a: 'Paris', topic: 'France' })
    const peers = [
      makeCard({ a: 'Madrid', topic: 'Spain' }),
      makeCard({ a: 'Lyon', topic: 'France' }),
      makeCard({ a: 'paris', topic: 'France' }),
      makeCard({ a: 'Marseille', topic: 'France' })
    ]
    const picked = pickDistractors(card, [card, ...peers], 2, seededRng(1))
    expect(picked.sort()).toEqual(['Lyon', 'Marseille'])
  })

  it('uses the right direction for reversed cards', () => {
    const card = makeCard({ q: 'the cat', a: 'le chat', reversed: true })
    const peers = [
      makeCard({ q: 'le chien', a: 'the dog' }),
      makeCard({ q: 'la vache', a: 'the cow' })
    ]
    expect(pickDistractors(card, peers, 2, rng).sort()).toEqual(['la vache', 'le chien'])
  })
})

describe('buildQuestion', () => {
  it('builds MCQ with the correct option included once', () => {
    const card = makeCard({ a: 'Paris', distractors: ['Lyon', 'Nice', 'Lille'] })
    const q = buildQuestion(card, 'mcq', [], rng)
    if (q.type !== 'mcq') throw new Error('wrong type')
    expect(q.options).toHaveLength(4)
    expect(q.options[q.correctIndex]).toBe('Paris')
  })

  it('builds true/false questions with a correction', () => {
    const card = makeCard({
      q: 'Capital of France?',
      a: 'Paris',
      falseStatements: ['The capital of France is Lyon.']
    })
    const seen = new Set<boolean>()
    for (let i = 0; i < 30; i++) {
      const q = buildQuestion(card, 'truefalse', [], seededRng(i))
      if (q.type !== 'truefalse') throw new Error('wrong type')
      seen.add(q.isTrue)
      expect(q.correction).toBe('Paris')
    }
    expect(seen.size).toBe(2)
  })

  it('builds cloze questions with alternatives', () => {
    const card = makeCard({ cloze: 'Plants make {{glucose|sugar}} in {{chloroplasts}}.' })
    const q = buildQuestion(card, 'cloze', [], rng)
    if (q.type !== 'cloze') throw new Error('wrong type')
    expect(q.blanks).toEqual([['glucose', 'sugar'], ['chloroplasts']])
    expect(q.parts).toEqual([
      { text: 'Plants make ' },
      { blank: 0 },
      { text: ' in ' },
      { blank: 1 },
      { text: '.' }
    ])
  })

  it('shuffles ordering questions', () => {
    const card = makeCard({ kind: 'steps', steps: ['a', 'b', 'c', 'd'] })
    const q = buildQuestion(card, 'order', [], rng)
    if (q.type !== 'order') throw new Error('wrong type')
    expect(q.items.map((i) => i.key)).not.toEqual([0, 1, 2, 3])
    expect([...q.items].sort((x, y) => x.key - y.key).map((i) => i.text)).toEqual([
      'a',
      'b',
      'c',
      'd'
    ])
  })

  it('builds typed questions accepting alternatives', () => {
    const q = buildQuestion(
      makeCard({ a: 'ATP', answers: ['adenosine triphosphate'] }),
      'typed',
      [],
      rng
    )
    expect(q).toMatchObject({ type: 'typed', accepted: ['ATP', 'adenosine triphosphate'] })
  })

  it('builds match rounds', () => {
    const cards = [makeCard(), makeCard(), makeCard()]
    const q = buildMatch(cards, rng)
    if (q.type !== 'match') throw new Error('wrong type')
    expect(q.pairs).toHaveLength(3)
  })
})

describe('cloze helpers', () => {
  it('fills and parses cloze text', () => {
    expect(fillCloze('A {{b|c}} d {{e}}')).toBe('A b d e')
    expect(parseCloze('{{x}}').blanks).toEqual([['x']])
  })
})

import { describe, expect, it } from 'vitest'
import { extractJsonBlocks, fixLatexEscapes, parseImport } from './parse'

const deckJson = JSON.stringify({
  format: 'revisiontool',
  version: 1,
  deck: { name: 'Cell Biology', emoji: '🧬', subject: 'Biology', level: 'A-level' },
  cards: [
    {
      id: 'c1',
      topic: 'Organelles',
      q: 'Which organelle is the site of aerobic respiration?',
      a: 'Mitochondria',
      answers: ['mitochondrion'],
      distractors: ['Ribosome', 'Golgi apparatus', 'Chloroplast'],
      cloze: 'Aerobic respiration takes place in the {{mitochondria}}.',
      false: ['Aerobic respiration takes place in the ribosomes.'],
      explain: 'They make ATP.'
    },
    {
      id: 's1',
      kind: 'steps',
      q: 'Order mitosis',
      steps: ['Prophase', 'Metaphase', 'Anaphase', 'Telophase']
    },
    { id: 'e1', kind: 'essay', q: 'Explain WW1 causes', points: ['Militarism', 'Alliances'] },
    { q: 'le chat', a: 'the cat', reverse: true }
  ]
})

describe('parseImport (JSON)', () => {
  it('reads the documented format', () => {
    const r = parseImport(deckJson)
    expect(r.errors).toEqual([])
    expect(r.source).toBe('json')
    expect(r.decks).toHaveLength(1)
    const [deck] = r.decks
    expect(deck.deck).toMatchObject({ name: 'Cell Biology', emoji: '🧬', level: 'A-level' })
    expect(deck.cards).toHaveLength(4)
    const [qa, steps, essay, vocab] = deck.cards
    expect(qa).toMatchObject({
      extId: 'c1',
      kind: 'qa',
      topic: 'Organelles',
      answers: ['mitochondrion']
    })
    expect(qa.falseStatements).toEqual(['Aerobic respiration takes place in the ribosomes.'])
    expect(steps).toMatchObject({ kind: 'steps', a: 'Prophase → Metaphase → Anaphase → Telophase' })
    expect(essay).toMatchObject({ kind: 'essay', points: ['Militarism', 'Alliances'] })
    expect(vocab.reverse).toBe(true)
  })

  it('extracts JSON from a chatty reply with a code fence', () => {
    const reply = `Sure! Here is your deck:\n\n\`\`\`json\n${deckJson}\n\`\`\`\n\nLet me know if you want more.`
    const r = parseImport(reply)
    expect(r.errors).toEqual([])
    expect(r.decks[0].cards).toHaveLength(4)
  })

  it('extracts JSON without a fence', () => {
    const r = parseImport(`Here you go: ${deckJson} Enjoy`)
    expect(r.decks[0].cards).toHaveLength(4)
  })

  it('repairs trailing commas, comments and smart quotes', () => {
    const messy = `{
      // my deck
      "deck": { "name": "Messy", },
      "cards": [
        { "q": "Capital of France?", "a": "Paris", },
        { “q”: “2 + 2?”, “a”: “4” },
      ],
    }`
    const r = parseImport(messy)
    expect(r.errors).toEqual([])
    expect(r.decks[0].deck.name).toBe('Messy')
    expect(r.decks[0].cards.map((c) => c.a)).toEqual(['Paris', '4'])
  })

  it('recovers cards from a truncated reply', () => {
    const cut = deckJson.slice(0, deckJson.indexOf('"id":"e1"') + 30)
    const r = parseImport('```json\n' + cut)
    expect(r.decks[0].cards.length).toBeGreaterThanOrEqual(2)
  })

  it('merges several parts of the same deck', () => {
    const part = (ids: number[]): string =>
      '```json\n' +
      JSON.stringify({
        deck: { name: 'Physics' },
        cards: ids.map((i) => ({ id: `c${i}`, q: `Q${i}`, a: `A${i}` }))
      }) +
      '\n```'
    const r = parseImport(`Part 1\n${part([1, 2])}\nPart 2\n${part([3])}`)
    expect(r.decks).toHaveLength(1)
    expect(r.decks[0].cards.map((c) => c.extId)).toEqual(['c1', 'c2', 'c3'])
  })

  it('accepts common alias field names', () => {
    const r = parseImport(
      JSON.stringify([
        { question: 'Q1', answer: 'A1', explanation: 'E', wrong_answers: ['x', 'y'] }
      ]),
      'Fallback'
    )
    expect(r.decks[0].deck.name).toBe('Fallback')
    expect(r.decks[0].cards[0]).toMatchObject({
      q: 'Q1',
      a: 'A1',
      explain: 'E',
      distractors: ['x', 'y']
    })
  })

  it('skips broken cards with a warning but keeps the rest', () => {
    const r = parseImport(
      JSON.stringify({ deck: { name: 'D' }, cards: [{ q: 'Only a question' }, { q: 'Q', a: 'A' }] })
    )
    expect(r.decks[0].cards).toHaveLength(1)
    expect(r.decks[0].warnings[0]).toMatch(/Card 1: missing an answer/)
  })

  it('removes distractors that equal the answer', () => {
    const r = parseImport(
      JSON.stringify({
        deck: 'D',
        cards: [{ q: 'Q', a: 'Paris', distractors: ['paris', 'Lyon', 'Lyon'] }]
      })
    )
    expect(r.decks[0].cards[0].distractors).toEqual(['Lyon'])
  })

  it('converts Anki-style and plain cloze sentences', () => {
    const r = parseImport(
      JSON.stringify({
        deck: 'D',
        cards: [
          { q: 'Q1', a: 'ATP', cloze: 'Cells use {{c1::ATP}} for energy.' },
          { q: 'Q2', a: 'ATP', cloze: 'Cells use ATP for energy.' }
        ]
      })
    )
    expect(r.decks[0].cards.map((c) => c.cloze)).toEqual([
      'Cells use {{ATP}} for energy.',
      'Cells use {{ATP}} for energy.'
    ])
  })

  it('reports unreadable input', () => {
    expect(parseImport('').errors[0]).toMatch(/Nothing to import/)
    expect(parseImport('just some words').errors[0]).toMatch(/No cards found/)
  })
})

describe('LaTeX in JSON', () => {
  it('keeps single-backslash LaTeX that would otherwise become control characters', () => {
    const raw = String.raw`{"deck":"Maths","cards":[{"q":"Kinetic energy?","a":"$\frac{1}{2}mv^2$"},{"q":"Angle symbol","a":"$\theta$"},{"q":"Greek nu","a":"$\nu$"},{"q":"alpha","a":"$\alpha + \beta$"}]}`
    const r = parseImport(raw)
    expect(r.decks[0].cards.map((c) => c.a)).toEqual([
      '$\\frac{1}{2}mv^2$',
      '$\\theta$',
      '$\\nu$',
      '$\\alpha + \\beta$'
    ])
  })

  it('leaves correctly escaped LaTeX and real newlines alone', () => {
    const raw = String.raw`{"deck":"Maths","cards":[{"q":"Line one\nLine two","a":"$\\frac{a}{b}$"}]}`
    const r = parseImport(raw)
    expect(r.decks[0].cards[0].q).toBe('Line one\nLine two')
    expect(r.decks[0].cards[0].a).toBe('$\\frac{a}{b}$')
  })

  it('only rewrites inside strings', () => {
    expect(fixLatexEscapes('{"a":"\\times"}')).toBe('{"a":"\\\\times"}')
  })
})

describe('parseImport (CSV, TSV, text)', () => {
  it('reads tab-separated Quizlet/Anki exports', () => {
    const r = parseImport('#separator:tab\nhola\thello\nadiós\tgoodbye')
    expect(r.source).toBe('csv')
    expect(r.decks[0].cards.map((c) => [c.q, c.a])).toEqual([
      ['hola', 'hello'],
      ['adiós', 'goodbye']
    ])
  })

  it('reads CSV with a header row', () => {
    const r = parseImport(
      'question,answer,explanation,distractors\n"Capital of Spain?",Madrid,"Since 1561",Barcelona|Seville'
    )
    expect(r.decks[0].cards[0]).toMatchObject({
      q: 'Capital of Spain?',
      a: 'Madrid',
      explain: 'Since 1561',
      distractors: ['Barcelona', 'Seville']
    })
  })

  it('reads Q:/A: notes', () => {
    const r = parseImport('Q: What is ATP?\nA: Energy currency\n\nQ: Where is DNA?\nA: Nucleus')
    expect(r.source).toBe('text')
    expect(r.decks[0].cards.map((c) => c.a)).toEqual(['Energy currency', 'Nucleus'])
  })
})

describe('extractJsonBlocks', () => {
  it('ignores tiny bracketed fragments in prose', () => {
    expect(extractJsonBlocks('See note [1] for details')).toEqual([])
  })
})

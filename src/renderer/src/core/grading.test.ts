import { describe, expect, it } from 'vitest'
import { gradeText, isTypeable, normalise, parseNumber, pointCoverage } from './grading'

const v = (input: string, accepted: string[], opts = {}): string =>
  gradeText(input, accepted, opts).verdict

describe('normalise', () => {
  it('ignores case, punctuation, extra spaces and accents', () => {
    expect(normalise('  The  Mitochondria! ')).toBe('the mitochondria')
    expect(normalise('Café')).toBe('cafe')
    expect(normalise('mother-in-law')).toBe('mother in law')
    expect(normalise('**ATP**')).toBe('atp')
  })
})

describe('gradeText', () => {
  it('accepts exact and case-insensitive answers', () => {
    expect(v('mitochondria', ['Mitochondria'])).toBe('correct')
  })

  it('accepts alternative answers', () => {
    expect(v('mitochondrion', ['Mitochondria', 'mitochondrion'])).toBe('correct')
  })

  it('ignores English articles', () => {
    expect(v('the mitochondria', ['Mitochondria'])).toBe('correct')
    expect(v('mitochondria', ['The mitochondria'])).toBe('correct')
  })

  it('flags a wrong foreign article as close', () => {
    const r = gradeText('la chat', ['le chat'])
    expect(r.verdict).toBe('close')
    expect(r.note).toBe('article')
  })

  it('treats small typos as close', () => {
    const r = gradeText('mitocondria', ['Mitochondria'])
    expect(r.verdict).toBe('close')
    expect(r.note).toBe('typo')
  })

  it('does not forgive typos in short words', () => {
    expect(v('cot', ['cat'])).toBe('wrong')
  })

  it('rejects different words', () => {
    expect(v('ribosome', ['Mitochondria'])).toBe('wrong')
    expect(v('', ['Mitochondria'])).toBe('wrong')
  })

  it('handles accents leniently by default and strictly when asked', () => {
    const lenient = gradeText('nino', ['niño'])
    expect(lenient.verdict).toBe('correct')
    expect(lenient.note).toBe('accent')
    expect(v('nino', ['niño'], { accentStrict: true })).toBe('close')
    expect(v('niño', ['niño'], { accentStrict: true })).toBe('correct')
  })

  it('accepts the answer without its parenthetical', () => {
    expect(v('ATP', ['ATP (adenosine triphosphate)'])).toBe('correct')
  })

  it('accepts lists in any order', () => {
    expect(v('blue, red and green', ['red, green, blue'])).toBe('correct')
  })

  it('requires digits to match exactly', () => {
    expect(v('1944', ['1945'])).toBe('wrong')
    expect(v('WW2 1945', ['WW2 1945'])).toBe('correct')
  })

  it('grades numbers numerically', () => {
    expect(v('1000', ['1,000'])).toBe('correct')
    expect(v('3', ['3.0'])).toBe('correct')
    expect(v('0.5', ['1/2'])).toBe('correct')
    expect(v('6.02e23', ['6.02 x 10^23'])).toBe('correct')
    expect(v('6.02×10²³', ['6.02e23'])).toBe('correct')
    expect(v('9.8', ['9.81 m/s^2'])).toBe('correct')
    expect(v('12', ['13'])).toBe('wrong')
  })

  it('marks a wrong unit as close', () => {
    const r = gradeText('5 J', ['5 kJ'])
    expect(r.verdict).toBe('close')
    expect(r.note).toBe('unit')
  })

  it('turns off typo tolerance when asked', () => {
    expect(v('mitocondria', ['Mitochondria'], { typoTolerance: 'off' })).toBe('wrong')
  })
})

describe('parseNumber', () => {
  it('parses common number formats', () => {
    expect(parseNumber('-2.5 kJ')).toMatchObject({ value: -2.5, unit: 'kj' })
    expect(parseNumber('abc')).toBeNull()
    expect(parseNumber('1,234,567')?.value).toBe(1234567)
  })
})

describe('isTypeable', () => {
  it('allows short plain answers only', () => {
    expect(isTypeable('Mitochondria')).toBe(true)
    expect(isTypeable('$E = mc^2$')).toBe(false)
    expect(isTypeable('one two three four five six seven eight nine')).toBe(false)
  })
})

describe('pointCoverage', () => {
  it('detects key points mentioned in free recall', () => {
    const text =
      'There was militarism with an arms race, plus the alliance system and imperial rivalry.'
    expect(pointCoverage(text, 'Militarism and the arms race')).toBeGreaterThanOrEqual(0.5)
    expect(pointCoverage(text, 'Alliance system divided Europe')).toBeGreaterThanOrEqual(0.5)
    expect(pointCoverage(text, 'Nationalism in the Balkans')).toBe(0)
  })
})

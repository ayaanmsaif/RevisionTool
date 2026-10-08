import { distance } from 'fastest-levenshtein'
import type { Verdict } from './types'

export type TypoTolerance = 'off' | 'normal' | 'lenient'

export interface GradeOptions {
  /** When true, a missing or wrong accent counts as "close" instead of correct. */
  accentStrict?: boolean
  typoTolerance?: TypoTolerance
}

export type GradeNote = 'typo' | 'accent' | 'article' | 'rounding' | 'unit' | 'order'

export interface GradeResult {
  verdict: Verdict
  note?: GradeNote
  /** The accepted answer the input matched (or came closest to). */
  matched?: string
}

const EN_ARTICLES = new Set(['the', 'a', 'an'])
const FOREIGN_ARTICLES = new Set([
  'le',
  'la',
  'les',
  'l',
  'un',
  'une',
  'des',
  'du',
  'der',
  'die',
  'das',
  'den',
  'dem',
  'ein',
  'eine',
  'einen',
  'el',
  'los',
  'las',
  'il',
  'lo',
  'gli',
  'una',
  'uno'
])

/** Remove markdown emphasis and LaTeX delimiters so "**ATP**" and "$ATP$" grade like "ATP". */
export function stripMarkup(s: string): string {
  return s
    .replace(/\$\$?/g, '')
    .replace(/\\(text|mathrm|textbf|mathbf|ce)\{([^}]*)\}/g, '$2')
    .replace(/\\times|\\cdot/g, ' x ')
    .replace(/[*_`~]+/g, '')
}

/** Lower-case, strip punctuation and (optionally) accents, collapse whitespace. */
export function normalise(s: string, keepAccents = false): string {
  let out = stripMarkup(s).normalize('NFKD')
  if (!keepAccents) out = out.replace(/\p{M}/gu, '')
  out = out
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[’‘`´]/g, "'")
    .replace(/'/g, ' ')
    .replace(/[\p{P}\p{S}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return keepAccents ? out.normalize('NFC') : out
}

interface ArticleSplit {
  article?: string
  rest: string
}

function splitArticle(norm: string): ArticleSplit {
  const space = norm.indexOf(' ')
  if (space === -1) return { rest: norm }
  const first = norm.slice(0, space)
  const rest = norm.slice(space + 1)
  if (EN_ARTICLES.has(first) || FOREIGN_ARTICLES.has(first)) return { article: first, rest }
  return { rest: norm }
}

// ---------- numbers ----------

export interface ParsedNumber {
  value: number
  isInteger: boolean
  unit: string
}

const SUPERSCRIPTS: Record<string, string> = {
  '⁰': '0',
  '¹': '1',
  '²': '2',
  '³': '3',
  '⁴': '4',
  '⁵': '5',
  '⁶': '6',
  '⁷': '7',
  '⁸': '8',
  '⁹': '9',
  '⁻': '-'
}

/**
 * Parse answers like "1,000", "3.0", "-2.5 kJ", "6.02e23", "6.02 x 10^23", "6.02×10²³", "1/2".
 * Returns null when the text does not start with a number.
 */
export function parseNumber(raw: string): ParsedNumber | null {
  let s = stripMarkup(raw)
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+/g, (m) => '^' + [...m].map((c) => SUPERSCRIPTS[c]).join(''))
    .replace(/[−–]/g, '-')
    .replace(/\^\{([^}]*)\}/g, '^$1')
    .trim()
  s = s.replace(/^(-?\d{1,3}(?:,\d{3})+)(?!\d)/, (m) => m.replace(/,/g, ''))
  const m = s.match(
    /^([-+]?(?:\d+\.?\d*|\.\d+))(?:\s*\/\s*(\d+(?:\.\d+)?))?(?:\s*(?:e|E)\s*([-+]?\d+)|\s*(?:x|×|\*|·)\s*10\s*\^\s*([-+]?\d+))?/
  )
  if (!m) return null
  let value = parseFloat(m[1])
  let isInteger = !m[1].includes('.')
  if (m[2]) {
    value = value / parseFloat(m[2])
    isInteger = Number.isInteger(value)
  }
  const exp = m[3] ?? m[4]
  if (exp !== undefined) {
    value = value * Math.pow(10, parseInt(exp, 10))
    isInteger = false
  }
  if (!Number.isFinite(value)) return null
  const unit = s
    .slice(m[0].length)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[.]$/, '')
    .replace(/[µμ]/g, 'u')
  // Treat "3 apples" style answers as text, not numbers with units.
  if (
    unit.length > 12 ||
    /\s/.test(
      s
        .slice(m[0].length)
        .trim()
        .replace(/\s*\/\s*/g, '/')
    )
  ) {
    return { value, isInteger, unit: '__text__' }
  }
  return { value, isInteger, unit }
}

function gradeNumber(input: ParsedNumber, expected: ParsedNumber): GradeResult | null {
  if (expected.unit === '__text__' || input.unit === '__text__') return null
  const diff = Math.abs(input.value - expected.value)
  const scale = Math.max(Math.abs(expected.value), 1e-12)
  let verdict: Verdict = 'wrong'
  let note: GradeNote | undefined
  if (diff <= scale * 1e-9) verdict = 'correct'
  else if (!expected.isInteger && diff / scale <= 0.01) {
    verdict = 'correct'
    note = 'rounding'
  }
  if (verdict === 'correct' && input.unit && expected.unit && input.unit !== expected.unit) {
    return { verdict: 'close', note: 'unit' }
  }
  return { verdict, note }
}

// ---------- text ----------

function allowedTypos(len: number, tolerance: TypoTolerance): number {
  if (tolerance === 'off') return 0
  const extra = tolerance === 'lenient' ? 1 : 0
  if (len < 4) return 0
  if (len <= 7) return 1 + extra
  if (len <= 12) return 2 + extra
  return Math.floor(len * 0.15) + extra
}

const digitsOf = (s: string): string => s.replace(/\D/g, '')

/** Split "a, b and c" into normalised items, or null if it is not a list. */
function splitList(raw: string): string[] | null {
  const parts = stripMarkup(raw)
    .split(/\s*(?:,|;|&|\+|\band\b)\s*/i)
    .map((p) => splitArticle(normalise(p)).rest)
    .filter(Boolean)
  return parts.length > 1 ? parts : null
}

/** Expand an accepted answer into the variants a student might reasonably type. */
export function answerVariants(answer: string): string[] {
  const variants = new Set<string>([answer])
  const noParens = answer.replace(/\s*\([^)]*\)\s*/g, ' ').trim()
  if (noParens && noParens !== answer) variants.add(noParens)
  for (const v of [...variants]) {
    if (v.includes(' / ')) v.split(' / ').forEach((p) => p.trim() && variants.add(p.trim()))
  }
  return [...variants]
}

function gradeOne(input: string, candidate: string, opts: GradeOptions): GradeResult {
  const tolerance = opts.typoTolerance ?? 'normal'

  const expNum = parseNumber(candidate)
  const inNum = parseNumber(input)
  if (expNum && inNum) {
    const numeric = gradeNumber(inNum, expNum)
    if (numeric) return { ...numeric, matched: candidate }
  }

  const ni = normalise(input)
  const nc = normalise(candidate)
  if (!ni) return { verdict: 'wrong', matched: candidate }

  const accentResult = (): GradeResult => {
    const accented = normalise(input, true) === normalise(candidate, true)
    if (accented) return { verdict: 'correct', matched: candidate }
    return opts.accentStrict
      ? { verdict: 'close', note: 'accent', matched: candidate }
      : { verdict: 'correct', note: 'accent', matched: candidate }
  }

  if (ni === nc) return accentResult()

  const ai = splitArticle(ni)
  const ac = splitArticle(nc)
  if (ai.rest === ac.rest) {
    const foreignMismatch =
      (ai.article !== ac.article && ai.article && FOREIGN_ARTICLES.has(ai.article)) ||
      (ai.article !== ac.article && ac.article && FOREIGN_ARTICLES.has(ac.article))
    if (foreignMismatch) return { verdict: 'close', note: 'article', matched: candidate }
    return accentResult()
  }

  const li = splitList(input)
  const lc = splitList(candidate)
  if (li && lc && li.length === lc.length) {
    const a = [...li].sort().join('|')
    const b = [...lc].sort().join('|')
    if (a === b) return { verdict: 'correct', note: 'order', matched: candidate }
  }

  // Digits must match exactly; typo tolerance applies to letters only.
  if (digitsOf(ai.rest) === digitsOf(ac.rest)) {
    const d = distance(ai.rest, ac.rest)
    if (d <= allowedTypos(ac.rest.length, tolerance)) {
      return { verdict: 'close', note: 'typo', matched: candidate }
    }
  }
  return { verdict: 'wrong', matched: candidate }
}

const RANK: Record<Verdict, number> = { correct: 2, close: 1, wrong: 0 }

/** Grade a typed answer against every accepted answer and return the best result. */
export function gradeText(
  input: string,
  accepted: readonly string[],
  opts: GradeOptions = {}
): GradeResult {
  let best: GradeResult = { verdict: 'wrong', matched: accepted[0] }
  for (const answer of accepted) {
    for (const variant of answerVariants(answer)) {
      const r = gradeOne(input, variant, opts)
      if (RANK[r.verdict] > RANK[best.verdict]) best = r
      if (best.verdict === 'correct' && !best.note) return best
    }
  }
  return best
}

/** True when an answer is short and plain enough to type from memory. */
export function isTypeable(answer: string): boolean {
  const a = answer.trim()
  if (!a || a.length > 60) return false
  if (/\n|\$|\\\(|\\\[|```/.test(a)) return false
  return a.split(/\s+/).length <= 8
}

// ---------- blurt ----------

const STOPWORDS = new Set(
  'the a an and or but of to in on at for with by from as is are was were be been being it its this that these those which who whom what when where why how not no into than then so such can could would should will may might must have has had do does did their there they them he she his her our your you we i'.split(
    ' '
  )
)

function contentWords(s: string): string[] {
  return normalise(s)
    .split(' ')
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w))
}

/**
 * Rough check of whether a free-recall answer mentions a key point: the share of the
 * point's content words that appear (prefix-matched, so "industrialised" hits "industrial").
 */
export function pointCoverage(text: string, point: string): number {
  const words = contentWords(point)
  if (!words.length) return 0
  const have = contentWords(text)
  let hit = 0
  for (const w of words) {
    const stem = w.slice(0, Math.max(4, Math.ceil(w.length * 0.7)))
    if (have.some((h) => h.startsWith(stem) || (h.length >= 4 && w.startsWith(h)))) hit++
  }
  return hit / words.length
}

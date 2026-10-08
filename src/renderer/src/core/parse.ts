import { jsonrepair } from 'jsonrepair'
import Papa from 'papaparse'
import { readCard, readImportJson, type ImportCard, type ParsedDeck } from './schema'

export interface ParseResult {
  decks: ParsedDeck[]
  /** Fatal problems: nothing could be read from a block. */
  errors: string[]
  source: 'json' | 'csv' | 'text' | 'none'
}

// LaTeX commands whose first letter is also a JSON escape (\f, \n, \t, \r, \b, \u).
// "\frac" inside a JSON string silently becomes a form feed + "rac", so these are re-escaped.
const AMBIGUOUS_LATEX = new Set(
  (
    'frac,flat,forall,footnotesize,' +
    'nu,neq,ne,nabla,neg,not,ni,newline,nolimits,nleq,ngeq,nmid,nexists,' +
    'theta,times,text,textbf,textit,textrm,textsf,texttt,tau,to,tan,tanh,tfrac,therefore,tilde,top,triangle,triangleq,textdegree,' +
    'rho,right,rightarrow,rightleftharpoons,rangle,rm,rfloor,rceil,rbrace,rvert,' +
    'beta,bar,binom,bmod,boldsymbol,bot,bullet,big,bigl,bigr,bigg,bigcup,bigcap,backslash,because,' +
    'uparrow,underline,underbrace,upsilon,cup,unit'
  ).split(',')
)

/** Make LaTeX inside AI-written JSON strings survive JSON.parse. */
export function fixLatexEscapes(raw: string): string {
  let out = ''
  let inString = false
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]
    if (!inString) {
      if (ch === '"') inString = true
      out += ch
      continue
    }
    if (ch === '"') {
      inString = false
      out += ch
      continue
    }
    if (ch !== '\\') {
      out += ch
      continue
    }
    const next = raw[i + 1] ?? ''
    if (next === '\\' || next === '"' || next === '/') {
      out += ch + next
      i++
      continue
    }
    const word = /^[a-zA-Z]+/.exec(raw.slice(i + 1))?.[0] ?? ''
    if ('bfnrt'.includes(next) && next !== '') {
      if (AMBIGUOUS_LATEX.has(word)) out += '\\\\'
      else out += '\\'
      continue
    }
    if (next === 'u') {
      if (/^u[0-9a-fA-F]{4}/.test(raw.slice(i + 1)) && !AMBIGUOUS_LATEX.has(word)) out += '\\'
      else out += '\\\\'
      continue
    }
    // Any other character after a backslash is not a valid JSON escape: keep it literally.
    out += '\\\\'
  }
  return out
}

/** Find JSON documents in a chat reply: fenced blocks first, otherwise balanced brackets. */
export function extractJsonBlocks(text: string): string[] {
  const fenced: string[] = []
  const fence = /```[a-zA-Z0-9]*[ \t]*\r?\n?([\s\S]*?)(?:```|$)/g
  let m: RegExpExecArray | null
  while ((m = fence.exec(text))) {
    const body = m[1].trim()
    if (body.startsWith('{') || body.startsWith('[')) fenced.push(body)
    if (m[0].length === 0) fence.lastIndex++
  }
  if (fenced.length) return fenced

  const blocks: string[] = []
  let i = 0
  while (i < text.length) {
    const start = text.slice(i).search(/[{[]/)
    if (start === -1) break
    const s = i + start
    let depth = 0
    let inStr = false
    let end = -1
    for (let j = s; j < text.length; j++) {
      const c = text[j]
      if (inStr) {
        if (c === '\\') j++
        else if (c === '"') inStr = false
        continue
      }
      if (c === '"') inStr = true
      else if (c === '{' || c === '[') depth++
      else if (c === '}' || c === ']') {
        depth--
        if (depth === 0) {
          end = j
          break
        }
      }
    }
    if (end === -1) {
      // Truncated reply: hand the rest to jsonrepair, which can close it.
      blocks.push(text.slice(s))
      break
    }
    const candidate = text.slice(s, end + 1)
    // Ignore tiny bracketed fragments in prose like "[1]".
    if (candidate.length > 20 || candidate.includes('"')) blocks.push(candidate)
    i = end + 1
  }
  return blocks
}

function parseJsonLenient(block: string): { value?: unknown; error?: string } {
  const fixed = fixLatexEscapes(block)
  try {
    return { value: JSON.parse(fixed) }
  } catch {
    try {
      return { value: JSON.parse(jsonrepair(fixed)) }
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) }
    }
  }
}

/** Merge parts that belong to the same deck (e.g. "Part 1 of 3" replies pasted together). */
export function mergeDecks(decks: ParsedDeck[]): ParsedDeck[] {
  const byName = new Map<string, ParsedDeck>()
  for (const d of decks) {
    const key = d.deck.name.trim().toLowerCase()
    const existing = byName.get(key)
    if (!existing) {
      byName.set(key, { deck: { ...d.deck }, cards: [...d.cards], warnings: [...d.warnings] })
      continue
    }
    existing.deck = {
      ...d.deck,
      ...Object.fromEntries(Object.entries(existing.deck).filter(([, v]) => v))
    } as ParsedDeck['deck']
    existing.cards.push(...d.cards)
    existing.warnings.push(...d.warnings)
  }
  return [...byName.values()]
}

const HEADER_ALIASES: Record<string, string> = {
  q: 'q',
  question: 'q',
  front: 'q',
  term: 'q',
  prompt: 'q',
  a: 'a',
  answer: 'a',
  back: 'a',
  definition: 'a',
  explain: 'explain',
  explanation: 'explain',
  notes: 'explain',
  topic: 'topic',
  section: 'topic',
  tags: 'tags',
  distractors: 'distractors',
  wrong: 'distractors',
  cloze: 'cloze',
  answers: 'answers',
  false: 'false'
}

function parseDelimited(text: string, fallbackName: string): ParsedDeck | null {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith('#'))
  if (!lines.length) return null
  const body = lines.join('\n')
  const tabby = lines.filter((l) => l.includes('\t')).length >= Math.ceil(lines.length * 0.6)
  const res = Papa.parse<string[]>(body, {
    delimiter: tabby ? '\t' : '',
    skipEmptyLines: true
  })
  const rows = res.data.filter((r) => r.length >= 2 && r[0]?.trim() && r[1]?.trim())
  if (rows.length < Math.max(1, Math.floor(lines.length * 0.5))) return null

  let columns = ['q', 'a', 'explain']
  const header = rows[0].map((h) => HEADER_ALIASES[h.trim().toLowerCase()])
  if (header.filter(Boolean).length >= 2) {
    columns = rows[0].map((h) => HEADER_ALIASES[h.trim().toLowerCase()] ?? '')
    rows.shift()
  }
  const warnings: string[] = []
  const cards: ImportCard[] = []
  rows.forEach((row, i) => {
    const raw: Record<string, unknown> = {}
    columns.forEach((col, idx) => {
      if (!col || row[idx] === undefined || !row[idx].trim()) return
      raw[col] =
        col === 'distractors' || col === 'answers' || col === 'false'
          ? row[idx].split('|')
          : row[idx]
    })
    const { card, problem } = readCard(raw, `Row ${i + 1}`)
    if (card) cards.push(card)
    else if (problem) warnings.push(problem)
  })
  return cards.length ? { deck: { name: fallbackName }, cards, warnings } : null
}

function parseQaText(text: string, fallbackName: string): ParsedDeck | null {
  const cards: ImportCard[] = []
  const warnings: string[] = []
  const re =
    /^\s*(?:Q|Question)\s*[:.)-]\s*([\s\S]*?)\n\s*(?:A|Answer)\s*[:.)-]\s*([\s\S]*?)(?=\n\s*(?:Q|Question)\s*[:.)-]|$)/gim
  let m: RegExpExecArray | null
  let i = 0
  while ((m = re.exec(text))) {
    const { card, problem } = readCard({ q: m[1].trim(), a: m[2].trim() }, `Card ${++i}`)
    if (card) cards.push(card)
    else if (problem) warnings.push(problem)
  }
  return cards.length ? { deck: { name: fallbackName }, cards, warnings } : null
}

/**
 * Read whatever the student pasted or dropped in: an AI reply containing JSON
 * (one or several parts), a CSV/TSV export (Quizlet, Anki, spreadsheets), or Q:/A: notes.
 */
export function parseImport(text: string, fallbackName = 'Imported deck'): ParseResult {
  const clean = text.replace(/^\uFEFF/, '').trim()
  if (!clean)
    return {
      decks: [],
      errors: ['Nothing to import yet. Paste your AI reply or drop a file.'],
      source: 'none'
    }

  const blocks = extractJsonBlocks(clean)
  if (blocks.length) {
    const decks: ParsedDeck[] = []
    const errors: string[] = []
    blocks.forEach((block, i) => {
      const { value, error } = parseJsonLenient(block)
      const label = blocks.length > 1 ? `Part ${i + 1}` : 'The JSON'
      if (error) {
        errors.push(`${label} could not be read: ${error}`)
        return
      }
      const found = readImportJson(value, fallbackName)
      if (!found.length) errors.push(`${label} has no "cards" list.`)
      decks.push(...found)
    })
    const merged = mergeDecks(decks).filter((d) => d.cards.length || d.warnings.length)
    if (merged.length || errors.length) return { decks: merged, errors, source: 'json' }
  }

  const qa = parseQaText(clean, fallbackName)
  if (qa) return { decks: [qa], errors: [], source: 'text' }
  const delimited = parseDelimited(clean, fallbackName)
  if (delimited) return { decks: [delimited], errors: [], source: 'csv' }

  return {
    decks: [],
    errors: [
      'No cards found. Paste the JSON your AI produced, or a CSV/TSV file with question and answer columns.'
    ],
    source: 'none'
  }
}

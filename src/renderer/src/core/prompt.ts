import type { CardRecord } from './types'

export type Level = 'GCSE' | 'A-level' | 'IB' | 'University' | 'Other'

export interface PromptOptions {
  level: Level
  /** Roughly how many cards to make, or 'auto' to cover everything. */
  count: 'auto' | number
  /** Language of the cards (defaults to the language of the notes). */
  language?: string
  vocab: boolean
  steps: boolean
  essay: boolean
  /** Optional extra steer, e.g. "focus on chapter 3" or "AQA spec". */
  focus?: string
}

export const DEFAULT_PROMPT_OPTIONS: PromptOptions = {
  level: 'A-level',
  count: 'auto',
  vocab: false,
  steps: true,
  essay: true
}

const PART_SIZE = 60

export function buildDeckPrompt(o: PromptOptions): string {
  const level = o.level === 'Other' ? 'the level of the material' : o.level
  const count =
    o.count === 'auto'
      ? 'Make as many cards as it takes to cover every fact, definition, process and idea in the material (often 30 to 150).'
      : `Aim for about ${o.count} cards, prioritising what is most likely to be examined.`

  const types = [
    `1. Question and answer card (most cards):
{ "id": "c1", "topic": "Organelles",
  "q": "Which organelle is the site of aerobic respiration?",
  "a": "Mitochondria",
  "answers": ["mitochondrion"],
  "distractors": ["Ribosome", "Golgi apparatus", "Chloroplast"],
  "cloze": "Aerobic respiration takes place in the {{mitochondria|mitochondrion}}.",
  "false": ["Aerobic respiration takes place in the ribosomes."],
  "explain": "Mitochondria run the Krebs cycle and oxidative phosphorylation, which make most of the cell's ATP." }`
  ]
  if (o.steps) {
    types.push(`${types.length + 1}. Steps card (processes, sequences, timelines, method steps):
{ "id": "s1", "kind": "steps", "topic": "Cell division",
  "q": "Put the stages of mitosis in order",
  "steps": ["Prophase", "Metaphase", "Anaphase", "Telophase"],
  "explain": "Chromosomes condense, line up, separate, then two nuclei form." }`)
  }
  if (o.essay) {
    types.push(`${types.length + 1}. Essay card (explain, evaluate, discuss, compare questions with several marking points):
{ "id": "e1", "kind": "essay", "topic": "Causes of WW1",
  "q": "Explain the long-term causes of the First World War.",
  "points": ["Militarism and the arms race", "Alliance system divided Europe", "Imperial rivalry over colonies", "Nationalism in the Balkans"],
  "explain": "Remembered as MAIN: militarism, alliances, imperialism, nationalism." }`)
  }

  const rules = [
    'One idea per card. Split lists and compound facts into separate cards.',
    '"q" must make sense on its own, out of context. Never write "according to the text" or "in the notes".',
    '"a" must be short (ideally 1 to 6 words) so it can be typed from memory. Put extra detail in "explain".',
    '"answers": other spellings, abbreviations or phrasings that should also be marked correct. Use [] if none.',
    '"distractors": exactly 3 wrong answers from the same category and of similar length, that a student who half-knows the topic might pick. Never "all of the above", never joke options, never another correct answer.',
    '"cloze": one full sentence (reword it if needed) where the key term is in {{double braces}}. Put alternative accepted answers after a bar: {{term|alternative}}. Blank the important word, never filler. At most 2 blanks.',
    '"false": one statement that sounds right but is wrong in one important detail. Use a common misconception when there is one.',
    '"explain": one or two sentences on WHY the answer is right, linking it to related ideas. Every card needs one.',
    `Mix question types: definitions, but also why and how questions, cause and effect, comparisons, worked examples and exam-style application questions at ${level} standard.`,
    'Group cards with a short "topic" that follows the sections of the material (usually 3 to 12 topics).',
    'Cover everything in the material. Do not invent facts that are not supported by it, and never contradict it.',
    'Maths and science: write maths in LaTeX between $...$, for example $\\\\frac{1}{2}mv^2$, and chemistry as $\\\\ce{H2SO4}$. Inside JSON strings every backslash must be doubled. Include units in answers.',
    'Use unique ids: c1, c2, c3 and so on (s1 for steps cards, e1 for essay cards).'
  ]
  if (o.vocab) {
    rules.push(
      'Vocabulary: make one card per word or phrase with "q" as the word in the language being learned and "a" as its meaning, and add "reverse": true so both directions are practised. Include the article or gender in "q" where the language has one.'
    )
  }
  if (o.language) rules.push(`Write the cards in ${o.language}.`)
  if (o.focus?.trim()) rules.push(`Extra instructions: ${o.focus.trim()}`)

  return `You are an expert ${level} teacher and exam writer. Turn the study material I have attached or pasted into a flashcard deck for an app called RevisionTool.

## Output
Reply with ONLY one JSON code block (\`\`\`json ... \`\`\`), with no text before or after it. Use exactly this structure:

{
  "format": "revisiontool",
  "version": 1,
  "deck": { "name": "Short deck name", "emoji": "one emoji", "subject": "Subject", "level": "${o.level}" },
  "cards": [ ... ]
}

## Card types
${types.join('\n\n')}

## Rules for great cards
${rules.map((r) => `- ${r}`).join('\n')}

## Size
${count}
If the deck needs more than ${PART_SIZE} cards, split it into parts. Send Part 1 now as a complete, valid JSON block with the first ${PART_SIZE} cards, then stop and tell me how many parts there are. When I reply "continue", send the next part. Every part repeats the same "deck" object and keeps numbering the ids.

If I have not attached or pasted any material yet, ask me for it and wait.`
}

export function buildRepairPrompt(problems: string[]): string {
  return `The JSON you gave me could not be fully imported into RevisionTool. These problems were found:

${problems.map((p) => `- ${p}`).join('\n')}

Please send the complete deck again as ONE valid JSON code block in the same format, with these problems fixed. Remember: every card needs "q" and "a" (or "steps" for steps cards, "points" for essay cards), backslashes inside strings must be doubled, and there should be no text outside the code block.`
}

export function buildLeechPrompt(
  cards: Pick<CardRecord, 'q' | 'a' | 'explain' | 'topic' | 'extId'>[]
): string {
  const list = cards
    .map(
      (c, i) =>
        `${i + 1}. ${c.extId ? `[id ${c.extId}] ` : ''}Q: ${c.q}\n   A: ${c.a}${c.explain ? `\n   Explain: ${c.explain}` : ''}`
    )
    .join('\n')
  return `I keep forgetting these flashcards. Rewrite them so they are easier to learn and remember, using the RevisionTool JSON format (same structure as before, reply with one JSON code block only).

For each card:
- Break it into 2 or 3 smaller cards if it holds more than one idea.
- Add a vivid "explain" with a memory hook, mnemonic, analogy or example.
- Keep the original "id" on the first replacement card so my progress is kept, and give new ids to any extra cards.
- Include "distractors", "cloze" and "false" as before.

Cards:
${list}`
}

/** Short instructions for a Claude.ai Project, so the student only uploads notes each time. */
export function buildProjectInstructions(o: PromptOptions): string {
  return `${buildDeckPrompt(o)}

Whenever I upload notes, slides or a PDF in this project, follow these instructions to turn them into a RevisionTool deck.`
}

# RevisionTool import format (v1)

RevisionTool has no built-in AI. Your own chatbot (Claude, ChatGPT, Gemini) turns your notes into a deck in this format, and the app does everything else.

The app's **Import → Copy AI prompt** button gives you a ready-made prompt that asks for exactly this format, so most people never need to read this page. It is here for people who want to write decks by hand, fix a deck, or build their own tools.

## Shape

```json
{
  "format": "revisiontool",
  "version": 1,
  "deck": {
    "name": "Cell Biology",
    "emoji": "🧬",
    "subject": "Biology",
    "level": "A-level",
    "description": "Optional"
  },
  "cards": [ ... ]
}
```

Only `deck.name` and `cards` are required.

## Card types

### Question and answer (the default)

```json
{
  "id": "c1",
  "topic": "Organelles",
  "q": "Which organelle is the site of aerobic respiration?",
  "a": "Mitochondria",
  "answers": ["mitochondrion"],
  "distractors": ["Ribosome", "Golgi apparatus", "Chloroplast"],
  "cloze": "Aerobic respiration takes place in the {{mitochondria|mitochondrion}}.",
  "false": ["Aerobic respiration takes place in the ribosomes."],
  "explain": "Mitochondria run the Krebs cycle and oxidative phosphorylation.",
  "tags": ["respiration"],
  "reverse": false
}
```

| Field | Required | Used for |
|---|---|---|
| `q` | yes | The question |
| `a` | yes | The answer. Keep it short so it can be typed. |
| `answers` | no | Other answers that should be marked correct |
| `distractors` | no | Wrong options for multiple choice (3 is ideal) |
| `cloze` | no | Fill-the-gap sentence. Put the blank in `{{...}}`. Separate alternatives with a bar: `{{glucose\|sugar}}` |
| `false` | no | Plausible false statements for true or false questions |
| `explain` | no | Shown after every answer. Explains why. |
| `topic` | no | Groups cards. Used for interleaving and matching. |
| `tags` | no | Free labels for filtering |
| `reverse` | no | `true` also creates the opposite card (great for vocabulary) |
| `id` | no | A stable id. Re-importing a deck with the same ids updates cards and keeps your progress. |

### Steps (ordering)

```json
{ "id": "s1", "kind": "steps", "q": "Put the stages of mitosis in order",
  "steps": ["Prophase", "Metaphase", "Anaphase", "Telophase"] }
```

### Essay (blurting)

```json
{ "id": "e1", "kind": "essay", "q": "Explain the long-term causes of WW1",
  "points": ["Militarism", "Alliance system", "Imperial rivalry", "Nationalism"] }
```

You write everything you remember, then tick off the key points you covered.

## One card, many question types

Every format is built from the same card:

| Format | Built from |
|---|---|
| Multiple choice | `a` plus `distractors`, topped up with answers from other cards |
| True or false | `false` statements, or the question paired with a wrong answer |
| Match up | Several short cards at once |
| Fill the gap | `cloze` |
| Type it | `a` and `answers` (only when the answer is short) |
| Recall (flip) | `q` and `a`, you rate yourself |
| Put in order | `steps` |
| Blurt it out | `points` |

A plain front/back deck still gets multiple choice, true or false and matching, because the app borrows answers from other cards in the deck.

## Maths and chemistry

Write LaTeX between `$...$` (inline) or `$$...$$` (display). Chemistry uses mhchem: `$\ce{H2SO4}$`. Markdown (bold, lists, code) works in every text field.

Inside JSON, backslashes should be doubled (`"$\\frac{1}{2}mv^2$"`). If an AI forgets, the importer repairs common LaTeX commands such as `\frac`, `\theta`, `\nu` and `\times`, which would otherwise be read as JSON escape characters.

## What the importer forgives

- Text before or after the JSON, and code fences
- Several JSON blocks pasted together (for example "Part 1" and "Part 2"): parts with the same deck name are merged
- Replies cut off mid-way: complete cards are kept
- Trailing commas, comments, smart quotes, single quotes
- Common alternative field names: `question`/`front`/`term`, `answer`/`back`/`definition`, `explanation`, `wrong_answers`, Anki-style `{{c1::cloze}}`
- A bare list of cards (the deck is named after the file)

## Other formats

- **CSV or TSV** (Quizlet, Anki and spreadsheet exports): the first column is the question and the second the answer. With a header row you can also use `explanation`, `topic`, `tags`, `distractors` and `answers` columns; separate list values with `|`.
- **Plain text**: lines starting `Q:` and `A:`.

## Re-importing

Cards are matched first by `id`, then by question text. Matching cards are updated in place and keep their review history; new cards are added. Nothing is deleted on re-import.

---
name: make-deck
description: Turn study material (PDFs, slides, Word/Markdown notes, images of notes) into a RevisionTool flashcard deck and save it to the RevisionTool inbox folder, where the app imports it automatically. Use when the user asks to make flashcards, a deck, revision cards or questions from their notes for RevisionTool, or runs /make-deck with file paths.
---

# Make a RevisionTool deck

RevisionTool is a local revision app with no built-in AI. You write the deck as a JSON file in its import format and save it to its inbox folder. The app watches that folder and imports new files within a second, so the student just opens the app and studies.

## Steps

1. **Find the material.** Use the paths the user gave (arguments to `/make-deck`, or files they mention). If none were given, ask which files or folder to use. Read every file completely: PDFs page by page with the Read tool, Markdown and text directly, images of handwritten notes visually. For `.docx` or `.pptx`, try `pandoc` or ask the user to export to PDF.
2. **Ask only what you need.** If it is not obvious, ask the level (GCSE, A-level, IB, University) and whether they want vocabulary cards both ways. Otherwise infer from the material and go.
3. **Plan topics** that follow the sections of the material (usually 3 to 12).
4. **Write the cards** following the format and rules below. Cover everything in the material.
5. **Save** the JSON to the inbox folder (see "Where to save"). For more than about 80 cards, split into several files named `<deck>-part1.json`, `<deck>-part2.json` and so on, each repeating the same `deck` object. The app merges parts with the same deck name.
6. **Validate** each file parses before you finish:
   `node -e "JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')); console.log('ok')" "<file>"`
   Fix and re-save anything that fails.
7. **Report** the deck name, card count per topic, and that RevisionTool will pick it up automatically (the app must be open, or it will import next time it starts).

## Where to save

The inbox folder is: `{{INBOX_PATH}}`

If that still shows a placeholder, use `Documents/RevisionTool/Inbox` in the user's home folder. On Windows also check `OneDrive/Documents/RevisionTool/Inbox`, and use whichever exists (create the first if neither does). Name the file after the deck, for example `cell-biology.json`.

## Format

```json
{
  "format": "revisiontool",
  "version": 1,
  "deck": { "name": "Short deck name", "emoji": "🧬", "subject": "Biology", "level": "A-level" },
  "cards": [ ... ]
}
```

### Question and answer card (most cards)

```json
{ "id": "c1", "topic": "Organelles",
  "q": "Which organelle is the site of aerobic respiration?",
  "a": "Mitochondria",
  "answers": ["mitochondrion"],
  "distractors": ["Ribosome", "Golgi apparatus", "Chloroplast"],
  "cloze": "Aerobic respiration takes place in the {{mitochondria|mitochondrion}}.",
  "false": ["Aerobic respiration takes place in the ribosomes."],
  "explain": "Mitochondria run the Krebs cycle and oxidative phosphorylation, which make most of the cell's ATP." }
```

### Steps card (processes, sequences, timelines)

```json
{ "id": "s1", "kind": "steps", "topic": "Cell division",
  "q": "Put the stages of mitosis in order",
  "steps": ["Prophase", "Metaphase", "Anaphase", "Telophase"],
  "explain": "Chromosomes condense, line up, separate, then two nuclei form." }
```

### Essay card (explain, evaluate, compare questions with marking points)

```json
{ "id": "e1", "kind": "essay", "topic": "Causes of WW1",
  "q": "Explain the long-term causes of the First World War.",
  "points": ["Militarism and the arms race", "Alliance system divided Europe", "Imperial rivalry over colonies", "Nationalism in the Balkans"],
  "explain": "Remembered as MAIN: militarism, alliances, imperialism, nationalism." }
```

## Rules for great cards

The app turns each card into multiple choice, true or false, matching, fill the gap, typed recall and more, and schedules it with the FSRS memory model. These rules make every format work:

- One idea per card. Split lists and compound facts into separate cards; use a steps card for sequences and an essay card for multi-point answers.
- `q` must make sense on its own. Never write "according to the text".
- `a` must be short (ideally 1 to 6 words) so it can be typed from memory. Put detail in `explain`.
- `answers`: other spellings, abbreviations or phrasings to accept. Use `[]` if none.
- `distractors`: exactly 3 wrong answers from the same category and of similar length that a student who half-knows the topic might pick. Never "all of the above", joke options, or another correct answer.
- `cloze`: one full sentence where the key term is in `{{double braces}}`, alternatives after a bar: `{{glucose|sugar}}`. Blank the important word, never filler. At most 2 blanks.
- `false`: one statement that sounds right but is wrong in one important detail, ideally a common misconception.
- `explain`: one or two sentences on why the answer is right, linking it to related ideas. Every card needs one.
- Mix question types: definitions, but also why and how, cause and effect, comparisons, worked examples and exam-style application questions at the student's level.
- Maths and science: LaTeX between `$...$`, for example `$\\frac{1}{2}mv^2$`, chemistry as `$\\ce{H2SO4}$`. Backslashes must be doubled inside JSON strings. Include units in answers.
- Vocabulary: one card per word with `q` in the language being learned and `a` its meaning, plus `"reverse": true` so both directions are practised. Include the article or gender in `q`.
- Use a consistent `topic` per section, and unique ids (`c1`, `c2`, `s1`, `e1`). Keep ids stable if you are updating an existing deck: re-importing a deck with the same ids updates those cards and keeps the student's progress.
- Do not invent facts that are not in the material, and never contradict it.

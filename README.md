# RevisionTool

A local, science-based revision app for Windows. Turn your notes into flashcards with the AI chat you already pay for, then learn them with multiple choice, fill the gap, typed recall, matching, ordering and blurting, scheduled by the FSRS memory model. Colourful, gamified, and entirely offline: no account, no API key, no extra cost.

## How it works

RevisionTool has **no built-in AI**. Your own chatbot does the one job that needs AI (reading your notes and writing cards) and the app does everything else.

1. Open **Import** and click **Copy AI prompt**.
2. Paste it into Claude, ChatGPT or Gemini with your PDF, slides or notes attached.
3. Paste the reply back into RevisionTool (or drop the file into the inbox folder). Done.

The prompt asks the AI for one question and answer per card plus a few "ingredients": three plausible wrong options, a fill-the-gap sentence, a false statement and a one-line explanation. From those, the app builds every question type itself. Plain front/back decks (CSV, Quizlet or Anki exports) work too.

**With Claude Code** (included in Claude Pro): install the `make-deck` skill from Settings, then run `/make-deck my-notes.pdf`. The finished deck lands in the inbox folder and appears in the app automatically.

**With a Claude.ai Project:** click *Copy as Claude Project instructions* on the Import screen, paste it into a Project's instructions once, and from then on just upload notes and say "make deck".

The full format is documented in [docs/IMPORT_FORMAT.md](docs/IMPORT_FORMAT.md).

## What makes it effective

Every design choice comes from learning research: retrieval practice, FSRS spaced repetition, pretesting ("guess first" on new cards), a format ladder that gets harder as memory strengthens, successive relearning of missed cards, interleaving, immediate feedback with explanations, and automatic marking instead of self-rating. See [docs/SCIENCE.md](docs/SCIENCE.md) for the reasoning and references.

## Features

- **Eight question types** from one card: multiple choice, true or false, match up, fill the gap, type it, put in order, recall (flip) and blurt it out
- **FSRS-6 scheduling** with adjustable desired retention, daily new and review limits, leech detection
- **Gamification:** XP, combos with rising chimes, daily goal and streaks with freezes, levels, 21 achievements, optional Hardcore hearts mode
- **Games:** Match (timed board) and Blitz (60-second true or false), plus an exam-style **Test** mode
- **Stats:** study heatmap, true retention, reviews per day, 30-day forecast, this week against last week, per-deck mastery
- **Card browser and editor** with a live preview of every format; add cards by hand
- **Maths and chemistry** via LaTeX and mhchem; markdown everywhere
- **Light and dark themes**, keyboard shortcuts, reduced-motion support
- **Your data stays on your computer**, with automatic daily backups (last 10 kept) and one-click restore

## Keyboard shortcuts

| Key | Action |
|---|---|
| 1 to 4 | Pick an option, or rate a flip card |
| T / F | True or false |
| Enter | Check, or continue after feedback |
| Space | Show the answer on a flip card |
| Esc | Leave a lesson |

## Running it

Requires Node.js 22 or newer.

```bash
npm install
npm run dev        # start the app with hot reload
npm run build:win  # build a Windows installer into dist/
```

Other scripts:

```bash
npm test           # unit tests (Vitest)
npm run test:e2e   # end-to-end smoke test (Playwright + Electron)
npm run typecheck
npm run lint
```

## Where your data lives

- Decks, cards and progress: the app's local database (IndexedDB in Electron's user data folder).
- Backups and the import inbox: `Documents\RevisionTool\Backups` and `Documents\RevisionTool\Inbox`.

## Project layout

```
src/main/                 Electron main process: window, file dialogs, backups, inbox watcher, skill installer
src/preload/              The small API the app is allowed to use
src/renderer/src/core/    The learning engine (pure TypeScript, unit tested): import parsing, grading,
                          FSRS scheduling, format ladder, questions, sessions, gamification, prompts
src/renderer/src/db/      IndexedDB (Dexie) storage, progress and backups
src/renderer/src/study/   The lesson controller and the eight question views
src/renderer/src/screens/ Home, deck, import, cards, stats and settings
src/renderer/src/games/   Match, Blitz and Test
.claude/skills/make-deck/ The Claude Code skill
docs/                     Import format and the science
examples/                 A sample deck that shows every question type
```

## Licence

MIT

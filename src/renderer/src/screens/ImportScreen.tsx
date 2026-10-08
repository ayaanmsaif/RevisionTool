import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import clsx from 'clsx'
import {
  ArrowRightIcon,
  CheckCircleIcon,
  ClipboardTextIcon,
  CopyIcon,
  FileArrowUpIcon,
  PaperclipIcon,
  SparkleIcon,
  WarningCircleIcon,
  WarningIcon,
  WrenchIcon
} from '@phosphor-icons/react'
import { now } from '../core/clock'
import { planImport } from '../core/importer'
import { parseImport, type ParseResult } from '../core/parse'
import {
  DEFAULT_PROMPT_OPTIONS,
  buildDeckPrompt,
  buildProjectInstructions,
  buildRepairPrompt,
  type Level,
  type PromptOptions
} from '../core/prompt'
import type { ParsedDeck } from '../core/schema'
import { db } from '../db/db'
import { findDeckByName, importDeck, updateProfile, type ImportSummary } from '../db/repo'
import { announceAchievements } from '../lib/achievements'
import { Button } from '../components/ui/Button'
import { Field, Segmented, ToggleChip, inputClass } from '../components/ui/Controls'
import { PageHeader, Panel, SectionTitle } from '../components/ui/Panel'
import { RichText } from '../components/RichText'
import { useProfile } from '../state/hooks'
import { toast } from '../state/toast'
import { copyText } from '../lib/clipboard'
import { SAMPLE_DECK_TEXT as sampleDeck } from '../lib/sample'

const LEVELS: { value: Level; label: string }[] = [
  { value: 'GCSE', label: 'GCSE' },
  { value: 'A-level', label: 'A-level' },
  { value: 'IB', label: 'IB' },
  { value: 'University', label: 'University' },
  { value: 'Other', label: 'Other' }
]

const COUNTS: { value: string; label: string }[] = [
  { value: 'auto', label: 'Cover everything' },
  { value: '20', label: 'About 20' },
  { value: '40', label: 'About 40' },
  { value: '80', label: 'About 80' }
]

export function ImportScreen(): React.JSX.Element {
  return (
    <div className="mx-auto max-w-[1180px] px-10 py-10">
      <PageHeader
        title="Import"
        subtitle="Turn your notes into a deck with the AI chat you already use. No API key, no extra cost."
      />
      <ol className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-card bg-sunken px-5 py-3.5 text-[15px] font-bold">
        <HowTo icon={<CopyIcon />} text="Copy the prompt" />
        <ArrowRightIcon className="text-ink-faint" aria-hidden />
        <HowTo
          icon={<PaperclipIcon />}
          text="Send it to Claude or ChatGPT with your notes attached"
        />
        <ArrowRightIcon className="text-ink-faint" aria-hidden />
        <HowTo icon={<ClipboardTextIcon />} text="Paste the reply here" />
      </ol>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <PromptBuilder />
        <ReplyImporter />
      </div>
    </div>
  )
}

// ---------- prompt ----------

function PromptBuilder(): React.JSX.Element {
  const profile = useProfile()
  const [opts, setOpts] = useState<PromptOptions>(DEFAULT_PROMPT_OPTIONS)
  const [copied, setCopied] = useState<'prompt' | 'project' | null>(null)
  const loaded = useRef(false)

  useEffect(() => {
    if (!loaded.current && profile.promptOptions !== DEFAULT_PROMPT_OPTIONS) {
      loaded.current = true
      setOpts(profile.promptOptions)
    }
  }, [profile.promptOptions])

  const change = (patch: Partial<PromptOptions>): void => {
    const next = { ...opts, ...patch }
    setOpts(next)
    loaded.current = true
    void updateProfile((p) => ({ ...p, promptOptions: next }))
  }

  const copy = async (kind: 'prompt' | 'project'): Promise<void> => {
    await copyText(kind === 'prompt' ? buildDeckPrompt(opts) : buildProjectInstructions(opts))
    setCopied(kind)
    window.setTimeout(() => setCopied(null), 2200)
  }

  return (
    <Panel className="flex flex-col gap-5 p-7">
      <div>
        <SectionTitle>Get the prompt</SectionTitle>
        <p className="mt-1 text-ink-muted">
          It teaches your AI to write cards for every question type.
        </p>
      </div>

      <Field label="Level">
        <Segmented
          label="Level"
          value={opts.level}
          options={LEVELS}
          onChange={(level) => change({ level })}
          size="sm"
        />
      </Field>

      <Field label="How many cards">
        <Segmented
          label="How many cards"
          value={String(opts.count)}
          options={COUNTS}
          onChange={(v) => change({ count: v === 'auto' ? 'auto' : Number(v) })}
          size="sm"
        />
      </Field>

      <Field label="Also include">
        <div className="flex flex-wrap gap-2">
          <ToggleChip checked={opts.steps} onChange={(steps) => change({ steps })}>
            Process steps
          </ToggleChip>
          <ToggleChip checked={opts.essay} onChange={(essay) => change({ essay })}>
            Essay points
          </ToggleChip>
          <ToggleChip checked={opts.vocab} onChange={(vocab) => change({ vocab })}>
            Vocab both ways
          </ToggleChip>
        </div>
      </Field>

      <Field
        label="Extra instructions (optional)"
        htmlFor="prompt-focus"
        hint="For example: only chapter 4, or follow the AQA specification."
      >
        <input
          id="prompt-focus"
          value={opts.focus ?? ''}
          onChange={(e) => change({ focus: e.target.value })}
          className={inputClass}
        />
      </Field>

      <div className="flex flex-col gap-3">
        <Button size="lg" block onClick={() => copy('prompt')}>
          {copied === 'prompt' ? <CheckCircleIcon weight="fill" /> : <CopyIcon />}
          {copied === 'prompt' ? 'Copied' : 'Copy AI prompt'}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => copy('project')}>
          {copied === 'project'
            ? 'Copied project instructions'
            : 'Copy as Claude Project instructions'}
        </Button>
      </div>
    </Panel>
  )
}

function HowTo({ icon, text }: { icon: React.ReactNode; text: string }): React.JSX.Element {
  return (
    <li className="flex items-center gap-2.5">
      <span className="grid size-8 shrink-0 place-items-center rounded-control bg-surface text-accent">
        {icon}
      </span>
      <span className="text-ink">{text}</span>
    </li>
  )
}

// ---------- reply ----------

interface DeckDiff {
  existing: boolean
  add: number
  update: number
  unchanged: number
}

function ReplyImporter(): React.JSX.Element {
  const navigate = useNavigate()
  const [text, setText] = useState('')
  const [fileName, setFileName] = useState<string>()
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [diffState, setDiffState] = useState<{ for: ParseResult | null; diffs: DeckDiff[] }>({
    for: null,
    diffs: []
  })
  const fileInput = useRef<HTMLInputElement>(null)

  const deferred = useDeferredValue(text)
  const fallbackName = fileName?.replace(/\.[^.]+$/, '') || 'Imported deck'
  const result: ParseResult | null = useMemo(
    () => (deferred.trim() ? parseImport(deferred, fallbackName) : null),
    [deferred, fallbackName]
  )

  useEffect(() => {
    let cancelled = false
    if (!result?.decks.length) return
    Promise.all(
      result.decks.map(async (d) => {
        const deck = await findDeckByName(d.deck.name)
        const cards = deck ? await db.cards.where('deckId').equals(deck.id).toArray() : []
        const plan = planImport(d, { deck, cards }, now())
        return {
          existing: !!deck,
          add: plan.add.length,
          update: plan.update.length,
          unchanged: plan.unchanged
        }
      })
    ).then((diffs) => !cancelled && setDiffState({ for: result, diffs }))
    return () => {
      cancelled = true
    }
  }, [result])
  const diffs = diffState.for === result ? diffState.diffs : []

  const readFile = async (file: File): Promise<void> => {
    setFileName(file.name)
    setText(await file.text())
  }

  const onDrop = (e: React.DragEvent): void => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) void readFile(file)
    else setText(e.dataTransfer.getData('text'))
  }

  const problems = result ? [...result.errors, ...result.decks.flatMap((d) => d.warnings)] : []
  const importable = result?.decks.filter((d) => d.cards.length) ?? []
  const totalCards = importable.reduce((n, d) => n + d.cards.length, 0)

  const doImport = async (): Promise<void> => {
    if (!importable.length) return
    setBusy(true)
    try {
      const summaries: ImportSummary[] = []
      for (const d of importable) summaries.push(await importDeck(d, now()))
      const added = summaries.reduce((n, s) => n + s.added, 0)
      const updated = summaries.reduce((n, s) => n + s.updated, 0)
      toast({
        tone: 'good',
        title:
          summaries.length === 1
            ? `${summaries[0].deckName} is ready`
            : `${summaries.length} decks imported`,
        body: `${added} new card${added === 1 ? '' : 's'}${updated ? `, ${updated} updated` : ''}.`
      })
      setText('')
      setFileName(undefined)
      void announceAchievements()
      navigate(summaries.length === 1 ? `/deck/${summaries[0].deckId}` : '/')
    } catch (e) {
      toast({
        tone: 'bad',
        title: 'Import failed',
        body: e instanceof Error ? e.message : String(e)
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Panel className="flex flex-col gap-5 p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <SectionTitle>Paste the reply</SectionTitle>
          <p className="mt-1 text-ink-muted">
            Paste everything the AI sent, or drop a .json, .csv or .txt file.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => fileInput.current?.click()}>
            <FileArrowUpIcon />
            Choose file
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setFileName(undefined)
              setText(sampleDeck)
            }}
          >
            <SparkleIcon />
            Try the sample
          </Button>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept=".json,.csv,.tsv,.txt,.md"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void readFile(f)
            e.target.value = ''
          }}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="ai-reply" className="text-sm font-extrabold">
          AI reply {fileName && <span className="font-bold text-ink-muted">from {fileName}</span>}
        </label>
        <textarea
          id="ai-reply"
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            setFileName(undefined)
          }}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          spellCheck={false}
          rows={9}
          placeholder={
            '```json\n{ "format": "revisiontool", "deck": { ... }, "cards": [ ... ] }\n```'
          }
          className={clsx(
            inputClass,
            'min-h-[220px] resize-y font-mono text-[13px] leading-relaxed',
            dragging && 'border-accent bg-accent-soft'
          )}
        />
      </div>

      {result && (
        <div className="flex flex-col gap-4">
          {result.decks.map((d, i) => (
            <DeckPreview key={`${d.deck.name}-${i}`} deck={d} diff={diffs[i]} />
          ))}

          {problems.length > 0 && <Problems problems={problems} fatal={!importable.length} />}
        </div>
      )}

      <div className="mt-auto flex items-center justify-between gap-4 border-t border-line pt-5">
        <p className="max-w-[46ch] text-sm text-ink-muted">
          Re-importing an improved deck updates cards in place and keeps your progress. Files saved
          to your{' '}
          <button
            type="button"
            onClick={() => void window.api?.openFolder('inbox')}
            className="font-bold text-accent hover:underline"
          >
            inbox folder
          </button>{' '}
          are imported automatically.
        </p>
        <Button size="lg" variant="good" disabled={!importable.length || busy} onClick={doImport}>
          {totalCards ? `Import ${totalCards} card${totalCards === 1 ? '' : 's'}` : 'Import'}
        </Button>
      </div>
    </Panel>
  )
}

function DeckPreview({ deck, diff }: { deck: ParsedDeck; diff?: DeckDiff }): React.JSX.Element {
  const cards = deck.cards
  const qa = cards.filter((c) => c.kind === 'qa')
  const topics = new Set(cards.map((c) => c.topic).filter(Boolean))
  const coverage = [
    {
      label: 'Multiple choice',
      n: qa.filter((c) => c.distractors.length >= 3).length,
      of: qa.length
    },
    { label: 'Fill the gap', n: qa.filter((c) => c.cloze).length, of: qa.length },
    { label: 'True or false', n: qa.filter((c) => c.falseStatements.length).length, of: qa.length },
    { label: 'Explanations', n: cards.filter((c) => c.explain).length, of: cards.length }
  ].filter((c) => c.of > 0)
  const steps = cards.filter((c) => c.kind === 'steps').length
  const essays = cards.filter((c) => c.kind === 'essay').length
  const reverse = cards.filter((c) => c.reverse).length

  return (
    <div className="rounded-card border-2 border-line p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-3xl leading-none">{deck.deck.emoji ?? '📚'}</span>
          <div>
            <p className="font-display text-lg font-bold">{deck.deck.name}</p>
            <p className="text-sm text-ink-muted">
              {cards.length} cards
              {topics.size > 0 && `, ${topics.size} topics`}
              {steps > 0 && `, ${steps} steps`}
              {essays > 0 && `, ${essays} essay`}
              {reverse > 0 && `, ${reverse} both ways`}
            </p>
          </div>
        </div>
        {diff && (
          <span
            className={clsx(
              'rounded-full px-3 py-1 text-sm font-bold',
              diff.existing
                ? 'bg-gold-soft text-ink'
                : 'bg-good-soft text-good-press dark:text-good'
            )}
          >
            {diff.existing
              ? `Updates existing deck: ${diff.add} new, ${diff.update} changed`
              : 'New deck'}
          </span>
        )}
      </div>

      {coverage.length > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 2xl:grid-cols-4">
          {coverage.map((c) => (
            <div key={c.label}>
              <p className="text-xs font-bold text-ink-muted">{c.label}</p>
              <p className="tabular font-display text-lg font-bold">
                {c.n}
                <span className="text-sm font-semibold text-ink-faint">/{c.of}</span>
              </p>
            </div>
          ))}
        </div>
      )}

      {cards.length > 0 && (
        <ul className="mt-4 flex max-h-56 flex-col gap-2 overflow-y-auto pr-1">
          {cards.slice(0, 8).map((c, i) => (
            <li key={i} className="rounded-control bg-sunken px-3.5 py-2.5 text-sm">
              <RichText inline text={c.q} className="font-bold" />
              <span className="mx-2 text-ink-faint">→</span>
              <RichText
                inline
                text={
                  c.kind === 'qa'
                    ? c.a
                    : c.kind === 'steps'
                      ? `${c.steps.length} steps`
                      : `${c.points.length} key points`
                }
                className="text-ink-muted"
              />
            </li>
          ))}
          {cards.length > 8 && (
            <li className="px-1 text-sm font-bold text-ink-faint">and {cards.length - 8} more</li>
          )}
        </ul>
      )}
    </div>
  )
}

function Problems({ problems, fatal }: { problems: string[]; fatal: boolean }): React.JSX.Element {
  const [open, setOpen] = useState(fatal)
  const [copied, setCopied] = useState(false)
  const Icon = fatal ? WarningCircleIcon : WarningIcon
  return (
    <div
      className={clsx(
        'rounded-card border-2 p-5',
        fatal ? 'border-bad bg-bad-soft' : 'border-gold bg-gold-soft'
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          className="flex items-center gap-2 font-extrabold"
          onClick={() => setOpen(!open)}
        >
          <Icon weight="fill" className={fatal ? 'text-bad' : 'text-gold-press'} />
          {fatal
            ? 'This could not be imported'
            : `${problems.length} card${problems.length === 1 ? '' : 's'} skipped`}
          <span className="text-sm font-bold text-ink-muted">{open ? 'Hide' : 'Show'}</span>
        </button>
        <Button
          variant="secondary"
          size="sm"
          onClick={async () => {
            await copyText(buildRepairPrompt(problems))
            setCopied(true)
            window.setTimeout(() => setCopied(false), 2000)
          }}
        >
          <WrenchIcon />
          {copied ? 'Copied' : 'Copy fix-it prompt'}
        </Button>
      </div>
      {open && (
        <ul className="mt-3 flex max-h-40 list-disc flex-col gap-1 overflow-y-auto pl-6 text-sm">
          {problems.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

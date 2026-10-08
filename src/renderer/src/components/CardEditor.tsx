import { useState } from 'react'
import clsx from 'clsx'
import {
  ArrowCounterClockwiseIcon,
  FlagIcon,
  PauseIcon,
  PlayIcon,
  TrashIcon
} from '@phosphor-icons/react'
import { now } from '../core/clock'
import { capableFormats } from '../core/formats'
import { buildQuestion, FORMAT_LABEL } from '../core/questions'
import { normaliseCloze } from '../core/schema'
import { formatInterval, newMemory } from '../core/scheduler'
import {
  MemState,
  type CardContent,
  type CardKind,
  type CardRecord,
  type Deck,
  type Format
} from '../core/types'
import { seededRng } from '../core/util'
import { addCard, deleteCards, resetCard, saveCardContent, updateCard } from '../db/repo'
import { toast } from '../state/toast'
import { Button } from './ui/Button'
import { Field, Segmented, inputClass } from './ui/Controls'
import { Modal } from './ui/Modal'
import { McqView } from '../study/views/McqView'
import { TrueFalseView } from '../study/views/TrueFalseView'
import { TypedView } from '../study/views/TypedView'
import { ClozeView } from '../study/views/ClozeView'
import { FlipView } from '../study/views/FlipView'
import { OrderView } from '../study/views/OrderView'
import { BlurtView } from '../study/views/BlurtView'

interface Draft {
  deckId: string
  kind: CardKind
  q: string
  a: string
  answers: string
  distractors: string
  cloze: string
  falseStatements: string
  explain: string
  steps: string
  points: string
  topic: string
  tags: string
}

const lines = (s: string): string[] =>
  s
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

function toDraft(card: CardRecord | undefined, deckId: string): Draft {
  return {
    deckId: card?.deckId ?? deckId,
    kind: card?.kind ?? 'qa',
    q: card?.q ?? '',
    a: card?.kind === 'qa' ? card.a : '',
    answers: card?.answers.join('\n') ?? '',
    distractors: card?.distractors.join('\n') ?? '',
    cloze: card?.cloze ?? '',
    falseStatements: card?.falseStatements.join('\n') ?? '',
    explain: card?.explain ?? '',
    steps: card?.steps.join('\n') ?? '',
    points: card?.points.join('\n') ?? '',
    topic: card?.topic ?? '',
    tags: card?.tags.join(', ') ?? ''
  }
}

function toContent(d: Draft): { content?: CardContent; problem?: string } {
  const q = d.q.trim()
  if (!q) return { problem: 'Add a question.' }
  const steps = lines(d.steps)
  const points = lines(d.points)
  if (d.kind === 'qa' && !d.a.trim()) return { problem: 'Add an answer.' }
  if (d.kind === 'steps' && steps.length < 2)
    return { problem: 'Add at least 2 steps, one per line.' }
  if (d.kind === 'essay' && points.length < 2)
    return { problem: 'Add at least 2 key points, one per line.' }
  const a =
    d.kind === 'qa' ? d.a.trim() : d.kind === 'steps' ? steps.join(' → ') : points.join('; ')
  const cloze = d.kind === 'qa' ? normaliseCloze(d.cloze.trim() || undefined, a) : undefined
  if (d.kind === 'qa' && d.cloze.trim() && !cloze) {
    return { problem: 'The fill-the-gap sentence needs a blank in {{double braces}}.' }
  }
  return {
    content: {
      kind: d.kind,
      q,
      a,
      answers: d.kind === 'qa' ? lines(d.answers) : [],
      distractors: d.kind === 'qa' ? lines(d.distractors) : [],
      cloze,
      falseStatements: d.kind === 'qa' ? lines(d.falseStatements) : [],
      explain: d.explain.trim() || undefined,
      steps: d.kind === 'steps' ? steps : [],
      points: d.kind === 'essay' ? points : [],
      topic: d.topic.trim() || undefined,
      tags: d.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
    }
  }
}

export function CardEditor({
  card,
  deckId,
  decks,
  peers,
  onClose
}: {
  card?: CardRecord
  deckId: string
  decks: Deck[]
  /** Other cards in the deck, so the preview can borrow wrong options. */
  peers: CardRecord[]
  onClose: () => void
}): React.JSX.Element {
  const [draft, setDraft] = useState<Draft>(() => toDraft(card, deckId))
  const [error, setError] = useState<string>()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const set = (patch: Partial<Draft>): void => {
    setDraft({ ...draft, ...patch })
    setError(undefined)
  }

  const save = async (): Promise<void> => {
    const { content, problem } = toContent(draft)
    if (!content) {
      setError(problem)
      return
    }
    if (card) await saveCardContent(card.id, content, draft.deckId, now())
    else await addCard(draft.deckId, content, now())
    toast({ tone: 'good', title: card ? 'Card saved' : 'Card added' })
    onClose()
  }

  const title = card ? 'Edit card' : 'Add a card'
  return (
    <Modal
      title={title}
      onClose={onClose}
      wide
      footer={
        <>
          <div className="flex flex-wrap gap-2">
            {card && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    await updateCard(card.id, { suspended: card.suspended ? 0 : 1 })
                    onClose()
                  }}
                >
                  {card.suspended ? <PlayIcon /> : <PauseIcon />}
                  {card.suspended ? 'Unsuspend' : 'Suspend'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    await updateCard(card.id, { flagged: card.flagged ? 0 : 1 })
                    onClose()
                  }}
                >
                  <FlagIcon weight={card.flagged ? 'fill' : 'bold'} />{' '}
                  {card.flagged ? 'Unflag' : 'Flag'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    await resetCard(card.id, now())
                    toast({
                      tone: 'info',
                      title: 'Progress reset',
                      body: 'The card will be learned again as new.'
                    })
                    onClose()
                  }}
                >
                  <ArrowCounterClockwiseIcon /> Reset progress
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className={clsx(confirmDelete && 'text-bad')}
                  onClick={async () => {
                    if (!confirmDelete) {
                      setConfirmDelete(true)
                      return
                    }
                    await deleteCards([card.id])
                    toast({ tone: 'info', title: 'Card deleted' })
                    onClose()
                  }}
                >
                  <TrashIcon /> {confirmDelete ? 'Click again to delete' : 'Delete'}
                </Button>
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
            {error && <p className="text-sm font-bold text-bad">{error}</p>}
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={save}>{card ? 'Save' : 'Add card'}</Button>
          </div>
        </>
      }
    >
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-5">
          {card && <MemoryLine card={card} />}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Deck" htmlFor="ed-deck">
              <select
                id="ed-deck"
                value={draft.deckId}
                onChange={(e) => set({ deckId: e.target.value })}
                className={inputClass}
              >
                {decks.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.emoji} {d.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Topic" htmlFor="ed-topic">
              <input
                id="ed-topic"
                value={draft.topic}
                onChange={(e) => set({ topic: e.target.value })}
                className={inputClass}
              />
            </Field>
          </div>
          {!card?.reversed && (
            <Field label="Card type">
              <Segmented
                value={draft.kind}
                size="sm"
                options={[
                  { value: 'qa', label: 'Question and answer' },
                  { value: 'steps', label: 'Steps' },
                  { value: 'essay', label: 'Essay points' }
                ]}
                onChange={(kind) => set({ kind })}
              />
            </Field>
          )}
          <Area label="Question" value={draft.q} onChange={(q) => set({ q })} rows={2} />
          {draft.kind === 'qa' && (
            <>
              <Area
                label="Answer"
                hint="Short enough to type from memory works best."
                value={draft.a}
                onChange={(a) => set({ a })}
                rows={1}
              />
              <div className="grid grid-cols-2 gap-4">
                <Area
                  label="Also accept"
                  hint="One per line"
                  value={draft.answers}
                  onChange={(answers) => set({ answers })}
                  rows={3}
                />
                <Area
                  label="Wrong options"
                  hint="One per line, for multiple choice"
                  value={draft.distractors}
                  onChange={(distractors) => set({ distractors })}
                  rows={3}
                />
              </div>
              <Area
                label="Fill-the-gap sentence"
                hint="Put the blank in {{double braces}}, alternatives after a bar: {{glucose|sugar}}"
                value={draft.cloze}
                onChange={(cloze) => set({ cloze })}
                rows={2}
              />
              <Area
                label="False statements"
                hint="One per line, for true or false"
                value={draft.falseStatements}
                onChange={(falseStatements) => set({ falseStatements })}
                rows={2}
              />
            </>
          )}
          {draft.kind === 'steps' && (
            <Area
              label="Steps in the right order"
              hint="One per line"
              value={draft.steps}
              onChange={(steps) => set({ steps })}
              rows={5}
            />
          )}
          {draft.kind === 'essay' && (
            <Area
              label="Key points"
              hint="One per line"
              value={draft.points}
              onChange={(points) => set({ points })}
              rows={5}
            />
          )}
          <Area
            label="Explanation"
            hint="Shown after every answer. Say why, not just what."
            value={draft.explain}
            onChange={(explain) => set({ explain })}
            rows={2}
          />
          <Field label="Tags" htmlFor="ed-tags" hint="Comma separated">
            <input
              id="ed-tags"
              value={draft.tags}
              onChange={(e) => set({ tags: e.target.value })}
              className={inputClass}
            />
          </Field>
        </div>
        <Preview draft={draft} card={card} peers={peers} />
      </div>
    </Modal>
  )
}

function Area({
  label,
  hint,
  value,
  onChange,
  rows
}: {
  label: string
  hint?: string
  value: string
  onChange: (v: string) => void
  rows: number
}): React.JSX.Element {
  const id = `ed-${label.replace(/\W+/g, '-').toLowerCase()}`
  return (
    <Field label={label} hint={hint} htmlFor={id}>
      <textarea
        id={id}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={clsx(inputClass, 'resize-y')}
      />
    </Field>
  )
}

function MemoryLine({ card }: { card: CardRecord }): React.JSX.Element {
  const state = ['New', 'Learning', 'Review', 'Relearning'][card.mem.state]
  return (
    <p className="rounded-control bg-sunken px-4 py-2.5 text-sm text-ink-muted">
      <span className="font-bold text-ink">{state}</span>
      {card.mem.state !== MemState.New && (
        <>
          {', '}due {card.due <= now() ? 'now' : `in ${formatInterval(card.due - now())}`}, memory
          lasts about {formatInterval(card.mem.stability * 86_400_000)}, {card.mem.reps} reviews,{' '}
          {card.mem.lapses} lapses
        </>
      )}
    </p>
  )
}

const PREVIEW_ORDER: Format[] = ['mcq', 'truefalse', 'cloze', 'typed', 'flip', 'order', 'blurt']

function Preview({
  draft,
  card,
  peers
}: {
  draft: Draft
  card?: CardRecord
  peers: CardRecord[]
}): React.JSX.Element {
  const [format, setFormat] = useState<Format | null>(null)
  const [attempt, setAttempt] = useState(0)
  const content = toContent(draft).content
  const previewCard = ((): CardRecord | null => {
    if (!content) return null
    const mem = card?.mem ?? newMemory(now())
    const base: CardRecord = card ?? {
      ...content,
      id: 'preview',
      deckId: '',
      hash: '',
      mem,
      due: mem.due,
      suspended: 0,
      flagged: 0,
      leech: 0,
      createdAt: 0,
      updatedAt: 0
    }
    return { ...base, ...content, lastFormat: undefined }
  })()

  if (!previewCard) {
    return (
      <div className="rounded-card border-2 border-dashed border-line p-6 text-ink-muted">
        Fill in the card to preview how it will be asked.
      </div>
    )
  }
  const others = peers.filter((p) => p.id !== previewCard.id)
  const formats = PREVIEW_ORDER.filter((f) => capableFormats(previewCard, others.length).has(f))
  const active = format && formats.includes(format) ? format : formats[0]
  const question = buildQuestion(previewCard, active, others, seededRng(attempt + 1))
  const props = {
    card: previewCard,
    cards: [previewCard],
    feedback: undefined,
    onAnswer: () => undefined,
    grading: { accentStrict: false, typoTolerance: 'normal' as const }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-extrabold">Try it</p>
        <button
          type="button"
          onClick={() => setAttempt(attempt + 1)}
          className="text-sm font-bold text-accent hover:underline"
        >
          Reset
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {formats.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => {
              setFormat(f)
              setAttempt(attempt + 1)
            }}
            className={clsx(
              'rounded-full px-3 py-1 text-sm font-bold',
              f === active ? 'bg-accent text-white' : 'bg-sunken text-ink-muted hover:text-ink'
            )}
          >
            {FORMAT_LABEL[f]}
          </button>
        ))}
      </div>
      <div
        key={`${active}-${attempt}`}
        className="rounded-card bg-canvas p-5 [&_.font-display]:text-xl"
      >
        {question.type === 'mcq' && <McqView {...props} question={question} pretest={false} />}
        {question.type === 'truefalse' && <TrueFalseView {...props} question={question} />}
        {question.type === 'typed' && <TypedView {...props} question={question} />}
        {question.type === 'cloze' && <ClozeView {...props} question={question} />}
        {question.type === 'flip' && <FlipView {...props} question={question} />}
        {question.type === 'order' && <OrderView {...props} question={question} />}
        {question.type === 'blurt' && <BlurtView {...props} question={question} />}
      </div>
    </div>
  )
}

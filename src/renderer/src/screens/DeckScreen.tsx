import { useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import clsx from 'clsx'
import {
  ArrowLeftIcon,
  BrainIcon,
  CardsIcon,
  LightningIcon,
  PlayIcon,
  PlusCircleIcon,
  RepeatIcon,
  SquaresFourIcon
} from '@phosphor-icons/react'
import { db } from '../db/db'
import { summarise } from '../db/repo'
import { useNow, useSettings } from '../state/hooks'
import { deckStyle } from '../lib/deckColors'
import { Button } from '../components/ui/Button'
import { Panel, SectionTitle } from '../components/ui/Panel'
import { MemState } from '../core/types'
import { studyLink } from '../lib/links'

export function DeckScreen(): React.JSX.Element {
  const { deckId = '' } = useParams()
  const navigate = useNavigate()
  const settings = useSettings()
  const now = useNow()
  const data = useLiveQuery(async () => {
    const [deck, cards] = await Promise.all([
      db.decks.get(deckId),
      db.cards.where('deckId').equals(deckId).toArray()
    ])
    return { deck, cards }
  }, [deckId])

  const summary = useMemo(
    () => (data?.deck ? summarise(data.deck, data.cards, now, settings) : null),
    [data, now, settings]
  )
  const topics = useMemo(() => {
    const counts = new Map<string, number>()
    for (const c of data?.cards ?? [])
      if (c.topic) counts.set(c.topic, (counts.get(c.topic) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [data])

  if (!data) return <div className="p-10 text-ink-muted">Loading</div>
  if (!data.deck || !summary) {
    return (
      <div className="p-10">
        <p className="text-ink-muted">This deck no longer exists.</p>
        <Link to="/" className="font-bold text-accent">
          Back home
        </Link>
      </div>
    )
  }

  const deck = data.deck
  const here = `/deck/${deck.id}`
  const newToday = Math.min(summary.fresh, deck.newPerDay ?? settings.newPerDay)
  const studyCount = summary.due + newToday
  const masteredPct = summary.total ? summary.mastered / summary.total : 0
  const started = data.cards.filter((c) => c.mem.state !== MemState.New).length

  return (
    <div className="mx-auto max-w-[1100px] px-10 py-8" style={deckStyle(deck.color)}>
      <Link
        to="/"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-bold text-ink-muted hover:text-ink"
      >
        <ArrowLeftIcon size={16} /> All decks
      </Link>

      <div className="mb-8 flex flex-wrap items-center gap-6">
        <div className="grid size-24 shrink-0 place-items-center rounded-card bg-[var(--deck)] text-5xl shadow-[0_6px_0_var(--deck-press)]">
          {deck.emoji}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-4xl font-bold tracking-tight">{deck.name}</h1>
          <p className="mt-1 text-ink-muted">
            {[deck.subject, deck.level].filter(Boolean).join(' · ') || 'Deck'}
            {deck.description && <span className="block max-w-[65ch]">{deck.description}</span>}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Panel className="flex flex-col gap-6 p-7">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-extrabold text-ink-muted">Ready to study</p>
              <p className="tabular font-display text-5xl font-bold">{studyCount}</p>
              <p className="mt-1 text-ink-muted">
                {summary.due} due for review, {newToday} new today
              </p>
            </div>
            <Button
              size="xl"
              onClick={() => navigate(studyLink({ decks: deck.id, mode: 'review' }, here))}
            >
              <PlayIcon weight="fill" />
              {studyCount ? 'Study now' : 'Study'}
            </Button>
          </div>
          <div className="flex flex-wrap gap-3 border-t border-line pt-5">
            <Button
              variant="secondary"
              onClick={() => navigate(studyLink({ decks: deck.id, mode: 'learn', new: '1' }, here))}
              disabled={!summary.fresh}
            >
              <PlusCircleIcon /> Learn new cards
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                navigate(studyLink({ decks: deck.id, mode: 'practice', cram: '1' }, here))
              }
              disabled={!summary.total}
            >
              <RepeatIcon /> Practise everything
            </Button>
            <Button variant="ghost" onClick={() => navigate(`/browse?deck=${deck.id}`)}>
              <CardsIcon /> Browse cards
            </Button>
          </div>
        </Panel>

        <Panel className="flex flex-col justify-between gap-5 p-7">
          <div>
            <div className="flex items-baseline justify-between">
              <p className="text-sm font-extrabold text-ink-muted">Mastered</p>
              <p className="tabular font-display text-2xl font-bold">
                {Math.round(masteredPct * 100)}%
              </p>
            </div>
            <div className="mt-2 h-3 overflow-hidden rounded-full bg-sunken">
              <div
                className="h-full rounded-full bg-[var(--deck)] transition-[width] duration-700"
                style={{ width: `${Math.max(masteredPct * 100, masteredPct ? 2 : 0)}%` }}
              />
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
            <Metric icon={<CardsIcon />} label="Cards" value={summary.total} />
            <Metric icon={<SquaresFourIcon />} label="Started" value={started} />
            <Metric icon={<LightningIcon />} label="Learning" value={summary.learning} />
            <Metric icon={<BrainIcon />} label="Mastered" value={summary.mastered} />
          </dl>
        </Panel>
      </div>

      {topics.length > 1 && (
        <section className="mt-10">
          <SectionTitle>Practise a topic</SectionTitle>
          <p className="mt-1 mb-4 text-ink-muted">
            Mixed practice works best day to day. Focus on one topic when something is not clicking.
          </p>
          <div className="flex flex-wrap gap-2.5">
            {topics.map(([topic, n]) => (
              <button
                key={topic}
                type="button"
                onClick={() =>
                  navigate(studyLink({ decks: deck.id, mode: 'practice', cram: '1', topic }, here))
                }
                className={clsx(
                  'flex items-center gap-2 rounded-full border-2 border-line bg-surface px-4 py-2 font-bold transition-colors',
                  'hover:border-[var(--deck)] hover:bg-[var(--deck-soft)]'
                )}
              >
                {topic}
                <span className="tabular rounded-full bg-sunken px-2 text-sm text-ink-muted">
                  {n}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function Metric({
  icon,
  label,
  value
}: {
  icon: React.ReactNode
  label: string
  value: number
}): React.JSX.Element {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-sm font-bold text-ink-muted">
        {icon}
        {label}
      </dt>
      <dd className="tabular font-display text-2xl font-bold">{value}</dd>
    </div>
  )
}

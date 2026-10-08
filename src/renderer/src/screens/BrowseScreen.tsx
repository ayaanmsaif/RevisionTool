import { useDeferredValue, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import { useVirtualizer } from '@tanstack/react-virtual'
import clsx from 'clsx'
import { FlagIcon, MagnifyingGlassIcon, PlusIcon } from '@phosphor-icons/react'
import { normalise } from '../core/grading'
import { formatInterval, isMastered } from '../core/scheduler'
import { schedulerConfig } from '../core/settings'
import { MemState, type CardRecord } from '../core/types'
import { db } from '../db/db'
import { useNow, useSettings } from '../state/hooks'
import { Button } from '../components/ui/Button'
import { Segmented, inputClass } from '../components/ui/Controls'
import { CardEditor } from '../components/CardEditor'

type Filter = 'all' | 'new' | 'learning' | 'due' | 'mastered' | 'suspended' | 'leech' | 'flagged'

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'new', label: 'New' },
  { value: 'learning', label: 'Learning' },
  { value: 'due', label: 'Due' },
  { value: 'mastered', label: 'Mastered' },
  { value: 'flagged', label: 'Flagged' },
  { value: 'leech', label: 'Leeches' },
  { value: 'suspended', label: 'Suspended' }
]

type Status = { label: string; className: string }

export function BrowseScreen(): React.JSX.Element {
  const [params, setParams] = useSearchParams()
  const settings = useSettings()
  const now = useNow(60_000)
  const deckFilter = params.get('deck') ?? 'all'
  const [filter, setFilter] = useState<Filter>('all')
  const [topic, setTopic] = useState('all')
  const [search, setSearch] = useState('')
  const query = useDeferredValue(normalise(search))
  const [editing, setEditing] = useState<{ card?: CardRecord } | null>(null)
  const scroller = useRef<HTMLDivElement>(null)

  const data = useLiveQuery(async () => {
    const [decks, cards] = await Promise.all([db.decks.toArray(), db.cards.toArray()])
    return { decks, cards }
  }, [])
  const decks = useMemo(() => data?.decks ?? [], [data])
  const deckById = useMemo(() => new Map(decks.map((d) => [d.id, d])), [decks])
  const cfg = schedulerConfig(settings)

  const status = (c: CardRecord): Status => {
    if (c.suspended) return { label: 'Suspended', className: 'bg-sunken text-ink-muted' }
    if (c.mem.state === MemState.New) return { label: 'New', className: 'bg-gold-soft text-ink' }
    if (c.mem.state !== MemState.Review)
      return { label: 'Learning', className: 'bg-accent-soft text-accent' }
    if (c.due <= now) return { label: 'Due', className: 'bg-bad-soft text-ink' }
    if (isMastered(c.mem, now, cfg))
      return { label: 'Mastered', className: 'bg-good-soft text-ink' }
    return { label: `In ${formatInterval(c.due - now)}`, className: 'bg-sunken text-ink-muted' }
  }

  const inDeck = useMemo(
    () => (data?.cards ?? []).filter((c) => deckFilter === 'all' || c.deckId === deckFilter),
    [data, deckFilter]
  )
  const topics = useMemo(
    () => [...new Set(inDeck.map((c) => c.topic).filter((t): t is string => !!t))].sort(),
    [inDeck]
  )
  const rows = useMemo(() => {
    return inDeck
      .filter((c) => {
        if (topic !== 'all' && c.topic !== topic) return false
        switch (filter) {
          case 'new':
            return !c.suspended && c.mem.state === MemState.New
          case 'learning':
            return (
              !c.suspended &&
              (c.mem.state === MemState.Learning || c.mem.state === MemState.Relearning)
            )
          case 'due':
            return !c.suspended && c.mem.state !== MemState.New && c.due <= now
          case 'mastered':
            return !c.suspended && isMastered(c.mem, now, cfg)
          case 'suspended':
            return !!c.suspended
          case 'leech':
            return !!c.leech
          case 'flagged':
            return !!c.flagged
          default:
            return true
        }
      })
      .filter((c) => {
        if (!query) return true
        return normalise(
          `${c.q} ${c.a} ${c.topic ?? ''} ${c.tags.join(' ')} ${c.explain ?? ''}`
        ).includes(query)
      })
      .sort((a, b) => a.createdAt - b.createdAt)
  }, [inDeck, topic, filter, query, now, cfg])

  // TanStack Virtual manages its own state; the React compiler simply skips this hook.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtual = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scroller.current,
    estimateSize: () => 68,
    overscan: 12
  })

  const editorDeck = deckFilter !== 'all' ? deckFilter : decks[0]?.id

  return (
    <div className="mx-auto flex h-full max-w-[1180px] flex-col px-10 pt-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Cards</h1>
          <p className="mt-1.5 text-ink-muted">Search, edit, suspend or add cards by hand.</p>
        </div>
        <Button onClick={() => setEditing({})} disabled={!editorDeck}>
          <PlusIcon /> Add card
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1">
          <MagnifyingGlassIcon className="absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-faint" />
          <label htmlFor="card-search" className="sr-only">
            Search cards
          </label>
          <input
            id="card-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search questions, answers, topics"
            className={clsx(inputClass, 'pl-10')}
          />
        </div>
        <label htmlFor="deck-filter" className="sr-only">
          Deck
        </label>
        <select
          id="deck-filter"
          value={deckFilter}
          onChange={(e) => {
            setTopic('all')
            setParams(e.target.value === 'all' ? {} : { deck: e.target.value })
          }}
          className={clsx(inputClass, 'w-auto! max-w-64')}
        >
          <option value="all">All decks</option>
          {decks.map((d) => (
            <option key={d.id} value={d.id}>
              {d.emoji} {d.name}
            </option>
          ))}
        </select>
        {topics.length > 1 && (
          <>
            <label htmlFor="topic-filter" className="sr-only">
              Topic
            </label>
            <select
              id="topic-filter"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className={clsx(inputClass, 'w-auto! max-w-64')}
            >
              <option value="all">All topics</option>
              {topics.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </>
        )}
      </div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Segmented
          value={filter}
          options={FILTERS}
          onChange={setFilter}
          size="sm"
          label="Card state"
        />
        <p className="text-sm font-bold text-ink-muted">
          {rows.length.toLocaleString()} of {inDeck.length.toLocaleString()} cards
        </p>
      </div>

      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto pb-10">
        {data && rows.length === 0 && (
          <div className="rounded-card border-2 border-dashed border-line p-10 text-center text-ink-muted">
            {inDeck.length
              ? 'No cards match these filters.'
              : 'No cards yet. Import a deck or add a card.'}
          </div>
        )}
        <div className="relative" style={{ height: virtual.getTotalSize() }}>
          {virtual.getVirtualItems().map((item) => {
            const c = rows[item.index]
            const deck = deckById.get(c.deckId)
            const s = status(c)
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setEditing({ card: c })}
                className="absolute inset-x-0 flex items-center gap-4 rounded-control px-4 text-left hover:bg-surface"
                style={{ top: item.start, height: item.size }}
              >
                <span className="text-xl">{deck?.emoji}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">{c.q}</span>
                  <span className="block truncate text-sm text-ink-muted">{c.a}</span>
                </span>
                {c.flagged === 1 && (
                  <FlagIcon weight="fill" className="shrink-0 text-flame" aria-label="Flagged" />
                )}
                {c.topic && (
                  <span className="hidden max-w-40 shrink-0 truncate text-sm text-ink-faint lg:block">
                    {c.topic}
                  </span>
                )}
                {c.leech === 1 && (
                  <span className="shrink-0 rounded-full bg-bad-soft px-2.5 py-0.5 text-xs font-extrabold">
                    Leech
                  </span>
                )}
                <span
                  className={clsx(
                    'w-24 shrink-0 rounded-full px-2.5 py-0.5 text-center text-xs font-extrabold',
                    s.className
                  )}
                >
                  {s.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {editing && editorDeck && (
        <CardEditor
          card={editing.card}
          deckId={editing.card?.deckId ?? editorDeck}
          decks={decks}
          peers={(data?.cards ?? []).filter(
            (c) => c.deckId === (editing.card?.deckId ?? editorDeck)
          )}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

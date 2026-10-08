import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import clsx from 'clsx'
import {
  FireIcon,
  PlayIcon,
  PlusIcon,
  SnowflakeIcon,
  SparkleIcon,
  TrayArrowDownIcon
} from '@phosphor-icons/react'
import { studyDay } from '../core/clock'
import { viewStreak } from '../core/gamify'
import { formatInterval } from '../core/scheduler'
import { MemState } from '../core/types'
import { db } from '../db/db'
import { summarise, type DeckSummary } from '../db/repo'
import { useNow, useProfile, useSettings } from '../state/hooks'
import { toast } from '../state/toast'
import { deckStyle } from '../lib/deckColors'
import { studyLink } from '../lib/links'
import { importSampleDeck } from '../lib/sample'
import { announceAchievements } from '../lib/achievements'
import { Button } from '../components/ui/Button'
import { Panel, SectionTitle } from '../components/ui/Panel'
import { ProgressRing } from '../components/ProgressRing'

function greeting(now: number): string {
  const h = new Date(now).getHours()
  if (h < 5) return 'Up late'
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

export function HomeScreen(): React.JSX.Element {
  const navigate = useNavigate()
  const settings = useSettings()
  const profile = useProfile()
  const now = useNow()
  const data = useLiveQuery(async () => {
    const [decks, cards] = await Promise.all([db.decks.toArray(), db.cards.toArray()])
    return { decks, cards }
  }, [])

  const summaries = useMemo<DeckSummary[]>(() => {
    if (!data) return []
    return data.decks
      .map((d) =>
        summarise(
          d,
          data.cards.filter((c) => c.deckId === d.id),
          now,
          settings
        )
      )
      .sort((a, b) => b.due - a.due || b.deck.updatedAt - a.deck.updatedAt)
  }, [data, now, settings])

  const today = studyDay(now, settings.rolloverHour)
  const xpToday = profile.xpByDay[today] ?? 0
  const streak = viewStreak(profile.streak, today)
  const due = summaries.reduce((n, s) => n + s.due, 0)
  const freshAvailable = summaries.reduce(
    (n, s) => n + Math.min(s.fresh, s.deck.newPerDay ?? settings.newPerDay),
    0
  )
  const fresh = Math.min(freshAvailable, settings.newPerDay)
  const ready = due + fresh
  const nextDue = useMemo(() => {
    const upcoming = (data?.cards ?? [])
      .filter((c) => !c.suspended && c.mem.state !== MemState.New && c.due > now)
      .map((c) => c.due)
    return upcoming.length ? Math.min(...upcoming) : undefined
  }, [data, now])

  if (!data) return <div className="p-10 text-ink-muted">Loading</div>

  const streakLine = streak.doneToday
    ? 'Daily goal done. Your streak is safe.'
    : streak.count > 0
      ? `Earn ${Math.max(0, settings.dailyGoal - xpToday)} more XP today to keep your ${streak.count} day streak.`
      : `Earn ${settings.dailyGoal} XP today to start a streak.`

  return (
    <div className="mx-auto max-w-[1180px] px-10 py-10">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold tracking-tight">{greeting(now)}</h1>
        <p className="mt-1.5 text-ink-muted">
          {data.decks.length ? streakLine : 'Let us get your first deck ready.'}
        </p>
      </div>

      {data.decks.length === 0 ? (
        <FirstRun
          onSample={async () => {
            const s = await importSampleDeck()
            toast({
              tone: 'good',
              title: 'Sample deck added',
              body: `${s.added} cards ready to learn.`
            })
            void announceAchievements()
            navigate(`/deck/${s.deckId}`)
          }}
        />
      ) : (
        <>
          <Panel className="mb-10 grid gap-8 p-8 md:grid-cols-[minmax(0,1fr)_auto]">
            <div className="flex flex-col justify-between gap-6">
              <div>
                <p className="text-sm font-extrabold text-ink-muted">Ready to study</p>
                <p className="font-display text-6xl font-bold tracking-tight">{ready}</p>
                <p className="mt-1 text-ink-muted">
                  {ready
                    ? `${due} due for review and ${fresh} new, mixed across your decks.`
                    : nextDue
                      ? `All caught up. The next review is in ${formatInterval(nextDue - now)}.`
                      : 'All caught up.'}
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                {ready > 0 ? (
                  <Button size="xl" onClick={() => navigate(studyLink({ mode: 'review' }, '/'))}>
                    <PlayIcon weight="fill" /> Start studying
                  </Button>
                ) : (
                  <Button
                    size="xl"
                    variant="secondary"
                    onClick={() => navigate(studyLink({ mode: 'practice', cram: '1' }, '/'))}
                  >
                    Practise anyway
                  </Button>
                )}
              </div>
            </div>
            <div className="flex items-center gap-6 border-line md:border-l md:pl-8">
              <ProgressRing
                value={xpToday / settings.dailyGoal}
                size={132}
                stroke={13}
                color="var(--gold)"
              >
                <p className="font-display text-3xl font-bold">{xpToday}</p>
                <p className="text-xs font-bold text-ink-muted">of {settings.dailyGoal} XP</p>
              </ProgressRing>
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <FireIcon
                    size={34}
                    weight={streak.doneToday ? 'fill' : 'bold'}
                    className={streak.count ? 'text-flame' : 'text-ink-faint'}
                  />
                  <div>
                    <p className="font-display text-2xl leading-none font-bold">{streak.count}</p>
                    <p className="text-sm font-bold text-ink-muted">day streak</p>
                  </div>
                </div>
                {profile.streak.freezes > 0 && (
                  <p className="flex items-center gap-1.5 text-sm font-bold text-ink-muted">
                    <SnowflakeIcon className="text-[var(--heat-2)]" /> {profile.streak.freezes}{' '}
                    streak freeze{profile.streak.freezes === 1 ? '' : 's'}
                  </p>
                )}
              </div>
            </div>
          </Panel>

          <div className="mb-4 flex items-end justify-between">
            <SectionTitle>Your decks</SectionTitle>
            <Button variant="secondary" size="sm" onClick={() => navigate('/import')}>
              <TrayArrowDownIcon /> Import
            </Button>
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-5">
            {summaries.map((s) => (
              <DeckTile key={s.deck.id} summary={s} />
            ))}
            <Link
              to="/import"
              className="flex min-h-[208px] flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed border-line text-ink-muted transition-colors hover:border-accent hover:text-accent"
            >
              <PlusIcon size={28} />
              <span className="font-bold">Add a deck</span>
            </Link>
          </div>
        </>
      )}
    </div>
  )
}

function DeckTile({ summary: s }: { summary: DeckSummary }): React.JSX.Element {
  const mastered = s.total ? s.mastered / s.total : 0
  const started = s.total - s.fresh - s.suspended
  return (
    <Link
      to={`/deck/${s.deck.id}`}
      style={deckStyle(s.deck.color)}
      className="group flex flex-col overflow-hidden rounded-card border border-line bg-surface shadow-soft transition-transform hover:-translate-y-1"
    >
      <div className="flex h-24 items-start justify-between bg-[var(--deck)] p-4">
        <span className="text-5xl leading-none drop-shadow-sm">{s.deck.emoji}</span>
        {s.due > 0 ? (
          <span className="rounded-full bg-surface px-2.5 py-1 text-sm font-extrabold text-ink">
            {s.due} due
          </span>
        ) : s.fresh > 0 ? (
          <span className="rounded-full bg-surface/85 px-2.5 py-1 text-sm font-extrabold text-ink">
            {s.fresh} new
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <p className="line-clamp-2 font-display text-lg leading-tight font-bold">{s.deck.name}</p>
          <p className="mt-0.5 text-sm text-ink-muted">
            {s.total} cards{started > 0 ? `, ${started} started` : ''}
          </p>
        </div>
        <div className="mt-auto">
          <div className="mb-1 flex justify-between text-xs font-bold text-ink-muted">
            <span>Mastered</span>
            <span>{Math.round(mastered * 100)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-sunken">
            <div
              className={clsx('h-full rounded-full bg-[var(--deck)]')}
              style={{ width: `${mastered * 100}%` }}
            />
          </div>
        </div>
      </div>
    </Link>
  )
}

function FirstRun({ onSample }: { onSample: () => void }): React.JSX.Element {
  const navigate = useNavigate()
  return (
    <Panel className="grid gap-10 p-10 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="flex flex-col gap-5">
        <h2 className="font-display text-3xl font-bold tracking-tight">Make your first deck</h2>
        <p className="max-w-[52ch] text-ink-muted">
          Give your notes, slides or a PDF to Claude or ChatGPT with the RevisionTool prompt. Paste
          the reply here and every card becomes multiple choice, fill the gap, typed recall and
          more, scheduled by the FSRS memory model.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button size="lg" onClick={() => navigate('/import')}>
            <TrayArrowDownIcon /> Import from your AI
          </Button>
          <Button size="lg" variant="secondary" onClick={onSample}>
            <SparkleIcon /> Try the sample deck
          </Button>
        </div>
      </div>
      <ul className="flex flex-col gap-4 self-center text-[15px]">
        <Fact
          title="Guess first"
          body="New cards start with a quick guess. Getting it wrong first makes the answer stick."
        />
        <Fact
          title="Harder as you improve"
          body="Questions move from multiple choice to typing from memory as a card gets stronger."
        />
        <Fact title="Right on time" body="Each card comes back just before you would forget it." />
      </ul>
    </Panel>
  )
}

function Fact({ title, body }: { title: string; body: string }): React.JSX.Element {
  return (
    <li className="rounded-control bg-sunken px-4 py-3">
      <p className="font-extrabold">{title}</p>
      <p className="text-ink-muted">{body}</p>
    </li>
  )
}

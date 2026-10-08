import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import clsx from 'clsx'
import { CopyIcon, LockSimpleIcon, PauseIcon } from '@phosphor-icons/react'
import { DAY_MS, studyDay } from '../core/clock'
import { ACHIEVEMENTS, viewStreak } from '../core/gamify'
import { buildLeechPrompt } from '../core/prompt'
import { isMastered } from '../core/scheduler'
import { schedulerConfig } from '../core/settings'
import {
  dueForecast,
  lastDays,
  reviewsByDay,
  studyTimeMs,
  trueRetention,
  weeklyXp
} from '../core/stats'
import { MemState } from '../core/types'
import { db } from '../db/db'
import { updateCard } from '../db/repo'
import { useNow, useProfile, useSettings } from '../state/hooks'
import { copyText } from '../lib/clipboard'
import { ACHIEVEMENT_ICON } from '../lib/achievementIcons'
import { announceAchievements } from '../lib/achievements'
import { BarChart } from '../components/charts/BarChart'
import { Heatmap } from '../components/charts/Heatmap'
import { Button } from '../components/ui/Button'
import { PageHeader, Panel, SectionTitle } from '../components/ui/Panel'
import { RichText } from '../components/RichText'

function shortDate(day: string): string {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

function hours(ms: number): string {
  const min = Math.round(ms / 60_000)
  if (min < 60) return `${min} min`
  return `${(min / 60).toFixed(1)} h`
}

export function StatsScreen(): React.JSX.Element {
  const settings = useSettings()
  const profile = useProfile()
  const now = useNow(60_000)
  useEffect(() => {
    void announceAchievements()
  }, [])
  const data = useLiveQuery(async () => {
    const [decks, cards, reviews] = await Promise.all([
      db.decks.toArray(),
      db.cards.toArray(),
      db.reviews.toArray()
    ])
    return { decks, cards, reviews }
  }, [])

  const stats = useMemo(() => {
    if (!data) return null
    const { cards, reviews, decks } = data
    const cfg = schedulerConfig(settings)
    const r = settings.rolloverHour
    const byDay = reviewsByDay(reviews, r)
    const days30 = lastDays(now, 30, r)
    const retention = trueRetention(reviews, now - 30 * DAY_MS)
    const studyReviews = reviews.filter((x) => x.mode !== 'game')
    const mastered = cards.filter((c) => isMastered(c.mem, now, cfg))
    const deckRows = decks
      .map((d) => {
        const own = cards.filter((c) => c.deckId === d.id)
        const m = own.filter((c) => isMastered(c.mem, now, cfg)).length
        const started = own.filter((c) => c.mem.state !== MemState.New).length
        return { deck: d, total: own.length, mastered: m, started }
      })
      .sort((a, b) => b.total - a.total)
    const activeDays = [...byDay.keys()].filter((d) => d >= studyDay(now - 182 * DAY_MS, r)).length
    return {
      byDay,
      perDay: days30.map((d) => ({
        label: shortDate(d),
        full: shortDate(d),
        values: [byDay.get(d) ?? 0]
      })),
      forecast: dueForecast(cards, now, 30, r).map((f) => ({
        label: shortDate(f.day),
        full: shortDate(f.day),
        values: [f.count]
      })),
      retention,
      reviewsTotal: studyReviews.length,
      time: studyTimeMs(studyReviews),
      mastered: mastered.length,
      total: cards.length,
      deckRows,
      leeches: cards.filter((c) => c.leech && !c.suspended),
      activeDays
    }
  }, [data, now, settings])

  if (!data || !stats) return <div className="p-10 text-ink-muted">Loading</div>

  const streak = viewStreak(profile.streak, studyDay(now, settings.rolloverHour))
  const week = weeklyXp(profile.xpByDay, now, settings.rolloverHour)
  const weekTotal = week.thisWeek.reduce((a, b) => a + b, 0)
  const lastTotal = week.lastWeek.reduce((a, b) => a + b, 0)
  const unlocked = new Map(profile.achievements.map((a) => [a.id, a.at]))

  return (
    <div className="mx-auto max-w-[1180px] px-10 py-10">
      <PageHeader title="Stats" subtitle="How your memory is doing, and what is coming up." />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Tile
          label="Reviews"
          value={stats.reviewsTotal.toLocaleString()}
          note={`${hours(stats.time)} studied`}
          tone="accent"
        />
        <Tile
          label="True retention, 30 days"
          value={
            stats.retention.rate === null ? 'No data' : `${Math.round(stats.retention.rate * 100)}%`
          }
          note={`Target ${Math.round(settings.retention * 100)}%`}
          tone="good"
        />
        <Tile
          label="Streak"
          value={`${streak.count} days`}
          note={`Best ${profile.streak.best}`}
          tone="flame"
        />
        <Tile
          label="Mastered"
          value={stats.mastered.toLocaleString()}
          note={`of ${stats.total.toLocaleString()} cards`}
          tone="gold"
        />
      </div>

      <Panel className="mb-6 p-7">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <SectionTitle>Study calendar</SectionTitle>
          <p className="text-sm text-ink-muted">
            {stats.activeDays} day{stats.activeDays === 1 ? '' : 's'} studied in the last six months
          </p>
        </div>
        <div className="overflow-x-auto">
          <Heatmap counts={stats.byDay} now={now} rolloverHour={settings.rolloverHour} />
        </div>
      </Panel>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Panel className="p-7">
          <SectionTitle>Reviews per day</SectionTitle>
          <p className="mt-1 mb-5 text-sm text-ink-muted">Last 30 days</p>
          <BarChart
            title="Reviews per day, last 30 days"
            data={stats.perDay}
            series={[{ name: 'Reviews', color: 'var(--series-1)' }]}
            labelEvery={7}
          />
        </Panel>
        <Panel className="p-7">
          <SectionTitle>Coming up</SectionTitle>
          <p className="mt-1 mb-5 text-sm text-ink-muted">Cards due over the next 30 days</p>
          <BarChart
            title="Cards due, next 30 days"
            data={stats.forecast}
            series={[{ name: 'Due', color: 'var(--series-1)' }]}
            labelEvery={7}
          />
        </Panel>
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Panel className="p-7">
          <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <SectionTitle>This week against last week</SectionTitle>
              <p className="mt-1 text-sm text-ink-muted">Your only rival is past you.</p>
            </div>
            <p className="text-sm font-bold text-ink-muted">
              <span className="font-display text-2xl text-ink">{weekTotal}</span> XP vs {lastTotal}
            </p>
          </div>
          <BarChart
            title="XP per day, this week and last week"
            data={week.labels.map((l, i) => ({
              label: l,
              values: [week.thisWeek[i], week.lastWeek[i]]
            }))}
            series={[
              { name: 'This week', color: 'var(--series-1)' },
              { name: 'Last week', color: 'var(--series-2)' }
            ]}
          />
        </Panel>
        <Panel className="p-7">
          <SectionTitle>Decks</SectionTitle>
          <ul className="mt-5 flex flex-col gap-4">
            {stats.deckRows.length === 0 && <li className="text-ink-muted">No decks yet.</li>}
            {stats.deckRows.map((row) => {
              const pct = row.total ? row.mastered / row.total : 0
              return (
                <li key={row.deck.id}>
                  <Link to={`/deck/${row.deck.id}`} className="group block">
                    <div className="mb-1.5 flex items-center justify-between gap-3">
                      <span className="flex min-w-0 items-center gap-2 font-bold group-hover:text-accent">
                        <span>{row.deck.emoji}</span>
                        <span className="truncate">{row.deck.name}</span>
                      </span>
                      <span className="shrink-0 text-sm font-bold text-ink-muted">
                        {Math.round(pct * 100)}% mastered
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-sunken">
                      <div
                        className="h-full rounded-full bg-[var(--series-1)]"
                        style={{ width: `${pct * 100}%` }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-ink-faint">
                      {row.started} of {row.total} started
                    </p>
                  </Link>
                </li>
              )
            })}
          </ul>
        </Panel>
      </div>

      {stats.leeches.length > 0 && <Leeches cards={stats.leeches} />}

      <Panel className="p-7">
        <div className="mb-5 flex items-baseline justify-between">
          <SectionTitle>Achievements</SectionTitle>
          <p className="text-sm font-bold text-ink-muted">
            {unlocked.size} of {ACHIEVEMENTS.length}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {ACHIEVEMENTS.map((a) => {
            const Icon = ACHIEVEMENT_ICON[a.icon]
            const got = unlocked.has(a.id)
            return (
              <div
                key={a.id}
                className={clsx(
                  'flex items-center gap-3 rounded-control border-2 px-3.5 py-3',
                  got ? 'border-gold bg-gold-soft' : 'border-line opacity-70'
                )}
              >
                <span
                  className={clsx(
                    'grid size-10 shrink-0 place-items-center rounded-full',
                    got ? 'bg-gold text-[#2a1d00]' : 'bg-sunken text-ink-faint'
                  )}
                >
                  {got ? <Icon size={20} weight="fill" /> : <LockSimpleIcon size={18} />}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-extrabold">{a.title}</p>
                  <p className="text-xs text-ink-muted">{a.description}</p>
                </div>
              </div>
            )
          })}
        </div>
      </Panel>
    </div>
  )
}

function Tile({
  label,
  value,
  note,
  tone
}: {
  label: string
  value: string
  note: string
  tone: 'accent' | 'good' | 'flame' | 'gold'
}): React.JSX.Element {
  return (
    <div
      className={clsx(
        'rounded-card px-5 py-4',
        tone === 'accent' && 'bg-accent-soft',
        tone === 'good' && 'bg-good-soft',
        tone === 'gold' && 'bg-gold-soft',
        tone === 'flame' && 'bg-[color-mix(in_srgb,var(--flame)_14%,var(--surface))]'
      )}
    >
      <p className="text-sm font-extrabold text-ink-muted">{label}</p>
      <p className="mt-1 font-display text-3xl font-bold">{value}</p>
      <p className="text-sm text-ink-muted">{note}</p>
    </div>
  )
}

function Leeches({ cards }: { cards: import('../core/types').CardRecord[] }): React.JSX.Element {
  const [copied, setCopied] = useState(false)
  return (
    <Panel className="mb-6 border-2 border-bad/40 p-7">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <SectionTitle>Cards you keep forgetting</SectionTitle>
          <p className="mt-1 max-w-[60ch] text-ink-muted">
            These have been forgotten {6}+ times. Rewriting them usually fixes it: copy the prompt,
            give it to your AI, then import the reply. Your progress on each card is kept.
          </p>
        </div>
        <Button
          variant="secondary"
          onClick={async () => {
            await copyText(buildLeechPrompt(cards))
            setCopied(true)
            window.setTimeout(() => setCopied(false), 2000)
          }}
        >
          <CopyIcon /> {copied ? 'Copied' : 'Copy rewrite prompt'}
        </Button>
      </div>
      <ul className="flex flex-col gap-2">
        {cards.slice(0, 20).map((c) => (
          <li
            key={c.id}
            className="flex items-center gap-3 rounded-control bg-sunken px-4 py-2.5 text-[15px]"
          >
            <div className="min-w-0 flex-1">
              <RichText inline text={c.q} className="font-bold" />
              <span className="mx-2 text-ink-faint">→</span>
              <RichText inline text={c.a} className="text-ink-muted" />
            </div>
            <span className="shrink-0 text-xs font-bold text-ink-faint">{c.mem.lapses} lapses</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void updateCard(c.id, { suspended: 1 })}
            >
              <PauseIcon /> Suspend
            </Button>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

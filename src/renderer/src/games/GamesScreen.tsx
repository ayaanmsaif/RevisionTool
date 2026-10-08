import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useLiveQuery } from 'dexie-react-hooks'
import clsx from 'clsx'
import { ExamIcon, LightningIcon, SquaresFourIcon, TrophyIcon } from '@phosphor-icons/react'
import { db } from '../db/db'
import { useProfile } from '../state/hooks'
import { Button } from '../components/ui/Button'
import { PageHeader } from '../components/ui/Panel'
import { deckParam } from './pool'

export function GamesScreen(): React.JSX.Element {
  const navigate = useNavigate()
  const profile = useProfile()
  const decks = useLiveQuery(() => db.decks.toArray(), [])
  const [picked, setPicked] = useState<string[]>([])
  const q = deckParam(picked.length ? picked : undefined)
  const toggle = (id: string): void =>
    setPicked(picked.includes(id) ? picked.filter((p) => p !== id) : [...picked, id])

  return (
    <div className="mx-auto max-w-[1100px] px-10 py-10">
      <PageHeader
        title="Games"
        subtitle="Quick, fun retrieval practice. Games never change your review schedule, so play as much as you like."
      />

      <div className="mb-8">
        <p className="mb-3 text-sm font-extrabold">Play with</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setPicked([])}
            className={clsx(
              'rounded-full border-2 px-4 py-1.5 font-bold',
              picked.length === 0
                ? 'border-accent bg-accent-soft text-accent'
                : 'border-line text-ink-muted hover:text-ink'
            )}
          >
            All decks
          </button>
          {(decks ?? []).map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => toggle(d.id)}
              className={clsx(
                'rounded-full border-2 px-4 py-1.5 font-bold',
                picked.includes(d.id)
                  ? 'border-accent bg-accent-soft text-accent'
                  : 'border-line text-ink-muted hover:text-ink'
              )}
            >
              {d.emoji} {d.name}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <GameCard
          tone="accent"
          icon={<SquaresFourIcon size={34} weight="fill" />}
          title="Match"
          body="Clear a board of questions and answers as fast as you can. Wrong pairs add a second."
          best={
            profile.stats.matchBestMs !== undefined
              ? `${(profile.stats.matchBestMs / 1000).toFixed(1)}s`
              : undefined
          }
          onPlay={() => navigate(`/games/match${q}`)}
          big
        />
        <GameCard
          tone="gold"
          icon={<LightningIcon size={34} weight="fill" />}
          title="Blitz"
          body="60 seconds of true or false. Build a combo, but mistakes cost time."
          best={profile.stats.blitzBest ? String(profile.stats.blitzBest) : undefined}
          onPlay={() => navigate(`/games/blitz${q}`)}
        />
      </div>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-6 rounded-card border border-line bg-surface p-7 shadow-soft">
        <div className="flex items-center gap-5">
          <span className="grid size-16 shrink-0 place-items-center rounded-card bg-good-soft text-good">
            <ExamIcon size={34} weight="fill" />
          </span>
          <div>
            <p className="font-display text-2xl font-bold">Test yourself</p>
            <p className="mt-1 max-w-[60ch] text-ink-muted">
              Exam conditions: mixed questions with the answers held back until the end. Good the
              week before a real exam.
            </p>
          </div>
        </div>
        <Button variant="good" size="lg" onClick={() => navigate(`/games/test${q}`)}>
          Start a test
        </Button>
      </div>
    </div>
  )
}

function GameCard({
  tone,
  icon,
  title,
  body,
  best,
  onPlay,
  big
}: {
  tone: 'accent' | 'gold'
  icon: React.ReactNode
  title: string
  body: string
  best?: string
  onPlay: () => void
  big?: boolean
}): React.JSX.Element {
  return (
    <div
      className={clsx(
        'flex flex-col justify-between gap-8 rounded-card p-8',
        tone === 'accent' ? 'bg-accent text-white' : 'bg-gold-soft text-ink',
        big && 'min-h-64'
      )}
    >
      <div>
        <span
          className={clsx(
            'grid size-16 place-items-center rounded-card',
            tone === 'accent' ? 'bg-white/15' : 'bg-gold text-[#2a1d00]'
          )}
        >
          {icon}
        </span>
        <p className="mt-5 font-display text-3xl font-bold">{title}</p>
        <p
          className={clsx(
            'mt-2 max-w-[44ch]',
            tone === 'accent' ? 'text-white/85' : 'text-ink-muted'
          )}
        >
          {body}
        </p>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="flex items-center gap-2 font-extrabold">
          {best && (
            <>
              <TrophyIcon
                weight="fill"
                className={tone === 'accent' ? 'text-gold' : 'text-gold-press'}
              />{' '}
              Best {best}
            </>
          )}
        </span>
        <Button variant={tone === 'accent' ? 'secondary' : 'gold'} size="lg" onClick={onPlay}>
          Play
        </Button>
      </div>
    </div>
  )
}

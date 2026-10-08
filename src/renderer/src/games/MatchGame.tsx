import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import clsx from 'clsx'
import { ArrowCounterClockwiseIcon, TimerIcon, TrophyIcon, XIcon } from '@phosphor-icons/react'
import { sfx } from '../audio/sfx'
import { now } from '../core/clock'
import type { CardRecord } from '../core/types'
import { shuffle } from '../core/util'
import { recordGameAnswer, getSettings } from '../db/repo'
import { awardXp, recordGameBest } from '../db/progress'
import { celebrate } from '../lib/confetti'
import { announceAchievements } from '../lib/achievements'
import { useProfile } from '../state/hooks'
import { RichText } from '../components/RichText'
import { Button } from '../components/ui/Button'
import { pickMatchSet, useGamePool } from './pool'

const PAIRS = 6
const PENALTY_MS = 1000

interface Tile {
  key: string
  cardId: string
  text: string
}

function secs(ms: number): string {
  return (ms / 1000).toFixed(1)
}

export function MatchGame(): React.JSX.Element {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const deckIds = params.get('decks')?.split(',').filter(Boolean)
  const pool = useGamePool(deckIds)
  const [round, setRound] = useState(0)
  const cards = useMemo(
    () => (pool ? pickMatchSet(pool.cards, PAIRS) : []),
    // A new set each round.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pool?.cards.length, round]
  )

  if (!pool) return <div className="grid h-full place-items-center text-ink-muted">Loading</div>
  const close = (): void => {
    void navigate('/games')
  }
  if (cards.length < 3) {
    return (
      <div className="grid h-full place-items-center p-10 text-center">
        <div>
          <p className="font-display text-2xl font-bold">Not enough cards to match</p>
          <p className="mt-2 text-ink-muted">
            Match needs at least 3 short question and answer cards.
          </p>
          <Button className="mt-6" onClick={close}>
            Back to games
          </Button>
        </div>
      </div>
    )
  }
  return (
    <MatchBoard key={round} cards={cards} onAgain={() => setRound(round + 1)} onClose={close} />
  )
}

function MatchBoard({
  cards,
  onAgain,
  onClose
}: {
  cards: CardRecord[]
  onAgain: () => void
  onClose: () => void
}): React.JSX.Element {
  const reduce = useReducedMotion()
  const profile = useProfile()
  const tiles = useMemo<Tile[]>(
    () =>
      shuffle(
        cards.flatMap((c) => [
          { key: `${c.id}-q`, cardId: c.id, text: c.q },
          { key: `${c.id}-a`, cardId: c.id, text: c.a }
        ])
      ),
    [cards]
  )
  const [selected, setSelected] = useState<Tile | null>(null)
  const [done, setDone] = useState<Set<string>>(new Set())
  const [miss, setMiss] = useState<string[]>([])
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [penalty, setPenalty] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [result, setResult] = useState<{ ms: number; best: boolean } | null>(null)
  const mistakes = useRef(new Map<string, number>())

  useEffect(() => {
    if (startedAt === null || result) return
    const id = window.setInterval(() => setElapsed(now() - startedAt), 100)
    return () => window.clearInterval(id)
  }, [startedAt, result])

  const finish = async (doneSet: Set<string>): Promise<void> => {
    const ms = now() - (startedAt ?? now()) + penalty
    const best = await recordGameBest('match', ms)
    setResult({ ms, best })
    sfx.complete()
    if (best) celebrate(true)
    const settings = await getSettings()
    for (const c of cards) {
      if (!doneSet.has(c.id)) continue
      await recordGameAnswer(
        c,
        'match',
        (mistakes.current.get(c.id) ?? 0) ? 'close' : 'correct',
        ms / cards.length,
        now()
      )
    }
    await awardXp(cards.length * 2 + (ms < 30_000 ? 5 : 0), now(), settings)
    void announceAchievements()
  }

  const pick = (t: Tile): void => {
    if (result || done.has(t.cardId)) return
    if (startedAt === null) setStartedAt(now())
    if (!selected) {
      setSelected(t)
      sfx.tap()
      return
    }
    if (selected.key === t.key) {
      setSelected(null)
      return
    }
    if (selected.cardId === t.cardId) {
      const next = new Set(done).add(t.cardId)
      setDone(next)
      setSelected(null)
      sfx.correct(next.size)
      if (next.size === cards.length) void finish(next)
    } else {
      mistakes.current.set(selected.cardId, (mistakes.current.get(selected.cardId) ?? 0) + 1)
      setPenalty(penalty + PENALTY_MS)
      setMiss([selected.key, t.key])
      setSelected(null)
      sfx.wrong()
      window.setTimeout(() => setMiss([]), 400)
    }
  }

  const shown = result ? result.ms : elapsed + penalty
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-5 px-8 pt-6 pb-4">
        <button
          type="button"
          aria-label="Leave game"
          onClick={onClose}
          className="grid size-10 place-items-center rounded-control text-ink-faint hover:bg-sunken hover:text-ink"
        >
          <XIcon size={24} />
        </button>
        <p className="font-display text-xl font-bold">Match</p>
        <div className="ml-auto flex items-center gap-6 font-extrabold">
          {profile.stats.matchBestMs !== undefined && (
            <span className="flex items-center gap-1.5 text-ink-muted">
              <TrophyIcon weight="fill" className="text-gold" /> Best{' '}
              {secs(profile.stats.matchBestMs)}s
            </span>
          )}
          <span className="flex items-center gap-1.5 text-2xl tabular">
            <TimerIcon weight="fill" className="text-accent" /> {secs(shown)}s
          </span>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-8 pb-10">
        {result ? (
          <div className="mx-auto mt-16 max-w-[460px] text-center">
            <p className="font-display text-6xl font-bold">{secs(result.ms)}s</p>
            <p className="mt-2 text-lg text-ink-muted">
              {result.best ? 'New personal best.' : 'Cleared. Try to beat your best.'}
            </p>
            <div className="mt-8 flex justify-center gap-3">
              <Button variant="secondary" size="lg" onClick={onClose}>
                Done
              </Button>
              <Button size="lg" onClick={onAgain} autoFocus>
                <ArrowCounterClockwiseIcon /> Play again
              </Button>
            </div>
          </div>
        ) : (
          <>
            <p className="mx-auto mb-5 max-w-[980px] text-ink-muted">
              {startedAt === null
                ? 'Tap a question and its answer to clear them. The clock starts on your first tap.'
                : `Each wrong pair adds ${PENALTY_MS / 1000} second.`}
            </p>
            <div className="mx-auto grid max-w-[980px] grid-cols-3 gap-4 lg:grid-cols-4">
              <AnimatePresence>
                {tiles
                  .filter((t) => !done.has(t.cardId))
                  .map((t) => (
                    <motion.button
                      key={t.key}
                      type="button"
                      layout={!reduce}
                      onClick={() => pick(t)}
                      initial={false}
                      animate={
                        miss.includes(t.key) && !reduce ? { x: [0, -8, 8, -5, 5, 0] } : { x: 0 }
                      }
                      exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
                      transition={{ duration: 0.3 }}
                      className={clsx(
                        'flex min-h-28 items-center justify-center rounded-card border-2 p-4 text-center text-[15px] font-bold transition-colors',
                        selected?.key === t.key
                          ? 'border-accent bg-accent-soft'
                          : miss.includes(t.key)
                            ? 'border-bad bg-bad-soft'
                            : 'border-line bg-surface shadow-[0_4px_0_var(--line)] hover:border-ink-faint'
                      )}
                    >
                      <RichText inline text={t.text} />
                    </motion.button>
                  ))}
              </AnimatePresence>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

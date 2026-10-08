import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import clsx from 'clsx'
import {
  ArrowCounterClockwiseIcon,
  CheckIcon,
  FireIcon,
  LightningIcon,
  TrophyIcon,
  XIcon
} from '@phosphor-icons/react'
import { sfx } from '../audio/sfx'
import { now } from '../core/clock'
import { buildQuestion, type Question } from '../core/questions'
import { capableFormats } from '../core/formats'
import type { CardRecord } from '../core/types'
import { pick } from '../core/util'
import { getSettings, recordGameAnswer } from '../db/repo'
import { awardXp, recordGameBest } from '../db/progress'
import { celebrate } from '../lib/confetti'
import { announceAchievements } from '../lib/achievements'
import { useProfile } from '../state/hooks'
import { RichText } from '../components/RichText'
import { Button } from '../components/ui/Button'
import { Kbd } from '../components/ui/Controls'
import { useGamePool } from './pool'

const DURATION_MS = 60_000
const PENALTY_MS = 3_000

type TF = Extract<Question, { type: 'truefalse' }>

export function BlitzGame(): React.JSX.Element {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const deckIds = params.get('decks')?.split(',').filter(Boolean)
  const pool = useGamePool(deckIds)
  const [round, setRound] = useState(0)
  const close = (): void => {
    void navigate('/games')
  }
  if (!pool) return <div className="grid h-full place-items-center text-ink-muted">Loading</div>
  const playable = pool.cards.filter((c) =>
    capableFormats(c, pool.cards.length - 1).has('truefalse')
  )
  if (playable.length < 4) {
    return (
      <div className="grid h-full place-items-center p-10 text-center">
        <div>
          <p className="font-display text-2xl font-bold">Not enough cards for Blitz</p>
          <p className="mt-2 text-ink-muted">Blitz needs at least 4 question and answer cards.</p>
          <Button className="mt-6" onClick={close}>
            Back to games
          </Button>
        </div>
      </div>
    )
  }
  return (
    <BlitzRound
      key={round}
      cards={playable}
      pool={pool.cards}
      onAgain={() => setRound(round + 1)}
      onClose={close}
    />
  )
}

function BlitzRound({
  cards,
  pool,
  onAgain,
  onClose
}: {
  cards: CardRecord[]
  pool: CardRecord[]
  onAgain: () => void
  onClose: () => void
}): React.JSX.Element {
  const reduce = useReducedMotion()
  const profile = useProfile()
  const byId = useMemo(() => new Map(pool.map((c) => [c.id, c])), [pool])
  const next = useCallback((): TF => {
    const card = pick(cards)
    return buildQuestion(
      card,
      'truefalse',
      pool.filter((p) => p.deckId === card.deckId),
      Math.random
    ) as TF
  }, [cards, pool])

  const [started, setStarted] = useState<number | null>(null)
  const [penalty, setPenalty] = useState(0)
  const [left, setLeft] = useState(DURATION_MS)
  const [q, setQ] = useState<TF>(next)
  const [qKey, setQKey] = useState(0)
  const [score, setScore] = useState(0)
  const [combo, setCombo] = useState(0)
  const [flash, setFlash] = useState<'good' | 'bad' | null>(null)
  const [result, setResult] = useState<{ best: boolean } | null>(null)
  const shownAt = useRef(now())

  const end = useCallback(async (finalScore: number) => {
    const best = await recordGameBest('blitz', finalScore)
    setResult({ best })
    sfx.complete()
    if (best && finalScore > 0) celebrate(true)
    if (finalScore > 0) await awardXp(finalScore, now(), await getSettings())
    void announceAchievements()
  }, [])

  useEffect(() => {
    if (started === null || result) return
    const id = window.setInterval(() => {
      const remaining = DURATION_MS - (now() - started) - penalty
      setLeft(Math.max(0, remaining))
      if (remaining <= 0) {
        window.clearInterval(id)
        void end(score)
      }
    }, 100)
    return () => window.clearInterval(id)
  }, [started, penalty, result, score, end])

  const answer = (value: boolean): void => {
    if (result) return
    if (started === null) setStarted(now())
    const correct = value === q.isTrue
    const card = byId.get(q.cardId)
    if (card)
      void recordGameAnswer(
        card,
        'truefalse',
        correct ? 'correct' : 'wrong',
        now() - shownAt.current,
        now()
      )
    if (correct) {
      setScore(score + 1)
      setCombo(combo + 1)
      sfx.correct(combo + 1)
    } else {
      setCombo(0)
      setPenalty(penalty + PENALTY_MS)
      sfx.wrong()
    }
    setFlash(correct ? 'good' : 'bad')
    window.setTimeout(() => setFlash(null), 250)
    setQ(next())
    setQKey(qKey + 1)
    shownAt.current = now()
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const k = e.key.toLowerCase()
      if (k === 't' || k === 'arrowleft') answer(true)
      if (k === 'f' || k === 'arrowright') answer(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const pct = left / DURATION_MS
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-5 px-8 pt-6 pb-2">
        <button
          type="button"
          aria-label="Leave game"
          onClick={onClose}
          className="grid size-10 place-items-center rounded-control text-ink-faint hover:bg-sunken hover:text-ink"
        >
          <XIcon size={24} />
        </button>
        <div className="h-4 flex-1 overflow-hidden rounded-full bg-sunken">
          <div
            className={clsx(
              'h-full rounded-full transition-[width] duration-100',
              pct < 0.2 ? 'bg-bad' : 'bg-accent'
            )}
            style={{ width: `${pct * 100}%` }}
          />
        </div>
        <span className="w-14 text-right font-extrabold tabular">{Math.ceil(left / 1000)}s</span>
        <span
          className={clsx(
            'flex items-center gap-1 font-extrabold tabular',
            combo >= 2 ? 'text-flame' : 'text-ink-faint'
          )}
        >
          <FireIcon size={22} weight={combo >= 2 ? 'fill' : 'bold'} /> {combo}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-8 pb-10">
        {result ? (
          <div className="mx-auto mt-16 max-w-[460px] text-center">
            <LightningIcon size={56} weight="fill" className="mx-auto text-gold" />
            <p className="mt-3 font-display text-6xl font-bold">{score}</p>
            <p className="mt-2 text-lg text-ink-muted">
              {result.best && score > 0
                ? 'New personal best.'
                : `Best so far: ${profile.stats.blitzBest}`}
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
          <div className="mx-auto max-w-[760px] pt-8">
            <div className="mb-6 flex items-center justify-between">
              <p className="font-display text-xl font-bold">Blitz</p>
              <p className="flex items-center gap-4 font-extrabold">
                <span className="flex items-center gap-1.5 text-ink-muted">
                  <TrophyIcon weight="fill" className="text-gold" /> {profile.stats.blitzBest}
                </span>
                <span className="font-display text-3xl">{score}</span>
              </p>
            </div>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={qKey}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, y: -24 }}
                transition={{ duration: 0.16 }}
                className={clsx(
                  'min-h-48 rounded-card border-2 bg-surface p-7 transition-colors',
                  flash === 'good' ? 'border-good' : flash === 'bad' ? 'border-bad' : 'border-line'
                )}
              >
                {q.prompt ? (
                  <>
                    <RichText
                      text={q.prompt}
                      className="font-display text-[22px] leading-snug font-bold"
                    />
                    <div className="mt-4 flex items-baseline gap-3 border-t border-line pt-4">
                      <span className="text-sm font-extrabold text-ink-muted">Answer</span>
                      <RichText text={q.statement} className="text-xl font-bold text-accent" />
                    </div>
                  </>
                ) : (
                  <RichText
                    text={q.statement}
                    className="font-display text-[24px] leading-snug font-bold"
                  />
                )}
              </motion.div>
            </AnimatePresence>
            <div className="mt-6 grid grid-cols-2 gap-4">
              <Button variant="good" size="xl" onClick={() => answer(true)}>
                <CheckIcon weight="bold" /> True <Kbd>T</Kbd>
              </Button>
              <Button variant="bad" size="xl" onClick={() => answer(false)}>
                <XIcon weight="bold" /> False <Kbd>F</Kbd>
              </Button>
            </div>
            <p className="mt-5 text-center text-sm text-ink-muted">
              {started === null
                ? 'The clock starts with your first answer. Wrong answers cost 3 seconds.'
                : 'Arrow keys work too: left for true, right for false.'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import clsx from 'clsx'
import { FireIcon, HeartIcon, StarIcon, XIcon } from '@phosphor-icons/react'
import { sfx } from '../audio/sfx'
import { celebrate } from '../lib/confetti'
import { FORMAT_LABEL } from '../core/questions'
import type { StudyMode } from '../core/types'
import { useLoadedSettings } from '../state/hooks'
import { DEFAULT_SETTINGS } from '../core/settings'
import { toast } from '../state/toast'
import { Button } from '../components/ui/Button'
import { useStudy } from './useStudy'
import { FeedbackSheet } from './FeedbackSheet'
import { LessonSummaryView } from './LessonSummary'
import { StudyEmpty } from './EmptyState'
import type { StudyItem, StudyState, Feedback, ResultIn } from './controller'
import type { ViewProps } from './views/shared'
import { McqView } from './views/McqView'
import { TrueFalseView } from './views/TrueFalseView'
import { TypedView } from './views/TypedView'
import { ClozeView } from './views/ClozeView'
import { FlipView } from './views/FlipView'
import { OrderView } from './views/OrderView'
import { BlurtView } from './views/BlurtView'
import { MatchView } from './views/MatchView'

/** Formats where the student has already seen the answer: move on automatically. */
const AUTO_CONTINUE = new Set(['flip', 'blurt', 'match'])

export function StudyScreen(): React.JSX.Element {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const loaded = useLoadedSettings()
  const settings = loaded ?? DEFAULT_SETTINGS

  const opts = useMemo(
    () => ({
      mode: (params.get('mode') as StudyMode) ?? 'review',
      deckIds: params.get('decks')?.split(',').filter(Boolean),
      topic: params.get('topic') ?? undefined,
      newOnly: params.get('new') === '1',
      cram: params.get('cram') === '1'
    }),
    [params]
  )
  const { controller, state } = useStudy(opts, settings, !!loaded)
  const [confirmExit, setConfirmExit] = useState(false)
  const back = params.get('back') ?? '/'

  const exit = (): void => {
    void navigate(back)
  }
  const requestExit = (): void => {
    if (state && state.phase !== 'summary' && state.phase !== 'empty' && state.progress.done > 0) {
      setConfirmExit(true)
    } else exit()
  }

  useStudyEffects(state)

  // Enter continues from feedback; Escape asks to leave.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        if (confirmExit) setConfirmExit(false)
        else requestExit()
      }
      if (e.key === 'Enter' && state?.phase === 'feedback' && !confirmExit) {
        e.preventDefault()
        void controller?.continue()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // Auto-advance after formats where the answer was already visible.
  useEffect(() => {
    if (state?.phase !== 'feedback' || !state.item || !AUTO_CONTINUE.has(state.item.format)) return
    const id = window.setTimeout(() => void controller?.continue(), 1100)
    return () => window.clearTimeout(id)
  }, [state?.phase, state?.item, controller])

  if (!state || (state.phase === 'loading' && !state.item)) {
    return (
      <div className="grid h-full place-items-center text-ink-muted">Getting your cards ready</div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-canvas">
      {state.phase !== 'summary' && state.phase !== 'empty' && (
        <TopBar state={state} onExit={requestExit} />
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {state.phase === 'summary' && state.summary && (
          <LessonSummaryView
            summary={state.summary}
            onKeepGoing={() => void controller?.keepGoing()}
            onDone={exit}
          />
        )}
        {state.phase === 'empty' && (
          <StudyEmpty
            nextDue={state.nextDue}
            newWaiting={state.newWaiting}
            onMoreNew={() => void controller?.extend('more-new')}
            onCram={() => void controller?.extend('cram')}
            onBack={exit}
          />
        )}
        {state.item &&
          (state.phase === 'question' ||
            state.phase === 'feedback' ||
            state.phase === 'loading') && (
            <QuestionStage
              item={state.item}
              feedback={state.feedback}
              onAnswer={(r) => void controller?.answer(r)}
              grading={{
                accentStrict: settings.accentStrict,
                typoTolerance: settings.typoTolerance
              }}
            />
          )}
      </div>

      <AnimatePresence>
        {state.phase === 'feedback' && state.item && state.feedback && (
          <FeedbackSheet
            key={state.item.key}
            item={state.item}
            feedback={state.feedback}
            onContinue={() => void controller?.continue()}
            onOverride={() => void controller?.override()}
          />
        )}
      </AnimatePresence>

      {confirmExit && <ConfirmExit onStay={() => setConfirmExit(false)} onLeave={exit} />}
    </div>
  )
}

function TopBar({ state, onExit }: { state: StudyState; onExit: () => void }): React.JSX.Element {
  const reduce = useReducedMotion()
  const pct = state.progress.total ? state.progress.done / state.progress.total : 0
  return (
    <div className="flex items-center gap-5 px-8 pt-6 pb-2">
      <button
        type="button"
        aria-label="Leave lesson"
        onClick={onExit}
        className="grid size-10 place-items-center rounded-control text-ink-faint hover:bg-sunken hover:text-ink"
      >
        <XIcon size={24} />
      </button>
      <div className="h-4 flex-1 overflow-hidden rounded-full bg-sunken">
        <motion.div
          className="h-full rounded-full bg-good"
          initial={false}
          animate={{ width: `${Math.max(pct * 100, 3)}%` }}
          transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 120, damping: 20 }}
        />
      </div>
      {state.hearts !== null && (
        <span className="flex items-center gap-1.5 font-extrabold text-bad tabular">
          <HeartIcon size={22} weight="fill" /> {state.hearts}
        </span>
      )}
      <motion.span
        key={state.combo}
        initial={reduce || state.combo < 2 ? false : { scale: 1.35 }}
        animate={{ scale: 1 }}
        className={clsx(
          'flex min-w-12 items-center gap-1 font-extrabold tabular',
          state.combo >= 2 ? 'text-flame' : 'text-ink-faint'
        )}
        aria-label={`${state.combo} in a row`}
      >
        <FireIcon size={22} weight={state.combo >= 2 ? 'fill' : 'bold'} /> {state.combo}
      </motion.span>
      <span className="flex min-w-16 items-center gap-1 font-extrabold text-gold-press tabular dark:text-gold">
        <StarIcon size={20} weight="fill" /> {state.sessionXp}
      </span>
    </div>
  )
}

function QuestionStage({
  item,
  feedback,
  onAnswer,
  grading
}: {
  item: StudyItem
  feedback?: Feedback
  onAnswer: (r: ResultIn[]) => void
  grading: ViewProps['grading']
}): React.JSX.Element {
  const reduce = useReducedMotion()
  const card = item.cards[0]
  const props: ViewProps = { card, cards: item.cards, feedback, onAnswer, grading }
  const q = item.question
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={item.key}
        initial={reduce ? { opacity: 0 } : { opacity: 0, x: 48 }}
        animate={{ opacity: 1, x: 0 }}
        exit={reduce ? { opacity: 0 } : { opacity: 0, x: -48 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="mx-auto w-full max-w-[820px] px-8 pt-8 pb-16"
      >
        <div className="mb-5 flex items-center gap-2">
          <span className="rounded-full bg-accent-soft px-3 py-1 text-sm font-extrabold text-accent">
            {FORMAT_LABEL[item.format]}
          </span>
          {item.stage === 'new' && item.format !== 'match' && (
            <span className="rounded-full bg-gold-soft px-3 py-1 text-sm font-extrabold text-gold-press dark:text-gold">
              New card
            </span>
          )}
          {card.topic && item.format !== 'match' && (
            <span className="text-sm font-bold text-ink-faint">{card.topic}</span>
          )}
        </div>
        {q.type === 'mcq' && <McqView {...props} question={q} pretest={item.stage === 'new'} />}
        {q.type === 'truefalse' && <TrueFalseView {...props} question={q} />}
        {q.type === 'typed' && <TypedView {...props} question={q} />}
        {q.type === 'cloze' && <ClozeView {...props} question={q} />}
        {q.type === 'flip' && <FlipView {...props} question={q} />}
        {q.type === 'order' && <OrderView {...props} question={q} />}
        {q.type === 'blurt' && <BlurtView {...props} question={q} />}
        {q.type === 'match' && <MatchView {...props} question={q} />}
      </motion.div>
    </AnimatePresence>
  )
}

/** Sounds, confetti and toasts that react to session events. */
function useStudyEffects(state: StudyState | null): void {
  const lastFeedback = useRef<Feedback | undefined>(undefined)
  const lastSummary = useRef<unknown>(undefined)
  const fb = state?.feedback
  const summary = state?.summary

  useEffect(() => {
    if (!fb || fb === lastFeedback.current) return
    const prev = lastFeedback.current
    lastFeedback.current = fb
    // The same answer re-rendered with level/goal info: only play the extras.
    const sameAnswer = prev && prev.results === fb.results
    if (!sameAnswer) {
      if (fb.verdict === 'correct') sfx.correct(fb.combo)
      else if (fb.verdict === 'close') sfx.close()
      else sfx.wrong()
      if (fb.comboMilestone) window.setTimeout(() => sfx.combo(fb.combo / 5), 260)
      if (fb.heartLost) window.setTimeout(() => sfx.heart(), 200)
    }
    if (fb.leveledUp && !prev?.leveledUp) {
      window.setTimeout(() => sfx.levelUp(), 300)
      celebrate(true)
    }
    if (fb.goalJustMet && !prev?.goalJustMet) {
      toast({ tone: 'gold', title: 'Daily goal reached', body: 'Your streak is safe for today.' })
    }
  }, [fb])

  useEffect(() => {
    if (!summary || summary === lastSummary.current) return
    lastSummary.current = summary
    if (summary.outOfHearts) return
    sfx.complete()
    if (summary.accuracy >= 0.9) celebrate(summary.perfect)
    if (summary.achievements.length) window.setTimeout(() => sfx.achievement(), 900)
  }, [summary])
}

function ConfirmExit({
  onStay,
  onLeave
}: {
  onStay: () => void
  onLeave: () => void
}): React.JSX.Element {
  return (
    <div
      className="fixed inset-0 grid place-items-center bg-black/40 p-6"
      style={{ zIndex: 'var(--z-modal)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="leave-title"
    >
      <div className="w-full max-w-[420px] rounded-card bg-surface p-7 shadow-soft">
        <h2 id="leave-title" className="font-display text-2xl font-bold">
          Leave this lesson?
        </h2>
        <p className="mt-2 text-ink-muted">
          Every answer so far is saved. You can pick up where you left off.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={onLeave}>
            Leave
          </Button>
          <Button onClick={onStay} autoFocus>
            Keep studying
          </Button>
        </div>
      </div>
    </div>
  )
}

import { motion, useReducedMotion } from 'motion/react'
import clsx from 'clsx'
import {
  CheckCircleIcon,
  FireIcon,
  LightbulbIcon,
  StarIcon,
  WarningCircleIcon,
  XCircleIcon
} from '@phosphor-icons/react'
import { Button } from '../components/ui/Button'
import { Kbd } from '../components/ui/Controls'
import { RichText } from '../components/RichText'
import { fillCloze } from '../core/questions'
import type { Feedback, StudyItem } from './controller'

const PRAISE = ['Correct', 'Nice one', 'Spot on', 'Great recall', 'Nailed it']

function headline(fb: Feedback, key: number): { title: string; sub?: string } {
  if (fb.verdict === 'correct') {
    if (fb.note === 'accent')
      return { title: PRAISE[key % PRAISE.length], sub: 'Watch the accents.' }
    if (fb.note === 'rounding') return { title: 'Correct', sub: 'Accepted after rounding.' }
    return { title: PRAISE[key % PRAISE.length] }
  }
  if (fb.verdict === 'close') {
    const sub =
      fb.note === 'typo'
        ? 'Check the spelling.'
        : fb.note === 'accent'
          ? 'Check the accents.'
          : fb.note === 'article'
            ? 'Check the article.'
            : fb.note === 'unit'
              ? 'Check the unit.'
              : undefined
    return { title: 'Almost', sub }
  }
  if (fb.pretest) {
    return {
      title: 'Good guess. Now you know.',
      sub: 'Guessing before you learn makes the answer stick.'
    }
  }
  return { title: 'Not quite' }
}

/** The answer to show after a question, by format. */
function correctAnswer(item: StudyItem, fb: Feedback): React.ReactNode {
  const card = item.cards[0]
  const q = item.question
  if (fb.verdict === 'correct' && !fb.note) return null
  switch (q.type) {
    case 'mcq':
    case 'typed':
      return <RichText text={card.a} className="font-bold" />
    case 'truefalse':
      return (
        <span>
          It is {q.isTrue ? 'true' : 'false'}.{' '}
          {!q.isTrue && <RichText inline text={q.correction} className="font-bold" />}
        </span>
      )
    case 'cloze':
      return <RichText text={fillCloze(card.cloze ?? card.a)} className="font-bold" />
    case 'order':
      return (
        <ol className="list-decimal pl-5 font-bold">
          {card.steps.map((s, i) => (
            <li key={i}>
              <RichText inline text={s} />
            </li>
          ))}
        </ol>
      )
    default:
      return null
  }
}

export function FeedbackSheet({
  item,
  feedback,
  onContinue,
  onOverride
}: {
  item: StudyItem
  feedback: Feedback
  onContinue: () => void
  onOverride: () => void
}): React.JSX.Element {
  const reduce = useReducedMotion()
  const { title, sub } = headline(feedback, item.key)
  const answer = correctAnswer(item, feedback)
  const explain = item.cards.length === 1 ? item.cards[0].explain : undefined
  const tone =
    feedback.verdict === 'correct' ? 'good' : feedback.verdict === 'close' ? 'gold' : 'bad'
  const Icon = tone === 'good' ? CheckCircleIcon : tone === 'gold' ? WarningCircleIcon : XCircleIcon
  const given = feedback.results[0]?.given
  const showGiven = item.format === 'typed' && feedback.verdict !== 'correct' && given

  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { y: '100%' }}
      animate={reduce ? { opacity: 1 } : { y: 0 }}
      transition={{ type: 'spring', stiffness: 420, damping: 36 }}
      className={clsx(
        'border-t-2',
        tone === 'good' && 'border-good bg-good-soft',
        tone === 'gold' && 'border-gold bg-gold-soft',
        tone === 'bad' && 'border-bad bg-bad-soft'
      )}
      role="status"
    >
      <div className="mx-auto flex max-w-[820px] flex-wrap items-center gap-x-8 gap-y-4 px-8 py-6">
        <div className="flex min-w-0 flex-1 items-start gap-4">
          <Icon
            size={40}
            weight="fill"
            className={clsx(
              'shrink-0',
              tone === 'good' && 'text-good',
              tone === 'gold' && 'text-gold-press',
              tone === 'bad' && 'text-bad'
            )}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <p className="font-display text-2xl font-bold tracking-tight">{title}</p>
              {feedback.xp > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-gold px-2.5 py-0.5 text-sm font-extrabold text-[#2a1d00]">
                  <StarIcon size={14} weight="fill" /> +{feedback.xp} XP
                </span>
              )}
              {feedback.comboMilestone && (
                <span className="inline-flex items-center gap-1 rounded-full bg-flame px-2.5 py-0.5 text-sm font-extrabold text-white">
                  <FireIcon size={14} weight="fill" /> {feedback.combo} in a row
                </span>
              )}
            </div>
            {sub && <p className="mt-0.5 font-bold text-ink-muted">{sub}</p>}
            {showGiven && (
              <p className="mt-2 text-ink-muted">
                You wrote{' '}
                <span className="font-bold text-ink line-through decoration-2">{given}</span>
              </p>
            )}
            {answer && (
              <div className="mt-2 flex items-baseline gap-2">
                <span className="shrink-0 text-sm font-extrabold text-ink-muted">Answer</span>
                <div className="min-w-0">{answer}</div>
              </div>
            )}
            {explain && (
              <div className="mt-3 flex items-start gap-2 text-ink">
                <LightbulbIcon size={18} className="mt-1 shrink-0 text-ink-muted" />
                <RichText text={explain} className="min-w-0" />
              </div>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {feedback.overridable && (
            <Button variant="ghost" size="sm" onClick={onOverride}>
              I was right
            </Button>
          )}
          <Button variant={tone} size="lg" onClick={onContinue} autoFocus>
            Continue <Kbd>Enter</Kbd>
          </Button>
        </div>
      </div>
    </motion.div>
  )
}

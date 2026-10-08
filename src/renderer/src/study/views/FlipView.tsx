import { useEffect, useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import clsx from 'clsx'
import { RichText } from '../../components/RichText'
import { Kbd } from '../../components/ui/Controls'
import { Button } from '../../components/ui/Button'
import { now } from '../../core/clock'
import type { Question } from '../../core/questions'
import { isTyping } from './keys'
import { formatInterval, previewIntervals } from '../../core/scheduler'
import { Rating, type RatingValue, type Verdict } from '../../core/types'
import { sfx } from '../../audio/sfx'
import type { ViewProps } from './shared'

type Flip = Extract<Question, { type: 'flip' }>

const RATINGS: {
  rating: RatingValue
  label: string
  verdict: Verdict
  variant: 'bad' | 'gold' | 'good' | 'primary'
}[] = [
  { rating: Rating.Again, label: 'Forgot', verdict: 'wrong', variant: 'bad' },
  { rating: Rating.Hard, label: 'Hard', verdict: 'close', variant: 'gold' },
  { rating: Rating.Good, label: 'Good', verdict: 'correct', variant: 'good' },
  { rating: Rating.Easy, label: 'Easy', verdict: 'correct', variant: 'primary' }
]

export function FlipView({
  question,
  card,
  feedback,
  onAnswer
}: ViewProps & { question: Flip }): React.JSX.Element {
  const [shown, setShown] = useState(false)
  const reduce = useReducedMotion()
  const intervals = useMemo(() => previewIntervals(card.mem, now()), [card.mem])
  const locked = !!feedback

  const reveal = (): void => {
    if (shown) return
    sfx.flip()
    setShown(true)
  }
  const rate = (r: (typeof RATINGS)[number]): void => {
    if (!shown || locked) return
    onAnswer([{ cardId: question.cardId, verdict: r.verdict, selfRating: r.rating }])
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (isTyping(e)) return
      if (!shown && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault()
        reveal()
        return
      }
      const n = Number(e.key)
      if (shown && n >= 1 && n <= 4) rate(RATINGS[n - 1])
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div>
      <p className="mb-3 font-bold text-ink-muted">Recall the answer, then check yourself</p>
      <div className="relative [perspective:1400px]">
        <motion.div
          animate={{ rotateY: shown && !reduce ? 180 : 0 }}
          transition={{ type: 'spring', stiffness: 160, damping: 20 }}
          style={{ transformStyle: 'preserve-3d' }}
          className="relative min-h-[260px]"
        >
          <div
            className="absolute inset-0 flex flex-col justify-center rounded-card border-2 border-line bg-surface p-8 [backface-visibility:hidden]"
            style={{ opacity: reduce && shown ? 0 : 1 }}
          >
            <RichText
              text={question.prompt}
              className="font-display text-[26px] leading-snug font-bold tracking-tight"
            />
          </div>
          <div
            className={clsx(
              'absolute inset-0 flex flex-col justify-center gap-4 overflow-y-auto rounded-card border-2 border-accent bg-accent-soft p-8 [backface-visibility:hidden]',
              !reduce && '[transform:rotateY(180deg)]'
            )}
            style={{ opacity: reduce && !shown ? 0 : 1 }}
          >
            <RichText text={question.prompt} className="text-sm font-bold text-ink-muted" />
            <RichText
              text={question.answer}
              className="font-display text-[24px] leading-snug font-bold tracking-tight"
            />
            {card.explain && <RichText text={card.explain} className="text-ink-muted" />}
          </div>
        </motion.div>
      </div>

      <div className="mt-6">
        {!shown ? (
          <Button size="lg" block onClick={reveal}>
            Show answer <Kbd>Space</Kbd>
          </Button>
        ) : (
          <div className="grid grid-cols-4 gap-3">
            {RATINGS.map((r, i) => (
              <Button
                key={r.rating}
                variant={r.variant}
                size="lg"
                onClick={() => rate(r)}
                disabled={locked}
                className="flex-col !h-auto py-3"
              >
                <span>{r.label}</span>
                <span className="text-xs font-bold opacity-85">
                  {formatInterval(intervals[r.rating])}{' '}
                  <span className="opacity-70">({i + 1})</span>
                </span>
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

import { useState } from 'react'
import clsx from 'clsx'
import { CheckIcon } from '@phosphor-icons/react'
import { Button } from '../../components/ui/Button'
import { RichText } from '../../components/RichText'
import { inputClass } from '../../components/ui/Controls'
import { POINT_DETECT_THRESHOLD, pointCoverage } from '../../core/grading'
import type { Question } from '../../core/questions'
import { ratingForCoverage } from '../../core/scheduler'
import type { Verdict } from '../../core/types'
import { Prompt, type ViewProps } from './shared'

type Blurt = Extract<Question, { type: 'blurt' }>

export function BlurtView({
  question,
  card,
  feedback,
  onAnswer
}: ViewProps & { question: Blurt }): React.JSX.Element {
  const [text, setText] = useState('')
  const [marking, setMarking] = useState(false)
  const [ticked, setTicked] = useState<boolean[]>([])
  const locked = !!feedback

  const startMarking = (): void => {
    setTicked(
      question.points.map((p) => pointCoverage(text, p, question.prompt) >= POINT_DETECT_THRESHOLD)
    )
    setMarking(true)
  }

  const finish = (): void => {
    const got = ticked.filter(Boolean).length
    const coverage = got / question.points.length
    const verdict: Verdict = coverage >= 0.7 ? 'correct' : coverage >= 0.4 ? 'close' : 'wrong'
    onAnswer([
      {
        cardId: question.cardId,
        verdict,
        selfRating: ratingForCoverage(coverage),
        units: got,
        given: `${got} of ${question.points.length} points`
      }
    ])
  }

  return (
    <div>
      <Prompt
        text={question.prompt}
        sub={
          marking
            ? 'Tick every point you covered. Points the app spotted are already ticked.'
            : 'Write down everything you can remember. Bullet points are fine.'
        }
      />
      {!marking ? (
        <>
          <label htmlFor="blurt" className="sr-only">
            Your answer
          </label>
          <textarea
            id="blurt"
            autoFocus
            rows={8}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className={clsx(inputClass, 'resize-y text-[17px] leading-relaxed')}
          />
          <div className="mt-5 flex items-center justify-between">
            <p className="text-sm text-ink-muted">{question.points.length} key points to find</p>
            <Button size="lg" onClick={startMarking}>
              Mark it
            </Button>
          </div>
        </>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="max-h-80 overflow-y-auto rounded-card border-2 border-line bg-sunken p-5 whitespace-pre-wrap text-ink-muted">
            {text.trim() || 'You did not write anything.'}
          </div>
          <div className="flex flex-col gap-2.5">
            {question.points.map((p, i) => (
              <button
                key={i}
                type="button"
                disabled={locked}
                onClick={() => setTicked(ticked.map((t, j) => (j === i ? !t : t)))}
                className={clsx(
                  'flex items-start gap-3 rounded-control border-2 px-4 py-3 text-left font-bold transition-colors',
                  ticked[i]
                    ? 'border-good bg-good-soft'
                    : 'border-line bg-surface hover:border-ink-faint'
                )}
              >
                <span
                  className={clsx(
                    'mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border-2',
                    ticked[i] ? 'border-good bg-good text-white' : 'border-ink-faint'
                  )}
                >
                  {ticked[i] && <CheckIcon size={12} weight="bold" />}
                </span>
                <RichText inline text={p} />
              </button>
            ))}
            {card.explain && (
              <RichText text={card.explain} className="mt-2 text-sm text-ink-muted" />
            )}
            {!locked && (
              <Button size="lg" className="mt-2 self-end" onClick={finish}>
                Done, {ticked.filter(Boolean).length} of {question.points.length}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

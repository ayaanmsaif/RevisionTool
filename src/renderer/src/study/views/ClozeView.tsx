import { Fragment, useRef, useState } from 'react'
import clsx from 'clsx'
import { LightbulbIcon } from '@phosphor-icons/react'
import { Button } from '../../components/ui/Button'
import { RichText } from '../../components/RichText'
import { gradeText, type GradeResult } from '../../core/grading'
import type { Question } from '../../core/questions'
import type { Verdict } from '../../core/types'
import type { ViewProps } from './shared'
import { verdictClass } from './style'

type Cloze = Extract<Question, { type: 'cloze' }>

export function ClozeView({
  question,
  feedback,
  onAnswer,
  grading
}: ViewProps & { question: Cloze }): React.JSX.Element {
  const [values, setValues] = useState<string[]>(() => question.blanks.map(() => ''))
  const [results, setResults] = useState<GradeResult[] | null>(null)
  const [hint, setHint] = useState(false)
  const inputs = useRef<(HTMLInputElement | null)[]>([])
  const locked = !!feedback

  const check = (giveUp = false): void => {
    if (locked) return
    if (!giveUp && values.some((v) => !v.trim())) {
      inputs.current[values.findIndex((v) => !v.trim())]?.focus()
      return
    }
    const graded = question.blanks.map((accepted, i) =>
      giveUp ? ({ verdict: 'wrong' } as GradeResult) : gradeText(values[i], accepted, grading)
    )
    setResults(graded)
    const verdict: Verdict = graded.every((g) => g.verdict === 'correct')
      ? 'correct'
      : graded.some((g) => g.verdict === 'wrong')
        ? 'wrong'
        : 'close'
    onAnswer([
      {
        cardId: question.cardId,
        verdict,
        note: graded.find((g) => g.note)?.note,
        hintUsed: hint,
        given: values.join(', ')
      }
    ])
  }

  return (
    <div>
      <div className="rounded-card border-2 border-line bg-surface p-6 font-display text-[22px] leading-[2.4] font-semibold">
        {question.parts.map((part, i) =>
          'text' in part ? (
            <RichText key={i} inline text={part.text} />
          ) : (
            <Fragment key={i}>
              <input
                ref={(el) => {
                  inputs.current[part.blank] = el
                }}
                autoFocus={part.blank === 0}
                autoComplete="off"
                spellCheck={false}
                aria-label={`Blank ${part.blank + 1}`}
                disabled={locked}
                value={values[part.blank]}
                placeholder={hint ? question.blanks[part.blank][0][0] : ''}
                onChange={(e) => {
                  const next = values.slice()
                  next[part.blank] = e.target.value
                  setValues(next)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    e.stopPropagation()
                    const empty = values.findIndex((v, idx) => idx > part.blank && !v.trim())
                    if (empty !== -1) inputs.current[empty]?.focus()
                    else check()
                  }
                }}
                style={{ width: `${Math.max(5, question.blanks[part.blank][0].length + 2)}ch` }}
                className={clsx(
                  'mx-1 inline-block rounded-lg border-2 px-2 py-0.5 text-center align-baseline leading-normal outline-none',
                  verdictClass(results?.[part.blank]?.verdict)
                )}
              />
              {results && results[part.blank]?.verdict !== 'correct' && (
                <span className="mr-1 text-base font-bold text-good">
                  ({question.blanks[part.blank][0]})
                </span>
              )}
            </Fragment>
          )
        )}
      </div>
      {!locked && (
        <div className="mt-5 flex items-center justify-between gap-3">
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setHint(true)} disabled={hint}>
              <LightbulbIcon /> Hint
            </Button>
            <Button variant="ghost" size="sm" onClick={() => check(true)}>
              I don&apos;t know
            </Button>
          </div>
          <Button size="lg" onClick={() => check()}>
            Check
          </Button>
        </div>
      )}
    </div>
  )
}

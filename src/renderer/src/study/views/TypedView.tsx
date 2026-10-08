import { useRef, useState } from 'react'
import clsx from 'clsx'
import { LightbulbIcon } from '@phosphor-icons/react'
import { Button } from '../../components/ui/Button'
import { gradeText, stripMarkup } from '../../core/grading'
import type { Question } from '../../core/questions'
import { Prompt, type ViewProps } from './shared'
import { verdictClass } from './style'

type Typed = Extract<Question, { type: 'typed' }>

/** "M _ _ _ _" style hint: first letter of each word, the rest as blanks. */
function hintFor(answer: string): string {
  return stripMarkup(answer)
    .split(/\s+/)
    .map((w) => w[0] + ' _'.repeat(Math.max(0, w.length - 1)))
    .join('   ')
}

export function TypedView({
  question,
  feedback,
  onAnswer,
  grading
}: ViewProps & { question: Typed }): React.JSX.Element {
  const [value, setValue] = useState('')
  const [hint, setHint] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const locked = !!feedback

  const check = (giveUp = false): void => {
    if (locked) return
    if (!giveUp && !value.trim()) {
      input.current?.focus()
      return
    }
    const r = giveUp ? { verdict: 'wrong' as const } : gradeText(value, question.accepted, grading)
    onAnswer([
      {
        cardId: question.cardId,
        verdict: r.verdict,
        note: 'note' in r ? r.note : undefined,
        hintUsed: hint,
        given: value
      }
    ])
  }

  return (
    <div>
      <Prompt text={question.prompt} />
      <label htmlFor="typed-answer" className="mb-2 block text-sm font-extrabold text-ink-muted">
        Type your answer
      </label>
      <input
        id="typed-answer"
        ref={input}
        autoFocus
        autoComplete="off"
        spellCheck={false}
        value={value}
        disabled={locked}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            e.stopPropagation()
            check()
          }
        }}
        className={clsx(
          'w-full rounded-control border-2 px-5 py-4 text-xl font-bold outline-none transition-colors',
          verdictClass(feedback?.verdict)
        )}
      />
      {hint && !locked && (
        <p className="mt-3 font-mono text-lg font-bold tracking-wider text-ink-muted">
          {hintFor(question.accepted[0])}
        </p>
      )}
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

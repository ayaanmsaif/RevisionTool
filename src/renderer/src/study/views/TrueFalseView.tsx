import { useEffect, useState } from 'react'
import { CheckIcon, XIcon } from '@phosphor-icons/react'
import { RichText } from '../../components/RichText'
import type { Question } from '../../core/questions'
import { ChoiceTile, type ViewProps } from './shared'

type TrueFalse = Extract<Question, { type: 'truefalse' }>

export function TrueFalseView({
  question,
  feedback,
  onAnswer
}: ViewProps & { question: TrueFalse }): React.JSX.Element {
  const [picked, setPicked] = useState<boolean | null>(null)
  const locked = picked !== null || !!feedback

  const pick = (value: boolean): void => {
    if (locked) return
    setPicked(value)
    onAnswer([
      {
        cardId: question.cardId,
        verdict: value === question.isTrue ? 'correct' : 'wrong',
        given: value ? 'True' : 'False'
      }
    ])
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const k = e.key.toLowerCase()
      if (k === 't' || k === '1') pick(true)
      if (k === 'f' || k === '2') pick(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const stateFor = (value: boolean): 'idle' | 'correct' | 'wrong' | 'reveal' | 'dim' => {
    if (!locked) return 'idle'
    if (value === picked) return value === question.isTrue ? 'correct' : 'wrong'
    return value === question.isTrue ? 'reveal' : 'dim'
  }

  return (
    <div>
      <div className="mb-7 rounded-card border-2 border-line bg-surface p-6">
        {question.prompt ? (
          <>
            <RichText
              text={question.prompt}
              className="font-display text-[22px] leading-snug font-bold tracking-tight"
            />
            <div className="mt-4 flex items-baseline gap-3 border-t border-line pt-4">
              <span className="shrink-0 text-sm font-extrabold text-ink-muted">Answer</span>
              <RichText text={question.statement} className="text-xl font-bold text-accent" />
            </div>
          </>
        ) : (
          <RichText
            text={question.statement}
            className="font-display text-[24px] leading-snug font-bold tracking-tight"
          />
        )}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <ChoiceTile
          state={stateFor(true)}
          onClick={() => pick(true)}
          disabled={locked}
          className="justify-center"
        >
          <span className="flex items-center justify-center gap-2 text-lg">
            <CheckIcon weight="bold" /> True
          </span>
        </ChoiceTile>
        <ChoiceTile
          state={stateFor(false)}
          onClick={() => pick(false)}
          disabled={locked}
          className="justify-center"
        >
          <span className="flex items-center justify-center gap-2 text-lg">
            <XIcon weight="bold" /> False
          </span>
        </ChoiceTile>
      </div>
    </div>
  )
}

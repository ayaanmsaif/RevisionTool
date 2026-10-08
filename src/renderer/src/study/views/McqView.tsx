import { useEffect, useState } from 'react'
import { RichText } from '../../components/RichText'
import type { Question } from '../../core/questions'
import { ChoiceTile, Prompt, type ViewProps } from './shared'

type Mcq = Extract<Question, { type: 'mcq' }>

export function McqView({
  question,
  feedback,
  onAnswer,
  pretest
}: ViewProps & { question: Mcq; pretest: boolean }): React.JSX.Element {
  const [picked, setPicked] = useState<number | null>(null)
  const locked = picked !== null || !!feedback

  const pick = (i: number): void => {
    if (locked) return
    setPicked(i)
    onAnswer([
      {
        cardId: question.cardId,
        verdict: i === question.correctIndex ? 'correct' : 'wrong',
        given: question.options[i]
      }
    ])
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const n = Number(e.key)
      if (n >= 1 && n <= question.options.length) pick(n - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const short = question.options.every((o) => o.length <= 32)
  return (
    <div>
      <Prompt
        text={question.prompt}
        sub={pretest ? 'New card. Have a guess, it helps it stick.' : undefined}
      />
      <div className={short ? 'grid grid-cols-2 gap-3.5' : 'flex flex-col gap-3'}>
        {question.options.map((opt, i) => {
          let state: 'idle' | 'correct' | 'wrong' | 'reveal' | 'dim' = 'idle'
          if (locked) {
            if (i === picked) state = i === question.correctIndex ? 'correct' : 'wrong'
            else if (i === question.correctIndex) state = 'reveal'
            else state = 'dim'
          }
          return (
            <ChoiceTile
              key={i}
              index={i + 1}
              state={state}
              onClick={() => pick(i)}
              disabled={locked}
            >
              <RichText inline text={opt} />
            </ChoiceTile>
          )
        })}
      </div>
    </div>
  )
}

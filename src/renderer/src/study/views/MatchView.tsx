import { useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import clsx from 'clsx'
import { RichText } from '../../components/RichText'
import type { Question } from '../../core/questions'
import { shuffle } from '../../core/util'
import type { Verdict } from '../../core/types'
import { sfx } from '../../audio/sfx'
import type { ViewProps } from './shared'

type Match = Extract<Question, { type: 'match' }>
type Side = 'left' | 'right'

export function MatchView({
  question,
  feedback,
  onAnswer
}: ViewProps & { question: Match }): React.JSX.Element {
  const reduce = useReducedMotion()
  const left = question.pairs
  const right = useMemo(() => shuffle(question.pairs), [question.pairs])
  const [selected, setSelected] = useState<{ side: Side; cardId: string } | null>(null)
  const [done, setDone] = useState<Set<string>>(new Set())
  const [flash, setFlash] = useState<{ keys: string[]; good: boolean } | null>(null)
  const mistakes = useRef(new Map<string, number>())
  const locked = !!feedback

  const choose = (side: Side, cardId: string): void => {
    if (locked || done.has(cardId)) return
    if (!selected || selected.side === side) {
      setSelected({ side, cardId })
      sfx.tap()
      return
    }
    const keys = [`${selected.side}-${selected.cardId}`, `${side}-${cardId}`]
    if (selected.cardId === cardId) {
      const next = new Set(done).add(cardId)
      setDone(next)
      setFlash({ keys, good: true })
      sfx.match()
      if (next.size === left.length) {
        const results = left.map((p) => {
          const m = mistakes.current.get(p.cardId) ?? 0
          const verdict: Verdict = m === 0 ? 'correct' : m === 1 ? 'close' : 'wrong'
          return { cardId: p.cardId, verdict }
        })
        window.setTimeout(() => onAnswer(results), 350)
      }
    } else {
      mistakes.current.set(selected.cardId, (mistakes.current.get(selected.cardId) ?? 0) + 1)
      setFlash({ keys, good: false })
      sfx.wrong()
    }
    setSelected(null)
    window.setTimeout(() => setFlash(null), 450)
  }

  const tile = (side: Side, cardId: string, text: string): React.JSX.Element => {
    const isDone = done.has(cardId)
    const isSel = selected?.side === side && selected.cardId === cardId
    const missFlash = !!flash && !flash.good && flash.keys.includes(`${side}-${cardId}`)
    return (
      <motion.button
        key={`${side}-${cardId}`}
        type="button"
        layout={!reduce}
        onClick={() => choose(side, cardId)}
        disabled={isDone || locked}
        animate={
          reduce
            ? undefined
            : missFlash
              ? { x: [0, -8, 8, -5, 5, 0] }
              : isDone
                ? { opacity: 0.35, scale: 0.97 }
                : { opacity: 1, scale: 1 }
        }
        transition={{ duration: 0.35 }}
        className={clsx(
          'flex min-h-16 items-center rounded-control border-2 px-4 py-3 text-left text-[15px] font-bold transition-colors',
          isDone && 'border-good bg-good-soft',
          !isDone && isSel && 'border-accent bg-accent-soft',
          !isDone && !isSel && missFlash && 'border-bad bg-bad-soft',
          !isDone &&
            !isSel &&
            !missFlash &&
            'border-line bg-surface shadow-[0_3px_0_var(--line)] hover:border-ink-faint'
        )}
      >
        <RichText inline text={text} />
      </motion.button>
    )
  }

  return (
    <div>
      <p className="mb-6 font-display text-[24px] font-bold tracking-tight">
        Tap a question, then its answer
      </p>
      <div className="grid grid-cols-2 gap-x-5 gap-y-3">
        <div className="flex flex-col gap-3">
          <AnimatePresence initial={false}>
            {left.map((p) => tile('left', p.cardId, p.left))}
          </AnimatePresence>
        </div>
        <div className="flex flex-col gap-3">
          <AnimatePresence initial={false}>
            {right.map((p) => tile('right', p.cardId, p.right))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

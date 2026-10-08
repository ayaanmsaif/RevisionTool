import { useState } from 'react'
import { Reorder, useReducedMotion } from 'motion/react'
import clsx from 'clsx'
import { ArrowDownIcon, ArrowUpIcon, DotsSixVerticalIcon } from '@phosphor-icons/react'
import { Button } from '../../components/ui/Button'
import { RichText } from '../../components/RichText'
import type { Question } from '../../core/questions'
import type { Verdict } from '../../core/types'
import { Prompt, type ViewProps } from './shared'

type Order = Extract<Question, { type: 'order' }>
type Item = Order['items'][number]

export function OrderView({
  question,
  feedback,
  onAnswer
}: ViewProps & { question: Order }): React.JSX.Element {
  const [items, setItems] = useState<Item[]>(question.items)
  const [checked, setChecked] = useState(false)
  const reduce = useReducedMotion()
  const locked = !!feedback || checked

  const move = (from: number, to: number): void => {
    if (to < 0 || to >= items.length || locked) return
    const next = items.slice()
    const [it] = next.splice(from, 1)
    next.splice(to, 0, it)
    setItems(next)
  }

  const check = (): void => {
    setChecked(true)
    const right = items.filter((it, i) => it.key === i).length
    const ratio = right / items.length
    const verdict: Verdict = ratio === 1 ? 'correct' : ratio >= 0.6 ? 'close' : 'wrong'
    onAnswer([{ cardId: question.cardId, verdict, given: `${right} of ${items.length} in place` }])
  }

  return (
    <div>
      <Prompt text={question.prompt} sub="Drag the steps into the right order." />
      <Reorder.Group
        axis="y"
        values={items}
        onReorder={(v) => !locked && setItems(v)}
        className="flex flex-col gap-2.5"
      >
        {items.map((it, i) => {
          const right = locked && it.key === i
          const wrong = locked && it.key !== i
          return (
            <Reorder.Item
              key={it.key}
              value={it}
              drag={!locked && !reduce ? 'y' : false}
              className={clsx(
                'flex items-center gap-3 rounded-control border-2 bg-surface px-4 py-3 font-bold select-none',
                !locked &&
                  'cursor-grab border-line shadow-[0_3px_0_var(--line)] active:cursor-grabbing',
                right && 'border-good bg-good-soft',
                wrong && 'border-bad bg-bad-soft'
              )}
            >
              <span
                className={clsx(
                  'grid size-7 shrink-0 place-items-center rounded-lg text-sm',
                  right
                    ? 'bg-good text-white'
                    : wrong
                      ? 'bg-bad text-white'
                      : 'bg-sunken text-ink-muted'
                )}
              >
                {i + 1}
              </span>
              <RichText inline text={it.text} className="min-w-0 flex-1" />
              {wrong && <span className="text-sm text-ink-muted">should be {it.key + 1}</span>}
              {!locked && (
                <span className="flex items-center gap-1 text-ink-faint">
                  <button
                    type="button"
                    aria-label="Move up"
                    onClick={() => move(i, i - 1)}
                    className="rounded p-1 hover:bg-sunken hover:text-ink"
                  >
                    <ArrowUpIcon size={16} />
                  </button>
                  <button
                    type="button"
                    aria-label="Move down"
                    onClick={() => move(i, i + 1)}
                    className="rounded p-1 hover:bg-sunken hover:text-ink"
                  >
                    <ArrowDownIcon size={16} />
                  </button>
                  <DotsSixVerticalIcon size={18} />
                </span>
              )}
            </Reorder.Item>
          )
        })}
      </Reorder.Group>
      {!locked && (
        <div className="mt-5 flex justify-end">
          <Button size="lg" onClick={check}>
            Check order
          </Button>
        </div>
      )}
    </div>
  )
}

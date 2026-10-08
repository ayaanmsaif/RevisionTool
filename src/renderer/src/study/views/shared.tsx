import clsx from 'clsx'
import { motion, useReducedMotion } from 'motion/react'
import { RichText } from '../../components/RichText'
import type { CardRecord } from '../../core/types'
import type { Feedback, ResultIn } from '../controller'

export interface ViewProps {
  card: CardRecord
  cards: CardRecord[]
  feedback?: Feedback
  onAnswer: (results: ResultIn[]) => void
  /** Settings that affect grading. */
  grading: { accentStrict: boolean; typoTolerance: 'off' | 'normal' | 'lenient' }
}

export function Prompt({ text, sub }: { text: string; sub?: string }): React.JSX.Element {
  return (
    <div className="mb-7">
      <RichText
        text={text}
        className="font-display text-[26px] leading-snug font-bold tracking-tight text-ink"
      />
      {sub && <p className="mt-2 text-ink-muted">{sub}</p>}
    </div>
  )
}

const SHAKE = { x: [0, -10, 10, -7, 7, -3, 0] }
const POP = { scale: [1, 1.04, 1] }

/** A big answer tile used by multiple choice, true/false and matching. */
export function ChoiceTile({
  onClick,
  state,
  index,
  children,
  disabled,
  className
}: {
  onClick: () => void
  state: 'idle' | 'selected' | 'correct' | 'wrong' | 'reveal' | 'dim'
  index?: number
  children: React.ReactNode
  disabled?: boolean
  className?: string
}): React.JSX.Element {
  const reduce = useReducedMotion()
  const animate = reduce
    ? undefined
    : state === 'wrong'
      ? SHAKE
      : state === 'correct'
        ? POP
        : undefined
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      animate={animate}
      transition={{ duration: state === 'wrong' ? 0.4 : 0.25 }}
      className={clsx(
        'group flex min-h-16 w-full items-center gap-4 rounded-control border-2 px-5 py-3.5 text-left text-[17px] font-bold transition-[background-color,border-color,box-shadow,transform] duration-100',
        'disabled:cursor-default',
        state === 'idle' &&
          'border-line bg-surface shadow-[0_4px_0_var(--line)] hover:border-ink-faint active:translate-y-[4px] active:shadow-none',
        state === 'selected' && 'border-accent bg-accent-soft shadow-[0_4px_0_var(--accent)]',
        state === 'correct' && 'border-good bg-good-soft text-ink shadow-[0_4px_0_var(--good)]',
        state === 'wrong' && 'border-bad bg-bad-soft text-ink shadow-[0_4px_0_var(--bad)]',
        state === 'reveal' && 'border-good border-dashed bg-surface',
        state === 'dim' && 'border-line bg-surface opacity-55',
        className
      )}
    >
      {index !== undefined && (
        <span
          className={clsx(
            'grid size-8 shrink-0 place-items-center rounded-lg border-2 text-sm',
            state === 'correct'
              ? 'border-good bg-good text-white'
              : state === 'wrong'
                ? 'border-bad bg-bad text-white'
                : 'border-line text-ink-muted'
          )}
        >
          {index}
        </span>
      )}
      <span className="min-w-0 flex-1">{children}</span>
    </motion.button>
  )
}

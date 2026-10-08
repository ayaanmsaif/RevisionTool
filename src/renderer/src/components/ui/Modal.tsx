import { useEffect, useId } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import clsx from 'clsx'
import { XIcon } from '@phosphor-icons/react'

export function Modal({
  title,
  onClose,
  children,
  wide,
  footer
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
  wide?: boolean
  footer?: React.ReactNode
}): React.JSX.Element {
  const id = useId()
  const reduce = useReducedMotion()
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/45 p-6"
      style={{ zIndex: 'var(--z-modal)' }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        initial={reduce ? false : { opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className={clsx(
          'flex max-h-full w-full flex-col overflow-hidden rounded-card bg-surface shadow-soft',
          wide ? 'max-w-[1080px]' : 'max-w-[560px]'
        )}
      >
        <div className="flex items-center justify-between gap-4 border-b border-line px-7 py-5">
          <h2 id={id} className="font-display text-xl font-bold tracking-tight">
            {title}
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="grid size-9 place-items-center rounded-control text-ink-faint hover:bg-sunken hover:text-ink"
          >
            <XIcon />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-7 py-6">{children}</div>
        {footer && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-7 py-4">
            {footer}
          </div>
        )}
      </motion.div>
    </div>
  )
}

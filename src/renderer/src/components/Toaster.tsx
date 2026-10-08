import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import clsx from 'clsx'
import { XIcon } from '@phosphor-icons/react'
import { useToasts, type ToastTone } from '../state/toast'

const TONE: Record<ToastTone, string> = {
  info: 'border-line',
  good: 'border-good',
  bad: 'border-bad',
  gold: 'border-gold'
}

export function Toaster(): React.JSX.Element {
  const { toasts, dismiss } = useToasts()
  const reduce = useReducedMotion()
  return (
    <div
      className="pointer-events-none fixed right-5 bottom-5 flex w-[360px] flex-col gap-3"
      style={{ zIndex: 'var(--z-toast)' }}
      aria-live="polite"
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout={!reduce}
            initial={reduce ? false : { opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, x: 40 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className={clsx(
              'pointer-events-auto rounded-card border-2 bg-surface p-4 shadow-soft',
              TONE[t.tone]
            )}
          >
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-extrabold">{t.title}</p>
                {t.body && <p className="mt-0.5 text-sm text-ink-muted">{t.body}</p>}
                {t.action && (
                  <button
                    type="button"
                    onClick={() => {
                      t.action?.run()
                      dismiss(t.id)
                    }}
                    className="mt-2 text-sm font-extrabold text-accent hover:underline"
                  >
                    {t.action.label}
                  </button>
                )}
              </div>
              <button
                type="button"
                aria-label="Dismiss"
                onClick={() => dismiss(t.id)}
                className="text-ink-faint hover:text-ink"
              >
                <XIcon size={16} />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

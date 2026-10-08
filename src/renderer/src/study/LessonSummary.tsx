import { motion, useReducedMotion } from 'motion/react'
import clsx from 'clsx'
import {
  ArrowRightIcon,
  ClockIcon,
  FireIcon,
  HeartBreakIcon,
  StarIcon,
  TargetIcon,
  TrophyIcon
} from '@phosphor-icons/react'
import { Button } from '../components/ui/Button'
import { RichText } from '../components/RichText'
import type { LessonSummary as Summary } from './controller'

function duration(ms: number): string {
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`
}

function Ring({ value }: { value: number }): React.JSX.Element {
  const reduce = useReducedMotion()
  const r = 52
  const c = 2 * Math.PI * r
  return (
    <svg viewBox="0 0 120 120" className="size-32 -rotate-90" aria-hidden>
      <circle cx="60" cy="60" r={r} fill="none" stroke="var(--sunken)" strokeWidth="12" />
      <motion.circle
        cx="60"
        cy="60"
        r={r}
        fill="none"
        stroke="var(--good)"
        strokeWidth="12"
        strokeLinecap="round"
        strokeDasharray={c}
        initial={{ strokeDashoffset: reduce ? c * (1 - value) : c }}
        animate={{ strokeDashoffset: c * (1 - value) }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      />
    </svg>
  )
}

export function LessonSummaryView({
  summary,
  onKeepGoing,
  onDone
}: {
  summary: Summary
  onKeepGoing: () => void
  onDone: () => void
}): React.JSX.Element {
  const reduce = useReducedMotion()
  const pct = Math.round(summary.accuracy * 100)
  const title = summary.outOfHearts
    ? 'Out of hearts'
    : summary.perfect
      ? 'Perfect lesson'
      : pct >= 80
        ? 'Lesson complete'
        : 'Lesson done. Keep at it.'
  const sub = summary.outOfHearts
    ? 'Your answers are saved. The rest of the cards will be back in the next lesson.'
    : summary.newCards
      ? `${summary.newCards} new card${summary.newCards === 1 ? '' : 's'} started.`
      : 'Every card you reviewed is now scheduled at the right moment.'

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto flex w-full max-w-[760px] flex-col gap-8 px-8 py-12"
    >
      <div className="flex items-center gap-8">
        <div className="relative grid place-items-center">
          <Ring value={summary.accuracy} />
          <div className="absolute text-center">
            {summary.outOfHearts ? (
              <HeartBreakIcon size={40} weight="fill" className="text-bad" />
            ) : (
              <>
                <p className="tabular font-display text-3xl font-bold">{pct}%</p>
                <p className="text-xs font-bold text-ink-muted">first try</p>
              </>
            )}
          </div>
        </div>
        <div>
          <h1 className="font-display text-4xl font-bold tracking-tight">{title}</h1>
          <p className="mt-2 max-w-[48ch] text-ink-muted">{sub}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Stat
          icon={<StarIcon weight="fill" />}
          tone="gold"
          label="XP earned"
          value={`+${summary.xp}`}
        />
        <Stat
          icon={<FireIcon weight="fill" />}
          tone="flame"
          label="Best combo"
          value={String(summary.bestCombo)}
        />
        <Stat
          icon={<ClockIcon weight="fill" />}
          tone="accent"
          label="Time"
          value={duration(summary.durationMs)}
        />
      </div>

      {summary.leveledUp && (
        <div className="flex items-center gap-4 rounded-card bg-accent px-6 py-5 text-white">
          <TrophyIcon size={36} weight="fill" />
          <div>
            <p className="font-display text-xl font-bold">Level {summary.level} reached</p>
            <p className="text-white/85">Your XP total keeps every lesson counting.</p>
          </div>
        </div>
      )}

      {summary.achievements.length > 0 && (
        <div className="flex flex-col gap-3">
          {summary.achievements.map((a) => (
            <div
              key={a.id}
              className="flex items-center gap-4 rounded-card border-2 border-gold bg-gold-soft px-5 py-4"
            >
              <TrophyIcon size={28} weight="fill" className="text-gold-press" />
              <div>
                <p className="font-extrabold">Achievement: {a.title}</p>
                <p className="text-sm text-ink-muted">{a.description}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {summary.missed.length > 0 && (
        <div>
          <p className="mb-3 flex items-center gap-2 font-extrabold">
            <TargetIcon /> Tricky ones, they will come back soon
          </p>
          <ul className="flex flex-col gap-2">
            {summary.missed.slice(0, 6).map((c) => (
              <li key={c.id} className="rounded-control bg-sunken px-4 py-3 text-[15px]">
                <RichText inline text={c.q} className="font-bold" />
                <span className="mx-2 text-ink-faint">→</span>
                <RichText inline text={c.a} className="text-ink-muted" />
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex justify-end gap-3 border-t border-line pt-6">
        <Button variant="secondary" size="lg" onClick={onDone}>
          Finish
        </Button>
        <Button size="lg" onClick={onKeepGoing} autoFocus>
          Keep going <ArrowRightIcon />
        </Button>
      </div>
    </motion.div>
  )
}

function Stat({
  icon,
  label,
  value,
  tone
}: {
  icon: React.ReactNode
  label: string
  value: string
  tone: 'gold' | 'flame' | 'accent'
}): React.JSX.Element {
  return (
    <div
      className={clsx(
        'rounded-card px-5 py-4',
        tone === 'gold' && 'bg-gold-soft',
        tone === 'flame' && 'bg-[color-mix(in_srgb,var(--flame)_14%,var(--surface))]',
        tone === 'accent' && 'bg-accent-soft'
      )}
    >
      <div
        className={clsx(
          'flex items-center gap-1.5 text-sm font-extrabold',
          tone === 'gold' && 'text-gold-press',
          tone === 'flame' && 'text-flame',
          tone === 'accent' && 'text-accent'
        )}
      >
        {icon}
        {label}
      </div>
      <p className="tabular mt-1 font-display text-3xl font-bold">{value}</p>
    </div>
  )
}

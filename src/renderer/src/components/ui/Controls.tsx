import clsx from 'clsx'
import { useId } from 'react'

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
  size = 'md'
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  label?: string
  size?: 'sm' | 'md'
}): React.JSX.Element {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={clsx(
              'rounded-full border-2 font-bold transition-colors',
              size === 'sm' ? 'px-3 py-1 text-sm' : 'px-4 py-1.5 text-[15px]',
              active
                ? 'border-accent bg-accent-soft text-accent'
                : 'border-line text-ink-muted hover:border-ink-faint hover:text-ink'
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

export function ToggleChip({
  checked,
  onChange,
  children
}: {
  checked: boolean
  onChange: (v: boolean) => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={clsx(
        'inline-flex items-center gap-2 rounded-full border-2 px-4 py-1.5 text-[15px] font-bold transition-colors',
        checked
          ? 'border-accent bg-accent-soft text-accent'
          : 'border-line text-ink-muted hover:border-ink-faint hover:text-ink'
      )}
    >
      <span
        aria-hidden
        className={clsx(
          'grid size-4 place-items-center rounded-[5px] border-2 text-[10px] leading-none',
          checked ? 'border-accent bg-accent text-white' : 'border-ink-faint'
        )}
      >
        {checked ? '✓' : ''}
      </span>
      {children}
    </button>
  )
}

export function Switch({
  checked,
  onChange,
  label,
  description
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  description?: string
}): React.JSX.Element {
  const id = useId()
  return (
    <div className="flex items-start justify-between gap-6">
      <div>
        <label htmlFor={id} className="font-bold">
          {label}
        </label>
        {description && <p className="mt-0.5 text-sm text-ink-muted">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={clsx(
          'relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition-colors',
          checked ? 'bg-accent' : 'bg-line'
        )}
      >
        <span
          className={clsx(
            'absolute top-1 left-1 size-5 rounded-full bg-white shadow transition-transform',
            checked && 'translate-x-5'
          )}
        />
      </button>
    </div>
  )
}

export function Field({
  label,
  hint,
  children,
  htmlFor
}: {
  label: string
  hint?: string
  htmlFor?: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={htmlFor} className="text-sm font-extrabold text-ink">
        {label}
      </label>
      {children}
      {hint && <p className="text-sm text-ink-muted">{hint}</p>}
    </div>
  )
}

export const inputClass =
  'w-full rounded-control border-2 border-line bg-surface px-3.5 py-2.5 text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none'

export function Kbd({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <kbd className="inline-grid min-w-6 place-items-center rounded-md border border-line bg-sunken px-1.5 py-0.5 font-sans text-xs font-bold text-ink-muted">
      {children}
    </kbd>
  )
}

import clsx from 'clsx'
import { forwardRef } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'good' | 'bad' | 'gold'
type Size = 'sm' | 'md' | 'lg' | 'xl'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  block?: boolean
}

// Chunky, "pressable" buttons: a coloured base edge that disappears when pressed.
const VARIANT: Record<Variant, string> = {
  primary:
    'bg-accent text-white shadow-[0_4px_0_var(--accent-press)] hover:brightness-105 active:shadow-none',
  good: 'bg-good text-white shadow-[0_4px_0_var(--good-press)] hover:brightness-105 active:shadow-none',
  bad: 'bg-bad text-white shadow-[0_4px_0_var(--bad-press)] hover:brightness-105 active:shadow-none',
  gold: 'bg-gold text-[#2a1d00] shadow-[0_4px_0_var(--gold-press)] hover:brightness-105 active:shadow-none',
  secondary:
    'bg-surface text-ink border-2 border-line shadow-[0_4px_0_var(--line)] hover:bg-sunken active:shadow-none',
  ghost: 'bg-transparent text-ink-muted hover:bg-sunken hover:text-ink'
}

const SIZE: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-sm gap-1.5',
  md: 'h-11 px-5 text-[15px] gap-2',
  lg: 'h-13 px-6 text-base gap-2.5',
  xl: 'h-15 px-8 text-lg gap-3'
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', block, className, type = 'button', ...rest },
  ref
) {
  const pressable = variant !== 'ghost'
  return (
    <button
      ref={ref}
      type={type}
      className={clsx(
        'inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap rounded-control font-extrabold tracking-tight transition-[transform,box-shadow,background-color,filter] duration-100',
        'disabled:pointer-events-none disabled:opacity-45',
        pressable && 'active:translate-y-[4px]',
        VARIANT[variant],
        SIZE[size],
        block && 'w-full',
        className
      )}
      {...rest}
    />
  )
})

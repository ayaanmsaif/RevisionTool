import clsx from 'clsx'

export function Panel({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return (
    <div
      className={clsx('rounded-card border border-line bg-surface shadow-soft', className)}
      {...rest}
    >
      {children}
    </div>
  )
}

export function SectionTitle({
  children,
  className
}: {
  children: React.ReactNode
  className?: string
}): React.JSX.Element {
  return (
    <h2 className={clsx('font-display text-xl font-bold tracking-tight', className)}>{children}</h2>
  )
}

export function PageHeader({
  title,
  subtitle,
  actions
}: {
  title: string
  subtitle?: string
  actions?: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-[65ch] text-ink-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </div>
  )
}

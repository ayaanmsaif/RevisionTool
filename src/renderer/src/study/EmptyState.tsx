import { CheckCircleIcon } from '@phosphor-icons/react'
import { Button } from '../components/ui/Button'
import { formatInterval } from '../core/scheduler'
import { now } from '../core/clock'

export function StudyEmpty({
  nextDue,
  newWaiting,
  onMoreNew,
  onCram,
  onBack
}: {
  nextDue?: number
  newWaiting: number
  onMoreNew: () => void
  onCram: () => void
  onBack: () => void
}): React.JSX.Element {
  return (
    <div className="mx-auto flex max-w-[560px] flex-col items-center px-8 py-20 text-center">
      <span className="grid size-24 place-items-center rounded-full bg-good-soft text-good">
        <CheckCircleIcon size={56} weight="fill" />
      </span>
      <h1 className="mt-6 font-display text-3xl font-bold tracking-tight">All caught up</h1>
      <p className="mt-2 text-ink-muted">
        {nextDue
          ? `Nothing is due right now. The next review is in ${formatInterval(nextDue - now())}. Spacing it out is what makes it stick.`
          : 'Nothing is due right now.'}
      </p>
      <div className="mt-8 flex flex-col gap-3 self-stretch">
        {newWaiting > 0 && (
          <Button size="lg" onClick={onMoreNew}>
            Learn 10 more new cards
          </Button>
        )}
        <Button variant="secondary" size="lg" onClick={onCram}>
          Practise anyway
        </Button>
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
      </div>
      <p className="mt-6 text-sm text-ink-faint">
        Practising early still helps, but reviews spaced at the right time are worth more.
      </p>
    </div>
  )
}

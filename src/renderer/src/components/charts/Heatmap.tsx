import { useMemo, useState } from 'react'
import { DAY_MS, studyDay } from '../../core/clock'
import { heatLevel } from '../../core/stats'

const LEVEL_BG = [
  'var(--sunken)',
  'var(--heat-1)',
  'var(--heat-2)',
  'var(--heat-3)',
  'var(--heat-4)'
]
const WEEKDAYS = ['Mon', '', 'Wed', '', 'Fri', '', '']

function niceDate(day: string): string {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short'
  })
}

/** GitHub-style study calendar: one column per week, one cell per day. */
export function Heatmap({
  counts,
  now,
  weeks = 26,
  rolloverHour = 4
}: {
  counts: Map<string, number>
  now: number
  weeks?: number
  rolloverHour?: number
}): React.JSX.Element {
  const [hover, setHover] = useState<string | null>(null)
  const { cells, max, months } = useMemo(() => {
    const today = new Date(now - rolloverHour * 3_600_000)
    const mondayOffset = (today.getDay() + 6) % 7
    const start = now - (mondayOffset + (weeks - 1) * 7) * DAY_MS
    const list: { day: string; count: number; future: boolean }[] = []
    for (let i = 0; i < weeks * 7; i++) {
      const ts = start + i * DAY_MS
      const day = studyDay(ts, rolloverHour)
      list.push({ day, count: counts.get(day) ?? 0, future: ts > now })
    }
    const labels: { col: number; text: string }[] = []
    let lastMonth = -1
    for (let col = 0; col < weeks; col++) {
      const [y, m] = list[col * 7].day.split('-').map(Number)
      if (m !== lastMonth) {
        labels.push({
          col,
          text: new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'short' })
        })
        lastMonth = m
      }
    }
    return { cells: list, max: Math.max(0, ...list.map((c) => c.count)), months: labels }
  }, [counts, now, weeks, rolloverHour])

  const hovered = cells.find((c) => c.day === hover)
  const active = [...counts.entries()]
    .filter(([, n]) => n > 0)
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))

  return (
    <figure className="m-0">
      <div className="flex gap-2">
        <div className="mt-5 grid grid-rows-7 gap-[3px] text-[10px] leading-[13px] text-ink-faint">
          {WEEKDAYS.map((d, i) => (
            <span key={i}>{d}</span>
          ))}
        </div>
        <div className="relative">
          <div className="relative mb-1 h-4 text-[10px] text-ink-faint">
            {months.map((m) => (
              <span key={m.col} className="absolute" style={{ left: m.col * 16 }}>
                {m.text}
              </span>
            ))}
          </div>
          <div
            className="grid grid-flow-col grid-rows-7 gap-[3px]"
            role="img"
            aria-label="Study activity by day"
          >
            {cells.map((c) => (
              <div
                key={c.day}
                tabIndex={c.future ? -1 : 0}
                aria-label={`${niceDate(c.day)}: ${c.count} reviews`}
                onPointerEnter={() => setHover(c.day)}
                onPointerLeave={() => setHover(null)}
                onFocus={() => setHover(c.day)}
                onBlur={() => setHover(null)}
                className="size-[13px] rounded-[3px] outline-none focus-visible:ring-2 focus-visible:ring-accent"
                style={{
                  background: c.future ? 'transparent' : LEVEL_BG[heatLevel(c.count, max)],
                  boxShadow: hover === c.day ? '0 0 0 2px var(--ink)' : undefined
                }}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-ink-muted">
        <span className="min-h-4 font-bold">
          {hovered
            ? `${hovered.count} review${hovered.count === 1 ? '' : 's'} on ${niceDate(hovered.day)}`
            : ''}
        </span>
        <span className="flex items-center gap-1.5">
          Less
          {LEVEL_BG.map((bg, i) => (
            <span key={i} className="size-[11px] rounded-[3px]" style={{ background: bg }} />
          ))}
          More
        </span>
      </div>
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer font-bold text-ink-muted hover:text-ink">
          View as table
        </summary>
        <table className="mt-2 w-full max-w-sm text-left tabular">
          <caption className="sr-only">Reviews per day</caption>
          <tbody>
            {active.length === 0 && (
              <tr>
                <td className="py-1 text-ink-muted">No reviews yet</td>
              </tr>
            )}
            {active.slice(0, 60).map(([day, n]) => (
              <tr key={day} className="border-t border-line">
                <td className="py-1">{niceDate(day)}</td>
                <td className="py-1 text-right">{n}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  )
}

import { useId, useState } from 'react'
import { niceTicks } from '../../core/stats'

export interface BarSeries {
  name: string
  /** CSS colour, normally a --series-N token. */
  color: string
}

export interface BarDatum {
  /** Short axis label. */
  label: string
  /** Longer label for the tooltip and table. */
  full?: string
  values: number[]
}

const fmt = (n: number): string => n.toLocaleString()

/**
 * Column chart: thin bars (max 24px) with 4px rounded tops from one baseline, hairline
 * gridlines, a per-column hover/focus tooltip and a table view. A legend appears only
 * for two or more series.
 */
export function BarChart({
  data,
  series,
  height = 160,
  labelEvery = 1,
  title
}: {
  data: BarDatum[]
  series: BarSeries[]
  height?: number
  labelEvery?: number
  title: string
}): React.JSX.Element {
  const [hover, setHover] = useState<number | null>(null)
  const id = useId()
  const max = Math.max(0, ...data.flatMap((d) => d.values))
  const ticks = niceTicks(max)
  const top = ticks[ticks.length - 1]

  return (
    <figure className="m-0">
      {series.length > 1 && (
        <figcaption className="mb-3 flex flex-wrap gap-4 text-sm font-bold text-ink-muted">
          {series.map((s) => (
            <span key={s.name} className="flex items-center gap-2">
              <span className="size-3 rounded-[3px]" style={{ background: s.color }} />
              {s.name}
            </span>
          ))}
        </figcaption>
      )}
      <div className="flex gap-2 pt-2" role="img" aria-labelledby={`${id}-table`}>
        <div
          className="relative w-8 shrink-0 text-right text-xs text-ink-faint tabular"
          style={{ height }}
        >
          {ticks.map((t) => (
            <span
              key={t}
              className="absolute right-0 -translate-y-1/2"
              style={{ bottom: `${(t / top) * 100}%` }}
            >
              {fmt(t)}
            </span>
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <div className="relative" style={{ height }}>
            {ticks.map((t) => (
              <div
                key={t}
                className="absolute inset-x-0 h-px bg-line"
                style={{ bottom: `${(t / top) * 100}%` }}
              />
            ))}
            <div className="absolute inset-0 flex">
              {data.map((d, i) => (
                <div
                  key={i}
                  tabIndex={0}
                  aria-label={`${d.full ?? d.label}: ${d.values.map((v, k) => `${series[k]?.name} ${fmt(v)}`).join(', ')}`}
                  onPointerEnter={() => setHover(i)}
                  onPointerLeave={() => setHover(null)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  className="relative flex h-full min-w-0 flex-1 items-end justify-center gap-[2px] px-px outline-none"
                >
                  {d.values.map((v, k) => (
                    <div
                      key={k}
                      className="w-full max-w-6 rounded-t-[4px] transition-[filter]"
                      style={{
                        height: `${(v / top) * 100}%`,
                        background: series[k]?.color,
                        filter: hover === i ? 'brightness(1.12)' : undefined
                      }}
                    />
                  ))}
                  {hover === i && (
                    <div
                      className="pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 rounded-control border border-line bg-surface px-3 py-2 text-sm whitespace-nowrap shadow-soft"
                      style={{ zIndex: 'var(--z-overlay)' }}
                    >
                      <p className="text-xs font-bold text-ink-muted">{d.full ?? d.label}</p>
                      {d.values.map((v, k) => (
                        <p key={k} className="flex items-center gap-2">
                          <span
                            className="h-0.5 w-3 rounded"
                            style={{ background: series[k]?.color }}
                          />
                          <span className="font-extrabold text-ink">{fmt(v)}</span>
                          {series.length > 1 && (
                            <span className="text-ink-muted">{series[k].name}</span>
                          )}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="mt-1.5 flex h-4 text-xs text-ink-faint">
            {data.map((d, i) => (
              <span key={i} className="relative min-w-0 flex-1">
                {i % labelEvery === 0 && (
                  <span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap">
                    {d.label}
                  </span>
                )}
              </span>
            ))}
          </div>
        </div>
      </div>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer font-bold text-ink-muted hover:text-ink">
          View as table
        </summary>
        <table id={`${id}-table`} className="mt-2 w-full text-left tabular">
          <caption className="sr-only">{title}</caption>
          <thead>
            <tr className="text-ink-muted">
              <th className="py-1 font-bold">Day</th>
              {series.map((s) => (
                <th key={s.name} className="py-1 font-bold">
                  {s.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((d, i) => (
              <tr key={i} className="border-t border-line">
                <td className="py-1">{d.full ?? d.label}</td>
                {d.values.map((v, k) => (
                  <td key={k} className="py-1">
                    {fmt(v)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  )
}

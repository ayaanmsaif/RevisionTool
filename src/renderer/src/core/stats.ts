import { DAY_MS, studyDay } from './clock'
import { MemState, Rating, type CardRecord, type ReviewRecord } from './types'

/** Reviews per study day (game rounds excluded). */
export function reviewsByDay(reviews: ReviewRecord[], rolloverHour = 4): Map<string, number> {
  const out = new Map<string, number>()
  for (const r of reviews) {
    if (r.mode === 'game') continue
    const d = studyDay(r.ts, rolloverHour)
    out.set(d, (out.get(d) ?? 0) + 1)
  }
  return out
}

/** The last `n` study days ending today, oldest first, as YYYY-MM-DD. */
export function lastDays(now: number, n: number, rolloverHour = 4): string[] {
  const days: string[] = []
  for (let i = n - 1; i >= 0; i--) days.push(studyDay(now - i * DAY_MS, rolloverHour))
  return [...new Set(days)]
}

/**
 * True retention: the share of reviews of already-learned cards that were remembered.
 * This is what FSRS's desired retention aims for, so the two can be compared.
 */
export function trueRetention(
  reviews: ReviewRecord[],
  since: number
): { rate: number | null; count: number } {
  const relevant = reviews.filter(
    (r) => r.ts >= since && r.stateBefore === MemState.Review && r.mode !== 'game'
  )
  if (!relevant.length) return { rate: null, count: 0 }
  const remembered = relevant.filter((r) => r.rating > Rating.Again).length
  return { rate: remembered / relevant.length, count: relevant.length }
}

/** How many cards fall due on each of the next `days` days (overdue counts as today). */
export function dueForecast(
  cards: CardRecord[],
  now: number,
  days: number,
  rolloverHour = 4
): { day: string; count: number }[] {
  const keys = Array.from({ length: days }, (_, i) => studyDay(now + i * DAY_MS, rolloverHour))
  const index = new Map(keys.map((k, i) => [k, i]))
  const counts = new Array<number>(days).fill(0)
  for (const c of cards) {
    if (c.suspended || c.mem.state === MemState.New) continue
    const i = c.due <= now ? 0 : index.get(studyDay(c.due, rolloverHour))
    if (i !== undefined) counts[i]++
  }
  return keys.map((day, i) => ({ day, count: counts[i] }))
}

/** XP per day for this week and last week, Monday first. */
export function weeklyXp(
  xpByDay: Record<string, number>,
  now: number,
  rolloverHour = 4
): { labels: string[]; thisWeek: number[]; lastWeek: number[] } {
  const today = new Date(now - rolloverHour * 3_600_000)
  const mondayOffset = (today.getDay() + 6) % 7
  const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const thisWeek: number[] = []
  const lastWeek: number[] = []
  for (let i = 0; i < 7; i++) {
    const thisTs = now + (i - mondayOffset) * DAY_MS
    thisWeek.push(i > mondayOffset ? 0 : (xpByDay[studyDay(thisTs, rolloverHour)] ?? 0))
    lastWeek.push(xpByDay[studyDay(thisTs - 7 * DAY_MS, rolloverHour)] ?? 0)
  }
  return { labels, thisWeek, lastWeek }
}

/** Clean axis maximum and ticks for a bar chart (0, step, 2*step, ...). */
export function niceTicks(max: number, count = 3): number[] {
  if (max <= 0) return [0, 1]
  const raw = max / count
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag
  const ticks: number[] = []
  for (let t = 0; t <= max + step * 0.001; t += step) ticks.push(Math.round(t * 1000) / 1000)
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step)
  return ticks
}

/** Bucket a count into a 0-4 intensity level relative to the busiest day. */
export function heatLevel(count: number, max: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0 || max <= 0) return 0
  const r = count / max
  if (r <= 0.25) return 1
  if (r <= 0.5) return 2
  if (r <= 0.75) return 3
  return 4
}

export function studyTimeMs(reviews: ReviewRecord[]): number {
  // Cap each answer at 2 minutes so a card left open does not inflate the total.
  return reviews.reduce((t, r) => t + Math.min(r.responseMs, 120_000), 0)
}

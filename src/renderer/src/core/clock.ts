// Single source of "now" so schedules and streaks can be tested with time travel.

const DAY_MS = 86_400_000

let offsetMs = 0

export function now(): number {
  return Date.now() + offsetMs
}

export function setClockOffsetDays(days: number): void {
  offsetMs = days * DAY_MS
}

export function getClockOffsetDays(): number {
  return offsetMs / DAY_MS
}

/**
 * The local calendar day a timestamp belongs to, as YYYY-MM-DD.
 * Days roll over at `rolloverHour` (default 4am) so late-night study counts for the evening.
 */
export function studyDay(ts: number, rolloverHour = 4): string {
  const d = new Date(ts - rolloverHour * 3_600_000)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Whole days from day `a` to day `b` (YYYY-MM-DD strings). */
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number)
  const [by, bm, bd] = b.split('-').map(Number)
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / DAY_MS)
}

/** Timestamp of the start of the study day containing `ts` (last rollover). */
export function startOfStudyDay(ts: number, rolloverHour = 4): number {
  const d = new Date(ts - rolloverHour * 3_600_000)
  d.setHours(rolloverHour, 0, 0, 0)
  return d.getTime()
}

/** Timestamp of the end of the study day containing `ts` (next rollover). */
export function endOfStudyDay(ts: number, rolloverHour = 4): number {
  const d = new Date(ts - rolloverHour * 3_600_000)
  d.setHours(24 + rolloverHour, 0, 0, 0)
  return d.getTime()
}

export { DAY_MS }

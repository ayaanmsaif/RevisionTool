import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { now, setClockOffsetDays } from '../core/clock'
import { DEFAULT_PROFILE, DEFAULT_SETTINGS, type Profile, type Settings } from '../core/settings'
import { getProfile, getSettings } from '../db/repo'

export function useSettings(): Settings {
  return useLiveQuery(getSettings, [], DEFAULT_SETTINGS)
}

/** Keep the shared clock in sync with the developer time-travel setting. */
export function useClockOffset(days: number): void {
  useEffect(() => {
    setClockOffsetDays(days)
  }, [days])
}

export function useProfile(): Profile {
  return useLiveQuery(getProfile, [], DEFAULT_PROFILE)
}

/** Current time that refreshes every `ms`, so due counts tick over without a reload. */
export function useNow(ms = 30_000): number {
  const [t, setT] = useState(now)
  useEffect(() => {
    const id = window.setInterval(() => setT(now()), ms)
    return () => window.clearInterval(id)
  }, [ms])
  return t
}

/** Apply the theme setting (system, light or dark) to <html data-theme>. */
export function useApplyTheme(theme: Settings['theme']): void {
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = (): void => {
      const dark = theme === 'dark' || (theme === 'system' && media.matches)
      document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
    }
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [theme])
}

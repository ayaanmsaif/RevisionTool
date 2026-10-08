import { useEffect, useMemo, useSyncExternalStore } from 'react'
import type { Settings } from '../core/settings'
import { StudyController, type StudyOptions, type StudyState } from './controller'

/** Create one controller per study session and subscribe to its state. */
export function useStudy(
  opts: Omit<StudyOptions, 'settings'>,
  settings: Settings,
  ready: boolean
): { controller: StudyController | null; state: StudyState | null } {
  const key = JSON.stringify(opts)
  const controller = useMemo(
    () => (ready ? new StudyController({ ...(JSON.parse(key) as typeof opts), settings }) : null),
    // Settings are read once at the start of a session on purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key, ready]
  )

  useEffect(() => {
    if (!controller) return
    void controller.start()
    return () => controller.dispose()
  }, [controller])

  const state = useSyncExternalStore(
    controller ? controller.subscribe : noopSubscribe,
    controller ? controller.getState : nullState
  )
  return { controller, state }
}

const noopSubscribe = (): (() => void) => () => {}
const nullState = (): null => null

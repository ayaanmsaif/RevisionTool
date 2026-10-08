import { useEffect } from 'react'
import { RouterProvider } from 'react-router'
import { IconContext } from '@phosphor-icons/react'
import { router } from './router'
import { Toaster } from './components/Toaster'
import { configureSound } from './audio/sfx'
import { maybeDailyBackup } from './db/backup'
import { useInbox } from './lib/inbox'
import { now } from './core/clock'
import { useApplyTheme, useClockOffset, useSettings } from './state/hooks'

const iconDefaults = { weight: 'bold' as const, size: 20 }

function App(): React.JSX.Element {
  const settings = useSettings()
  useApplyTheme(settings.theme)
  useClockOffset(settings.clockOffsetDays)
  useInbox(settings.inboxEnabled)
  useEffect(
    () => configureSound(settings.sound, settings.volume),
    [settings.sound, settings.volume]
  )
  useEffect(() => {
    // One automatic backup per day, a few seconds after start so it never slows launch.
    const id = window.setTimeout(() => void maybeDailyBackup(now()).catch(() => undefined), 4000)
    return () => window.clearTimeout(id)
  }, [])
  return (
    <IconContext.Provider value={iconDefaults}>
      <RouterProvider router={router} />
      <Toaster />
    </IconContext.Provider>
  )
}

export default App

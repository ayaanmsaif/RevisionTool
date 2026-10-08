import { RouterProvider } from 'react-router'
import { IconContext } from '@phosphor-icons/react'
import { router } from './router'
import { Toaster } from './components/Toaster'
import { useApplyTheme, useClockOffset, useSettings } from './state/hooks'

const iconDefaults = { weight: 'bold' as const, size: 20 }

function App(): React.JSX.Element {
  const settings = useSettings()
  useApplyTheme(settings.theme)
  useClockOffset(settings.clockOffsetDays)
  return (
    <IconContext.Provider value={iconDefaults}>
      <RouterProvider router={router} />
      <Toaster />
    </IconContext.Provider>
  )
}

export default App

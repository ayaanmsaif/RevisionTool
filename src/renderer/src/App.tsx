import { RouterProvider } from 'react-router'
import { IconContext } from '@phosphor-icons/react'
import { router } from './router'

const iconDefaults = { weight: 'bold' as const, size: 20 }

function App(): React.JSX.Element {
  return (
    <IconContext.Provider value={iconDefaults}>
      <RouterProvider router={router} />
    </IconContext.Provider>
  )
}

export default App

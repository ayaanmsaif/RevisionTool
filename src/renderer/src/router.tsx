import { createHashRouter } from 'react-router'
import { AppShell } from './components/AppShell'
import { Placeholder } from './screens/Placeholder'

export const router = createHashRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Placeholder title="Home" /> },
      { path: 'import', element: <Placeholder title="Import" /> },
      { path: 'browse', element: <Placeholder title="Cards" /> },
      { path: 'stats', element: <Placeholder title="Stats" /> },
      { path: 'games', element: <Placeholder title="Games" /> },
      { path: 'settings', element: <Placeholder title="Settings" /> }
    ]
  }
])

import { createHashRouter } from 'react-router'
import { AppShell } from './components/AppShell'
import { Placeholder } from './screens/Placeholder'
import { ImportScreen } from './screens/ImportScreen'
import { DeckScreen } from './screens/DeckScreen'
import { StudyScreen } from './study/StudyScreen'

export const router = createHashRouter([
  { path: '/study', element: <StudyScreen /> },
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Placeholder title="Home" /> },
      { path: 'deck/:deckId', element: <DeckScreen /> },
      { path: 'import', element: <ImportScreen /> },
      { path: 'browse', element: <Placeholder title="Cards" /> },
      { path: 'stats', element: <Placeholder title="Stats" /> },
      { path: 'games', element: <Placeholder title="Games" /> },
      { path: 'settings', element: <Placeholder title="Settings" /> }
    ]
  }
])

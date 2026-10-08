import { createHashRouter } from 'react-router'
import { AppShell } from './components/AppShell'
import { Placeholder } from './screens/Placeholder'
import { ImportScreen } from './screens/ImportScreen'
import { DeckScreen } from './screens/DeckScreen'
import { StudyScreen } from './study/StudyScreen'
import { HomeScreen } from './screens/HomeScreen'
import { StatsScreen } from './screens/StatsScreen'
import { BrowseScreen } from './screens/BrowseScreen'
import { SettingsScreen } from './screens/SettingsScreen'

export const router = createHashRouter([
  { path: '/study', element: <StudyScreen /> },
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <HomeScreen /> },
      { path: 'deck/:deckId', element: <DeckScreen /> },
      { path: 'import', element: <ImportScreen /> },
      { path: 'browse', element: <BrowseScreen /> },
      { path: 'stats', element: <StatsScreen /> },
      { path: 'games', element: <Placeholder title="Games" /> },
      { path: 'settings', element: <SettingsScreen /> }
    ]
  }
])

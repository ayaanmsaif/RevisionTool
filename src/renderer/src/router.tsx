import { createHashRouter } from 'react-router'
import { AppShell } from './components/AppShell'
import { ImportScreen } from './screens/ImportScreen'
import { DeckScreen } from './screens/DeckScreen'
import { StudyScreen } from './study/StudyScreen'
import { HomeScreen } from './screens/HomeScreen'
import { StatsScreen } from './screens/StatsScreen'
import { BrowseScreen } from './screens/BrowseScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { GamesScreen } from './games/GamesScreen'
import { MatchGame } from './games/MatchGame'
import { BlitzGame } from './games/BlitzGame'
import { TestMode } from './games/TestMode'

export const router = createHashRouter([
  { path: '/study', element: <StudyScreen /> },
  { path: '/games/match', element: <MatchGame /> },
  { path: '/games/blitz', element: <BlitzGame /> },
  { path: '/games/test', element: <TestMode /> },
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <HomeScreen /> },
      { path: 'deck/:deckId', element: <DeckScreen /> },
      { path: 'import', element: <ImportScreen /> },
      { path: 'browse', element: <BrowseScreen /> },
      { path: 'stats', element: <StatsScreen /> },
      { path: 'games', element: <GamesScreen /> },
      { path: 'settings', element: <SettingsScreen /> }
    ]
  }
])

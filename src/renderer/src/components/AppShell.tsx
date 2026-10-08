import { NavLink, Outlet } from 'react-router'
import clsx from 'clsx'
import {
  CardsIcon,
  ChartBarIcon,
  GameControllerIcon,
  GearSixIcon,
  HouseIcon,
  TrayArrowDownIcon,
  type Icon
} from '@phosphor-icons/react'

const NAV: { to: string; label: string; icon: Icon }[] = [
  { to: '/', label: 'Home', icon: HouseIcon },
  { to: '/import', label: 'Import', icon: TrayArrowDownIcon },
  { to: '/browse', label: 'Cards', icon: CardsIcon },
  { to: '/games', label: 'Games', icon: GameControllerIcon },
  { to: '/stats', label: 'Stats', icon: ChartBarIcon },
  { to: '/settings', label: 'Settings', icon: GearSixIcon }
]

export function AppShell(): React.JSX.Element {
  return (
    <div className="flex h-full">
      <aside className="flex w-60 shrink-0 flex-col gap-6 border-r border-line bg-surface px-4 py-6">
        <div className="flex items-center gap-2.5 px-2">
          <span className="grid size-9 place-items-center rounded-control bg-accent text-white">
            <CardsIcon size={20} weight="fill" />
          </span>
          <span className="font-display text-lg font-bold tracking-tight">RevisionTool</span>
        </div>
        <nav className="flex flex-col gap-1">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 rounded-control px-3 py-2.5 font-bold transition-colors',
                  isActive
                    ? 'bg-accent-soft text-accent'
                    : 'text-ink-muted hover:bg-sunken hover:text-ink'
                )
              }
            >
              <Icon />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="min-w-0 flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}

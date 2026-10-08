import { NavLink, Outlet } from 'react-router'
import clsx from 'clsx'
import {
  CardsIcon,
  ChartBarIcon,
  FireIcon,
  GameControllerIcon,
  GearSixIcon,
  HouseIcon,
  StarIcon,
  TrayArrowDownIcon,
  type Icon
} from '@phosphor-icons/react'
import { studyDay } from '../core/clock'
import { levelFromXp, viewStreak } from '../core/gamify'
import { useNow, useProfile, useSettings } from '../state/hooks'

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
        <ProgressBadge />
      </aside>
      <main className="min-w-0 flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}

function ProgressBadge(): React.JSX.Element {
  const profile = useProfile()
  const settings = useSettings()
  const now = useNow()
  const streak = viewStreak(profile.streak, studyDay(now, settings.rolloverHour))
  const lvl = levelFromXp(profile.totalXp)
  return (
    <div className="mt-auto flex flex-col gap-4 rounded-card bg-sunken p-4">
      <div className="flex items-center justify-between">
        <span
          className={clsx(
            'flex items-center gap-1.5 font-extrabold',
            streak.count ? 'text-flame' : 'text-ink-faint'
          )}
          title={streak.atRisk ? 'Study today to keep your streak' : undefined}
        >
          <FireIcon size={22} weight={streak.doneToday ? 'fill' : 'bold'} />
          {streak.count}
          <span className="text-sm font-bold text-ink-muted">
            day{streak.count === 1 ? '' : 's'}
          </span>
        </span>
        <span className="flex items-center gap-1 text-sm font-extrabold text-gold-press dark:text-gold">
          <StarIcon size={16} weight="fill" />
          {profile.totalXp.toLocaleString()}
        </span>
      </div>
      <div>
        <div className="mb-1.5 flex justify-between text-xs font-bold text-ink-muted">
          <span>Level {lvl.level}</span>
          <span>
            {lvl.into}/{lvl.needed} XP
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-line">
          <div
            className="h-full rounded-full bg-accent"
            style={{ width: `${(lvl.into / lvl.needed) * 100}%` }}
          />
        </div>
      </div>
    </div>
  )
}

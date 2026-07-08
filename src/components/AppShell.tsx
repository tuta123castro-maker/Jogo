import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import type { Profile } from '../lib/profile'

/**
 * Authenticated app frame: brand + home currency, primary nav, and the routed
 * page in the middle. Later phases add their routes alongside Portfolio/Trade.
 */
export function AppShell({ profile }: { profile: Profile }) {
  const { signOut } = useAuth()

  const tabs = [
    { to: '/', label: 'Portfolio', end: true },
    { to: '/trade', label: 'Trade', end: false },
    { to: '/research', label: 'Research', end: false },
    { to: '/watchlist', label: 'Watchlist', end: false },
    { to: '/orders', label: 'Orders', end: false },
  ]

  return (
    <div className="mx-auto flex min-h-full max-w-lg flex-col">
      <header className="flex items-center justify-between px-5 py-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Open Markets</h1>
          <p className="text-xs text-slate-400">Home currency · {profile.home_currency}</p>
        </div>
        <button
          type="button"
          onClick={() => void signOut()}
          className="rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-300 transition hover:border-slate-500 hover:text-slate-100"
        >
          Sign out
        </button>
      </header>

      <nav className="flex gap-1 overflow-x-auto px-5">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              'shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-sm transition ' +
              (isActive
                ? 'bg-slate-800 text-slate-100'
                : 'text-slate-400 hover:text-slate-200')
            }
          >
            {t.label}
          </NavLink>
        ))}
      </nav>

      <main className="flex-1 px-5 py-5">
        <Outlet context={{ profile }} />
      </main>
    </div>
  )
}

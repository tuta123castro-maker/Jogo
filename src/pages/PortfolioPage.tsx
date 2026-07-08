import { useEffect } from 'react'
import { Link, useLocation, useOutletContext } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { usePortfolio } from '../lib/usePortfolio'
import { useSnapshots } from '../lib/useSnapshots'
import { format } from '../lib/money'
import { MoneyText, PnlText } from '../components/MoneyText'
import { PortfolioChart } from '../components/PortfolioChart'
import type { Profile } from '../lib/profile'

export function PortfolioPage() {
  const { profile } = useOutletContext<{ profile: Profile }>()
  const { user } = useAuth()
  const location = useLocation()
  const justTraded = Boolean(
    (location.state as { justTraded?: boolean } | null)?.justTraded,
  )
  const { summary, loading, error, refresh } = usePortfolio(
    user?.id ?? null,
    profile.home_currency,
    justTraded,
  )
  const { snapshots, refresh: refreshSnapshots } = useSnapshots(user?.id ?? null)

  useEffect(() => {
    // Re-sync once per successful load — including the load that just wrote a
    // new snapshot after a trade — so the chart never lags a load behind.
    if (summary) void refreshSnapshots()
  }, [summary, refreshSnapshots])

  if (loading && !summary) {
    return <p className="text-sm text-slate-400">Loading your portfolio…</p>
  }
  if (error) {
    return <p className="text-sm text-rose-400">Couldn’t load portfolio: {error}</p>
  }
  if (!summary) return null

  const { cash, holdingsValueHome, totalValueHome, unrealizedHome, positions } =
    summary

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
        <p className="text-xs text-slate-400">Total value</p>
        <p className="mt-1 text-3xl font-semibold tracking-tight">
          {format(totalValueHome)}
        </p>
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-400">
          <span>
            Holdings <MoneyText value={holdingsValueHome} />
          </span>
          <span>
            Cash <MoneyText value={cash} />
          </span>
          <span>
            Unrealized <PnlText value={unrealizedHome} />
          </span>
        </div>
      </section>

      <PortfolioChart snapshots={snapshots} currency={profile.home_currency} />

      <section className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-slate-200">Holdings</h2>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void refresh()}
            className="text-xs text-slate-400 hover:text-slate-200"
          >
            Refresh
          </button>
          <Link
            to="/trade"
            className="rounded-md bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-500"
          >
            New trade
          </Link>
        </div>
      </section>

      {positions.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-700 px-4 py-8 text-center text-sm text-slate-400">
          No holdings yet. Place your first trade to start building a position.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {positions.map(({ position, valuation }) => (
            <li
              key={position.symbol}
              className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/40 px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium text-slate-100">
                  {position.symbol}
                </p>
                <p className="text-xs text-slate-400">
                  {position.quantity.toString()} @{' '}
                  {format(
                    { amount: position.avgCostNative, currency: position.nativeCurrency },
                    { withSymbol: true },
                  )}{' '}
                  avg · {position.nativeCurrency}
                </p>
              </div>
              <div className="text-right">
                {valuation ? (
                  <>
                    <p className="text-sm text-slate-100">
                      {format(valuation.marketValueHome)}
                    </p>
                    <p className="text-xs">
                      <PnlText value={valuation.unrealizedHome} />
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-slate-500">price pending…</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

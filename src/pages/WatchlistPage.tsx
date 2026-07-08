import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useWatchlist } from '../lib/useWatchlist'
import { usePrices } from '../lib/useMarketData'
import { format } from '../lib/money'

export function WatchlistPage() {
  const { user } = useAuth()
  const { symbols, toggle, loading, error } = useWatchlist(user?.id ?? null)
  const { prices } = usePrices(symbols.map((s) => s.symbol))

  if (loading && symbols.length === 0) {
    return <p className="text-sm text-slate-400">Loading watchlist…</p>
  }
  if (error) return <p className="text-sm text-rose-400">{error}</p>

  if (symbols.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <p className="rounded-lg border border-dashed border-slate-700 px-4 py-8 text-center text-sm text-slate-400">
          No symbols yet. Look one up in Research and star it to track it here.
        </p>
        <Link
          to="/research"
          className="self-center rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500"
        >
          Go to Research
        </Link>
      </div>
    )
  }

  return (
    <ul className="flex flex-col gap-2">
      {symbols.map(({ symbol }) => {
        const price = prices.get(symbol.toUpperCase())
        return (
          <li
            key={symbol}
            className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/40 px-4 py-3"
          >
            <Link
              to={`/research?symbol=${encodeURIComponent(symbol)}`}
              className="text-sm font-medium text-slate-100 hover:text-sky-400"
            >
              {symbol}
            </Link>
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-200">
                {price ? format(price) : 'price pending…'}
              </span>
              <button
                type="button"
                onClick={() => void toggle(symbol)}
                className="text-xs text-slate-500 hover:text-rose-400"
                aria-label={`Remove ${symbol} from watchlist`}
              >
                Remove
              </button>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useResearch } from '../lib/useResearch'
import { useWatchlist } from '../lib/useWatchlist'
import { SymbolSearch } from '../components/SymbolSearch'
import type { FundamentalsRow, NewsRow } from '../lib/research'

/**
 * Research: look up a symbol (typeahead over EODHD's search, or a raw symbol
 * that isn't in the search index) and see its fundamentals + recent news, with
 * a star toggle to add/remove it from the watchlist.
 */
export function ResearchPage() {
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const symbol = params.get('symbol') ?? ''
  const { fundamentals, news, loading, error } = useResearch(symbol)
  const { isWatched, toggle } = useWatchlist(user?.id ?? null)

  return (
    <div className="flex flex-col gap-5">
      <SymbolSearch onSelect={(sym) => setParams({ symbol: sym })} />

      {!symbol ? (
        <p className="rounded-lg border border-dashed border-slate-700 px-4 py-8 text-center text-sm text-slate-400">
          Search a company or enter an EODHD symbol (e.g. AAPL.US, 7203.T) to
          see its fundamentals and recent news.
        </p>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-slate-200">{symbol}</h2>
            <button
              type="button"
              onClick={() => void toggle(symbol)}
              className={
                'rounded-md border px-3 py-1 text-xs font-medium transition ' +
                (isWatched(symbol)
                  ? 'border-amber-500 text-amber-400 hover:bg-amber-500/10'
                  : 'border-slate-600 text-slate-300 hover:border-slate-400')
              }
            >
              {isWatched(symbol) ? '★ On watchlist' : '☆ Add to watchlist'}
            </button>
          </div>

          {loading && !fundamentals ? (
            <p className="text-sm text-slate-400">Loading {symbol}…</p>
          ) : null}
          {error ? <p className="text-sm text-rose-400">{error}</p> : null}

          {fundamentals ? <FundamentalsCard data={fundamentals} /> : null}

          {!loading && !fundamentals && !error ? (
            <p className="text-sm text-slate-400">
              No fundamentals cached yet for {symbol}.
            </p>
          ) : null}

          <NewsList symbol={symbol} items={news} />
        </>
      )}
    </div>
  )
}

function FundamentalsCard({ data }: { data: FundamentalsRow }) {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
      <p className="text-xs text-slate-400">{data.symbol}</p>
      <p className="text-lg font-semibold text-slate-100">
        {data.name ?? 'Unknown company'}
      </p>
      <p className="text-xs text-slate-400">
        {[data.sector, data.industry].filter(Boolean).join(' · ') || '—'}
      </p>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <Stat label="Market cap" value={formatCompact(data.market_cap, data.currency)} />
        <Stat label="P/E ratio" value={data.pe_ratio != null ? data.pe_ratio.toFixed(1) : '—'} />
      </div>

      {data.description ? (
        <p className="mt-4 text-xs leading-relaxed text-slate-400">
          {data.description.length > 400
            ? `${data.description.slice(0, 400)}…`
            : data.description}
        </p>
      ) : null}
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-base font-medium text-slate-100">{value}</p>
    </div>
  )
}

function formatCompact(value: number | null, currency: string | null): string {
  if (value == null) return '—'
  const suffix = currency ? ` ${currency}` : ''
  if (value >= 1e12) return `${(value / 1e12).toFixed(2)}T${suffix}`
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B${suffix}`
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M${suffix}`
  return `${value.toLocaleString()}${suffix}`
}

function NewsList({ symbol, items }: { symbol: string; items: NewsRow[] }) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-slate-400">No cached news yet for {symbol}.</p>
    )
  }
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-medium text-slate-200">Recent news</h2>
      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="block rounded-lg border border-slate-800 bg-slate-900/40 px-4 py-3 transition hover:border-slate-600"
            >
              <p className="text-sm text-slate-100">{item.headline}</p>
              <p className="mt-1 text-xs text-slate-500">
                {[item.source, item.published_at && new Date(item.published_at).toLocaleDateString()]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}

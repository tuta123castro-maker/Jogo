import { useEffect, useMemo, useState } from 'react'
import {
  DEFERRED_EXCHANGES,
  EXCHANGES,
  dataQualityLabel,
  type Exchange,
} from '../lib/markets'
import { exchangeStatus, type MarketState } from '../lib/exchange-hours'
import { normalizeSymbol, parseSymbol } from '../lib/symbols'
import { universeFxPairs } from '../lib/fx'
import { currencyMeta } from '../lib/currency'

/**
 * A live, price-feed-free window onto the v2 scaffolding. It renders the whole
 * tradeable universe with each exchange's EOD-only label and current
 * open/closed status, plus a symbol-normalization playground and the derived
 * FX-pair fetch list. Everything here works on the free tier — no EODHD key
 * required — so the v2 groundwork is visible and verifiable in the running app.
 */

const STATE_STYLES: Record<MarketState, string> = {
  open: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30',
  closed: 'bg-slate-500/15 text-slate-300 ring-slate-500/30',
  weekend: 'bg-slate-500/15 text-slate-400 ring-slate-500/30',
  holiday: 'bg-amber-500/15 text-amber-300 ring-amber-500/30',
}

function StatusPill({ ex, now }: { ex: Exchange; now: Date }) {
  const status = exchangeStatus(ex, now)
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${STATE_STYLES[status.state]}`}
      title={status.reason}
    >
      {status.reason}
    </span>
  )
}

function ExchangeRow({ ex, now }: { ex: Exchange; now: Date }) {
  const cur = currencyMeta(ex.currency)
  return (
    <li className="flex flex-col gap-1 rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-slate-100">{ex.name}</span>
        <StatusPill ex={ex} now={now} />
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-400">
        <span className="font-mono text-slate-300">.{ex.code}</span>
        <span>
          {ex.currency} ({cur.symbol})
        </span>
        <span>{ex.timezone}</span>
        <span
          className={
            ex.dataQuality === 'eod' ? 'text-amber-300/90' : 'text-emerald-300/90'
          }
        >
          {dataQualityLabel(ex.dataQuality)}
        </span>
        {ex.requiresPaidTier && (
          <span className="text-slate-500">requires paid tier</span>
        )}
      </div>
    </li>
  )
}

function SymbolPlayground() {
  const [input, setInput] = useState('700.hk')
  const parsed = parseSymbol(input)
  const normalized = normalizeSymbol(input)
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3">
      <label className="mb-1 block text-xs font-medium text-slate-300">
        Symbol normalization
      </label>
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        spellCheck={false}
        placeholder="e.g. 700.hk, volv b.st, aapl"
        className="w-full rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 font-mono text-sm text-slate-100 outline-none focus:border-slate-500"
      />
      <div className="mt-2 text-xs">
        {normalized && parsed ? (
          <span className="text-slate-300">
            →{' '}
            <span className="font-mono text-emerald-300">{normalized}</span>{' '}
            <span className="text-slate-500">
              (code <span className="font-mono">{parsed.code}</span>, exchange{' '}
              <span className="font-mono">{parsed.exchange}</span>)
            </span>
          </span>
        ) : (
          <span className="text-slate-500">Type a symbol to normalize it.</span>
        )}
      </div>
    </div>
  )
}

export default function MarketsPanel() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(id)
  }, [])

  const fxPairs = useMemo(() => universeFxPairs(), [])

  return (
    <section className="w-full space-y-4 text-left">
      <div>
        <h2 className="text-sm font-semibold text-slate-200">
          v2 market universe
        </h2>
        <p className="text-xs text-slate-500">
          Live open/closed status · EOD-only labels · {EXCHANGES.length} exchanges.
          Prices activate when a paid EODHD key is added.
        </p>
      </div>

      <ul className="space-y-1.5">
        {EXCHANGES.map((ex) => (
          <ExchangeRow key={ex.code} ex={ex} now={now} />
        ))}
      </ul>

      {DEFERRED_EXCHANGES.map((ex) => (
        <div
          key={ex.code}
          className="rounded-lg border border-dashed border-slate-700 bg-slate-900/20 px-3 py-2 text-xs text-slate-400"
        >
          <span className="font-medium text-slate-300">
            {ex.name} (.{ex.code})
          </span>{' '}
          — deferred. {ex.reason}
        </div>
      ))}

      <SymbolPlayground />

      <details className="rounded-lg border border-slate-800 bg-slate-900/40 p-3 text-xs text-slate-400">
        <summary className="cursor-pointer font-medium text-slate-300">
          FX pairs the universe requires ({fxPairs.length})
        </summary>
        <div className="mt-2 flex flex-wrap gap-1.5 font-mono">
          {fxPairs.map((p) => (
            <span
              key={p}
              className="rounded bg-slate-800/70 px-1.5 py-0.5 text-slate-300"
            >
              {p}
            </span>
          ))}
        </div>
      </details>
    </section>
  )
}

import { useEffect, useState } from 'react'
import { useAuth } from '../lib/auth'
import { getSupabase } from '../lib/supabase'
import { format, money } from '../lib/money'
import { loadTrades, type TradeRecord } from '../lib/trading'

/**
 * Basic order history — the immutable trade log, newest first. The richer
 * search/filter view lands in the later search phase; this confirms trades are
 * recorded and shows each order's native price and settlement FX.
 */
export function OrdersPage() {
  const { user } = useAuth()
  const [trades, setTrades] = useState<TradeRecord[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = getSupabase()
    if (!supabase || !user) return
    let active = true
    loadTrades(supabase, user.id)
      .then((rows) => active && setTrades(rows))
      .catch((err) => active && setError(err.message))
    return () => {
      active = false
    }
  }, [user])

  if (error) return <p className="text-sm text-rose-400">{error}</p>
  if (!trades) return <p className="text-sm text-slate-400">Loading orders…</p>
  if (trades.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-slate-700 px-4 py-8 text-center text-sm text-slate-400">
        No orders yet.
      </p>
    )
  }

  return (
    <ul className="flex flex-col gap-2">
      {trades.map((t) => (
        <li
          key={t.id}
          className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/40 px-4 py-3"
        >
          <div>
            <p className="text-sm font-medium text-slate-100">
              <span
                className={
                  t.side === 'buy' ? 'text-emerald-400' : 'text-rose-400'
                }
              >
                {t.side.toUpperCase()}
              </span>{' '}
              {t.symbol}
            </p>
            <p className="text-xs text-slate-400">
              {new Date(t.executed_at).toLocaleString()}
            </p>
          </div>
          <div className="text-right text-xs text-slate-300">
            <p>
              {t.quantity} @ {format(money(t.price_native, t.native_currency))}
            </p>
            <p className="text-slate-500">
              FX {t.native_currency}→{t.home_currency} {t.fx_rate}
            </p>
          </div>
        </li>
      ))}
    </ul>
  )
}

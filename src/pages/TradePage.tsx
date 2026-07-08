import { useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { getSupabase } from '../lib/supabase'
import { dec, format, money } from '../lib/money'
import {
  fetchFxRates,
  fetchPrices,
  requestRefresh,
  requiredFxKeys,
  resolveFxRate,
} from '../lib/marketData'
import { executeTrade, type TradeSide } from '../lib/trading'
import type { Profile } from '../lib/profile'

export function TradePage() {
  const { profile } = useOutletContext<{ profile: Profile }>()
  const home = profile.home_currency
  const navigate = useNavigate()

  const [symbol, setSymbol] = useState('')
  const [side, setSide] = useState<TradeSide>('buy')
  const [quantity, setQuantity] = useState('')
  const [nativeCurrency, setNativeCurrency] = useState<string>(home)
  const [priceNative, setPriceNative] = useState('')
  const [fxRate, setFxRate] = useState('1')

  const [quoteBusy, setQuoteBusy] = useState(false)
  const [submitBusy, setSubmitBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Keep FX at 1 automatically whenever the trade settles in the home currency.
  const sameCurrency = nativeCurrency.toUpperCase() === home

  async function fetchQuote() {
    const supabase = getSupabase()
    const sym = symbol.trim().toUpperCase()
    if (!supabase || !sym) return
    setQuoteBusy(true)
    setError(null)
    setNotice(null)
    try {
      const fxKeys = requiredFxKeys(nativeCurrency, home)
      await requestRefresh(supabase, { symbols: [sym], pairs: fxKeys })
      const [prices, fx] = await Promise.all([
        fetchPrices(supabase, [sym]),
        fetchFxRates(supabase, fxKeys),
      ])
      const price = prices.find((p) => p.symbol.toUpperCase() === sym)
      if (price) {
        setPriceNative(price.price)
        setNativeCurrency(price.currency)
      }
      const rate = resolveFxRate(price?.currency ?? nativeCurrency, home, fx)
      if (rate) setFxRate(rate.rate.toString())
      setNotice(
        price
          ? 'Latest cached quote loaded.'
          : 'No cached quote yet — enter the price manually.',
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not fetch a quote.')
    } finally {
      setQuoteBusy(false)
    }
  }

  const effectiveFx = sameCurrency ? '1' : fxRate
  const estimate =
    quantity && priceNative && effectiveFx
      ? money(
          dec(quantity).times(dec(priceNative)).times(dec(effectiveFx)),
          home,
        )
      : null

  async function submit() {
    const supabase = getSupabase()
    if (!supabase) return
    setSubmitBusy(true)
    setError(null)
    setNotice(null)
    try {
      await executeTrade(supabase, {
        symbol,
        side,
        quantity,
        priceNative,
        nativeCurrency,
        fxRate: effectiveFx,
        homeCurrency: home,
      })
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Trade failed.')
    } finally {
      setSubmitBusy(false)
    }
  }

  const canSubmit =
    symbol.trim() !== '' &&
    Number(quantity) > 0 &&
    Number(priceNative) > 0 &&
    Number(effectiveFx) > 0 &&
    !submitBusy

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1 rounded-lg bg-slate-800/60 p-1">
        {(['buy', 'sell'] as TradeSide[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSide(s)}
            className={
              'flex-1 rounded-md py-1.5 text-sm font-medium capitalize transition ' +
              (side === s
                ? s === 'buy'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-rose-600 text-white'
                : 'text-slate-300 hover:text-white')
            }
          >
            {s}
          </button>
        ))}
      </div>

      <Field label="Symbol (EODHD, e.g. AAPL.US or 7203.T)">
        <div className="flex gap-2">
          <input
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            className={inputCls + ' flex-1'}
            placeholder="AAPL.US"
          />
          <button
            type="button"
            onClick={() => void fetchQuote()}
            disabled={quoteBusy || !symbol.trim()}
            className="rounded-md border border-slate-600 px-3 text-xs text-slate-200 hover:border-slate-400 disabled:opacity-50"
          >
            {quoteBusy ? '…' : 'Get price'}
          </button>
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Quantity">
          <input
            type="number"
            min="0"
            step="any"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Native currency">
          <input
            value={nativeCurrency}
            onChange={(e) => setNativeCurrency(e.target.value.toUpperCase())}
            className={inputCls}
          />
        </Field>
        <Field label="Price (native)">
          <input
            type="number"
            min="0"
            step="any"
            value={priceNative}
            onChange={(e) => setPriceNative(e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label={`FX ${nativeCurrency.toUpperCase()}→${home}`}>
          <input
            type="number"
            min="0"
            step="any"
            value={sameCurrency ? '1' : fxRate}
            disabled={sameCurrency}
            onChange={(e) => setFxRate(e.target.value)}
            className={inputCls + (sameCurrency ? ' opacity-50' : '')}
          />
        </Field>
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-900/40 px-4 py-3 text-sm">
        <span className="text-slate-400">
          Estimated {side === 'buy' ? 'cost' : 'proceeds'}:{' '}
        </span>
        <span className="font-medium text-slate-100">
          {estimate ? format(estimate) : '—'}
        </span>
      </div>

      {notice ? <p className="text-sm text-emerald-400">{notice}</p> : null}
      {error ? <p className="text-sm text-rose-400">{error}</p> : null}

      <button
        type="button"
        onClick={() => void submit()}
        disabled={!canSubmit}
        className="rounded-md bg-sky-600 px-3 py-2.5 text-sm font-medium text-white transition hover:bg-sky-500 disabled:opacity-50"
      >
        {submitBusy
          ? 'Placing…'
          : `${side === 'buy' ? 'Buy' : 'Sell'} ${symbol.trim() || 'symbol'}`}
      </button>
    </div>
  )
}

const inputCls =
  'w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-sky-500'

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-xs text-slate-400">{label}</span>
      {children}
    </label>
  )
}

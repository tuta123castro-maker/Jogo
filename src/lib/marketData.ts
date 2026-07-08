import type { SupabaseClient } from '@supabase/supabase-js'
import { dec, fxRate, money, type FxRate, type Money } from './money'

/**
 * Client-side market-data layer.
 *
 * The client NEVER calls EODHD directly. A trusted Edge Function (service role)
 * fetches delayed prices and FX into `price_cache` / `fx_cache`; the client
 * reads those cached rows and, when a row is missing or stale, asks the Edge
 * Function to refresh (stale-while-revalidate). This keeps us inside EODHD's
 * free-tier rate limits no matter how many components render.
 */

export interface PriceRow {
  symbol: string
  price: string
  currency: string
  fetched_at: string
}

export interface FxRow {
  pair: string
  rate: string
  fetched_at: string
}

/**
 * How long a cached quote / FX rate is treated as fresh. Prices are delayed
 * anyway and the free tier is rate-limited, so we serve cache aggressively and
 * only trigger a refresh once a row is older than this.
 */
export const CACHE_TTL_MS = 15 * 60 * 1000 // 15 minutes

export function isStale(fetchedAt: string, now: number = Date.now()): boolean {
  const t = Date.parse(fetchedAt)
  if (Number.isNaN(t)) return true
  return now - t > CACHE_TTL_MS
}

export function priceToMoney(row: PriceRow): Money {
  return money(row.price, row.currency)
}

/** Canonical cache key for an FX pair: concatenated ISO codes, e.g. 'JPYUSD'. */
export function fxPairKey(from: string, to: string): string {
  return `${from.toUpperCase()}${to.toUpperCase()}`
}

/**
 * The pair keys needed to resolve a `from → to` rate: the direct pair and its
 * inverse. Empty when the currencies are identical (rate is trivially 1).
 */
export function requiredFxKeys(from: string, to: string): string[] {
  const f = from.toUpperCase()
  const t = to.toUpperCase()
  if (f === t) return []
  return [fxPairKey(f, t), fxPairKey(t, f)]
}

/**
 * Resolve a `from → to` FX rate from cached rows:
 *  - same currency  → rate 1
 *  - direct pair     → used as-is
 *  - only inverse    → reciprocated
 *  - neither cached  → null
 */
export function resolveFxRate(
  from: string,
  to: string,
  rows: FxRow[],
): FxRate | null {
  const f = from.toUpperCase()
  const t = to.toUpperCase()
  if (f === t) return fxRate(f, t, 1)

  const direct = rows.find((r) => r.pair.toUpperCase() === fxPairKey(f, t))
  if (direct) return fxRate(f, t, direct.rate)

  const inverse = rows.find((r) => r.pair.toUpperCase() === fxPairKey(t, f))
  if (inverse) {
    const r = dec(inverse.rate)
    if (r.isZero()) return null
    return fxRate(f, t, dec(1).div(r))
  }

  return null
}

// ── Supabase reads (cache only) ─────────────────────────────────────────────

export async function fetchPrices(
  supabase: SupabaseClient,
  symbols: string[],
): Promise<PriceRow[]> {
  const wanted = uniqueUpper(symbols)
  if (wanted.length === 0) return []
  const { data, error } = await supabase
    .from('price_cache')
    .select('symbol, price, currency, fetched_at')
    .in('symbol', wanted)
  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => ({
    symbol: String(r.symbol),
    price: String(r.price),
    currency: String(r.currency),
    fetched_at: String(r.fetched_at),
  }))
}

export async function fetchFxRates(
  supabase: SupabaseClient,
  pairs: string[],
): Promise<FxRow[]> {
  const wanted = uniqueUpper(pairs)
  if (wanted.length === 0) return []
  const { data, error } = await supabase
    .from('fx_cache')
    .select('pair, rate, fetched_at')
    .in('pair', wanted)
  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => ({
    pair: String(r.pair),
    rate: String(r.rate),
    fetched_at: String(r.fetched_at),
  }))
}

export interface RefreshRequest {
  symbols?: string[]
  pairs?: string[]
}

/**
 * Ask the Edge Function to (re)populate the caches for these symbols/pairs.
 * Best-effort: callers should still render whatever cached rows they have.
 */
export async function requestRefresh(
  supabase: SupabaseClient,
  req: RefreshRequest,
): Promise<void> {
  const symbols = uniqueUpper(req.symbols ?? [])
  const pairs = uniqueUpper(req.pairs ?? [])
  if (symbols.length === 0 && pairs.length === 0) return
  const { error } = await supabase.functions.invoke('market-refresh', {
    body: { symbols, pairs },
  })
  if (error) throw new Error(error.message)
}

function uniqueUpper(values: string[]): string[] {
  return [...new Set(values.map((v) => v.trim().toUpperCase()).filter(Boolean))]
}

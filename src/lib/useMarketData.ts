import { useCallback, useEffect, useMemo, useState } from 'react'
import { getSupabase } from './supabase'
import type { FxRate, Money } from './money'
import {
  fetchFxRates,
  fetchPrices,
  isStale,
  priceToMoney,
  requestRefresh,
  requiredFxKeys,
  resolveFxRate,
  type FxRow,
  type PriceRow,
} from './marketData'

/**
 * Hooks that read the price/FX caches with stale-while-revalidate: return
 * cached rows immediately, and if any are missing or stale, ask the Edge
 * Function to refresh and then re-read. The refresh is best-effort — a failure
 * (offline, rate-limited) leaves the last-known cache in place.
 */

export interface UsePrices {
  prices: Map<string, Money>
  rows: PriceRow[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function usePrices(symbols: string[]): UsePrices {
  // Stable dependency key so array identity changes don't loop the effect.
  const key = useMemo(
    () => [...new Set(symbols.map((s) => s.toUpperCase()))].sort().join(','),
    [symbols],
  )
  const [rows, setRows] = useState<PriceRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const supabase = getSupabase()
    const wanted = key ? key.split(',') : []
    if (!supabase || wanted.length === 0) {
      setRows([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      let data = await fetchPrices(supabase, wanted)
      const need = staleOrMissing(
        wanted,
        data.map((r) => ({ id: r.symbol, fetched_at: r.fetched_at })),
      )
      if (need.length > 0) {
        try {
          await requestRefresh(supabase, { symbols: need })
          data = await fetchPrices(supabase, wanted)
        } catch {
          // keep cached data; refresh is best-effort
        }
      }
      setRows(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load prices.')
    } finally {
      setLoading(false)
    }
  }, [key])

  useEffect(() => {
    void load()
  }, [load])

  const prices = useMemo(
    () => new Map(rows.map((r) => [r.symbol.toUpperCase(), priceToMoney(r)])),
    [rows],
  )

  return { prices, rows, loading, error, refresh: load }
}

export interface UseFxRate {
  rate: FxRate | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function useFxRate(from: string, to: string): UseFxRate {
  const f = from.toUpperCase()
  const t = to.toUpperCase()
  const [rows, setRows] = useState<FxRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const supabase = getSupabase()
    const keys = requiredFxKeys(f, t)
    if (!supabase || keys.length === 0) {
      setRows([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      let data = await fetchFxRates(supabase, keys)
      // Refresh only when neither direction resolves or the found row is stale.
      const resolved = resolveFxRate(f, t, data)
      const anyStale = data.some((r) => isStale(r.fetched_at))
      if (!resolved || anyStale) {
        try {
          await requestRefresh(supabase, { pairs: keys })
          data = await fetchFxRates(supabase, keys)
        } catch {
          // best-effort
        }
      }
      setRows(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load FX rate.')
    } finally {
      setLoading(false)
    }
  }, [f, t])

  useEffect(() => {
    void load()
  }, [load])

  const rate = useMemo(() => resolveFxRate(f, t, rows), [f, t, rows])
  return { rate, loading, error, refresh: load }
}

/** IDs that are absent from `have`, or present but stale. */
function staleOrMissing(
  wanted: string[],
  have: { id: string; fetched_at: string }[],
): string[] {
  return wanted.filter((id) => {
    const row = have.find((r) => r.id.toUpperCase() === id)
    return !row || isStale(row.fetched_at)
  })
}

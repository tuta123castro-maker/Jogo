import { useCallback, useEffect, useRef, useState } from 'react'
import { getSupabase } from './supabase'
import { money } from './money'
import type { HomeCurrency } from './currency'
import { loadCash, loadHoldings } from './portfolioData'
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
import { summarizePortfolio, type PortfolioSummary } from './portfolioSummary'
import { isSnapshotDue, loadLatestSnapshot, recordSnapshot } from './snapshots'

/**
 * Loads the portfolio and values it against the market-data cache. Gathers the
 * symbols and native currencies it holds, reads their cached prices/FX,
 * triggers a best-effort refresh for anything missing or stale, then builds the
 * summary. `refresh` re-runs the whole thing after a trade.
 *
 * Also records a portfolio-value snapshot for the value-over-time graph: once
 * per UTC calendar day the user is active (ambient), or immediately when
 * `forceSnapshotOnce` is set — used right after a trade so every trade shows
 * up as its own point.
 */
export interface UsePortfolio {
  summary: PortfolioSummary | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function usePortfolio(
  userId: string | null,
  homeCurrency: HomeCurrency,
  forceSnapshotOnce = false,
): UsePortfolio {
  const [summary, setSummary] = useState<PortfolioSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const forceNext = useRef(forceSnapshotOnce)

  const load = useCallback(async () => {
    const supabase = getSupabase()
    if (!supabase || !userId) {
      setSummary(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [cashRow, positions] = await Promise.all([
        loadCash(supabase, userId),
        loadHoldings(supabase, userId),
      ])
      const cash = cashRow?.cash ?? money(0, homeCurrency)

      const symbols = positions.map((p) => p.symbol)
      const fxKeys = [
        ...new Set(
          positions.flatMap((p) => requiredFxKeys(p.nativeCurrency, homeCurrency)),
        ),
      ]

      let priceRows = await fetchPrices(supabase, symbols)
      let fxRows = await fetchFxRates(supabase, fxKeys)

      const needSymbols = symbols.filter((s) => {
        const row = priceRows.find((r) => r.symbol.toUpperCase() === s.toUpperCase())
        return !row || isStale(row.fetched_at)
      })
      const needFx = fxKeys.filter((k) => {
        const row = fxRows.find((r) => r.pair.toUpperCase() === k)
        return !row || isStale(row.fetched_at)
      })
      if (needSymbols.length > 0 || needFx.length > 0) {
        try {
          await requestRefresh(supabase, { symbols: needSymbols, pairs: needFx })
          priceRows = await fetchPrices(supabase, symbols)
          fxRows = await fetchFxRates(supabase, fxKeys)
        } catch {
          // best-effort; value with whatever cache we have
        }
      }

      const built = summarizePortfolio({
        cash,
        positions,
        priceOf: priceLookup(priceRows),
        fxOf: (from, to) => resolveFxRate(from, to, fxRows),
      })
      setSummary(built)

      const force = forceNext.current
      forceNext.current = false
      try {
        const latest = await loadLatestSnapshot(supabase, userId)
        if (isSnapshotDue(latest?.captured_at ?? null, Date.now(), force)) {
          await recordSnapshot(supabase, userId, built.totalValueHome)
        }
      } catch {
        // Snapshotting is best-effort; never block the portfolio view on it.
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load portfolio.')
      setSummary(null)
    } finally {
      setLoading(false)
    }
  }, [userId, homeCurrency])

  useEffect(() => {
    void load()
  }, [load])

  return { summary, loading, error, refresh: load }
}

function priceLookup(rows: PriceRow[]) {
  const bySymbol = new Map(rows.map((r) => [r.symbol.toUpperCase(), r]))
  return (symbol: string) => {
    const row = bySymbol.get(symbol.toUpperCase())
    return row ? priceToMoney(row) : null
  }
}

// Re-exported for callers that only need the raw fx rows shape.
export type { FxRow }

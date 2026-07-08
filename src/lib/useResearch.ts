import { useCallback, useEffect, useState } from 'react'
import { getSupabase } from './supabase'
import {
  FUNDAMENTALS_TTL_MS,
  NEWS_TTL_MS,
  fetchFundamentals,
  fetchNews,
  isResearchStale,
  requestResearchRefresh,
  type FundamentalsRow,
  type NewsRow,
} from './research'

export interface UseResearch {
  fundamentals: FundamentalsRow | null
  news: NewsRow[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

/**
 * Stale-while-revalidate for one symbol's fundamentals + news: read the cache
 * immediately, trigger a best-effort Edge Function refresh if either is
 * missing or past its TTL, then re-read. Passing an empty symbol clears state
 * without touching the network.
 */
export function useResearch(symbol: string): UseResearch {
  const trimmed = symbol.trim().toUpperCase()
  const [fundamentals, setFundamentals] = useState<FundamentalsRow | null>(null)
  const [news, setNews] = useState<NewsRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const supabase = getSupabase()
    if (!supabase || !trimmed) {
      setFundamentals(null)
      setNews([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      let fund = await fetchFundamentals(supabase, trimmed)
      let newsRows = await fetchNews(supabase, trimmed)

      const fundStale = !fund || isResearchStale(fund.fetched_at, FUNDAMENTALS_TTL_MS)
      const newsStale =
        newsRows.length === 0 ||
        isResearchStale(newsRows[0].fetched_at, NEWS_TTL_MS)

      if (fundStale || newsStale) {
        try {
          await requestResearchRefresh(supabase, trimmed)
          fund = await fetchFundamentals(supabase, trimmed)
          newsRows = await fetchNews(supabase, trimmed)
        } catch {
          // best-effort; keep whatever was cached
        }
      }

      setFundamentals(fund)
      setNews(newsRows)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load research.')
    } finally {
      setLoading(false)
    }
  }, [trimmed])

  useEffect(() => {
    void load()
  }, [load])

  return { fundamentals, news, loading, error, refresh: load }
}

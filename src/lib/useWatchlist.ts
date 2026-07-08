import { useCallback, useEffect, useMemo, useState } from 'react'
import { getSupabase } from './supabase'
import {
  addToWatchlist,
  loadWatchlist,
  removeFromWatchlist,
  type WatchlistRow,
} from './watchlist'

export interface UseWatchlist {
  symbols: WatchlistRow[]
  isWatched: (symbol: string) => boolean
  toggle: (symbol: string) => Promise<void>
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function useWatchlist(userId: string | null): UseWatchlist {
  const [symbols, setSymbols] = useState<WatchlistRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const supabase = getSupabase()
    if (!supabase || !userId) {
      setSymbols([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      setSymbols(await loadWatchlist(supabase, userId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load watchlist.')
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    void load()
  }, [load])

  const watchedSet = useMemo(
    () => new Set(symbols.map((s) => s.symbol.toUpperCase())),
    [symbols],
  )
  const isWatched = useCallback(
    (symbol: string) => watchedSet.has(symbol.toUpperCase()),
    [watchedSet],
  )

  const toggle = useCallback(
    async (symbol: string) => {
      const supabase = getSupabase()
      if (!supabase || !userId) return
      const sym = symbol.trim().toUpperCase()
      if (isWatched(sym)) {
        await removeFromWatchlist(supabase, userId, sym)
      } else {
        await addToWatchlist(supabase, userId, sym)
      }
      await load()
    },
    [userId, isWatched, load],
  )

  return { symbols, isWatched, toggle, loading, error, refresh: load }
}

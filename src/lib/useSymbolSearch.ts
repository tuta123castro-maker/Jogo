import { useEffect, useRef, useState } from 'react'
import { getSupabase } from './supabase'
import { MIN_QUERY_LENGTH, normalizeQuery, searchSymbols, type SymbolResult } from './symbolSearch'

const DEBOUNCE_MS = 300

export interface UseSymbolSearch {
  results: SymbolResult[]
  loading: boolean
  error: string | null
}

/**
 * Debounced symbol search for a typeahead. Waits `DEBOUNCE_MS` after the last
 * keystroke, skips queries under MIN_QUERY_LENGTH, and ignores responses for a
 * query that's no longer current (fixes the out-of-order-response race a
 * naive debounce leaves open when a slow early request resolves after a
 * faster later one).
 */
export function useSymbolSearch(query: string): UseSymbolSearch {
  const [results, setResults] = useState<SymbolResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const latestQuery = useRef('')

  useEffect(() => {
    const normalized = normalizeQuery(query)
    if (normalized.length < MIN_QUERY_LENGTH) {
      setResults([])
      setLoading(false)
      setError(null)
      return
    }

    const supabase = getSupabase()
    if (!supabase) return

    setLoading(true)
    const timer = setTimeout(async () => {
      latestQuery.current = normalized
      try {
        const found = await searchSymbols(supabase, normalized)
        if (latestQuery.current === normalized) {
          setResults(found)
          setError(null)
        }
      } catch (err) {
        if (latestQuery.current === normalized) {
          setError(err instanceof Error ? err.message : 'Search failed.')
        }
      } finally {
        if (latestQuery.current === normalized) setLoading(false)
      }
    }, DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [query])

  return { results, loading, error }
}

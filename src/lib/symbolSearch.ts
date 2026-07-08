import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Client-side symbol search. Unlike marketData/research, there is no cache
 * table to read here — the `symbol-search` Edge Function returns results
 * directly, the way any search-as-you-type endpoint would. The function keeps
 * its own server-side cache to save repeat EODHD calls.
 */

export interface SymbolResult {
  symbol: string
  name: string
  exchange: string
  country: string | null
  currency: string | null
  type: string | null
}

/** Queries shorter than this are not worth sending — matches the function's guard. */
export const MIN_QUERY_LENGTH = 2

export function normalizeQuery(query: string): string {
  return query.trim().toLowerCase()
}

export async function searchSymbols(
  supabase: SupabaseClient,
  query: string,
): Promise<SymbolResult[]> {
  const normalized = normalizeQuery(query)
  if (normalized.length < MIN_QUERY_LENGTH) return []

  const { data, error } = await supabase.functions.invoke('symbol-search', {
    body: { query: normalized },
  })
  if (error) throw new Error(error.message)
  return (data?.results ?? []) as SymbolResult[]
}

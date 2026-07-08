import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Client-side research layer (fundamentals + news), mirroring marketData.ts:
 * the client never calls EODHD directly. The `research-refresh` Edge Function
 * (service role) is the only writer to `fundamentals_cache` / `news_cache`;
 * the client reads those cached rows and asks the function to refresh a
 * symbol when the cache is missing or stale.
 */

export interface FundamentalsRow {
  symbol: string
  name: string | null
  sector: string | null
  industry: string | null
  description: string | null
  currency: string | null
  market_cap: number | null
  pe_ratio: number | null
  fetched_at: string
}

export interface NewsRow {
  id: string
  symbol: string
  headline: string
  url: string
  source: string | null
  published_at: string | null
  fetched_at: string
}

/** Fundamentals are treated as fresh for a day; news for an hour. */
export const FUNDAMENTALS_TTL_MS = 24 * 60 * 60 * 1000
export const NEWS_TTL_MS = 60 * 60 * 1000

export function isResearchStale(
  fetchedAt: string,
  ttlMs: number,
  now: number = Date.now(),
): boolean {
  const t = Date.parse(fetchedAt)
  if (Number.isNaN(t)) return true
  return now - t > ttlMs
}

export async function fetchFundamentals(
  supabase: SupabaseClient,
  symbol: string,
): Promise<FundamentalsRow | null> {
  const { data, error } = await supabase
    .from('fundamentals_cache')
    .select(
      'symbol, name, sector, industry, description, currency, market_cap, pe_ratio, fetched_at',
    )
    .eq('symbol', symbol.trim().toUpperCase())
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as FundamentalsRow | null) ?? null
}

export async function fetchNews(
  supabase: SupabaseClient,
  symbol: string,
  limit = 10,
): Promise<NewsRow[]> {
  const { data, error } = await supabase
    .from('news_cache')
    .select('id, symbol, headline, url, source, published_at, fetched_at')
    .eq('symbol', symbol.trim().toUpperCase())
    .order('published_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return (data ?? []) as NewsRow[]
}

/** Best-effort: ask the Edge Function to (re)populate research for a symbol. */
export async function requestResearchRefresh(
  supabase: SupabaseClient,
  symbol: string,
): Promise<void> {
  const { error } = await supabase.functions.invoke('research-refresh', {
    body: { symbol: symbol.trim().toUpperCase() },
  })
  if (error) throw new Error(error.message)
}

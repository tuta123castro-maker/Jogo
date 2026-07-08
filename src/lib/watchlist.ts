import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Watchlist reads/writes go straight to `public.watchlist` — no Edge Function
 * needed, since RLS already scopes every row to its owner (see
 * 0001_init.sql's "own watchlist" policy) and there's no third-party API
 * involved.
 */

export interface WatchlistRow {
  symbol: string
  created_at: string
}

export async function loadWatchlist(
  supabase: SupabaseClient,
  userId: string,
): Promise<WatchlistRow[]> {
  const { data, error } = await supabase
    .from('watchlist')
    .select('symbol, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as WatchlistRow[]
}

export async function addToWatchlist(
  supabase: SupabaseClient,
  userId: string,
  symbol: string,
): Promise<void> {
  const { error } = await supabase
    .from('watchlist')
    .upsert(
      { user_id: userId, symbol: symbol.trim().toUpperCase() },
      { onConflict: 'user_id,symbol', ignoreDuplicates: true },
    )
  if (error) throw new Error(error.message)
}

export async function removeFromWatchlist(
  supabase: SupabaseClient,
  userId: string,
  symbol: string,
): Promise<void> {
  const { error } = await supabase
    .from('watchlist')
    .delete()
    .eq('user_id', userId)
    .eq('symbol', symbol.trim().toUpperCase())
  if (error) throw new Error(error.message)
}

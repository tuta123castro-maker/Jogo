import type { SupabaseClient } from '@supabase/supabase-js'
import type { HomeCurrency } from './currency'
import { toStorageString, type Money } from './money'

/**
 * Portfolio value history. The schema (`portfolio_snapshots`) is designed for
 * "daily or per-event" rows (see the migration), which this implements without
 * a cron job: a snapshot is recorded once per calendar day the user is active
 * (ambient, from `usePortfolio`'s load) and once more per trade (event-based,
 * forced from `TradePage`), mirroring the stale-while-revalidate pattern
 * already used for the price/FX cache.
 */

export interface SnapshotRow {
  captured_at: string
  total_value_home: string
  home_currency: HomeCurrency
}

export async function loadLatestSnapshot(
  supabase: SupabaseClient,
  userId: string,
): Promise<SnapshotRow | null> {
  const { data, error } = await supabase
    .from('portfolio_snapshots')
    .select('captured_at, total_value_home, home_currency')
    .eq('user_id', userId)
    .order('captured_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as SnapshotRow | null) ?? null
}

export async function loadSnapshots(
  supabase: SupabaseClient,
  userId: string,
  limit = 400,
): Promise<SnapshotRow[]> {
  const { data, error } = await supabase
    .from('portfolio_snapshots')
    .select('captured_at, total_value_home, home_currency')
    .eq('user_id', userId)
    .order('captured_at', { ascending: true })
    .limit(limit)
  if (error) throw new Error(error.message)
  return (data ?? []) as SnapshotRow[]
}

/**
 * Whether a new snapshot should be written given the most recent one on file.
 * `force` always writes (used right after a trade). Otherwise a snapshot is
 * due once per UTC calendar day, so opening the app repeatedly in one day
 * doesn't spam rows.
 */
export function isSnapshotDue(
  lastCapturedAt: string | null,
  now: number,
  force = false,
): boolean {
  if (force || !lastCapturedAt) return true
  const last = new Date(lastCapturedAt)
  const current = new Date(now)
  return (
    last.getUTCFullYear() !== current.getUTCFullYear() ||
    last.getUTCMonth() !== current.getUTCMonth() ||
    last.getUTCDate() !== current.getUTCDate()
  )
}

export async function recordSnapshot(
  supabase: SupabaseClient,
  userId: string,
  totalValueHome: Money,
): Promise<void> {
  const { error } = await supabase.from('portfolio_snapshots').insert({
    user_id: userId,
    captured_at: new Date().toISOString(),
    total_value_home: toStorageString(totalValueHome),
    home_currency: totalValueHome.currency,
  })
  if (error) throw new Error(error.message)
}

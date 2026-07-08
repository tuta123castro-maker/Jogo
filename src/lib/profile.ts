import type { SupabaseClient } from '@supabase/supabase-js'
import { money, toStorageString } from './money'
import type { HomeCurrency } from './currency'

/**
 * Profile + onboarding data access.
 *
 * A "profile" row (SPEC: `users`) is created the moment a user finishes
 * onboarding by choosing a home currency. Completing onboarding also seeds the
 * user's single portfolio with a starting cash balance and records a day-one
 * snapshot so the value-over-time graph has an origin point.
 */

/**
 * Starting paper cash granted on onboarding, in the user's chosen home
 * currency. SPEC.md is not committed to the repo, so this is a sensible v1
 * default (a round 100,000) rather than a spec-derived figure — adjust here if
 * the spec dictates otherwise.
 */
export const STARTING_CASH = '100000'

export interface Profile {
  id: string
  home_currency: HomeCurrency
  onboarded_at: string | null
  created_at: string
}

export async function getProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, home_currency, onboarded_at, created_at')
    .eq('id', userId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return (data as Profile | null) ?? null
}

export interface OnboardResult {
  error: string | null
}

/**
 * Finish onboarding: create/complete the profile with the chosen home
 * currency, seed the portfolio with starting cash, and record the first
 * portfolio snapshot. Each write is idempotent via unique constraints, so a
 * retry after a partial failure will not duplicate rows.
 */
export async function completeOnboarding(
  supabase: SupabaseClient,
  userId: string,
  homeCurrency: HomeCurrency,
): Promise<OnboardResult> {
  const startingCash = toStorageString(money(STARTING_CASH, homeCurrency))
  const now = new Date().toISOString()

  const profileWrite = await supabase.from('profiles').upsert(
    {
      id: userId,
      home_currency: homeCurrency,
      onboarded_at: now,
    },
    { onConflict: 'id' },
  )
  if (profileWrite.error) return { error: profileWrite.error.message }

  const portfolioWrite = await supabase.from('portfolios').upsert(
    {
      user_id: userId,
      cash: startingCash,
      cash_currency: homeCurrency,
    },
    { onConflict: 'user_id' },
  )
  if (portfolioWrite.error) return { error: portfolioWrite.error.message }

  const snapshotWrite = await supabase.from('portfolio_snapshots').insert({
    user_id: userId,
    captured_at: now,
    total_value_home: startingCash,
    home_currency: homeCurrency,
  })
  if (snapshotWrite.error) return { error: snapshotWrite.error.message }

  return { error: null }
}

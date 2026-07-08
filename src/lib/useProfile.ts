import { useCallback, useEffect, useState } from 'react'
import { getSupabase } from './supabase'
import { getProfile, type Profile } from './profile'

export interface UseProfile {
  profile: Profile | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

/**
 * Loads the signed-in user's profile row. `profile` is null both while loading
 * and when the user has not onboarded yet; callers should gate on `loading`
 * first, then on `profile?.onboarded_at`.
 */
export function useProfile(userId: string | null): UseProfile {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const supabase = getSupabase()
    if (!supabase || !userId) {
      setProfile(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      setProfile(await getProfile(supabase, userId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profile.')
      setProfile(null)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { profile, loading, error, refresh }
}

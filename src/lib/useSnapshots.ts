import { useCallback, useEffect, useState } from 'react'
import { getSupabase } from './supabase'
import { loadSnapshots, type SnapshotRow } from './snapshots'

export interface UseSnapshots {
  snapshots: SnapshotRow[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function useSnapshots(userId: string | null): UseSnapshots {
  const [snapshots, setSnapshots] = useState<SnapshotRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const supabase = getSupabase()
    if (!supabase || !userId) {
      setSnapshots([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      setSnapshots(await loadSnapshots(supabase, userId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load history.')
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    void load()
  }, [load])

  return { snapshots, loading, error, refresh: load }
}

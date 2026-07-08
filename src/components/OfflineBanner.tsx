import { useOnlineStatus } from '../lib/useOnlineStatus'

/** Fixed top banner shown while offline — every screen needs Supabase. */
export function OfflineBanner() {
  const online = useOnlineStatus()
  if (online) return null

  return (
    <div className="sticky top-0 z-20 bg-amber-500/90 px-4 py-1.5 text-center text-xs font-medium text-slate-950">
      You’re offline — prices, trades, and research need a connection.
    </div>
  )
}

import { useEffect, useState } from 'react'
import { useAuth } from '../lib/auth'
import { getSupabase } from '../lib/supabase'
import type { Profile } from '../lib/profile'
import { fromStorage, format } from '../lib/money'

/**
 * Placeholder home screen for the signed-in, onboarded state. It confirms the
 * auth + onboarding pipeline end-to-end (identity, home currency, seeded cash)
 * and is the anchor the trading/portfolio UI will replace in a later phase.
 */
export function Dashboard({ profile }: { profile: Profile }) {
  const { user, signOut } = useAuth()
  const [cash, setCash] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = getSupabase()
    if (!supabase || !user) return
    let active = true
    supabase
      .from('portfolios')
      .select('cash, cash_currency')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return
        if (error) {
          setError(error.message)
          return
        }
        if (data) {
          setCash(format(fromStorage(String(data.cash), data.cash_currency)))
        }
      })
    return () => {
      active = false
    }
  }, [user])

  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col gap-6 px-6 py-10">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Open Markets</h1>
        <button
          type="button"
          onClick={() => void signOut()}
          className="rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-300 transition hover:border-slate-500 hover:text-slate-100"
        >
          Sign out
        </button>
      </header>

      <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
        <p className="text-xs text-slate-400">Signed in as</p>
        <p className="text-sm text-slate-200">{user?.email}</p>

        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-slate-400">Home currency</p>
            <p className="text-lg font-medium text-slate-100">
              {profile.home_currency}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Cash balance</p>
            <p className="text-lg font-medium text-slate-100">
              {cash ?? '—'}
            </p>
          </div>
        </div>

        {error ? (
          <p className="mt-3 text-sm text-rose-400">{error}</p>
        ) : null}
      </section>

      <p className="text-center text-xs text-slate-500">
        Trading, research, and your portfolio graph arrive in the next phases.
      </p>
    </main>
  )
}

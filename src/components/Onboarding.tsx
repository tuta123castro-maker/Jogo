import { useState } from 'react'
import { useAuth } from '../lib/auth'
import { getSupabase } from '../lib/supabase'
import { completeOnboarding, STARTING_CASH } from '../lib/profile'
import { HOME_CURRENCIES, currencyMeta, type HomeCurrency } from '../lib/currency'
import { format, money } from '../lib/money'
import { Brand, Screen } from './Screen'

/**
 * One-step onboarding: pick a home currency. Finishing seeds the portfolio with
 * starting paper cash and records a day-one snapshot, then hands control back
 * to the app via `onDone` (which re-fetches the profile).
 */
export function Onboarding({ onDone }: { onDone: () => void }) {
  const { user } = useAuth()
  const [selected, setSelected] = useState<HomeCurrency>('USD')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function confirm() {
    const supabase = getSupabase()
    if (!supabase || !user) {
      setError('Not signed in.')
      return
    }
    setBusy(true)
    setError(null)
    const { error } = await completeOnboarding(supabase, user.id, selected)
    setBusy(false)
    if (error) {
      setError(error)
      return
    }
    onDone()
  }

  const startingLabel = format(money(STARTING_CASH, selected))

  return (
    <Screen>
      <Brand tagline="One quick setup step" />

      <div className="flex flex-col gap-4 rounded-xl border border-slate-800 bg-slate-900/50 p-5">
        <div>
          <p className="text-sm font-medium text-slate-200">
            Choose your home currency
          </p>
          <p className="mt-1 text-xs text-slate-400">
            All returns are measured in this currency. Because holdings settle in
            their own native currency, exchange-rate moves genuinely affect your
            P&amp;L. You can’t change this later in v1.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {HOME_CURRENCIES.map((code) => {
            const meta = currencyMeta(code)
            const active = selected === code
            return (
              <button
                key={code}
                type="button"
                onClick={() => setSelected(code)}
                className={
                  'flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition ' +
                  (active
                    ? 'border-sky-500 bg-sky-500/10 text-slate-100'
                    : 'border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-500')
                }
              >
                <span className="font-medium">{code}</span>
                <span className="text-slate-400">{meta.symbol}</span>
              </button>
            )
          })}
        </div>

        <p className="text-xs text-slate-400">
          You’ll start with{' '}
          <span className="font-medium text-slate-200">{startingLabel}</span> in
          paper cash.
        </p>

        {error ? <p className="text-sm text-rose-400">{error}</p> : null}

        <button
          type="button"
          onClick={confirm}
          disabled={busy}
          className="rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-sky-500 disabled:opacity-50"
        >
          {busy ? 'Setting up…' : `Start with ${selected}`}
        </button>
      </div>
    </Screen>
  )
}

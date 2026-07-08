import { useState, type FormEvent } from 'react'
import { useAuth } from '../lib/auth'
import { Brand, Screen } from './Screen'

type Mode = 'sign-in' | 'sign-up'

/**
 * Email + password sign-in / sign-up for the small set of users. Password auth
 * keeps the app self-contained (no email-delivery setup required to get in),
 * while Supabase still enforces per-user data isolation via RLS.
 */
export function AuthScreen() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState<Mode>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setNotice(null)

    const result =
      mode === 'sign-in'
        ? await signIn(email, password)
        : await signUp(email, password)

    setBusy(false)
    if (result.error) {
      setError(result.error)
      return
    }
    if (mode === 'sign-up') {
      // If email confirmation is on, there is no session yet.
      setNotice('Account created. If sign-in does not start, confirm your email.')
    }
  }

  return (
    <Screen>
      <Brand tagline="Sign in to your paper portfolio" />

      <form
        onSubmit={onSubmit}
        className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900/50 p-5"
      >
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-400">Email</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-sky-500"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-400">Password</span>
          <input
            type="password"
            required
            minLength={6}
            autoComplete={
              mode === 'sign-in' ? 'current-password' : 'new-password'
            }
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-sky-500"
          />
        </label>

        {error ? <p className="text-sm text-rose-400">{error}</p> : null}
        {notice ? <p className="text-sm text-emerald-400">{notice}</p> : null}

        <button
          type="submit"
          disabled={busy}
          className="mt-1 rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-sky-500 disabled:opacity-50"
        >
          {busy
            ? 'Please wait…'
            : mode === 'sign-in'
              ? 'Sign in'
              : 'Create account'}
        </button>
      </form>

      <button
        type="button"
        onClick={() => {
          setMode((m) => (m === 'sign-in' ? 'sign-up' : 'sign-in'))
          setError(null)
          setNotice(null)
        }}
        className="text-center text-sm text-slate-400 underline-offset-2 hover:text-slate-200 hover:underline"
      >
        {mode === 'sign-in'
          ? 'Need an account? Create one'
          : 'Already have an account? Sign in'}
      </button>
    </Screen>
  )
}

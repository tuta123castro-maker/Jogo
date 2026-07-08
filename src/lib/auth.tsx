import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { getSupabase } from './supabase'

/**
 * Auth context — a thin wrapper over Supabase Auth that exposes the current
 * session to the React tree and the handful of actions onboarding needs.
 *
 * The provider is only mounted once Supabase is configured (see App.tsx), but
 * it still guards against a null client so it never throws.
 */

export type AuthStatus = 'loading' | 'signed-out' | 'signed-in'

export interface AuthResult {
  error: string | null
}

interface AuthContextValue {
  status: AuthStatus
  session: Session | null
  user: User | null
  signIn: (email: string, password: string) => Promise<AuthResult>
  signUp: (email: string, password: string) => Promise<AuthResult>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = getSupabase()
  const [session, setSession] = useState<Session | null>(null)
  const [status, setStatus] = useState<AuthStatus>('loading')

  useEffect(() => {
    if (!supabase) {
      setStatus('signed-out')
      return
    }

    let active = true

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setStatus(data.session ? 'signed-in' : 'signed-out')
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      setStatus(next ? 'signed-in' : 'signed-out')
    })

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [supabase])

  const value = useMemo<AuthContextValue>(() => {
    async function signIn(email: string, password: string): Promise<AuthResult> {
      if (!supabase) return { error: 'Supabase is not configured.' }
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      return { error: error?.message ?? null }
    }

    async function signUp(email: string, password: string): Promise<AuthResult> {
      if (!supabase) return { error: 'Supabase is not configured.' }
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      })
      return { error: error?.message ?? null }
    }

    async function signOut(): Promise<void> {
      await supabase?.auth.signOut()
    }

    return {
      status,
      session,
      user: session?.user ?? null,
      signIn,
      signUp,
      signOut,
    }
  }, [supabase, session, status])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}

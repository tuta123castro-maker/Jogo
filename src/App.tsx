import { config } from './lib/config'
import { AuthProvider, useAuth } from './lib/auth'
import { useProfile } from './lib/useProfile'
import { SetupRequired } from './components/SetupRequired'
import { AuthScreen } from './components/AuthScreen'
import { Onboarding } from './components/Onboarding'
import { Dashboard } from './components/Dashboard'
import { Loading } from './components/Loading'

/**
 * Top-level gate. The auth/onboarding pipeline is a linear sequence of states:
 *
 *   not configured → signed-out → (signed-in, no profile) → onboarded
 *
 * App picks exactly one screen for the current state; later phases will mount
 * the real router inside the onboarded branch.
 */
export default function App() {
  if (!config.hasSupabase) return <SetupRequired />

  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  )
}

function Gate() {
  const { status, user } = useAuth()

  if (status === 'loading') return <Loading label="Starting Open Markets…" />
  if (status === 'signed-out' || !user) return <AuthScreen />

  return <AuthedGate userId={user.id} />
}

function AuthedGate({ userId }: { userId: string }) {
  const { profile, loading, error, refresh } = useProfile(userId)

  if (loading) return <Loading label="Loading your portfolio…" />
  if (error) return <Loading label={`Couldn’t load profile: ${error}`} />
  if (!profile?.onboarded_at) return <Onboarding onDone={() => void refresh()} />

  return <Dashboard profile={profile} />
}

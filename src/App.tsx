import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { config } from './lib/config'
import { AuthProvider, useAuth } from './lib/auth'
import { useProfile } from './lib/useProfile'
import type { Profile } from './lib/profile'
import { SetupRequired } from './components/SetupRequired'
import { AuthScreen } from './components/AuthScreen'
import { Onboarding } from './components/Onboarding'
import { AppShell } from './components/AppShell'
import { Loading } from './components/Loading'
import { PortfolioPage } from './pages/PortfolioPage'
import { TradePage } from './pages/TradePage'
import { OrdersPage } from './pages/OrdersPage'
import { ResearchPage } from './pages/ResearchPage'

/**
 * Top-level gate. The auth/onboarding pipeline is a linear sequence of states:
 *
 *   not configured → signed-out → (signed-in, no profile) → onboarded
 *
 * Once onboarded, the routed app (AppShell + pages) takes over.
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

  return <RoutedApp profile={profile} />
}

function RoutedApp({ profile }: { profile: Profile }) {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell profile={profile} />}>
          <Route index element={<PortfolioPage />} />
          <Route path="trade" element={<TradePage />} />
          <Route path="research" element={<ResearchPage />} />
          <Route path="orders" element={<OrdersPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

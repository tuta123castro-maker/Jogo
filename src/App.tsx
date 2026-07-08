import { lazy, Suspense } from 'react'
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
import { OfflineBanner } from './components/OfflineBanner'
import { UpdatePrompt } from './components/UpdatePrompt'
import { PortfolioPage } from './pages/PortfolioPage'

// Portfolio is the landing page and loads eagerly; everything reached by
// navigating away from it is code-split so the first paint doesn't pay for
// trading, research, watchlist, and order-history code up front.
const TradePage = lazy(() => import('./pages/TradePage').then((m) => ({ default: m.TradePage })))
const ResearchPage = lazy(() => import('./pages/ResearchPage').then((m) => ({ default: m.ResearchPage })))
const WatchlistPage = lazy(() => import('./pages/WatchlistPage').then((m) => ({ default: m.WatchlistPage })))
const OrdersPage = lazy(() => import('./pages/OrdersPage').then((m) => ({ default: m.OrdersPage })))

/**
 * Top-level gate. The auth/onboarding pipeline is a linear sequence of states:
 *
 *   not configured → signed-out → (signed-in, no profile) → onboarded
 *
 * Once onboarded, the routed app (AppShell + pages) takes over. The offline
 * banner and update prompt sit above all of that — they're relevant however
 * far the user got.
 */
export default function App() {
  if (!config.hasSupabase) return <SetupRequired />

  return (
    <AuthProvider>
      <OfflineBanner />
      <Gate />
      <UpdatePrompt />
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
          <Route
            path="trade"
            element={
              <Suspense fallback={<Loading label="Loading…" />}>
                <TradePage />
              </Suspense>
            }
          />
          <Route
            path="research"
            element={
              <Suspense fallback={<Loading label="Loading…" />}>
                <ResearchPage />
              </Suspense>
            }
          />
          <Route
            path="watchlist"
            element={
              <Suspense fallback={<Loading label="Loading…" />}>
                <WatchlistPage />
              </Suspense>
            }
          />
          <Route
            path="orders"
            element={
              <Suspense fallback={<Loading label="Loading…" />}>
                <OrdersPage />
              </Suspense>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

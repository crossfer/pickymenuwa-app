import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { AuthProvider } from '@/contexts/AuthContext'
import { useAuth } from '@/hooks/useAuth'
import { PageShell } from '@/components/layout/PageShell'

import { Login } from '@/pages/auth/Login'
import { ForgotPassword } from '@/pages/auth/ForgotPassword'
import { Overview } from '@/pages/dashboard/Overview'
import { Categories } from '@/pages/dashboard/Categories'
import { MenuItems } from '@/pages/dashboard/MenuItems'
import { Availability } from '@/pages/dashboard/Availability'
import { Conversations } from '@/pages/dashboard/Conversations'
import { Settings } from '@/pages/dashboard/Settings'
import { Restaurants } from '@/pages/superadmin/Restaurants'
import { Users } from '@/pages/superadmin/Users'

// ─── Query client ─────────────────────────────────────────────────────────────

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30,
      retry: 1,
    },
  },
})

// ─── Full-screen spinner (used while auth resolves) ───────────────────────────

function Spinner() {
  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  )
}

// ─── RequireAuth ──────────────────────────────────────────────────────────────
/**
 * Blocks rendering until auth is resolved.
 * If the user is not signed in → redirect to /login.
 * Uses <Navigate> (synchronous) instead of useEffect so there's zero flash.
 */
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) return <Spinner />
  if (!user)   return <Navigate to="/login" replace />

  return <>{children}</>
}

// ─── RoleGuard ────────────────────────────────────────────────────────────────
/**
 * After auth is confirmed, check that the user's role is in `allowed`.
 * If not → redirect to the appropriate home for their actual role.
 */
function RoleGuard({
  allowed,
  children,
}: {
  allowed: Array<'superadmin' | 'admin' | 'staff'>
  children: React.ReactNode
}) {
  const { profile, loading } = useAuth()

  // Still fetching profile — show nothing (RequireAuth already showed the spinner)
  if (loading || !profile) return null

  if (!allowed.includes(profile.role)) {
    const fallback =
      profile.role === 'superadmin' ? '/superadmin/restaurants' : '/dashboard'
    return <Navigate to={fallback} replace />
  }

  return <>{children}</>
}

// ─── Routes ───────────────────────────────────────────────────────────────────

function AppRoutes() {
  return (
    <Routes>
      {/* ── Public ── */}
      <Route path="/login"          element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />

      {/* ── Dashboard: admin + staff ── */}
      <Route
        path="/dashboard"
        element={
          <RequireAuth>
            <RoleGuard allowed={['admin', 'staff']}>
              <PageShell />
            </RoleGuard>
          </RequireAuth>
        }
      >
        <Route index                element={<Overview />} />
        <Route path="categories"   element={<Categories />} />
        <Route path="menu-items"   element={<MenuItems />} />
        <Route path="availability"   element={<Availability />} />
        <Route path="conversations" element={<Conversations />} />
        <Route path="settings"      element={<Settings />} />
      </Route>

      {/* ── Superadmin ── */}
      <Route
        path="/superadmin"
        element={
          <RequireAuth>
            <RoleGuard allowed={['superadmin']}>
              <PageShell />
            </RoleGuard>
          </RequireAuth>
        }
      >
        <Route index                  element={<Navigate to="restaurants" replace />} />
        <Route path="restaurants"     element={<Restaurants />} />
        <Route path="users"           element={<Users />} />
      </Route>

      {/* ── Catch-all: redirect to dashboard (RequireAuth will gate it) ── */}
      <Route path="/"  element={<Navigate to="/dashboard" replace />} />
      <Route path="*"  element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {/* AuthProvider must be inside BrowserRouter so <Navigate> works */}
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

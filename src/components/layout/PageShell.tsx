import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { useAuth } from '@/hooks/useAuth'

/**
 * PageShell — the persistent chrome for authenticated pages.
 *
 * By the time this renders, RequireAuth + RoleGuard have already confirmed
 * the user is signed in, so we can read profile directly from context without
 * an extra loading check.
 */
export function PageShell() {
  const { profile } = useAuth()

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar profile={profile} />
      <main className="flex flex-1 flex-col overflow-y-auto min-w-0">
        <Outlet />
      </main>
    </div>
  )
}

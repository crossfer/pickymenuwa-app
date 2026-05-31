import { useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { Sidebar } from './Sidebar'
import { useAuth } from '@/hooks/useAuth'

export function PageShell() {
  const { profile, impersonatedRestaurantId, impersonatedRestaurantName, setImpersonation } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const navigate = useNavigate()

  const handleExitImpersonation = () => {
    setImpersonation(null, null)
    navigate('/superadmin/restaurants')
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">

      {/* Impersonation banner — spans full width including sidebar */}
      {impersonatedRestaurantId && (
        <div className="flex shrink-0 items-center justify-between bg-amber-500 px-4 py-1.5 text-sm font-medium text-amber-950">
          <span>Viewing as <strong>{impersonatedRestaurantName}</strong></span>
          <button
            onClick={handleExitImpersonation}
            className="flex items-center gap-1 rounded px-2 py-0.5 hover:bg-amber-400 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
            Exit
          </button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden min-h-0">
        <Sidebar
          profile={profile}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        <main className="flex flex-1 flex-col overflow-y-auto min-w-0">
          {/* Mobile-only top bar with hamburger button */}
          <div className="lg:hidden sticky top-0 z-10 flex items-center h-12 border-b bg-background px-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="rounded-md p-1.5 text-foreground hover:bg-accent transition-colors"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
          <Outlet />
        </main>
      </div>

    </div>
  )
}

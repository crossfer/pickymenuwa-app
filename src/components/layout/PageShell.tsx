import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { Sidebar } from './Sidebar'
import { useAuth } from '@/hooks/useAuth'

export function PageShell() {
  const { profile } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden bg-background">
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
  )
}

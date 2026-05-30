import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  FolderOpen,
  UtensilsCrossed,
  ToggleLeft,
  MessageSquare,
  Settings,
  LogOut,
  Building2,
  Users,
} from 'lucide-react'
import logo from '@/assets/logo512.png'
import { cn } from '@/lib/utils'
import { signOut } from '@/hooks/useAuth'
import type { Profile } from '@/types/database'

interface SidebarProps {
  profile: Profile | null
}

interface NavItem {
  label: string
  to: string
  icon: React.ReactNode
}

const adminNavItems: NavItem[] = [
  { label: 'Overview', to: '/dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
  { label: 'Categories', to: '/dashboard/categories', icon: <FolderOpen className="h-4 w-4" /> },
  { label: 'Menu Items', to: '/dashboard/menu-items', icon: <UtensilsCrossed className="h-4 w-4" /> },
  { label: 'Availability',   to: '/dashboard/availability',   icon: <ToggleLeft    className="h-4 w-4" /> },
  { label: 'Conversations', to: '/dashboard/conversations', icon: <MessageSquare className="h-4 w-4" /> },
  { label: 'Settings',      to: '/dashboard/settings',      icon: <Settings      className="h-4 w-4" /> },
]

const superadminNavItems: NavItem[] = [
  { label: 'Restaurants', to: '/superadmin/restaurants', icon: <Building2 className="h-4 w-4" /> },
  { label: 'Users', to: '/superadmin/users', icon: <Users className="h-4 w-4" /> },
]

export function Sidebar({ profile }: SidebarProps) {
  const navigate = useNavigate()
  const isSuperadmin = profile?.role === 'superadmin'
  const navItems = isSuperadmin ? superadminNavItems : adminNavItems

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <aside className="flex h-screen w-60 flex-col border-r bg-sidebar text-sidebar-foreground">
      {/* Logo */}
      <div className="flex h-14 items-center border-b border-sidebar-border px-4">
        <img src={logo} alt="PickyMenu" className="h-16 w-auto" />
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.to === '/dashboard' || item.to === '/superadmin/restaurants'}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                  )
                }
              >
                {item.icon}
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* User footer */}
      <div className="border-t border-sidebar-border px-3 py-3">
        <div className="mb-2 px-3 py-1">
          <p className="text-xs font-medium text-white truncate">
            {profile?.full_name ?? 'User'}
          </p>
          <p className="text-xs text-sidebar-foreground/60 capitalize">
            {profile?.role}
          </p>
        </div>
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  )
}

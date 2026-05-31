import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { UtensilsCrossed, FolderOpen, ToggleLeft, Star, ArrowRight } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useAuth, useRestaurantId } from '@/hooks/useAuth'
import { useMenuItems } from '@/hooks/useMenu'
import { useCategories } from '@/hooks/useCategories'
import { formatCurrency, formatDate } from '@/lib/utils'

// ─── Stat card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  title: string
  value: number | string
  description?: string
  icon: React.ReactNode
  href?: string
}

function StatCard({ title, value, description, icon, href }: StatCardProps) {
  const inner = (
    <Card className={href ? 'hover:shadow-md transition-shadow cursor-pointer' : ''}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className="text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  )

  return href ? <Link to={href}>{inner}</Link> : inner
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function Overview() {
  const { profile, impersonatedRestaurantId } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (profile?.role === 'superadmin' && !impersonatedRestaurantId) {
      navigate('/superadmin/restaurants', { replace: true })
    }
  }, [profile, impersonatedRestaurantId, navigate])

  const restaurantId = useRestaurantId()
  const { data: items = [] } = useMenuItems(restaurantId)
  const { data: categories = [] } = useCategories(restaurantId)

  const availableCount      = items.filter((i) => i.available).length
  const soldOutCount        = items.length - availableCount
  const chefRecommendations = items.filter((i) => i.chef_recommendation).length
  const activeCategories    = categories.filter((c) => c.active).length

  // Most recently updated items
  const recentItems = [...items]
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 5)

  return (
    <div>
      <Header
        title="Overview"
        description="Welcome back — here's how your menu looks today."
      />

      <div className="p-6 space-y-8">
        {/* Stat cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Items"
            value={items.length}
            description="All menu items"
            icon={<UtensilsCrossed className="h-4 w-4" />}
            href="/dashboard/menu-items"
          />
          <StatCard
            title="Available Now"
            value={availableCount}
            description={soldOutCount > 0 ? `${soldOutCount} sold out` : 'All available'}
            icon={<ToggleLeft className="h-4 w-4" />}
            href="/dashboard/availability"
          />
          <StatCard
            title="Categories"
            value={activeCategories}
            description={`${categories.length - activeCategories} hidden`}
            icon={<FolderOpen className="h-4 w-4" />}
            href="/dashboard/categories"
          />
          <StatCard
            title="Chef's Picks"
            value={chefRecommendations}
            description="Starred recommendations"
            icon={<Star className="h-4 w-4" />}
          />
        </div>

        {items.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed py-16 text-center">
            <UtensilsCrossed className="h-10 w-10 text-muted-foreground" />
            <div>
              <p className="font-medium">No menu items yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Start by adding categories, then add your first dish.
              </p>
            </div>
            <div className="flex gap-2">
              <Link
                to="/dashboard/categories"
                className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm hover:bg-accent transition-colors"
              >
                Add a category
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                to="/dashboard/menu-items"
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Add first item
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        ) : (
          /* Recent activity */
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Recently updated
            </h2>
            <div className="rounded-xl border divide-y overflow-hidden">
              {recentItems.map((item) => {
                const cat = categories.find((c) => c.id === item.category_id)
                return (
                  <div key={item.id} className="flex items-center gap-3 px-4 py-3 bg-card">
                    {/* Thumbnail */}
                    <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-md bg-muted">
                      {item.image_url
                        ? <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" />
                        : <div className="flex h-full w-full items-center justify-center">
                            <UtensilsCrossed className="h-4 w-4 text-muted-foreground" />
                          </div>
                      }
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {cat?.name ?? 'Uncategorized'} · {formatDate(item.updated_at)}
                      </p>
                    </div>

                    {/* Right side */}
                    <div className="flex items-center gap-2 shrink-0">
                      {item.chef_recommendation && (
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                      )}
                      <span className="text-sm font-semibold tabular-nums">
                        {formatCurrency(item.price)}
                      </span>
                      <Badge variant={item.available ? 'success' : 'secondary'}>
                        {item.available ? 'Available' : 'Sold out'}
                      </Badge>
                    </div>
                  </div>
                )
              })}
            </div>

            {items.length > 5 && (
              <Link
                to="/dashboard/menu-items"
                className="mt-3 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                View all {items.length} items
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

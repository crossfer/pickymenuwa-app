import { useState } from 'react'
import { Loader2, Search } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/hooks/useAuth'
import { useMenuItems, useToggleAvailability } from '@/hooks/useMenu'
import { useCategories } from '@/hooks/useCategories'

export function Availability() {
  const { profile } = useAuth()
  const restaurantId = profile?.restaurant_id ?? ''

  const { data: items = [], isLoading } = useMenuItems(restaurantId)
  const { data: categories = [] } = useCategories(restaurantId)
  const toggleAvailability = useToggleAvailability(restaurantId)

  const [search, setSearch] = useState('')

  const availableCount = items.filter((i) => i.available).length

  // ── Bulk actions ───────────────────────────────────────────────────────────
  const handleMarkAllAvailable = async () => {
    await Promise.all(
      items
        .filter((i) => !i.available)
        .map((i) => toggleAvailability.mutateAsync({ id: i.id, available: true }))
    )
  }

  const handleMarkAllSoldOut = async () => {
    await Promise.all(
      items
        .filter((i) => i.available)
        .map((i) => toggleAvailability.mutateAsync({ id: i.id, available: false }))
    )
  }

  // ── Filter ────────────────────────────────────────────────────────────────
  const lowerSearch = search.toLowerCase()
  const filteredItems = search
    ? items.filter((i) => i.name.toLowerCase().includes(lowerSearch))
    : items

  // Group filtered items by category
  const categorized = categories.map((cat) => ({
    category: cat,
    items: filteredItems.filter((i) => i.category_id === cat.id),
  }))
  const uncategorized = filteredItems.filter((i) => !i.category_id)

  const hasResults = categorized.some((g) => g.items.length > 0) || uncategorized.length > 0

  return (
    <div>
      <Header
        title="Availability"
        description={`${availableCount} of ${items.length} items available`}
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAllAvailable}
              disabled={toggleAvailability.isPending || availableCount === items.length}
            >
              All available
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAllSoldOut}
              disabled={toggleAvailability.isPending || availableCount === 0}
            >
              All sold out
            </Button>
          </div>
        }
      />

      <div className="p-6 max-w-2xl space-y-5">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search items…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 max-w-xs"
          />
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No menu items yet. Add some from the Menu Items page.
          </p>
        ) : !hasResults ? (
          <p className="text-sm text-muted-foreground py-4">
            No items match "{search}".
          </p>
        ) : (
          <>
            {categorized.map(({ category, items: catItems }) =>
              catItems.length === 0 ? null : (
                <section key={category.id}>
                  <h2 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {category.name}
                    <span className="font-normal normal-case tracking-normal">
                      ({catItems.filter((i) => i.available).length}/{catItems.length} available)
                    </span>
                  </h2>
                  <ul className="space-y-1">
                    {catItems.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-center gap-3 rounded-lg border bg-card px-4 py-2.5 transition-colors"
                      >
                        {item.image_url && (
                          <img
                            src={item.image_url}
                            alt={item.name}
                            className="h-8 w-8 rounded object-cover shrink-0"
                          />
                        )}
                        <span className="flex-1 text-sm font-medium">{item.name}</span>
                        <Badge variant={item.available ? 'success' : 'secondary'}>
                          {item.available ? 'Available' : 'Sold out'}
                        </Badge>
                        <Switch
                          checked={item.available}
                          onCheckedChange={(checked) =>
                            toggleAvailability.mutate({ id: item.id, available: checked })
                          }
                        />
                      </li>
                    ))}
                  </ul>
                </section>
              )
            )}

            {uncategorized.length > 0 && (
              <section>
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Uncategorized
                </h2>
                <ul className="space-y-1">
                  {uncategorized.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center gap-3 rounded-lg border bg-card px-4 py-2.5"
                    >
                      {item.image_url && (
                        <img
                          src={item.image_url}
                          alt={item.name}
                          className="h-8 w-8 rounded object-cover shrink-0"
                        />
                      )}
                      <span className="flex-1 text-sm font-medium">{item.name}</span>
                      <Badge variant={item.available ? 'success' : 'secondary'}>
                        {item.available ? 'Available' : 'Sold out'}
                      </Badge>
                      <Switch
                        checked={item.available}
                        onCheckedChange={(checked) =>
                          toggleAvailability.mutate({ id: item.id, available: checked })
                        }
                      />
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}

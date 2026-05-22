import { Star, ImageOff, Pencil, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { formatCurrency } from '@/lib/utils'
import type { MenuItemWithSchedules } from '@/types/database'

interface MenuItemCardProps {
  item: MenuItemWithSchedules
  canEdit: boolean
  canDelete: boolean
  onToggleAvailability: (id: string, available: boolean) => void
  onEdit: (item: MenuItemWithSchedules) => void
  onDelete: (item: MenuItemWithSchedules) => void
}

export function MenuItemCard({
  item,
  canEdit,
  canDelete,
  onToggleAvailability,
  onEdit,
  onDelete,
}: MenuItemCardProps) {
  return (
    <div className="group flex items-start gap-4 rounded-xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
      {/* Image */}
      <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-muted">
        {item.image_url ? (
          <img
            src={item.image_url}
            alt={item.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <ImageOff className="h-6 w-6" />
          </div>
        )}
        {item.chef_recommendation && (
          <div className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-400">
            <Star className="h-3 w-3 fill-white text-white" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-medium text-sm leading-tight">{item.name}</h3>
            {item.description && (
              <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                {item.description}
              </p>
            )}
          </div>
          <span className="text-sm font-semibold tabular-nums whitespace-nowrap">
            {formatCurrency(item.price)}
          </span>
        </div>

        {item.chef_note && (
          <p className="mt-1 text-xs italic text-muted-foreground">
            Chef: {item.chef_note}
          </p>
        )}

        <div className="mt-2 flex items-center gap-2">
          <Badge variant={item.available ? 'success' : 'secondary'}>
            {item.available ? 'Available' : 'Sold out'}
          </Badge>
          {item.item_schedules.length > 0 && (
            <Badge variant="outline">Scheduled</Badge>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col items-end gap-2">
        <Switch
          checked={item.available}
          onCheckedChange={(checked) => onToggleAvailability(item.id, checked)}
          title="Toggle availability"
        />
        {(canEdit || canDelete) && (
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {canEdit && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => onEdit(item)}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
            {canDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={() => onDelete(item)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

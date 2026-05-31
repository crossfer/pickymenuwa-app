import { useState, useEffect } from 'react'
import { Plus, Clock, Trash2, Loader2, Search, UtensilsCrossed } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { MenuItemCard } from '@/components/menu/MenuItemCard'
import { ImageUpload } from '@/components/menu/ImageUpload'
import { useAuth, useRestaurantId } from '@/hooks/useAuth'
import {
  useMenuItems,
  useCreateMenuItem,
  useUpdateMenuItem,
  useDeleteMenuItem,
  useToggleAvailability,
  useItemPairings,
  useSyncPairings,
} from '@/hooks/useMenu'
import { useCategories } from '@/hooks/useCategories'
import type { MenuItem, MenuItemWithSchedules, ItemSchedule } from '@/types/database'

// ─── Constants ────────────────────────────────────────────────────────────────

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const DAY_NAMES  = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScheduleDraft {
  id?: string
  day_of_week: number[]
  time_start: string
  time_end: string
}

interface PairingDraft {
  paired_item_id: string
  pairing_note: string
}

interface ItemFormState {
  name: string
  description: string
  price: string
  category_id: string
  available: boolean
  chef_recommendation: boolean
  chef_note: string
}

const defaultForm: ItemFormState = {
  name: '',
  description: '',
  price: '',
  category_id: '',
  available: true,
  chef_recommendation: false,
  chef_note: '',
}

// ─── ScheduleRow ──────────────────────────────────────────────────────────────

interface ScheduleRowProps {
  schedule: ScheduleDraft
  onChange: (s: ScheduleDraft) => void
  onRemove: () => void
}

function ScheduleRow({ schedule, onChange, onRemove }: ScheduleRowProps) {
  const toggleDay = (day: number) => {
    const days = schedule.day_of_week.includes(day)
      ? schedule.day_of_week.filter((d) => d !== day)
      : [...schedule.day_of_week, day].sort((a, b) => a - b)
    onChange({ ...schedule, day_of_week: days })
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3">
      <div className="flex items-center gap-1">
        <span className="text-xs text-muted-foreground w-14 shrink-0">Days</span>
        <div className="flex gap-1 flex-wrap">
          {DAY_LABELS.map((label, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => toggleDay(idx)}
              title={DAY_NAMES[idx]}
              className={`flex h-7 w-7 items-center justify-center rounded text-xs font-medium transition-colors ${
                schedule.day_of_week.includes(idx)
                  ? 'bg-primary text-primary-foreground'
                  : 'border border-input bg-background text-muted-foreground hover:bg-accent'
              }`}
            >
              {label}
            </button>
          ))}
          {schedule.day_of_week.length === 0 && (
            <span className="text-xs text-muted-foreground italic self-center ml-1">
              = every day
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground w-14 shrink-0">Hours</span>
        <Input
          type="time"
          value={schedule.time_start}
          onChange={(e) => onChange({ ...schedule, time_start: e.target.value })}
          className="h-7 w-28 px-2 text-xs"
        />
        <span className="text-xs text-muted-foreground">to</span>
        <Input
          type="time"
          value={schedule.time_end}
          onChange={(e) => onChange({ ...schedule, time_end: e.target.value })}
          className="h-7 w-28 px-2 text-xs"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 ml-auto text-destructive hover:text-destructive"
          onClick={onRemove}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

// ─── PairingRow ───────────────────────────────────────────────────────────────

interface PairingRowProps {
  item: MenuItem
  categoryName: string
  selected: boolean
  note: string
  onToggle: () => void
  onNoteChange: (note: string) => void
}

function PairingRow({ item, categoryName, selected, note, onToggle, onNoteChange }: PairingRowProps) {
  return (
    <div
      className={`rounded-lg border transition-colors ${
        selected ? 'border-primary/50 bg-primary/5' : 'border-input bg-background'
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left"
      >
        <span
          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] font-bold transition-colors ${
            selected
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-input bg-background'
          }`}
        >
          {selected && '✓'}
        </span>
        <span className="flex-1 text-sm font-medium">{item.name}</span>
        {categoryName && (
          <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
            {categoryName}
          </span>
        )}
      </button>

      {selected && (
        <div className="border-t border-primary/20 px-3 pb-2.5 pt-2">
          <Input
            placeholder="Pairing note (optional)…"
            value={note}
            onChange={(e) => onNoteChange(e.target.value)}
            className="h-7 text-xs"
          />
        </div>
      )}
    </div>
  )
}

// ─── ItemFormDialog ───────────────────────────────────────────────────────────

interface ItemFormDialogProps {
  open: boolean
  onClose: () => void
  editingItem: MenuItemWithSchedules | null
  categories: Array<{ id: string; name: string }>
  allItems: MenuItem[]
  restaurantId: string
  isAdmin: boolean
  isStaff: boolean
  onSaved: () => void
}

function ItemFormDialog({
  open,
  onClose,
  editingItem,
  categories,
  allItems,
  restaurantId,
  isAdmin,
  isStaff,
  onSaved,
}: ItemFormDialogProps) {
  const createItem    = useCreateMenuItem()
  const updateItem    = useUpdateMenuItem()
  const syncPairings  = useSyncPairings()

  const [form, setForm] = useState<ItemFormState>(() =>
    editingItem
      ? {
          name:                editingItem.name,
          description:         editingItem.description ?? '',
          price:               editingItem.price?.toString() ?? '',
          category_id:         editingItem.category_id ?? '',
          available:           editingItem.available,
          chef_recommendation: editingItem.chef_recommendation,
          chef_note:           editingItem.chef_note ?? '',
        }
      : defaultForm
  )
  const [imageFile,  setImageFile]  = useState<File | undefined>(undefined)
  const [schedules,  setSchedules]  = useState<ScheduleDraft[]>(() =>
    editingItem
      ? editingItem.item_schedules.map((s: ItemSchedule) => ({
          id:          s.id,
          day_of_week: s.day_of_week,
          time_start:  s.time_start,
          time_end:    s.time_end,
        }))
      : []
  )
  const [pairings,   setPairings]   = useState<PairingDraft[]>([])
  const [pairSearch, setPairSearch] = useState('')

  const { data: existingPairings } = useItemPairings(editingItem?.id)

  useEffect(() => {
    if (existingPairings) {
      setPairings(
        existingPairings.map((p) => ({
          paired_item_id: p.paired_item_id,
          pairing_note:   p.pairing_note ?? '',
        }))
      )
    }
  }, [existingPairings])

  const categoryMap = Object.fromEntries(categories.map((c) => [c.id, c.name]))

  const otherItems = allItems
    .filter((i) => i.id !== editingItem?.id)
    .filter((i) =>
      pairSearch.trim() === '' ||
      i.name.toLowerCase().includes(pairSearch.toLowerCase()) ||
      categoryMap[i.category_id ?? '']?.toLowerCase().includes(pairSearch.toLowerCase())
    )

  const togglePairing = (itemId: string) => {
    setPairings((prev) => {
      const exists = prev.find((p) => p.paired_item_id === itemId)
      return exists
        ? prev.filter((p) => p.paired_item_id !== itemId)
        : [...prev, { paired_item_id: itemId, pairing_note: '' }]
    })
  }

  const updatePairingNote = (itemId: string, note: string) => {
    setPairings((prev) =>
      prev.map((p) => (p.paired_item_id === itemId ? { ...p, pairing_note: note } : p))
    )
  }

  const addSchedule = () => {
    setSchedules((prev) => [
      ...prev,
      { day_of_week: [], time_start: '10:00', time_end: '22:00' },
    ])
  }

  const isSaving = createItem.isPending || updateItem.isPending || syncPairings.isPending

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const values = {
      name:                form.name,
      description:         form.description || null,
      price:               form.price ? parseFloat(form.price) : null,
      category_id:         form.category_id || null,
      available:           form.available,
      chef_recommendation: form.chef_recommendation,
      chef_note:           form.chef_note || null,
      image_url:           editingItem?.image_url ?? null,
    }

    if (editingItem) {
      const originalIds        = editingItem.item_schedules.map((s: ItemSchedule) => s.id)
      const keptIds            = schedules.filter((s) => s.id).map((s) => s.id as string)
      const scheduleIdsToDelete = originalIds.filter((id) => !keptIds.includes(id))
      const schedulesToAdd     = schedules
        .filter((s) => !s.id)
        .map((s) => ({ day_of_week: s.day_of_week, time_start: s.time_start, time_end: s.time_end }))

      await updateItem.mutateAsync({
        id: editingItem.id,
        restaurantId,
        values,
        imageFile,
        scheduleIdsToDelete,
        schedulesToAdd,
      })

      if (isAdmin) {
        await syncPairings.mutateAsync({ itemId: editingItem.id, pairings })
      }
    } else {
      const newItem = await createItem.mutateAsync({
        restaurantId,
        values,
        imageFile,
        schedules: schedules.map((s) => ({
          day_of_week: s.day_of_week,
          time_start:  s.time_start,
          time_end:    s.time_end,
        })),
      })

      if (isAdmin && pairings.length > 0 && newItem) {
        await syncPairings.mutateAsync({ itemId: newItem.id, pairings })
      }
    }

    onSaved()
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={editingItem ? 'Edit menu item' : 'New menu item'}
      size="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Image */}
        <ImageUpload
          currentUrl={editingItem?.image_url}
          onFileSelect={setImageFile}
        />

        {/* Basic fields */}
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
              disabled={isStaff}
            />
          </div>

          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              rows={2}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              disabled={isStaff}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="price">Price</Label>
            <Input
              id="price"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={form.price}
              onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
              disabled={isStaff}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="category">Category</Label>
            <Select
              id="category"
              value={form.category_id}
              onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value }))}
              disabled={isStaff}
            >
              <option value="">— No category —</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </Select>
          </div>

          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="chef_note">Chef note</Label>
            <Input
              id="chef_note"
              placeholder="Optional note visible to diners…"
              value={form.chef_note}
              onChange={(e) => setForm((f) => ({ ...f, chef_note: e.target.value }))}
            />
          </div>

          {/* Toggles */}
          <div className="flex items-center gap-3">
            <Switch
              id="available"
              checked={form.available}
              onCheckedChange={(v) => setForm((f) => ({ ...f, available: v }))}
            />
            <Label htmlFor="available">Available now</Label>
          </div>

          {isAdmin && (
            <div className="flex items-center gap-3">
              <Switch
                id="chef_rec"
                checked={form.chef_recommendation}
                onCheckedChange={(v) => setForm((f) => ({ ...f, chef_recommendation: v }))}
              />
              <Label htmlFor="chef_rec">Chef's recommendation ⭐</Label>
            </div>
          )}
        </div>

        {/* ── Pairings ──────────────────────────────────────────────────────── */}
        {isAdmin && allItems.length > 1 && (
          <div className="space-y-2 border-t pt-4">
            <div>
              <p className="text-sm font-medium">Pairings</p>
              <p className="text-xs text-muted-foreground">
                Suggest items that pair well together. The AI will use this to make recommendations.
              </p>
            </div>

            {pairings.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pb-1">
                {pairings.map((p) => {
                  const paired = allItems.find((i) => i.id === p.paired_item_id)
                  return paired ? (
                    <Badge
                      key={p.paired_item_id}
                      variant="secondary"
                      className="gap-1 pr-1 text-xs"
                    >
                      {paired.name}
                      <button
                        type="button"
                        onClick={() => togglePairing(p.paired_item_id)}
                        className="ml-0.5 rounded-full hover:bg-muted-foreground/20 px-0.5"
                      >
                        ×
                      </button>
                    </Badge>
                  ) : null
                })}
              </div>
            )}

            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search items to pair…"
                value={pairSearch}
                onChange={(e) => setPairSearch(e.target.value)}
                className="pl-8 h-8 text-sm"
              />
            </div>

            <div className="max-h-52 overflow-y-auto space-y-1.5 pr-0.5">
              {otherItems.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">No items found</p>
              ) : (
                otherItems.map((item) => {
                  const pairing = pairings.find((p) => p.paired_item_id === item.id)
                  return (
                    <PairingRow
                      key={item.id}
                      item={item}
                      categoryName={categoryMap[item.category_id ?? ''] ?? ''}
                      selected={!!pairing}
                      note={pairing?.pairing_note ?? ''}
                      onToggle={() => togglePairing(item.id)}
                      onNoteChange={(note) => updatePairingNote(item.id, note)}
                    />
                  )
                })
              )}
            </div>
          </div>
        )}

        {/* ── Schedules ─────────────────────────────────────────────────────── */}
        {isAdmin && (
          <div className="space-y-2 border-t pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Availability schedule</p>
                <p className="text-xs text-muted-foreground">
                  Restrict when this item is offered. Leave empty for always-available.
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addSchedule}>
                <Clock className="mr-1.5 h-3.5 w-3.5" />
                Add window
              </Button>
            </div>

            {schedules.length > 0 && (
              <div className="space-y-2">
                {schedules.map((sched, idx) => (
                  <ScheduleRow
                    key={sched.id ?? `new-${idx}`}
                    schedule={sched}
                    onChange={(updated) =>
                      setSchedules((prev) => prev.map((s, i) => (i === idx ? updated : s)))
                    }
                    onRemove={() =>
                      setSchedules((prev) => prev.filter((_, i) => i !== idx))
                    }
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 border-t pt-4">
          <Button type="submit" disabled={isSaving || !form.name.trim()}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {editingItem ? 'Save changes' : 'Create item'}
          </Button>
          <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function MenuItems() {
  const { profile } = useAuth()
  const restaurantId = useRestaurantId()
  const isAdmin = profile?.role === 'admin' || profile?.role === 'superadmin'
  const isStaff = profile?.role === 'staff'

  const { data: items = [], isLoading } = useMenuItems(restaurantId)
  const { data: categories = [] }       = useCategories(restaurantId)
  const deleteItem         = useDeleteMenuItem(restaurantId)
  const toggleAvailability = useToggleAvailability(restaurantId)

  const [dialogOpen,   setDialogOpen]   = useState(false)
  const [editingItem,  setEditingItem]  = useState<MenuItemWithSchedules | null>(null)
  const [search,       setSearch]       = useState('')
  const [filterCategoryId, setFilterCategoryId] = useState('')

  const openCreate = () => { setEditingItem(null); setDialogOpen(true) }
  const openEdit   = (item: MenuItemWithSchedules) => { setEditingItem(item); setDialogOpen(true) }
  const closeDialog = () => setDialogOpen(false)

  const handleDelete = async (item: MenuItemWithSchedules) => {
    if (!confirm(`Delete "${item.name}"? This cannot be undone.`)) return
    await deleteItem.mutateAsync({ id: item.id, hasImage: !!item.image_url })
  }

  const filteredItems = items.filter((i) => {
    const matchesSearch = i.name.toLowerCase().includes(search.toLowerCase())
    const matchesCat    = !filterCategoryId || i.category_id === filterCategoryId
    return matchesSearch && matchesCat
  })

  const availableCount = items.filter((i) => i.available).length

  return (
    <div>
      <Header
        title="Menu Items"
        description={`${items.length} item${items.length !== 1 ? 's' : ''} · ${availableCount} available`}
        actions={
          isAdmin && (
            <Button onClick={openCreate}>
              <Plus className="mr-1.5 h-4 w-4" />
              Add item
            </Button>
          )
        }
      />

      <div className="p-6 space-y-4">
        {/* Search + category filter */}
        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search items…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 w-48"
            />
          </div>

          {categories.length > 0 && (
            <Select
              value={filterCategoryId}
              onChange={(e) => setFilterCategoryId(e.target.value)}
              className="w-48"
            >
              <option value="">All categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </Select>
          )}

          {(search || filterCategoryId) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setSearch(''); setFilterCategoryId('') }}
            >
              Clear
            </Button>
          )}
        </div>

        {/* Category pills */}
        {!filterCategoryId && !search && categories.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {categories.map((cat) => {
              const count = items.filter((i) => i.category_id === cat.id).length
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setFilterCategoryId(cat.id)}
                  className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs hover:bg-accent transition-colors"
                >
                  {cat.name}
                  <Badge variant="secondary" className="ml-0.5 h-4 px-1 text-[10px]">{count}</Badge>
                </button>
              )
            })}
          </div>
        )}

        {/* Items grid */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
            <UtensilsCrossed className="h-9 w-9 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">
                {search || filterCategoryId ? 'No items match your filter' : 'No menu items yet'}
              </p>
              {!search && !filterCategoryId && isAdmin && (
                <p className="text-xs text-muted-foreground mt-1">
                  Click "Add item" to create your first dish.
                </p>
              )}
            </div>
            {(search || filterCategoryId) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setSearch(''); setFilterCategoryId('') }}
              >
                Clear filters
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 max-w-5xl">
            {filteredItems.map((item) => (
              <MenuItemCard
                key={item.id}
                item={item}
                canEdit={isAdmin || isStaff}
                canDelete={isAdmin}
                onToggleAvailability={(id, available) =>
                  toggleAvailability.mutate({ id, available })
                }
                onEdit={openEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      {/* Dialog — keyed so it remounts for each distinct item */}
      <ItemFormDialog
        key={dialogOpen ? (editingItem?.id ?? 'new') : 'closed'}
        open={dialogOpen}
        onClose={closeDialog}
        editingItem={editingItem}
        categories={categories}
        allItems={items}
        restaurantId={restaurantId}
        isAdmin={isAdmin}
        isStaff={isStaff}
        onSaved={closeDialog}
      />
    </div>
  )
}

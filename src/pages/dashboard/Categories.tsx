import { useState, useEffect } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Plus, Pencil, Trash2, GripVertical, Loader2 } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { useAuth } from '@/hooks/useAuth'
import {
  useCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
  useReorderCategories,
} from '@/hooks/useCategories'
import type { Category } from '@/types/database'

// ─── Sortable row ──────────────────────────────────────────────────────────────

interface SortableCategoryRowProps {
  cat: Category
  isAdmin: boolean
  isEditing: boolean
  editingName: string
  onEditingNameChange: (name: string) => void
  onStartEdit: () => void
  onSaveEdit: () => void
  onCancelEdit: () => void
  onToggleActive: () => void
  onDelete: () => void
}

function SortableCategoryRow({
  cat,
  isAdmin,
  isEditing,
  editingName,
  onEditingNameChange,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onToggleActive,
  onDelete,
}: SortableCategoryRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: cat.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 rounded-lg border bg-card px-4 py-3 ${
        isDragging ? 'opacity-50 shadow-lg ring-2 ring-primary/40 z-10' : ''
      }`}
    >
      {/* Drag handle — only admins can reorder */}
      {isAdmin && (
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab touch-none text-muted-foreground hover:text-foreground transition-colors active:cursor-grabbing"
          tabIndex={-1}
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-4 w-4" />
        </button>
      )}

      {isEditing ? (
        /* Inline edit mode */
        <div className="flex flex-1 items-center gap-2">
          <Input
            value={editingName}
            onChange={(e) => onEditingNameChange(e.target.value)}
            className="h-7 py-0"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSaveEdit()
              if (e.key === 'Escape') onCancelEdit()
            }}
          />
          <Button size="sm" onClick={onSaveEdit}>Save</Button>
          <Button size="sm" variant="ghost" onClick={onCancelEdit}>Cancel</Button>
        </div>
      ) : (
        <>
          <span className="flex-1 text-sm font-medium">{cat.name}</span>
          <Badge variant={cat.active ? 'success' : 'secondary'}>
            {cat.active ? 'Active' : 'Hidden'}
          </Badge>
          {isAdmin && (
            <Switch
              checked={cat.active}
              onCheckedChange={onToggleActive}
              title="Toggle visibility"
            />
          )}
          {isAdmin && (
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={onStartEdit}
                title="Rename"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={onDelete}
                title="Delete"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </>
      )}
    </li>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

// Stable empty-array sentinel used as the default when TanStack Query data is
// undefined (query pending or disabled). Module-level so the reference never
// changes between renders — prevents the useEffect(() => setLocalCats(cats),
// [cats]) from firing on every render and causing an infinite update loop.
const EMPTY_CATS: Category[] = []

export function Categories() {
  const { profile } = useAuth()
  const restaurantId = profile?.restaurant_id ?? ''
  const isAdmin = profile?.role === 'admin' || profile?.role === 'superadmin'

  const { data: categories = EMPTY_CATS, isLoading } = useCategories(restaurantId)
  const createCategory  = useCreateCategory(restaurantId)
  const updateCategory  = useUpdateCategory(restaurantId)
  const deleteCategory  = useDeleteCategory(restaurantId)
  const reorderCategories = useReorderCategories(restaurantId)

  // Local ordered list — kept in sync with server, mutated optimistically on drag.
  // Initialised with EMPTY_CATS so the first setLocalCats(EMPTY_CATS) call is a
  // no-op (Object.is identity match), breaking the render → effect → setState loop.
  const [localCats, setLocalCats] = useState<Category[]>(EMPTY_CATS)
  useEffect(() => { setLocalCats(categories) }, [categories])

  const [newName, setNewName]       = useState('')
  const [editingId, setEditingId]   = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')

  // ── DnD ────────────────────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = localCats.findIndex((c) => c.id === active.id)
    const newIndex = localCats.findIndex((c) => c.id === over.id)
    const reordered = arrayMove(localCats, oldIndex, newIndex)

    setLocalCats(reordered)                     // optimistic
    await reorderCategories.mutateAsync(reordered.map((c) => c.id))
  }

  // ── CRUD ───────────────────────────────────────────────────────────────────
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    await createCategory.mutateAsync({ name: newName.trim(), sort_order: categories.length })
    setNewName('')
  }

  const handleStartEdit = (cat: Category) => {
    setEditingId(cat.id)
    setEditingName(cat.name)
  }

  const handleSaveEdit = async (id: string) => {
    if (!editingName.trim()) return
    await updateCategory.mutateAsync({ id, name: editingName.trim() })
    setEditingId(null)
  }

  const handleToggleActive = async (cat: Category) => {
    await updateCategory.mutateAsync({ id: cat.id, active: !cat.active })
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this category? Items inside will become uncategorized.')) return
    await deleteCategory.mutateAsync(id)
  }

  return (
    <div>
      <Header
        title="Categories"
        description="Organize your menu into sections. Drag to reorder."
      />

      <div className="p-6 space-y-6 max-w-2xl">
        {/* Add new */}
        {isAdmin && (
          <form onSubmit={handleCreate} className="flex gap-2">
            <Input
              placeholder="New category name…"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="max-w-xs"
            />
            <Button type="submit" disabled={!newName.trim() || createCategory.isPending}>
              {createCategory.isPending
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Plus className="h-4 w-4" />
              }
              Add
            </Button>
          </form>
        )}

        {/* List */}
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : localCats.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            No categories yet. Add one above to get started.
          </p>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={localCats.map((c) => c.id)}
              strategy={verticalListSortingStrategy}
            >
              <ul className="space-y-2">
                {localCats.map((cat) => (
                  <SortableCategoryRow
                    key={cat.id}
                    cat={cat}
                    isAdmin={isAdmin}
                    isEditing={editingId === cat.id}
                    editingName={editingName}
                    onEditingNameChange={setEditingName}
                    onStartEdit={() => handleStartEdit(cat)}
                    onSaveEdit={() => handleSaveEdit(cat.id)}
                    onCancelEdit={() => setEditingId(null)}
                    onToggleActive={() => handleToggleActive(cat)}
                    onDelete={() => handleDelete(cat.id)}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}

        {isAdmin && localCats.length > 1 && (
          <p className="text-xs text-muted-foreground">
            Drag the <GripVertical className="inline h-3 w-3" /> handle to reorder categories.
          </p>
        )}
      </div>
    </div>
  )
}

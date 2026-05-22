import { useState, useEffect } from 'react'
import { Plus, Loader2, Building2, Pencil, Eye, EyeOff } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Select } from '@/components/ui/select'
import { supabase } from '@/lib/supabase'
import { formatDate } from '@/lib/utils'
import type { Restaurant } from '@/types/database'

// ─── Constants ────────────────────────────────────────────────────────────────

const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'America/Mexico_City',
  'America/Bogota',
  'America/Sao_Paulo',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Australia/Sydney',
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export function Restaurants() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [loading, setLoading]         = useState(true)

  // ── Create form ──────────────────────────────────────────────────────────────
  const [showForm, setShowForm] = useState(false)
  const [newName, setNewName]   = useState('')
  const [newSlug, setNewSlug]   = useState('')
  const [creating, setCreating] = useState(false)

  // ── Edit dialog ──────────────────────────────────────────────────────────────
  const [editTarget, setEditTarget]         = useState<Restaurant | null>(null)
  const [editName, setEditName]             = useState('')
  const [editSlug, setEditSlug]             = useState('')
  const [editTimezone, setEditTimezone]     = useState('America/Los_Angeles')
  const [editKapsoPhone, setEditKapsoPhone] = useState('')
  const [editKapsoSecret, setEditKapsoSecret] = useState('')
  const [showSecret, setShowSecret]         = useState(false)
  const [savingEdit, setSavingEdit]         = useState(false)

  // ── Data fetching ─────────────────────────────────────────────────────────────
  const fetchRestaurants = async () => {
    const { data } = await supabase
      .from('restaurants')
      .select('*')
      .order('created_at', { ascending: false })
    setRestaurants(data ?? [])
    setLoading(false)
  }

  useEffect(() => { void fetchRestaurants() }, [])

  // ── Create ────────────────────────────────────────────────────────────────────
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    await supabase.from('restaurants').insert({
      name:     newName,
      slug:     newSlug.toLowerCase().replace(/\s+/g, '-'),
      timezone: 'America/Los_Angeles',
    })
    setNewName('')
    setNewSlug('')
    setShowForm(false)
    setCreating(false)
    void fetchRestaurants()
  }

  // ── Edit ──────────────────────────────────────────────────────────────────────
  const openEdit = (r: Restaurant) => {
    setEditTarget(r)
    setEditName(r.name)
    setEditSlug(r.slug)
    setEditTimezone(r.timezone)
    setEditKapsoPhone(r.kapso_phone_number_id ?? '')
    setEditKapsoSecret(r.kapso_webhook_secret  ?? '')
    setShowSecret(false)
  }

  const closeEdit = () => setEditTarget(null)

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editTarget) return
    setSavingEdit(true)

    await supabase
      .from('restaurants')
      .update({
        name:                  editName.trim(),
        slug:                  editSlug.trim().toLowerCase(),
        timezone:              editTimezone,
        kapso_phone_number_id: editKapsoPhone.trim()  || null,
        kapso_webhook_secret:  editKapsoSecret.trim() || null,
      })
      .eq('id', editTarget.id)

    setSavingEdit(false)
    closeEdit()
    void fetchRestaurants()
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div>
      <Header
        title="Restaurants"
        description="Manage all tenants on the platform."
        actions={
          <Button onClick={() => setShowForm((v) => !v)}>
            <Plus className="mr-1.5 h-4 w-4" />
            New restaurant
          </Button>
        }
      />

      <div className="p-6 space-y-6 max-w-3xl">

        {/* ── Create form ───────────────────────────────────────────────────── */}
        {showForm && (
          <Card>
            <CardContent className="pt-6">
              <form onSubmit={handleCreate} className="space-y-4">
                <h2 className="font-semibold">Add restaurant</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="r-name">Name</Label>
                    <Input
                      id="r-name"
                      value={newName}
                      onChange={(e) => {
                        setNewName(e.target.value)
                        setNewSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))
                      }}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="r-slug">Slug (URL-safe)</Label>
                    <Input
                      id="r-slug"
                      value={newSlug}
                      onChange={(e) => setNewSlug(e.target.value)}
                      pattern="[a-z0-9\-]+"
                      required
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={creating}>
                    {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* ── Restaurant list ───────────────────────────────────────────────── */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : restaurants.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
            <Building2 className="h-10 w-10" />
            <p className="text-sm">No restaurants yet. Create the first one above.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {restaurants.map((r) => (
              <li
                key={r.id}
                className="flex items-center gap-4 rounded-xl border bg-card px-5 py-3.5 shadow-sm"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{r.name}</p>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">{r.slug}</p>
                </div>
                <Badge variant="outline" className="text-xs shrink-0">
                  {r.timezone.replace(/_/g, ' ')}
                </Badge>
                <p className="text-xs text-muted-foreground shrink-0">
                  {formatDate(r.created_at)}
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={() => openEdit(r)}
                  title="Edit restaurant"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Edit dialog ───────────────────────────────────────────────────────── */}
      <Dialog
        open={editTarget !== null}
        onClose={closeEdit}
        title="Edit restaurant"
        description={editTarget ? `${editTarget.name} · ${editTarget.slug}` : undefined}
        size="max-w-lg"
      >
        <form onSubmit={handleSaveEdit} className="space-y-4">

          {/* Name + Slug */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
                autoComplete="organization"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-slug">Slug</Label>
              <Input
                id="edit-slug"
                value={editSlug}
                onChange={(e) =>
                  setEditSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))
                }
                pattern="[a-z0-9\-]+"
                required
                autoComplete="off"
                className="font-mono"
              />
            </div>
          </div>

          {/* Timezone */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-timezone">Timezone</Label>
            <Select
              id="edit-timezone"
              value={editTimezone}
              onChange={(e) => setEditTimezone(e.target.value)}
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz.replace(/_/g, ' ')}
                </option>
              ))}
            </Select>
          </div>

          {/* Kapso Phone Number ID */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-kapso-phone">Kapso Phone Number ID</Label>
            <Input
              id="edit-kapso-phone"
              value={editKapsoPhone}
              onChange={(e) => setEditKapsoPhone(e.target.value)}
              placeholder="e.g. kapso_phone_abc123"
              autoComplete="off"
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Found in the Kapso.ai dashboard under the connected WhatsApp number.
            </p>
          </div>

          {/* Kapso Webhook Secret */}
          <div className="space-y-1.5">
            <Label htmlFor="edit-kapso-secret">Kapso Webhook Secret</Label>
            <div className="relative">
              <Input
                id="edit-kapso-secret"
                type={showSecret ? 'text' : 'password'}
                value={editKapsoSecret}
                onChange={(e) => setEditKapsoSecret(e.target.value)}
                placeholder="Leave blank to disable signature verification"
                autoComplete="new-password"
                className="font-mono text-sm pr-10"
              />
              <button
                type="button"
                onClick={() => setShowSecret((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
                aria-label={showSecret ? 'Hide secret' : 'Show secret'}
              >
                {showSecret
                  ? <EyeOff className="h-4 w-4" />
                  : <Eye    className="h-4 w-4" />
                }
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              HMAC-SHA256 key for verifying incoming Kapso webhook signatures.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2 border-t">
            <Button type="submit" disabled={savingEdit}>
              {savingEdit && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save changes
            </Button>
            <Button type="button" variant="outline" onClick={closeEdit}>
              Cancel
            </Button>
          </div>

        </form>
      </Dialog>
    </div>
  )
}

import { useState, useEffect, useCallback } from 'react'
import { Plus, Loader2, Users as UsersIcon, Eye, EyeOff } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { Dialog } from '@/components/ui/dialog'
import { supabase } from '@/lib/supabase'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { formatDate } from '@/lib/utils'
import type { Profile, Restaurant, UserRole } from '@/types/database'

// ─── Types ────────────────────────────────────────────────────────────────────

type ProfileWithMeta = Profile & {
  email: string | null
  restaurant_name: string | null
}

const roleColors: Record<UserRole, 'default' | 'secondary' | 'outline'> = {
  superadmin: 'default',
  admin:      'secondary',
  staff:      'outline',
}

// ─── Add User form state ──────────────────────────────────────────────────────

interface AddUserForm {
  full_name:     string
  email:         string
  password:      string
  role:          'admin' | 'staff' | 'superadmin'
  restaurant_id: string
}

const defaultForm: AddUserForm = {
  full_name:     '',
  email:         '',
  password:      '',
  role:          'admin',
  restaurant_id: '',
}

// ─── Add User dialog ──────────────────────────────────────────────────────────

interface AddUserDialogProps {
  open:        boolean
  onClose:     () => void
  restaurants: Restaurant[]
  onCreated:   () => void
}

function AddUserDialog({ open, onClose, restaurants, onCreated }: AddUserDialogProps) {
  const [form, setForm]           = useState<AddUserForm>(defaultForm)
  const [showPassword, setShowPassword] = useState(false)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState<string | null>(null)

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setForm(defaultForm)
      setError(null)
      setSaving(false)
      setShowPassword(false)
    }
  }, [open])

  const needsRestaurant = form.role !== 'superadmin'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (needsRestaurant && !form.restaurant_id) {
      setError('Please select a restaurant for this user.')
      return
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    setSaving(true)
    try {
      // 1. Create user in Supabase Auth (service role → no email confirmation needed,
      //    no session side-effects on the current superadmin session).
      //    The handle_new_user trigger auto-inserts a profiles row using
      //    raw_user_meta_data.full_name and raw_user_meta_data.role.
      const { data: authData, error: authError } =
        await supabaseAdmin.auth.admin.createUser({
          email:          form.email,
          password:       form.password,
          email_confirm:  true,           // confirm immediately; no magic-link required
          user_metadata: {
            full_name: form.full_name,
            role:      form.role,
          },
        })

      if (authError) {
        setError(authError.message)
        return
      }

      const userId = authData.user.id

      // 2. The trigger created the profile. Now set restaurant_id (the trigger
      //    doesn't know about it). Use upsert in case the trigger raced us.
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name:     form.full_name,
          role:          form.role,
          restaurant_id: needsRestaurant ? form.restaurant_id : null,
        })
        .eq('id', userId)

      if (profileError) {
        setError(`User created but profile update failed: ${profileError.message}`)
        return
      }

      onCreated()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add user"
      description="Creates an active account — the user can sign in immediately."
      size="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Full name */}
        <div className="space-y-1.5">
          <Label htmlFor="u-name">Full name</Label>
          <Input
            id="u-name"
            value={form.full_name}
            onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
            placeholder="Jane Smith"
            required
          />
        </div>

        {/* Email */}
        <div className="space-y-1.5">
          <Label htmlFor="u-email">Email</Label>
          <Input
            id="u-email"
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            placeholder="jane@restaurant.com"
            autoComplete="off"
            required
          />
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <Label htmlFor="u-password">Password</Label>
          <div className="relative">
            <Input
              id="u-password"
              type={showPassword ? 'text' : 'password'}
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              placeholder="Min. 6 characters"
              autoComplete="new-password"
              className="pr-9"
              required
              minLength={6}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              tabIndex={-1}
            >
              {showPassword
                ? <EyeOff className="h-4 w-4" />
                : <Eye className="h-4 w-4" />
              }
            </button>
          </div>
        </div>

        {/* Role */}
        <div className="space-y-1.5">
          <Label htmlFor="u-role">Role</Label>
          <Select
            id="u-role"
            value={form.role}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                role: e.target.value as AddUserForm['role'],
                restaurant_id: e.target.value === 'superadmin' ? '' : f.restaurant_id,
              }))
            }
          >
            <option value="admin">admin — full restaurant control</option>
            <option value="staff">staff — availability &amp; chef notes only</option>
            <option value="superadmin">superadmin — platform-wide access</option>
          </Select>
        </div>

        {/* Restaurant — hidden for superadmin */}
        {needsRestaurant && (
          <div className="space-y-1.5">
            <Label htmlFor="u-restaurant">Restaurant</Label>
            <Select
              id="u-restaurant"
              value={form.restaurant_id}
              onChange={(e) => setForm((f) => ({ ...f, restaurant_id: e.target.value }))}
              required
            >
              <option value="">— Select a restaurant —</option>
              {restaurants.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
            {restaurants.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No restaurants yet. Create one first.
              </p>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <Button
            type="submit"
            disabled={saving || (needsRestaurant && !form.restaurant_id)}
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create user
          </Button>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function Users() {
  const [profiles, setProfiles]       = useState<ProfileWithMeta[]>([])
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [loading, setLoading]         = useState(true)
  const [dialogOpen, setDialogOpen]   = useState(false)

  const fetchData = useCallback(async () => {
    // Fetch profiles (with restaurant name join) and auth user list in parallel.
    // The admin client gives us emails from auth.users without needing a DB view.
    const [
      { data: profilesData },
      { data: restaurantsData },
      { data: authUsersData },
    ] = await Promise.all([
      supabase
        .from('profiles')
        .select('*, restaurants(name)')
        .order('created_at', { ascending: false }),
      supabase.from('restaurants').select('*').order('name'),
      supabaseAdmin.auth.admin.listUsers({ perPage: 1000 }),
    ])

    const authUsers = authUsersData?.users ?? []

    const merged: ProfileWithMeta[] = ((profilesData ?? []) as Array<
      Profile & { restaurants: { name: string } | null }
    >).map((p) => ({
      ...p,
      email:           authUsers.find((u) => u.id === p.id)?.email ?? null,
      restaurant_name: p.restaurants?.name ?? null,
    }))

    setProfiles(merged)
    setRestaurants(restaurantsData ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { void fetchData() }, [fetchData])

  const handleRoleChange = async (userId: string, role: UserRole) => {
    await supabase.from('profiles').update({ role }).eq('id', userId)
    void fetchData()
  }

  const handleRestaurantChange = async (userId: string, restaurantId: string) => {
    await supabase
      .from('profiles')
      .update({ restaurant_id: restaurantId || null })
      .eq('id', userId)
    void fetchData()
  }

  return (
    <div>
      <Header
        title="Users"
        description="Manage roles and restaurant assignments."
        actions={
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            Add user
          </Button>
        }
      />

      <div className="p-6 max-w-5xl">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : profiles.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
            <UsersIcon className="h-10 w-10" />
            <p className="text-sm">No users found.</p>
          </div>
        ) : (
          <div className="rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">User</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Role</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Restaurant</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {profiles.map((p) => (
                  <tr key={p.id} className="bg-card hover:bg-muted/20 transition-colors">
                    {/* User */}
                    <td className="px-4 py-3">
                      <p className="font-medium leading-tight">
                        {p.full_name ?? <span className="text-muted-foreground italic">No name</span>}
                      </p>
                      {p.email && (
                        <p className="text-xs text-muted-foreground mt-0.5">{p.email}</p>
                      )}
                    </td>

                    {/* Role */}
                    <td className="px-4 py-3">
                      <Select
                        value={p.role}
                        onChange={(e) => handleRoleChange(p.id, e.target.value as UserRole)}
                        className="w-32 h-7 text-xs"
                      >
                        <option value="staff">staff</option>
                        <option value="admin">admin</option>
                        <option value="superadmin">superadmin</option>
                      </Select>
                    </td>

                    {/* Restaurant */}
                    <td className="px-4 py-3">
                      {p.role !== 'superadmin' ? (
                        <Select
                          value={p.restaurant_id ?? ''}
                          onChange={(e) => handleRestaurantChange(p.id, e.target.value)}
                          className="w-48 h-7 text-xs"
                        >
                          <option value="">— None —</option>
                          {restaurants.map((r) => (
                            <option key={r.id} value={r.id}>{r.name}</option>
                          ))}
                        </Select>
                      ) : (
                        <Badge variant={roleColors[p.role]}>All restaurants</Badge>
                      )}
                    </td>

                    {/* Joined */}
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(p.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AddUserDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        restaurants={restaurants}
        onCreated={() => { void fetchData() }}
      />
    </div>
  )
}

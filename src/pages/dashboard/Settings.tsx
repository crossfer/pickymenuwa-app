import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth, useRestaurantId } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'

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

export function Settings() {
  const { profile } = useAuth()
  const restaurantId = useRestaurantId()
  const isAdmin      = profile?.role === 'admin' || profile?.role === 'superadmin'

  // ── Restaurant data ──────────────────────────────────────────────────────────
  const [loading, setLoading]         = useState(true)

  // ── Restaurant info form ─────────────────────────────────────────────────────
  const [name, setName]               = useState('')
  const [timezone, setTimezone]       = useState('America/Los_Angeles')
  const [saving, setSaving]           = useState(false)

  // ── Change password form ─────────────────────────────────────────────────────
  const [newPassword, setNewPassword]         = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwSaving, setPwSaving]               = useState(false)
  const [pwError, setPwError]                 = useState<string | null>(null)
  const [pwSuccess, setPwSuccess]             = useState(false)

  // ── Load ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!restaurantId) return

    supabase
      .from('restaurants')
      .select('*')
      .eq('id', restaurantId)
      .single()
      .then(({ data }) => {
        if (data) {
          setName(data.name)
          setTimezone(data.timezone)
        }
        setLoading(false)
      })
  }, [restaurantId])

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!restaurantId) return
    setSaving(true)
    await supabase
      .from('restaurants')
      .update({ name, timezone })
      .eq('id', restaurantId)
    setSaving(false)
  }

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setPwError(null)
    setPwSuccess(false)

    if (newPassword.length < 8) {
      setPwError('Password must be at least 8 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setPwError('Passwords do not match.')
      return
    }

    setPwSaving(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setPwSaving(false)

    if (error) {
      setPwError(error.message)
    } else {
      setPwSuccess(true)
      setNewPassword('')
      setConfirmPassword('')
    }
  }

  // ── Loading state ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div>
        <Header title="Settings" />
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  return (
    <div>
      <Header title="Settings" description="Manage your restaurant configuration." />

      <div className="p-6 max-w-2xl space-y-6">

        {/* ── Restaurant info ──────────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>Restaurant info</CardTitle>
            <CardDescription>Name and timezone used by the AI agent.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="res-name">Restaurant name</Label>
                <Input
                  id="res-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={!isAdmin}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="timezone">Timezone</Label>
                <Select
                  id="timezone"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  disabled={!isAdmin}
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz.replace('_', ' ')}
                    </option>
                  ))}
                </Select>
              </div>

              {isAdmin && (
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save changes
                </Button>
              )}
            </form>
          </CardContent>
        </Card>

        {/* ── Change password ──────────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>Change password</CardTitle>
            <CardDescription>Update your account password.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordUpdate} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="new-password">New password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirm-password">Confirm password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>

              {pwError && (
                <p className="text-sm text-destructive">{pwError}</p>
              )}
              {pwSuccess && (
                <p className="text-sm text-emerald-500">Password updated successfully.</p>
              )}

              <Button type="submit" disabled={pwSaving}>
                {pwSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Update password
              </Button>
            </form>
          </CardContent>
        </Card>

      </div>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { Loader2, Copy, Check, Eye, EyeOff } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import type { Restaurant } from '@/types/database'

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
  const restaurantId = profile?.restaurant_id ?? ''
  const isAdmin      = profile?.role === 'admin' || profile?.role === 'superadmin'

  // ── Restaurant data ──────────────────────────────────────────────────────────
  const [restaurant, setRestaurant]   = useState<Restaurant | null>(null)
  const [loading, setLoading]         = useState(true)

  // ── Restaurant info form ─────────────────────────────────────────────────────
  const [name, setName]               = useState('')
  const [timezone, setTimezone]       = useState('America/Los_Angeles')
  const [saving, setSaving]           = useState(false)

  // ── Copy webhook URL ─────────────────────────────────────────────────────────
  const [copied, setCopied]           = useState(false)

  // ── Secret visibility toggle (read-only reference) ───────────────────────────
  const [showSecret, setShowSecret]   = useState(false)

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
          setRestaurant(data)
          setName(data.name)
          setTimezone(data.timezone)
        }
        setLoading(false)
      })
  }, [restaurantId])

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const webhookUrl = restaurant
    ? `https://{n8n-instance}/webhook/${restaurant.slug}`
    : ''

  const handleCopyWebhook = async () => {
    await navigator.clipboard.writeText(webhookUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

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

        {/* ── Kapso webhook URL (read-only display) ────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>Kapso webhook URL</CardTitle>
            <CardDescription>
              Paste this URL into your Kapso.ai account to connect WhatsApp.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input value={webhookUrl} readOnly className="font-mono text-xs" />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleCopyWebhook}
              >
                {copied
                  ? <Check className="h-4 w-4 text-emerald-500" />
                  : <Copy  className="h-4 w-4" />
                }
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Replace <code className="font-mono">{'{n8n-instance}'}</code> with your actual n8n host.
            </p>
          </CardContent>
        </Card>

        {/* ── WhatsApp integration (read-only reference) ───────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>WhatsApp integration</CardTitle>
            <CardDescription>
              Kapso.ai credentials configured for this restaurant.
              These values are managed by your PickyMenu administrator in the
              Superadmin → Restaurants section.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">

            {/* Kapso Phone Number ID */}
            <div className="space-y-1.5">
              <Label htmlFor="kapso-phone-id">Kapso Phone Number ID</Label>
              <Input
                id="kapso-phone-id"
                value={restaurant?.kapso_phone_number_id ?? ''}
                readOnly
                placeholder="Not configured"
                className="font-mono text-sm text-muted-foreground"
              />
            </div>

            {/* Kapso Webhook Secret */}
            <div className="space-y-1.5">
              <Label htmlFor="kapso-secret">Kapso Webhook Secret</Label>
              <div className="relative">
                <Input
                  id="kapso-secret"
                  type={showSecret ? 'text' : 'password'}
                  value={restaurant?.kapso_webhook_secret ?? ''}
                  readOnly
                  placeholder="Not configured"
                  className="font-mono text-sm text-muted-foreground pr-10"
                />
                {restaurant?.kapso_webhook_secret && (
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
                )}
              </div>
            </div>

          </CardContent>
        </Card>

      </div>
    </div>
  )
}

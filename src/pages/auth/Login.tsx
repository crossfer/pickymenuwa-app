import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChefHat, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { signIn, useAuth } from '@/hooks/useAuth'
import type { Profile } from '@/types/database'

/** Decide where to land after a successful sign-in based on the profile role. */
function roleDestination(profile: Profile | null): string {
  return profile?.role === 'superadmin' ? '/superadmin/restaurants' : '/dashboard'
}

export function Login() {
  const { user, profile, loading } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // ── Already signed in (or just signed in): navigate to the right home ─────
  //
  // This guard fires once AuthContext resolves (loading=false).
  // AuthContext guarantees that setProfile() runs before setLoading(false), so
  // `profile` is already set here and roleDestination() returns the right path.
  // No window.location / hard reload — just a React Router <Navigate>.
  if (!loading && user && profile) {
    const dest = roleDestination(profile)
    window.location.href = dest
    return null
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    const { error: authError } = await signIn(email, password)
    if (authError) {
      setError(authError.message)
      setSubmitting(false)
      return
    }

    // signIn() succeeded.  AuthContext will receive the SIGNED_IN event,
    // fetch the profile, then set loading=false — which triggers the guard
    // above and navigates via <Navigate>.  Keep submitting=true so the button
    // stays in its loading state until we unmount.
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-sm space-y-6">

        {/* Brand */}
        <div className="flex flex-col items-center gap-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary shadow-lg">
            <ChefHat className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">PickyMenu</h1>
          <p className="text-sm text-muted-foreground">Restaurant management dashboard</p>
        </div>

        {/* Card */}
        <Card className="shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Sign in</CardTitle>
            <CardDescription>Enter your credentials to access the dashboard</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>

              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@restaurant.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  autoFocus
                  disabled={submitting}
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link
                    to="/forgot-password"
                    tabIndex={-1}
                    className="text-xs text-muted-foreground hover:text-primary underline underline-offset-4 transition-colors"
                  >
                    Forgot password?
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  disabled={submitting}
                />
              </div>

              {error && (
                <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2">
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing in…</>
                  : 'Sign in'
                }
              </Button>

            </form>
          </CardContent>
        </Card>

      </div>
    </div>
  )
}

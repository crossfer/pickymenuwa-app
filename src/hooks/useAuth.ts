/**
 * useAuth — thin wrapper around AuthContext.
 *
 * Components import this hook; they don't need to know about the context
 * directly. Utility auth functions (signIn/signOut/resetPassword) are
 * exported from here as well so all auth calls go through one module.
 */
export { useAuthContext as useAuth } from '@/contexts/AuthContext'

import { useAuthContext } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

export function useRestaurantId(): string {
  const { profile, impersonatedRestaurantId } = useAuthContext()
  return impersonatedRestaurantId ?? profile?.restaurant_id ?? ''
}

export async function signIn(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password })
}

export async function signOut() {
  return supabase.auth.signOut()
}

export async function resetPassword(email: string) {
  return supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  })
}

/**
 * supabase-admin.ts
 *
 * A Supabase client initialised with the SERVICE ROLE key.
 * It bypasses Row Level Security and can call auth.admin.* methods.
 *
 * ⚠ SECURITY NOTE
 * Exposing the service role key in a browser bundle is acceptable for an
 * internal superadmin-only dashboard (only reachable by authenticated
 * superadmins), but it is NOT suitable for a public-facing app.
 *
 * In production, move the auth.admin.createUser() call to a
 * Supabase Edge Function and call it via supabase.functions.invoke().
 *
 * WHY storageKey is set:
 * Both this client and the regular `supabase` client share the same project
 * URL, so GoTrueClient would derive an identical default storageKey for both
 * (sb-{projectRef}-auth-token). When this admin client initialises with
 * persistSession: false it calls storage.removeItem(storageKey), which would
 * wipe the main client's stored session and trigger a phantom SIGNED_OUT
 * event — causing an infinite loading spinner. A unique storageKey isolates
 * this client's (empty) storage slot from the main client's session entirely.
 * detectSessionInUrl: false prevents it from ever intercepting URL hash tokens.
 */

import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL as string
const serviceRoleKey  = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY as string

export const supabaseAdmin = createClient<Database>(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken:  false,
    persistSession:    false,
    storageKey:        'sb-admin-auth',   // unique key — never touches the main client's session slot
    detectSessionInUrl: false,             // never intercept URL hash tokens
  },
})

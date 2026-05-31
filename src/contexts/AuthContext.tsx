/**
 * AuthContext — single source of truth for authentication state.
 *
 * Design decisions (v6):
 *
 * 1. INITIAL_SESSION is the only initial-state source.
 *    GoTrueClient fires INITIAL_SESSION from the localStorage token cache —
 *    no network call required. getSession() was removed because it can trigger
 *    a token-refresh HTTP request that hangs on slow/broken connections.
 *
 * 2. fetchProfile uses a raw fetch() to the Supabase REST API.
 *    The supabase-js query builder was hanging indefinitely. Using fetch()
 *    directly with an explicit AbortController timeout makes the hang
 *    immediately visible in DevTools → Network and gives us a clean
 *    5-second escape hatch regardless of supabase-js internal state.
 *
 * 3. Hard 5-second fallback timer on INITIAL_SESSION.
 *    If INITIAL_SESSION never fires, loading is forced to false so the app
 *    lands on /login rather than spinning forever.
 *
 * 4. `loading` is always cleared in a `finally` block — even if fetchProfile
 *    times out, the spinner never gets permanently stuck.
 *
 * 5. `sessionRef` mirrors the session state value in a ref so that
 *    refreshProfile can read the current access token without a stale closure.
 */

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/types/database'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuthContextValue {
  user: User | null
  session: Session | null
  profile: Profile | null
  loading: boolean
  refreshProfile: () => Promise<void>
  impersonatedRestaurantId: string | null
  impersonatedRestaurantName: string | null
  setImpersonation: (id: string | null, name: string | null) => void
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null)

// ─── Module-level constants ───────────────────────────────────────────────────

// Module-level event counter — correlates log entries across async gaps.
let _authEventSeq = 0

const FALLBACK_TIMEOUT_MS     = 5000
const FETCH_PROFILE_TIMEOUT_MS = 5000

const SUPABASE_URL     = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const [impersonatedRestaurantId,   setImpersonatedRestaurantId]   = useState<string | null>(null)
  const [impersonatedRestaurantName, setImpersonatedRestaurantName] = useState<string | null>(null)

  const setImpersonation = useCallback((id: string | null, name: string | null) => {
    setImpersonatedRestaurantId(id)
    setImpersonatedRestaurantName(name)
  }, [])

  // One-shot gate: cleared after the first auth event resolves.
  // Ref (not state) so it survives StrictMode double-invoke without resetting.
  const hasResolved = useRef(false)

  // Mirrors session and user in refs so refreshProfile never needs them as
  // useCallback deps — keeping refreshProfile's identity stable across renders.
  const sessionRef = useRef<Session | null>(null)
  const userRef    = useRef<User | null>(null)

  // ── fetchProfile ────────────────────────────────────────────────────────────
  // Uses a raw fetch() to the Supabase REST API instead of the supabase-js
  // client, so we get an explicit 5 s timeout and full visibility in DevTools.
  const fetchProfile = useCallback(async (
    userId: string,
    seq: number,
    accessToken: string,
  ): Promise<Profile | null> => {
    const url = `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=*`
    console.log(`[Auth #${seq}] fetchProfile START → GET ${url}`)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => {
      console.error(`[Auth #${seq}] fetchProfile: aborting after ${FETCH_PROFILE_TIMEOUT_MS}ms`)
      controller.abort()
    }, FETCH_PROFILE_TIMEOUT_MS)

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'apikey':        SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${accessToken}`,
          'Accept':        'application/json',
        },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)
      console.log(`[Auth #${seq}] fetchProfile: HTTP ${response.status} ${response.statusText}`)

      if (!response.ok) {
        const body = await response.text().catch(() => '(could not read body)')
        console.error(`[Auth #${seq}] fetchProfile: HTTP ${response.status} error body:`, body)
        return null
      }

      const rows = await response.json() as Profile[]
      console.log(`[Auth #${seq}] fetchProfile: received ${rows.length} row(s)`)

      if (rows.length === 0) {
        console.warn(
          `[Auth #${seq}] fetchProfile: no profile row for ${userId}`,
          '— handle_new_user trigger may not have fired yet.',
        )
        return null
      }

      const p = rows[0]
      console.log(`[Auth #${seq}] fetchProfile END → role=${p.role}`)
      return p
    } catch (err) {
      clearTimeout(timeoutId)
      if (err instanceof DOMException && (err.name === 'AbortError' || err.name === 'TimeoutError')) {
        console.error(
          `[Auth #${seq}] fetchProfile TIMED OUT after ${FETCH_PROFILE_TIMEOUT_MS}ms.`,
          'Raw fetch() to the Supabase REST API also hung.',
          'This is a network-level issue — the supabase-js client is not the cause.',
          'Check: (1) Is the Supabase project active at app.supabase.com?',
          `(2) Is VITE_SUPABASE_URL correct? Currently: "${SUPABASE_URL}"`,
          '(3) DevTools → Network — find the /profiles request and inspect its status.',
        )
      } else {
        console.error(`[Auth #${seq}] fetchProfile threw unexpected error:`, err)
      }
      console.log(`[Auth #${seq}] fetchProfile END → null`)
      return null
    }
  }, [])

  // ── refreshProfile ──────────────────────────────────────────────────────────
  // Reads user from userRef (not state) so this callback's identity is stable
  // across renders — prevents the context value from churning on every auth
  // event and cascading unnecessary re-renders to all consumers.
  const refreshProfile = useCallback(async () => {
    if (!userRef.current || !sessionRef.current) return
    const p = await fetchProfile(userRef.current.id, 0, sessionRef.current.access_token)
    setProfile(p)
  }, [fetchProfile]) // fetchProfile has [] deps → refreshProfile is now fully stable

  // ── resolve ─────────────────────────────────────────────────────────────────
  const resolve = useCallback(
    async (s: Session | null, source: string, seq: number) => {
      console.log(
        `[Auth #${seq}] resolve() source="${source}"`,
        `| session=${s ? 'EXISTS' : 'NULL'}`,
        `| user=${s?.user?.id ?? 'none'}`,
        `| hasResolved=${hasResolved.current}`,
      )

      // Keep refs in sync before any await so refreshProfile always has the
      // latest user/token even if called during an in-flight fetchProfile.
      sessionRef.current = s
      userRef.current    = s?.user ?? null
      setSession(s)
      setUser(s?.user ?? null)

      try {
        if (s?.user) {
          const p = await fetchProfile(s.user.id, seq, s.access_token)
          setProfile(p)
        } else {
          console.log(`[Auth #${seq}] no user — clearing profile`)
          setProfile(null)
        }
      } finally {
        if (!hasResolved.current) {
          hasResolved.current = true
          console.log(`[Auth #${seq}] setLoading(false) — FIRST RESOLUTION via ${source}`)
          setLoading(false)
        } else {
          console.log(`[Auth #${seq}] already resolved — skipping setLoading(false) (source=${source})`)
        }
      }
    },
    [fetchProfile],
  )

  // ── Auth subscription ───────────────────────────────────────────────────────
  useEffect(() => {
    console.log('[Auth] useEffect: subscribing')

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, s) => {
        const seq = ++_authEventSeq
        console.log(`[Auth #${seq}] onAuthStateChange event="${event}"`)
        await resolve(s, `onAuthStateChange(${event})`, seq)
      }
    )

    // Hard fallback: if INITIAL_SESSION never fires within 5 s, unblock the
    // spinner. User lands on /login. Should never trigger in practice —
    // INITIAL_SESSION reads from localStorage without a network call.
    const fallbackId = setTimeout(() => {
      if (!hasResolved.current) {
        console.error(
          `[Auth] INITIAL_SESSION did not fire within ${FALLBACK_TIMEOUT_MS}ms`,
          '— forcing loading=false.',
          'Check: localStorage (sb-*-auth-token key), browser extension interference,',
          'or a supabase-js GoTrueClient regression.',
        )
        hasResolved.current = true
        setLoading(false)
      }
    }, FALLBACK_TIMEOUT_MS)

    return () => {
      console.log('[Auth] useEffect: unsubscribing')
      clearTimeout(fallbackId)
      subscription.unsubscribe()
    }
  }, [resolve])

  // Memoize the context value so its object identity only changes when one of
  // the individual values actually changes. Without this, every AuthProvider
  // re-render creates a new inline object, causing all consumers to re-render
  // even when nothing auth-related changed — which was amplifying the
  // Categories infinite-loop bug to every dashboard page.
  const contextValue = useMemo(
    () => ({
      user, session, profile, loading, refreshProfile,
      impersonatedRestaurantId, impersonatedRestaurantName, setImpersonation,
    }),
    [user, session, profile, loading, refreshProfile,
     impersonatedRestaurantId, impersonatedRestaurantName, setImpersonation],
  )

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuthContext() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuthContext must be used inside <AuthProvider>')
  return ctx
}

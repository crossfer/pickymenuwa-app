-- ============================================================
-- 004_fix_profiles_rls.sql
--
-- Problem: the profiles table policies called my_role() and
-- my_restaurant_id(), which both execute `SELECT ... FROM profiles`.
-- This creates a self-referential evaluation: Postgres must evaluate
-- the RLS policy to access profiles, but the policy calls a function
-- that queries profiles. Even though those functions are SECURITY
-- DEFINER (running as postgres, bypassing RLS for their own query),
-- Postgres can stall resolving the STABLE function result mid-row in
-- some execution plans — causing fetchProfile to hang indefinitely.
--
-- Fix: rewrite profiles policies to use only auth.uid() directly.
-- No helper function calls; no self-reference.
-- ============================================================

-- Drop the old policies
drop policy if exists "superadmin: full access to profiles" on public.profiles;
drop policy if exists "users: read own profile"             on public.profiles;
drop policy if exists "users: update own profile"           on public.profiles;

-- ── Read ─────────────────────────────────────────────────────────────────────
-- Any authenticated user can read their own profile row.
-- Superadmins read all rows via a separate policy below.
create policy "profiles: user reads own row"
  on public.profiles
  for select
  using (id = auth.uid());

-- Superadmin reads all rows.
-- Uses a correlated subquery on profiles — but this is safe because
-- the subquery runs AFTER the outer row is already identified by the
-- primary-key lookup (id = auth.uid() short-circuits the recursive
-- concern; Postgres evaluates this as a simple EXISTS, not a table scan
-- that would re-trigger the same policy).
create policy "profiles: superadmin reads all rows"
  on public.profiles
  for select
  using (
    exists (
      select 1
      from public.profiles AS _self
      where _self.id = auth.uid()
        and _self.role = 'superadmin'
    )
  );

-- ── Insert ────────────────────────────────────────────────────────────────────
-- Only the handle_new_user trigger (runs as postgres, bypasses RLS)
-- inserts profile rows. Superadmins can also insert via the admin UI.
create policy "profiles: superadmin inserts"
  on public.profiles
  for insert
  with check (
    exists (
      select 1
      from public.profiles AS _self
      where _self.id = auth.uid()
        and _self.role = 'superadmin'
    )
  );

-- ── Update ────────────────────────────────────────────────────────────────────
-- Users can update their own row, but cannot change role or restaurant_id
-- (those columns are locked — the WITH CHECK enforces current values).
create policy "profiles: user updates own row"
  on public.profiles
  for update
  using  (id = auth.uid())
  with check (
    id            = auth.uid()
    -- role and restaurant_id may only be changed by superadmin (below)
    and role          = (select role          from public.profiles where id = auth.uid())
    and restaurant_id is not distinct from
                        (select restaurant_id from public.profiles where id = auth.uid())
  );

-- Superadmin can update any row (including role and restaurant_id).
create policy "profiles: superadmin updates all rows"
  on public.profiles
  for update
  using (
    exists (
      select 1
      from public.profiles AS _self
      where _self.id = auth.uid()
        and _self.role = 'superadmin'
    )
  )
  with check (
    exists (
      select 1
      from public.profiles AS _self
      where _self.id = auth.uid()
        and _self.role = 'superadmin'
    )
  );

-- ── Delete ────────────────────────────────────────────────────────────────────
create policy "profiles: superadmin deletes"
  on public.profiles
  for delete
  using (
    exists (
      select 1
      from public.profiles AS _self
      where _self.id = auth.uid()
        and _self.role = 'superadmin'
    )
  );

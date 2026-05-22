-- ============================================================
-- 002_rls_policies.sql
-- Row Level Security for every table.
-- Principle: restaurant_id isolation between tenants.
-- Superadmin sees all rows; admin/staff see only their restaurant.
-- ============================================================

-- Helper function: get the current user's restaurant_id from profiles
create or replace function public.my_restaurant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select restaurant_id from public.profiles where id = auth.uid()
$$;

-- Helper function: get the current user's role
create or replace function public.my_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

-- ============================================================
-- restaurants
-- ============================================================
alter table public.restaurants enable row level security;

-- Superadmin can do everything
create policy "superadmin: full access to restaurants"
  on public.restaurants
  for all
  using (public.my_role() = 'superadmin')
  with check (public.my_role() = 'superadmin');

-- Admin/staff can read their own restaurant
create policy "admin/staff: read own restaurant"
  on public.restaurants
  for select
  using (id = public.my_restaurant_id());

-- Admin can update their own restaurant
create policy "admin: update own restaurant"
  on public.restaurants
  for update
  using (id = public.my_restaurant_id() and public.my_role() = 'admin')
  with check (id = public.my_restaurant_id() and public.my_role() = 'admin');

-- ============================================================
-- profiles
-- ============================================================
alter table public.profiles enable row level security;

-- Superadmin sees all profiles
create policy "superadmin: full access to profiles"
  on public.profiles
  for all
  using (public.my_role() = 'superadmin')
  with check (public.my_role() = 'superadmin');

-- Users can read their own profile
create policy "users: read own profile"
  on public.profiles
  for select
  using (id = auth.uid());

-- Users can update their own profile (name only; role/restaurant_id locked by superadmin)
create policy "users: update own profile"
  on public.profiles
  for update
  using (id = auth.uid())
  with check (id = auth.uid() and role = public.my_role() and restaurant_id = public.my_restaurant_id());

-- ============================================================
-- categories
-- ============================================================
alter table public.categories enable row level security;

-- Superadmin
create policy "superadmin: full access to categories"
  on public.categories
  for all
  using (public.my_role() = 'superadmin')
  with check (public.my_role() = 'superadmin');

-- Admin/staff: read own restaurant's categories
create policy "tenant: read own categories"
  on public.categories
  for select
  using (restaurant_id = public.my_restaurant_id());

-- Admin: full write on own categories
create policy "admin: write own categories"
  on public.categories
  for all
  using (restaurant_id = public.my_restaurant_id() and public.my_role() = 'admin')
  with check (restaurant_id = public.my_restaurant_id() and public.my_role() = 'admin');

-- ============================================================
-- menu_items
-- ============================================================
alter table public.menu_items enable row level security;

-- Superadmin
create policy "superadmin: full access to menu_items"
  on public.menu_items
  for all
  using (public.my_role() = 'superadmin')
  with check (public.my_role() = 'superadmin');

-- Tenant read
create policy "tenant: read own menu_items"
  on public.menu_items
  for select
  using (restaurant_id = public.my_restaurant_id());

-- Admin: full write
create policy "admin: write own menu_items"
  on public.menu_items
  for all
  using (restaurant_id = public.my_restaurant_id() and public.my_role() = 'admin')
  with check (restaurant_id = public.my_restaurant_id() and public.my_role() = 'admin');

-- Staff: can update available and chef_note only (enforced via app, but RLS allows the row)
create policy "staff: update own menu_items"
  on public.menu_items
  for update
  using (restaurant_id = public.my_restaurant_id() and public.my_role() = 'staff')
  with check (restaurant_id = public.my_restaurant_id());

-- ============================================================
-- item_schedules
-- ============================================================
alter table public.item_schedules enable row level security;

-- Superadmin
create policy "superadmin: full access to item_schedules"
  on public.item_schedules
  for all
  using (public.my_role() = 'superadmin')
  with check (public.my_role() = 'superadmin');

-- Tenant read (join through menu_items)
create policy "tenant: read own item_schedules"
  on public.item_schedules
  for select
  using (
    exists (
      select 1 from public.menu_items mi
      where mi.id = item_schedules.item_id
        and mi.restaurant_id = public.my_restaurant_id()
    )
  );

-- Admin: write
create policy "admin: write own item_schedules"
  on public.item_schedules
  for all
  using (
    public.my_role() = 'admin' and
    exists (
      select 1 from public.menu_items mi
      where mi.id = item_schedules.item_id
        and mi.restaurant_id = public.my_restaurant_id()
    )
  )
  with check (
    public.my_role() = 'admin' and
    exists (
      select 1 from public.menu_items mi
      where mi.id = item_schedules.item_id
        and mi.restaurant_id = public.my_restaurant_id()
    )
  );

-- ============================================================
-- conversations
-- ============================================================
alter table public.conversations enable row level security;

-- Superadmin
create policy "superadmin: full access to conversations"
  on public.conversations
  for all
  using (public.my_role() = 'superadmin')
  with check (public.my_role() = 'superadmin');

-- Tenant read
create policy "tenant: read own conversations"
  on public.conversations
  for select
  using (restaurant_id = public.my_restaurant_id());

-- Service role (n8n) writes via service key — no RLS needed for that path.
-- Admin can delete conversations for their restaurant
create policy "admin: delete own conversations"
  on public.conversations
  for delete
  using (restaurant_id = public.my_restaurant_id() and public.my_role() = 'admin');

-- ============================================================
-- messages
-- ============================================================
alter table public.messages enable row level security;

-- Superadmin
create policy "superadmin: full access to messages"
  on public.messages
  for all
  using (public.my_role() = 'superadmin')
  with check (public.my_role() = 'superadmin');

-- Tenant read (join through conversations)
create policy "tenant: read own messages"
  on public.messages
  for select
  using (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and c.restaurant_id = public.my_restaurant_id()
    )
  );

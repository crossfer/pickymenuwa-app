-- ============================================================
-- PickyMenu — Full Migration (paste into Supabase SQL Editor)
-- Run this ONE TIME on a fresh project.
-- Project: uvijeuwohxqqwsgeousv
-- Generated: 2026-05-20
-- ============================================================
-- Safe to re-run: most DDL uses IF NOT EXISTS / ON CONFLICT.
-- ============================================================

-- ============================================================
-- PART 1: Extensions & Core Tables
-- ============================================================

create extension if not exists "pgcrypto";

-- restaurants ------------------------------------------------
create table if not exists public.restaurants (
  id                      uuid primary key default gen_random_uuid(),
  name                    text not null,
  slug                    text unique not null,
  kapso_webhook_secret    text,
  timezone                text not null default 'America/Los_Angeles',
  created_at              timestamptz not null default now()
);

comment on table public.restaurants is 'One row per restaurant tenant.';

-- profiles ---------------------------------------------------
do $$ begin
  create type public.user_role as enum ('superadmin', 'admin', 'staff');
exception when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id              uuid primary key references auth.users on delete cascade,
  restaurant_id   uuid references public.restaurants (id) on delete set null,
  role            public.user_role not null default 'staff',
  full_name       text,
  created_at      timestamptz not null default now()
);

comment on table public.profiles is 'User profile extending auth.users.';
comment on column public.profiles.restaurant_id is 'NULL for superadmin role.';

-- Auto-create profile when a new user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce(
      (new.raw_user_meta_data->>'role')::public.user_role,
      'staff'::public.user_role
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- categories -------------------------------------------------
create table if not exists public.categories (
  id              uuid primary key default gen_random_uuid(),
  restaurant_id   uuid not null references public.restaurants (id) on delete cascade,
  name            text not null,
  sort_order      int not null default 0,
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);

create index if not exists categories_restaurant_sort_idx
  on public.categories (restaurant_id, sort_order);

-- menu_items -------------------------------------------------
create table if not exists public.menu_items (
  id                    uuid primary key default gen_random_uuid(),
  restaurant_id         uuid not null references public.restaurants (id) on delete cascade,
  category_id           uuid references public.categories (id) on delete set null,
  name                  text not null,
  description           text,
  price                 numeric(10, 2),
  image_url             text,
  available             boolean not null default true,
  chef_recommendation   boolean not null default false,
  chef_note             text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists menu_items_restaurant_category_idx
  on public.menu_items (restaurant_id, category_id);
create index if not exists menu_items_restaurant_available_idx
  on public.menu_items (restaurant_id, available);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists menu_items_updated_at on public.menu_items;
create trigger menu_items_updated_at
  before update on public.menu_items
  for each row execute function public.set_updated_at();

-- item_schedules ---------------------------------------------
-- day_of_week: empty = every day; 0=Sun … 6=Sat
create table if not exists public.item_schedules (
  id            uuid primary key default gen_random_uuid(),
  item_id       uuid not null references public.menu_items (id) on delete cascade,
  day_of_week   int[] not null default '{}',
  time_start    time not null,
  time_end      time not null,
  constraint chk_day_of_week check (day_of_week <@ array[0,1,2,3,4,5,6]),
  constraint chk_time_order  check (time_start < time_end)
);

create index if not exists item_schedules_item_idx on public.item_schedules (item_id);

-- conversations ----------------------------------------------
create table if not exists public.conversations (
  id                  uuid primary key default gen_random_uuid(),
  restaurant_id       uuid not null references public.restaurants (id) on delete cascade,
  whatsapp_number     text not null,
  started_at          timestamptz not null default now(),
  last_message_at     timestamptz
);

create index if not exists conversations_restaurant_number_idx
  on public.conversations (restaurant_id, whatsapp_number);
create index if not exists conversations_last_message_idx
  on public.conversations (last_message_at desc);

-- messages ---------------------------------------------------
do $$ begin
  create type public.message_role as enum ('user', 'assistant');
exception when duplicate_object then null;
end $$;

create table if not exists public.messages (
  id                  uuid primary key default gen_random_uuid(),
  conversation_id     uuid not null references public.conversations (id) on delete cascade,
  role                public.message_role not null,
  content             text not null,
  created_at          timestamptz not null default now()
);

create index if not exists messages_conversation_created_idx
  on public.messages (conversation_id, created_at);


-- ============================================================
-- PART 2: RLS Helper Functions
-- ============================================================

create or replace function public.my_restaurant_id()
returns uuid
language sql stable security definer
set search_path = public
as $$
  select restaurant_id from public.profiles where id = auth.uid()
$$;

create or replace function public.my_role()
returns public.user_role
language sql stable security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;


-- ============================================================
-- PART 3: Row Level Security Policies
-- ============================================================

-- restaurants ------------------------------------------------
alter table public.restaurants enable row level security;

drop policy if exists "superadmin: full access to restaurants" on public.restaurants;
create policy "superadmin: full access to restaurants"
  on public.restaurants for all
  using (public.my_role() = 'superadmin')
  with check (public.my_role() = 'superadmin');

drop policy if exists "admin/staff: read own restaurant" on public.restaurants;
create policy "admin/staff: read own restaurant"
  on public.restaurants for select
  using (id = public.my_restaurant_id());

drop policy if exists "admin: update own restaurant" on public.restaurants;
create policy "admin: update own restaurant"
  on public.restaurants for update
  using (id = public.my_restaurant_id() and public.my_role() = 'admin')
  with check (id = public.my_restaurant_id() and public.my_role() = 'admin');

-- profiles ---------------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists "superadmin: full access to profiles" on public.profiles;
create policy "superadmin: full access to profiles"
  on public.profiles for all
  using (public.my_role() = 'superadmin')
  with check (public.my_role() = 'superadmin');

drop policy if exists "users: read own profile" on public.profiles;
create policy "users: read own profile"
  on public.profiles for select
  using (id = auth.uid());

drop policy if exists "users: update own profile" on public.profiles;
create policy "users: update own profile"
  on public.profiles for update
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = public.my_role()
    and restaurant_id = public.my_restaurant_id()
  );

-- categories -------------------------------------------------
alter table public.categories enable row level security;

drop policy if exists "superadmin: full access to categories" on public.categories;
create policy "superadmin: full access to categories"
  on public.categories for all
  using (public.my_role() = 'superadmin')
  with check (public.my_role() = 'superadmin');

drop policy if exists "tenant: read own categories" on public.categories;
create policy "tenant: read own categories"
  on public.categories for select
  using (restaurant_id = public.my_restaurant_id());

drop policy if exists "admin: write own categories" on public.categories;
create policy "admin: write own categories"
  on public.categories for all
  using (restaurant_id = public.my_restaurant_id() and public.my_role() = 'admin')
  with check (restaurant_id = public.my_restaurant_id() and public.my_role() = 'admin');

-- menu_items -------------------------------------------------
alter table public.menu_items enable row level security;

drop policy if exists "superadmin: full access to menu_items" on public.menu_items;
create policy "superadmin: full access to menu_items"
  on public.menu_items for all
  using (public.my_role() = 'superadmin')
  with check (public.my_role() = 'superadmin');

drop policy if exists "tenant: read own menu_items" on public.menu_items;
create policy "tenant: read own menu_items"
  on public.menu_items for select
  using (restaurant_id = public.my_restaurant_id());

drop policy if exists "admin: write own menu_items" on public.menu_items;
create policy "admin: write own menu_items"
  on public.menu_items for all
  using (restaurant_id = public.my_restaurant_id() and public.my_role() = 'admin')
  with check (restaurant_id = public.my_restaurant_id() and public.my_role() = 'admin');

drop policy if exists "staff: update own menu_items" on public.menu_items;
create policy "staff: update own menu_items"
  on public.menu_items for update
  using (restaurant_id = public.my_restaurant_id() and public.my_role() = 'staff')
  with check (restaurant_id = public.my_restaurant_id());

-- item_schedules ---------------------------------------------
alter table public.item_schedules enable row level security;

drop policy if exists "superadmin: full access to item_schedules" on public.item_schedules;
create policy "superadmin: full access to item_schedules"
  on public.item_schedules for all
  using (public.my_role() = 'superadmin')
  with check (public.my_role() = 'superadmin');

drop policy if exists "tenant: read own item_schedules" on public.item_schedules;
create policy "tenant: read own item_schedules"
  on public.item_schedules for select
  using (
    exists (
      select 1 from public.menu_items mi
      where mi.id = item_schedules.item_id
        and mi.restaurant_id = public.my_restaurant_id()
    )
  );

drop policy if exists "admin: write own item_schedules" on public.item_schedules;
create policy "admin: write own item_schedules"
  on public.item_schedules for all
  using (
    public.my_role() = 'admin' and exists (
      select 1 from public.menu_items mi
      where mi.id = item_schedules.item_id
        and mi.restaurant_id = public.my_restaurant_id()
    )
  )
  with check (
    public.my_role() = 'admin' and exists (
      select 1 from public.menu_items mi
      where mi.id = item_schedules.item_id
        and mi.restaurant_id = public.my_restaurant_id()
    )
  );

-- conversations ----------------------------------------------
alter table public.conversations enable row level security;

drop policy if exists "superadmin: full access to conversations" on public.conversations;
create policy "superadmin: full access to conversations"
  on public.conversations for all
  using (public.my_role() = 'superadmin')
  with check (public.my_role() = 'superadmin');

drop policy if exists "tenant: read own conversations" on public.conversations;
create policy "tenant: read own conversations"
  on public.conversations for select
  using (restaurant_id = public.my_restaurant_id());

drop policy if exists "admin: delete own conversations" on public.conversations;
create policy "admin: delete own conversations"
  on public.conversations for delete
  using (restaurant_id = public.my_restaurant_id() and public.my_role() = 'admin');

-- messages ---------------------------------------------------
alter table public.messages enable row level security;

drop policy if exists "superadmin: full access to messages" on public.messages;
create policy "superadmin: full access to messages"
  on public.messages for all
  using (public.my_role() = 'superadmin')
  with check (public.my_role() = 'superadmin');

drop policy if exists "tenant: read own messages" on public.messages;
create policy "tenant: read own messages"
  on public.messages for select
  using (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and c.restaurant_id = public.my_restaurant_id()
    )
  );


-- ============================================================
-- PART 4: Storage — menu-images bucket
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'menu-images',
  'menu-images',
  true,
  2097152,                              -- 2 MB
  array['image/webp','image/jpeg','image/png','image/gif']
)
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Drop existing storage policies before recreating (idempotent)
drop policy if exists "public: read menu images"    on storage.objects;
drop policy if exists "tenant: upload menu images"  on storage.objects;
drop policy if exists "tenant: update menu images"  on storage.objects;
drop policy if exists "admin: delete menu images"   on storage.objects;

create policy "public: read menu images"
  on storage.objects for select
  using (bucket_id = 'menu-images');

create policy "tenant: upload menu images"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'menu-images'
    and (storage.foldername(name))[1] = (public.my_restaurant_id())::text
    and public.my_role() in ('admin', 'staff', 'superadmin')
  );

create policy "tenant: update menu images"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'menu-images'
    and (storage.foldername(name))[1] = (public.my_restaurant_id())::text
    and public.my_role() in ('admin', 'staff', 'superadmin')
  );

create policy "admin: delete menu images"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'menu-images'
    and (storage.foldername(name))[1] = (public.my_restaurant_id())::text
    and public.my_role() in ('admin', 'superadmin')
  );

-- ============================================================
-- Done! Verify with:
--   select tablename from pg_tables where schemaname = 'public' order by 1;
--   select id, name from storage.buckets;
-- ============================================================

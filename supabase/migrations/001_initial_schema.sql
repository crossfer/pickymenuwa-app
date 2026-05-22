-- ============================================================
-- 001_initial_schema.sql
-- Core tables for PickyMenu Level 1
-- ============================================================

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ============================================================
-- restaurants
-- ============================================================
create table public.restaurants (
  id                      uuid primary key default gen_random_uuid(),
  name                    text not null,
  slug                    text unique not null,
  kapso_webhook_secret    text,
  timezone                text not null default 'America/Los_Angeles',
  created_at              timestamptz not null default now()
);

comment on table public.restaurants is 'One row per restaurant tenant.';

-- ============================================================
-- profiles
-- Extends auth.users with role and restaurant assignment.
-- ============================================================
create type public.user_role as enum ('superadmin', 'admin', 'staff');

create table public.profiles (
  id              uuid primary key references auth.users on delete cascade,
  restaurant_id   uuid references public.restaurants (id) on delete set null,
  role            public.user_role not null default 'staff',
  full_name       text,
  created_at      timestamptz not null default now()
);

comment on table public.profiles is 'User profile extending auth.users.';
comment on column public.profiles.restaurant_id is 'NULL for superadmin role.';

-- Auto-create a profile row when a new user signs up
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
    coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'staff')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- categories
-- ============================================================
create table public.categories (
  id              uuid primary key default gen_random_uuid(),
  restaurant_id   uuid not null references public.restaurants (id) on delete cascade,
  name            text not null,
  sort_order      int not null default 0,
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);

create index on public.categories (restaurant_id, sort_order);

-- ============================================================
-- menu_items
-- ============================================================
create table public.menu_items (
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

create index on public.menu_items (restaurant_id, category_id);
create index on public.menu_items (restaurant_id, available);

-- Auto-update updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger menu_items_updated_at
  before update on public.menu_items
  for each row execute function public.set_updated_at();

-- ============================================================
-- item_schedules
-- Controls time/day availability of a menu item.
-- day_of_week: empty array = every day; otherwise 0=Sun … 6=Sat
-- ============================================================
create table public.item_schedules (
  id            uuid primary key default gen_random_uuid(),
  item_id       uuid not null references public.menu_items (id) on delete cascade,
  day_of_week   int[] not null default '{}',
  time_start    time not null,
  time_end      time not null,
  constraint chk_day_of_week check (
    day_of_week <@ array[0, 1, 2, 3, 4, 5, 6]
  ),
  constraint chk_time_order check (time_start < time_end)
);

create index on public.item_schedules (item_id);

-- ============================================================
-- conversations
-- One row per WhatsApp conversation session.
-- ============================================================
create table public.conversations (
  id                  uuid primary key default gen_random_uuid(),
  restaurant_id       uuid not null references public.restaurants (id) on delete cascade,
  whatsapp_number     text not null,
  started_at          timestamptz not null default now(),
  last_message_at     timestamptz
);

create index on public.conversations (restaurant_id, whatsapp_number);
create index on public.conversations (last_message_at desc);

-- ============================================================
-- messages
-- Individual messages inside a conversation.
-- ============================================================
create type public.message_role as enum ('user', 'assistant');

create table public.messages (
  id                  uuid primary key default gen_random_uuid(),
  conversation_id     uuid not null references public.conversations (id) on delete cascade,
  role                public.message_role not null,
  content             text not null,
  created_at          timestamptz not null default now()
);

create index on public.messages (conversation_id, created_at);

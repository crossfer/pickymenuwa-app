-- ============================================================
-- 003_storage.sql
-- Supabase Storage bucket and policies for menu images.
-- ============================================================

-- Create the bucket (idempotent via DO block)
insert into storage.buckets (id, name, public)
values ('menu-images', 'menu-images', true)
on conflict (id) do nothing;

-- ============================================================
-- Storage Policies
-- ============================================================

-- Anyone (including diners via WhatsApp) can read images
create policy "public: read menu images"
  on storage.objects
  for select
  using (bucket_id = 'menu-images');

-- Authenticated admin/staff can upload images for their restaurant
create policy "tenant: upload menu images"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'menu-images'
    and (
      -- Path must start with the user's restaurant_id
      (storage.foldername(name))[1] = (public.my_restaurant_id())::text
    )
    and public.my_role() in ('admin', 'staff', 'superadmin')
  );

-- Admin/staff can update (upsert) their restaurant's images
create policy "tenant: update menu images"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'menu-images'
    and (storage.foldername(name))[1] = (public.my_restaurant_id())::text
    and public.my_role() in ('admin', 'staff', 'superadmin')
  );

-- Admin can delete their restaurant's images
create policy "admin: delete menu images"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'menu-images'
    and (storage.foldername(name))[1] = (public.my_restaurant_id())::text
    and public.my_role() in ('admin', 'superadmin')
  );

-- ============================================================
-- create_first_superadmin.sql
--
-- Run this ONCE in the Supabase SQL Editor AFTER you have created
-- your first user via Authentication → Users → Add User
-- (or let them sign up via the login page first).
--
-- Replace the email below with your actual email address.
-- ============================================================

-- Step 1: Look up the user's ID by email (just for verification)
select id, email from auth.users where email = 'your-email@example.com';

-- Step 2: Update their profile to superadmin
-- Copy the `id` from the query above and paste it below.
update public.profiles
set role = 'superadmin',
    full_name = 'Super Admin',   -- change as you like
    restaurant_id = null          -- superadmins have no restaurant
where id = (
  select id from auth.users where email = 'your-email@example.com'
);

-- Step 3: Verify
select p.id, p.full_name, p.role, u.email
from public.profiles p
join auth.users u on u.id = p.id
where p.role = 'superadmin';

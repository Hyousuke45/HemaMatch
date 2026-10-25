-- ============================================================
-- HemaMatch — seed data for Supabase (Phase 2)
-- ============================================================
-- Run AFTER schema.sql, in the Supabase SQL editor.
--
-- What this creates:
--   1. Three hospitals (two verified, one pending).
--   2. The SAME eleven demo accounts the mock mode has, with real
--      bcrypt-hashed passwords and pre-confirmed emails, so the login
--      quick-fill chips work in the live defense demo:
--        admin@demo.com / admin123   (administrator)
--        maria@demo.com / maria123   (O- donor, NCR)
--        grace@demo.com / grace123   (AB+ requester, NCR)
--        ...and 8 more donors
--   3. Three demo blood requests so the app is not empty.
--
-- The seed is idempotent: fixed UUIDs + ON CONFLICT DO NOTHING, so it can
-- be re-run safely. DEMO ACCOUNTS ONLY — never reuse these passwords in
-- a real deployment.
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- 1. Hospitals
-- ------------------------------------------------------------
insert into public.hospitals (id, name, region, city, address, contact_number, status, notes) values
  ('00000000-0000-0000-0000-00000000aa01', 'St. Mary General Hospital', 'NCR (Metro Manila)', 'Manila',
   '123 España Boulevard, Sampaloc, Manila', '(02) 8123-4567', 'verified', 'License verified by administrator.'),
  ('00000000-0000-0000-0000-00000000aa02', 'Central Luzon Medical Center', 'Region III (Central Luzon)', 'San Fernando',
   'McArthur Highway, San Fernando, Pampanga', '(045) 456-7890', 'verified', 'License verified by administrator.'),
  ('00000000-0000-0000-0000-00000000aa03', 'Davao Regional Hospital', 'Region XI (Davao Region)', 'Davao City',
   'Southern Philippine Avenue, Davao City', '(082) 222-3333', 'pending', 'Awaiting license confirmation.')
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- 2. Demo accounts (auth.users + auth.identities)
--    The handle_new_user trigger creates each profile automatically.
--    Fixed UUIDs keep the seed idempotent.
-- ------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token
)
values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated',
   'admin@demo.com',   crypt('admin123',   gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Ana Villanueva"}'::jsonb, now(), now(), '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated',
   'maria@demo.com',   crypt('maria123',   gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Maria Santos"}'::jsonb, now(), now(), '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated',
   'juan@demo.com',   crypt('juan123',    gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Juan Dela Cruz"}'::jsonb, now(), now(), '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated',
   'angela@demo.com', crypt('angela123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Angela Reyes"}'::jsonb, now(), now(), '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated',
   'pedro@demo.com',  crypt('pedro123',   gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Pedro Ramos"}'::jsonb, now(), now(), '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000006', 'authenticated', 'authenticated',
   'miguel@demo.com', crypt('miguel123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Miguel Lopez"}'::jsonb, now(), now(), '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000007', 'authenticated', 'authenticated',
   'cristina@demo.com', crypt('cristina123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Cristina Flores"}'::jsonb, now(), now(), '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000008', 'authenticated', 'authenticated',
   'rafael@demo.com', crypt('rafael123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Rafael Mendoza"}'::jsonb, now(), now(), '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000009', 'authenticated', 'authenticated',
   'grace@demo.com',  crypt('grace123',   gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Grace Lim"}'::jsonb, now(), now(), '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-00000000000a', 'authenticated', 'authenticated',
   'paolo@demo.com',  crypt('paolo123',   gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Paolo Villanueva"}'::jsonb, now(), now(), '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-00000000000b', 'authenticated', 'authenticated',
   'sofia@demo.com',  crypt('sofia123',   gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Sofia Garcia"}'::jsonb, now(), now(), '', '')
on conflict (id) do nothing;

insert into auth.identities (
  id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
)
select
  gen_random_uuid(),
  u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  'email',
  u.id::text,
  now(), now(), now()
from auth.users u
where u.email like '%@demo.com'
  and not exists (select 1 from auth.identities i where i.user_id = u.id and i.provider = 'email');

-- ------------------------------------------------------------
-- 3. Profiles (created by the trigger; enrich with donor data)
-- ------------------------------------------------------------
update public.profiles set blood_type = 'O+', region = 'NCR (Metro Manila)',           city = 'Manila',        is_available = false
  where id = '00000000-0000-0000-0000-000000000001'; -- Ana (admin)
update public.profiles set blood_type = 'O-', region = 'NCR (Metro Manila)',           city = 'Quezon City',   is_available = true
  where id = '00000000-0000-0000-0000-000000000002'; -- Maria
update public.profiles set blood_type = 'A+', region = 'Region IV-A (CALABARZON)',      city = 'Antipolo',      is_available = true
  where id = '00000000-0000-0000-0000-000000000003'; -- Juan
update public.profiles set blood_type = 'B+', region = 'NCR (Metro Manila)',           city = 'Makati',        is_available = true
  where id = '00000000-0000-0000-0000-000000000004'; -- Angela
update public.profiles set blood_type = 'B+', region = 'NCR (Metro Manila)',           city = 'Pasig',         is_available = false
  where id = '00000000-0000-0000-0000-000000000005'; -- Pedro (intentionally unavailable: shows the availability filter)
update public.profiles set blood_type = 'AB-', region = 'Region III (Central Luzon)',  city = 'San Fernando',  is_available = true
  where id = '00000000-0000-0000-0000-000000000006'; -- Miguel
update public.profiles set blood_type = 'O+', region = 'Region VI (Western Visayas)',  city = 'Iloilo City',   is_available = true
  where id = '00000000-0000-0000-0000-000000000007'; -- Cristina
update public.profiles set blood_type = 'A-', region = 'Region XI (Davao Region)',     city = 'Davao City',    is_available = true
  where id = '00000000-0000-0000-0000-000000000008'; -- Rafael
update public.profiles set blood_type = 'AB+', region = 'NCR (Metro Manila)',          city = 'Taguig',        is_available = false
  where id = '00000000-0000-0000-0000-000000000009'; -- Grace
update public.profiles set blood_type = 'O-', region = 'Region IV-A (CALABARZON)',      city = 'Bacoor',        is_available = true
  where id = '00000000-0000-0000-0000-00000000000a'; -- Paolo
update public.profiles set blood_type = 'B-', region = 'NCR (Metro Manila)',           city = 'Mandaluyong',   is_available = true
  where id = '00000000-0000-0000-0000-00000000000b'; -- Sofia

-- ------------------------------------------------------------
-- 4. Promote Ana to administrator.
--    The protect_role trigger exists precisely so nobody can grant
--    themselves admin. Bootstrap requires temporarily disabling that
--    one trigger from the SQL editor (a service-role-only action).
--    Afterwards, ALL further role changes go through admin_set_role().
-- ------------------------------------------------------------
alter table public.profiles disable trigger protect_role;
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-000000000001';
alter table public.profiles enable trigger protect_role;

-- ------------------------------------------------------------
-- 5. Three demo blood requests (so the app is not empty).
--    Conversations, status changes and outcome records are easiest to
--    create live through the UI during the demo.
-- ------------------------------------------------------------
insert into public.donation_requests (
  id, requester_id, blood_type, units_needed, region, hospital_id, urgency, needed_by, description, status
) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000009', 'O+', 3,
   'NCR (Metro Manila)', '00000000-0000-0000-0000-00000000aa01', 'critical', current_date + 7,
   'Patient scheduled for major surgery at St. Mary General Hospital needs O+ blood. Coordination with the hospital blood bank is ongoing.',
   'pending'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000006', 'B+', 4,
   'Region III (Central Luzon)', '00000000-0000-0000-0000-00000000aa02', 'urgent', current_date + 5,
   'Father needs B+ units for an operation at Central Luzon Medical Center. Donors matched through this app will still go through standard screening.',
   'pending'),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000004', 'B-', 3,
   'NCR (Metro Manila)', '00000000-0000-0000-0000-00000000aa01', 'critical', current_date + 3,
   'Brother needs B- blood for an emergency procedure at St. Mary General Hospital. Looking for donors.',
   'pending')
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- Demo credentials summary (also shown as quick-fill chips in the app)
--   admin@demo.com   / admin123   — administrator (Ana Villanueva)
--   maria@demo.com   / maria123    — O- donor, NCR (universal donor)
--   grace@demo.com   / grace123    — AB+ requester with a live O+ request
--   paolo@demo.com   / paolo123    — O- donor, CALABARZON
--   sofia@demo.com   / sofia123    — B- donor, NCR
-- ------------------------------------------------------------

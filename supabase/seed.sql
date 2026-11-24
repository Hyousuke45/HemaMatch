-- ============================================================
-- HemaMatch — seed data for Supabase (Phase 2) — v4.1
-- ============================================================
-- Run AFTER schema.sql, in the Supabase SQL editor.
--
-- What this creates:
--   1. Three hospitals with their business admins, descriptions and
--      photos (two verified, one pending).
--   2. The SAME demo accounts the mock mode has, with real
--      bcrypt-hashed passwords and pre-confirmed emails, so the login
--      quick-fill chips work in the live defense demo:
--        admin@demo.com / admin123        (administrator)
--        maria@demo.com / maria123        (O- donor, Valencia City)
--        grace@demo.com / grace123        (AB+ requester, Valencia City)
--        biz.stmary@demo.com / biz12345   (business — Valencia Adventist admin; login name kept)
--        dr.ramos@demo.com / doctor123    (doctor — Valencia Adventist roster)
--        ...and more donors/doctors
--   3. Demo blood requests, donor acceptances (with assigned doctors),
--      hospital doctor applications and hospital notifications.
--
-- v6.9: auth seed rows are GoTrue-safe (all token columns non-null) and
--        self-healing: re-running fixes older broken seeds in place.
-- The seed is idempotent: fixed UUIDs + ON CONFLICT DO NOTHING, so it can
-- v6.6: profiles are inserted explicitly (not via the signup trigger), so a
-- re-run works even when auth.users rows already existed.
-- be re-run safely. DEMO ACCOUNTS ONLY — never reuse these passwords in
-- a real deployment.
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- 1. Demo accounts (auth.users + auth.identities)
--    The handle_new_user trigger creates each profile automatically
--    (with the v4 account type from raw_user_meta_data).
--    Fixed UUIDs keep the seed idempotent.
-- ------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token,
  -- v6.9: GoTrue scans these columns into non-nullable Go strings
  -- (supabase/auth#1940). NULL here breaks sign-in with a generic
  -- "Database error querying schema" 500. Always seed '' (and an
  -- epoch for the sent-at timestamps).
  email_change, email_change_token_new, email_change_token_current,
  email_change_sent_at
)
values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated',
   'admin@demo.com',   crypt('admin123',   gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Ana Villanueva","account_type":"user"}'::jsonb, now(), now(), '', '', '', '', '', '1970-01-01 00:00:00+00'),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated',
   'maria@demo.com',   crypt('maria123',   gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Maria Santos","account_type":"user"}'::jsonb, now(), now(), '', '', '', '', '', '1970-01-01 00:00:00+00'),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated',
   'juan@demo.com',   crypt('juan123',    gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Juan Dela Cruz","account_type":"user"}'::jsonb, now(), now(), '', '', '', '', '', '1970-01-01 00:00:00+00'),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated',
   'angela@demo.com', crypt('angela123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Angela Reyes","account_type":"user"}'::jsonb, now(), now(), '', '', '', '', '', '1970-01-01 00:00:00+00'),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated',
   'pedro@demo.com',  crypt('pedro123',   gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Pedro Ramos","account_type":"user"}'::jsonb, now(), now(), '', '', '', '', '', '1970-01-01 00:00:00+00'),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000006', 'authenticated', 'authenticated',
   'miguel@demo.com', crypt('miguel123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Miguel Lopez","account_type":"user"}'::jsonb, now(), now(), '', '', '', '', '', '1970-01-01 00:00:00+00'),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000007', 'authenticated', 'authenticated',
   'cristina@demo.com', crypt('cristina123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Cristina Flores","account_type":"user"}'::jsonb, now(), now(), '', '', '', '', '', '1970-01-01 00:00:00+00'),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000008', 'authenticated', 'authenticated',
   'rafael@demo.com', crypt('rafael123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Rafael Mendoza","account_type":"user"}'::jsonb, now(), now(), '', '', '', '', '', '1970-01-01 00:00:00+00'),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000009', 'authenticated', 'authenticated',
   'grace@demo.com',  crypt('grace123',   gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Grace Lim","account_type":"user"}'::jsonb, now(), now(), '', '', '', '', '', '1970-01-01 00:00:00+00'),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-00000000000a', 'authenticated', 'authenticated',
   'paolo@demo.com',  crypt('paolo123',   gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Paolo Villanueva","account_type":"user"}'::jsonb, now(), now(), '', '', '', '', '', '1970-01-01 00:00:00+00'),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-00000000000b', 'authenticated', 'authenticated',
   'sofia@demo.com',  crypt('sofia123',   gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Sofia Garcia","account_type":"user"}'::jsonb, now(), now(), '', '', '', '', '', '1970-01-01 00:00:00+00'),
  -- v4: business (hospital admin) accounts. NOTE: their hospitals are
  -- inserted directly below (the handle_new_user hospital creation is
  -- skipped because these users carry no hospital_* metadata).
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-00000000000c', 'authenticated', 'authenticated',
   'biz.stmary@demo.com',   crypt('biz12345',   gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Corazon Santiago","account_type":"business"}'::jsonb, now(), now(), '', '', '', '', '', '1970-01-01 00:00:00+00'),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-00000000000d', 'authenticated', 'authenticated',
   'biz.central@demo.com',  crypt('biz12345',   gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Melinda Torres","account_type":"business"}'::jsonb, now(), now(), '', '', '', '', '', '1970-01-01 00:00:00+00'),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-00000000000e', 'authenticated', 'authenticated',
   'biz.davao@demo.com',    crypt('biz12345',   gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Rodrigo Bautista","account_type":"business"}'::jsonb, now(), now(), '', '', '', '', '', '1970-01-01 00:00:00+00'),
  -- v4.1: fourth business admin (Abella Midway Hospital)
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000012', 'authenticated', 'authenticated',
   'biz.western@demo.com',  crypt('biz12345',   gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Teresita Uy","account_type":"business"}'::jsonb, now(), now(), '', '', '', '', '', '1970-01-01 00:00:00+00'),
  -- v4: doctor accounts
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-00000000000f', 'authenticated', 'authenticated',
   'dr.ramos@demo.com',   crypt('doctor123',  gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Dr. Elena Ramos","account_type":"doctor","doctor_license_id":"PRC-0092381","specialization":"Internal Medicine","doctor_contact_number":"0917-123-4567"}'::jsonb, now(), now(), '', '', '', '', '', '1970-01-01 00:00:00+00'),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000010', 'authenticated', 'authenticated',
   'dr.aquino@demo.com',  crypt('doctor123',  gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Dr. Marco Aquino","account_type":"doctor","doctor_license_id":"PRC-0077120","specialization":"Hematology","doctor_contact_number":"0918-555-1234"}'::jsonb, now(), now(), '', '', '', '', '', '1970-01-01 00:00:00+00'),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000011', 'authenticated', 'authenticated',
   'dr.domingo@demo.com', crypt('doctor123',  gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Dr. Liza Domingo","account_type":"doctor","doctor_license_id":"PRC-0055993","specialization":"Pediatrics","doctor_contact_number":"0920-777-8899"}'::jsonb, now(), now(), '', '', '', '', '', '1970-01-01 00:00:00+00')
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
-- 1b. Profiles — inserted EXPLICITLY (idempotent), not left to the
--     handle_new_user trigger: ON CONFLICT (id) DO NOTHING above skips
--     the trigger whenever an auth row already exists (re-run after a
--     partial seed, or a public-schema reset while auth.users
--     persisted), which used to crash the hospitals insert with
--     "hospitals_admin_id_fkey ... not present in table profiles".
--     Values mirror the trigger exactly; the UPDATEs below then enrich.
-- ------------------------------------------------------------
insert into public.profiles (id, full_name, role, is_doctor, doctor_license_id, specialization, contact_number) values
  ('00000000-0000-0000-0000-000000000001', 'Ana Villanueva',   'user',     false, null,        null,                 null),
  ('00000000-0000-0000-0000-000000000002', 'Maria Santos',     'user',     false, null,        null,                 null),
  ('00000000-0000-0000-0000-000000000003', 'Juan Dela Cruz',   'user',     false, null,        null,                 null),
  ('00000000-0000-0000-0000-000000000004', 'Angela Reyes',     'user',     false, null,        null,                 null),
  ('00000000-0000-0000-0000-000000000005', 'Pedro Ramos',      'user',     false, null,        null,                 null),
  ('00000000-0000-0000-0000-000000000006', 'Miguel Lopez',     'user',     false, null,        null,                 null),
  ('00000000-0000-0000-0000-000000000007', 'Cristina Flores',  'user',     false, null,        null,                 null),
  ('00000000-0000-0000-0000-000000000008', 'Rafael Mendoza',   'user',     false, null,        null,                 null),
  ('00000000-0000-0000-0000-000000000009', 'Grace Lim',        'user',     false, null,        null,                 null),
  ('00000000-0000-0000-0000-00000000000a', 'Paolo Villanueva', 'user',     false, null,        null,                 null),
  ('00000000-0000-0000-0000-00000000000b', 'Sofia Garcia',     'user',     false, null,        null,                 null),
  ('00000000-0000-0000-0000-00000000000c', 'Corazon Santiago', 'business', false, null,        null,                 null),
  ('00000000-0000-0000-0000-00000000000d', 'Melinda Torres',   'business', false, null,        null,                 null),
  ('00000000-0000-0000-0000-00000000000e', 'Rodrigo Bautista', 'business', false, null,        null,                 null),
  ('00000000-0000-0000-0000-000000000012', 'Teresita Uy',      'business', false, null,        null,                 null),
  ('00000000-0000-0000-0000-00000000000f', 'Dr. Elena Ramos',  'doctor',   false, 'PRC-0092381', 'Internal Medicine', '0917-123-4567'),
  ('00000000-0000-0000-0000-000000000010', 'Dr. Marco Aquino','doctor',   false, 'PRC-0077120', 'Hematology',        '0918-555-1234'),
  ('00000000-0000-0000-0000-000000000011', 'Dr. Liza Domingo', 'doctor',   false, 'PRC-0055993', 'Pediatrics',        '0920-777-8899')
on conflict (id) do nothing;


-- ------------------------------------------------------------
-- 1c. v6.9 SELF-HEALING for logins (safe on re-run, no-ops when the
--     rows were inserted correctly above):
--     a) NULL GoTrue-scanned columns -> '' / epoch, so signInWith-
--        Password stops 500-ing with "Database error querying schema"
--        (supabase/auth#1940: email_change, email_change_token_new,
--        email_change_token_current, email_change_sent_at — GoTrue
--        scans them into non-nullable Go strings).
--     b) instance_id of the demo accounts -> the project's all-zeros
--        instance UUID (three business rows were seeded with their own
--        user id in that column, which made GoTrue's lookup miss them
--        and return "Invalid email or password").
--     c) any NULL -> '' pass over confirmation/recovery tokens too.
-- ------------------------------------------------------------
update auth.users
set email_change                = coalesce(email_change, ''),
    email_change_token_new      = coalesce(email_change_token_new, ''),
    email_change_token_current  = coalesce(email_change_token_current, ''),
    email_change_sent_at        = coalesce(email_change_sent_at, '1970-01-01 00:00:00+00'),
    confirmation_token         = coalesce(confirmation_token, ''),
    recovery_token              = coalesce(recovery_token, ''),
    email_confirmed_at          = coalesce(email_confirmed_at, now())
where email like '%@demo.com';

update auth.users
set instance_id = '00000000-0000-0000-0000-000000000000'
where email like '%@demo.com'
  and instance_id <> '00000000-0000-0000-0000-000000000000';

-- make sure every demo user has an email identity row (GoTrue's
-- signInWithPassword resolves the identity for the email provider).
insert into auth.identities (
  id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
)
select
  gen_random_uuid(), u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  'email', u.id::text, now(), now(), now()
from auth.users u
where u.email like '%@demo.com'
  and not exists (
    select 1 from auth.identities i
    where i.user_id = u.id and i.provider = 'email'
  );

-- ------------------------------------------------------------
-- 2. Profiles (created by the trigger; enrich with donor data)
--    avatar_url uses DiceBear (free, no account needed) so the
--    profile-photo feature is visible in the demo without any
--    Cloudinary setup. Replace freely with real Cloudinary URLs.
-- ------------------------------------------------------------
update public.profiles set blood_type = 'O+', region = 'Region X (Northern Mindanao)',  city = 'Valencia City',        is_available = false
  where id = '00000000-0000-0000-0000-000000000001'; -- Ana (admin)
update public.profiles set blood_type = 'O-', region = 'Region X (Northern Mindanao)',  city = 'Valencia City',   is_available = true,
  avatar_url = 'https://api.dicebear.com/9.x/avataaars/svg?seed=Maria%20Santos&backgroundColor=c1912f'
  where id = '00000000-0000-0000-0000-000000000002'; -- Maria
update public.profiles set blood_type = 'A+', region = 'Region X (Northern Mindanao)',  city = 'Valencia City',      is_available = true,
  avatar_url = 'https://api.dicebear.com/9.x/avataaars/svg?seed=Juan%20Dela%20Cruz&backgroundColor=b6452c'
  where id = '00000000-0000-0000-0000-000000000003'; -- Juan
update public.profiles set blood_type = 'B+', region = 'Region X (Northern Mindanao)',  city = 'Valencia City',        is_available = true,
  avatar_url = 'https://api.dicebear.com/9.x/avataaars/svg?seed=Angela%20Reyes&backgroundColor=8a3033'
  where id = '00000000-0000-0000-0000-000000000004'; -- Angela
update public.profiles set blood_type = 'B+', region = 'Region X (Northern Mindanao)',  city = 'Valencia City',         is_available = false
  where id = '00000000-0000-0000-0000-000000000005'; -- Pedro (intentionally unavailable: shows the availability filter)
update public.profiles set blood_type = 'AB-', region = 'Region X (Northern Mindanao)',  city = 'Valencia City',  is_available = false, -- paused listing (sync rule)
  avatar_url = 'https://api.dicebear.com/9.x/avataaars/svg?seed=Miguel%20Lopez&backgroundColor=4d5e5a'
  where id = '00000000-0000-0000-0000-000000000006'; -- Miguel
update public.profiles set blood_type = 'O+', region = 'Region X (Northern Mindanao)',  city = 'Valencia City',   is_available = true,
  avatar_url = 'https://api.dicebear.com/9.x/avataaars/svg?seed=Cristina%20Flores&backgroundColor=946b2d'
  where id = '00000000-0000-0000-0000-000000000007'; -- Cristina
update public.profiles set blood_type = 'A-', region = 'Region X (Northern Mindanao)',  city = 'Valencia City',    is_available = true
  where id = '00000000-0000-0000-0000-000000000008'; -- Rafael
update public.profiles set blood_type = 'AB+', region = 'Region X (Northern Mindanao)',  city = 'Valencia City',        is_available = false
  where id = '00000000-0000-0000-0000-000000000009'; -- Grace
update public.profiles set blood_type = 'O-', region = 'Region X (Northern Mindanao)',  city = 'Valencia City',        is_available = true,
  avatar_url = 'https://api.dicebear.com/9.x/avataaars/svg?seed=Paolo%20Villanueva&backgroundColor=6b8e9e'
  where id = '00000000-0000-0000-0000-00000000000a'; -- Paolo
update public.profiles set blood_type = 'B-', region = 'Region X (Northern Mindanao)',  city = 'Valencia City',   is_available = true
  where id = '00000000-0000-0000-0000-00000000000b'; -- Sofia

-- v4: business admins (Corazon, Melinda, Rodrigo). Rodrigo is ALSO a
-- licensed doctor — the "business inherits doctor" demo.
update public.profiles set blood_type = 'O+', region = 'Region X (Northern Mindanao)',  city = 'Valencia City',        is_available = false, is_doctor = false,
  avatar_url = 'https://api.dicebear.com/9.x/avataaars/svg?seed=Corazon%20Santiago&backgroundColor=8a6d1f'
  where id = '00000000-0000-0000-0000-00000000000c'; -- Corazon (Valencia Adventist)
update public.profiles set blood_type = 'A+', region = 'Region X (Northern Mindanao)',  city = 'Valencia City',  is_available = false, is_doctor = false,
  avatar_url = 'https://api.dicebear.com/9.x/avataaars/svg?seed=Melinda%20Torres&backgroundColor=4d5e5a'
  where id = '00000000-0000-0000-0000-00000000000d'; -- Melinda (Valencia Medical Hospital)
update public.profiles set blood_type = 'AB-', region = 'Region X (Northern Mindanao)',  city = 'Valencia City',    is_available = false,
  is_doctor = true, doctor_license_id = 'PRC-0033120', specialization = 'General Surgery', contact_number = '0921-222-3344',
  avatar_url = 'https://api.dicebear.com/9.x/avataaars/svg?seed=Rodrigo%20Bautista&backgroundColor=6d2a2a'
  where id = '00000000-0000-0000-0000-00000000000e'; -- Rodrigo (La Viña General, also a doctor)

-- v4.1: Teresita Uy — business admin of Abella Midway Hospital.
update public.profiles set blood_type = 'A-', region = 'Region X (Northern Mindanao)',  city = 'Valencia City', is_available = false, is_doctor = false,
  avatar_url = 'https://api.dicebear.com/9.x/avataaars/svg?seed=Teresita%20Uy&backgroundColor=7a5a2a'
  where id = '00000000-0000-0000-0000-000000000012'; -- Teresita (Abella Midway)

-- v4: doctor credentials are already created by the trigger from the
-- sign-up metadata; enrich with location + photos.
update public.profiles set blood_type = 'O+', region = 'Region X (Northern Mindanao)',  city = 'Valencia City',        is_available = false,
  avatar_url = 'https://api.dicebear.com/9.x/avataaars/svg?seed=Elena%20Ramos&backgroundColor=7a4a21'
  where id = '00000000-0000-0000-0000-00000000000f'; -- Dr. Elena Ramos
update public.profiles set blood_type = 'A-', region = 'Region X (Northern Mindanao)',  city = 'Valencia City',   is_available = false,
  avatar_url = 'https://api.dicebear.com/9.x/avataaars/svg?seed=Marco%20Aquino&backgroundColor=33566b'
  where id = '00000000-0000-0000-0000-000000000010'; -- Dr. Marco Aquino
update public.profiles set blood_type = 'B+', region = 'Region X (Northern Mindanao)',  city = 'Valencia City',  is_available = false,
  avatar_url = 'https://api.dicebear.com/9.x/avataaars/svg?seed=Liza%20Domingo&backgroundColor=6b3b52'
  where id = '00000000-0000-0000-0000-000000000011'; -- Dr. Liza Domingo

-- ------------------------------------------------------------
-- 3. Promote Ana to administrator.
--    The protect_role trigger exists precisely so nobody can grant
--    themselves admin. Bootstrap requires temporarily disabling that
--    one trigger from the SQL editor (a service-role-only action).
--    Afterwards, ALL further role changes go through admin_set_role().
-- ------------------------------------------------------------
alter table public.profiles disable trigger protect_role;
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-000000000001';
alter table public.profiles enable trigger protect_role;

-- ------------------------------------------------------------
-- 4. Hospitals (v4: with admins, descriptions + photos)
-- ------------------------------------------------------------
insert into public.hospitals (id, admin_id, name, region, city, address, contact_number, description, photo_url, status, notes) values
  ('00000000-0000-0000-0000-00000000aa01', '00000000-0000-0000-0000-00000000000c',
   'Valencia Adventist Medical Center', 'Region X (Northern Mindanao)', 'Valencia City',
   'Sayre Highway, Barangay Poblacion, Valencia City, Bukidnon', '(088) 828-7777',
   'A faith-based non-stock, non-profit tertiary hospital in the heart of Valencia City with a 24/7 blood bank, trauma center and maternal care services. Valencia Adventist coordinates volunteer donors with its on-duty physicians so every unit is screened and witnessed before transfusion.',
   'https://picsum.photos/seed/valenciaadventist/1200/560', 'verified', 'License verified by administrator.'),
  ('00000000-0000-0000-0000-00000000aa02', '00000000-0000-0000-0000-00000000000d',
   'Valencia Medical Hospital', 'Region X (Northern Mindanao)', 'Valencia City',
   'Sayre Highway, Barangay Poblacion, Valencia City, Bukidnon', '(088) 828-8888',
   'A general hospital serving Valencia City and neighboring Bukidnon municipalities, housing a blood bank, dialysis unit and surgical complex. Its physician-led donor program witnesses every HemaMatch transaction held on site.',
   'https://picsum.photos/seed/valenciamedical/1200/560', 'verified', 'License verified by administrator.'),
  ('00000000-0000-0000-0000-00000000aa03', '00000000-0000-0000-0000-00000000000e',
   'La Viña General Hospital', 'Region X (Northern Mindanao)', 'Valencia City',
   'National Highway, Barangay La Viña, Valencia City, Bukidnon', '(088) 828-9999',
   'A general hospital in the La Viña district of Valencia City, with an emergency blood reserve and an outpatient transfusion unit. Managed by Dr. Rodrigo Bautista, a practicing general surgeon who also witnesses donations personally.',
   'https://picsum.photos/seed/lavinageneral/1200/560', 'pending', 'Awaiting license confirmation.'),
  ('00000000-0000-0000-0000-00000000aa04', '00000000-0000-0000-0000-000000000012',
   'Abella Midway Hospital', 'Region X (Northern Mindanao)', 'Valencia City',
   'Sayre Highway, Barangay Poblacion, Valencia City, Bukidnon', '(088) 828-6666',
   'A community hospital serving central Bukidnon from Valencia City, operating a blood bank with 24/7 transfusion services. Its physician-led donor program screens and witnesses every HemaMatch donation held on site.',
   'https://picsum.photos/seed/abellamidway/1200/560', 'verified', 'License verified by administrator.')
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- 5. Doctor rosters + one PENDING application (demo of the
--    apply -> admin verifies -> accepted flow)
-- ------------------------------------------------------------
insert into public.hospital_doctors (id, hospital_id, doctor_id, status, application_note, reviewed_by, reviewed_at) values
  ('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000aa01', '00000000-0000-0000-0000-00000000000f',
   'accepted', 'Internal medicine consultant at Valencia Adventist since 2021.', '00000000-0000-0000-0000-00000000000c', now()),
  ('40000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000aa01', '00000000-0000-0000-0000-000000000010',
   'accepted', 'Hematologist — handles the blood bank referrals.', '00000000-0000-0000-0000-00000000000c', now()),
  ('40000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-00000000aa02', '00000000-0000-0000-0000-000000000011',
   'accepted', 'Pediatrician covering the NICU transfusion cases.', '00000000-0000-0000-0000-00000000000d', now()),
  ('40000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-00000000aa01', '00000000-0000-0000-0000-000000000011',
   'pending', 'I also hold clinic hours at the Valencia City health office and can witness donations there.', null, null)
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- 6. Demo blood requests (v4: with preferred donor type)
-- ------------------------------------------------------------
-- ------------------------------------------------------------
-- 6. Demo blood requests (v4.1: preferred donor types as an array,
--    every request carries a hospital — it is required now)
-- ------------------------------------------------------------
insert into public.donation_requests (
  id, requester_id, blood_type, preferred_donor_types, units_needed, region, hospital_id, urgency, needed_by, description, status
) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000009', 'O+', '{O-}', 3,
   'Region X (Northern Mindanao)', '00000000-0000-0000-0000-00000000aa01', 'critical', current_date + 7,
   'Patient scheduled for major surgery at Valencia Adventist Medical Center needs O+ blood. Coordination with the hospital blood bank is ongoing.',
   'pending'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000006', 'B+', '{}', 4,
   'Region X (Northern Mindanao)', '00000000-0000-0000-0000-00000000aa02', 'urgent', current_date + 5,
   'Father needs B+ units for an operation at Valencia Medical Hospital. Donors matched through this app will still go through standard screening.',
   'accepted'),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000004', 'B-', '{}', 3,
   'Region X (Northern Mindanao)', '00000000-0000-0000-0000-00000000aa01', 'critical', current_date + 3,
   'Brother needs B- blood for an emergency procedure at Valencia Adventist Medical Center. Looking for donors.',
   'accepted')
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- 7. Donor acceptances (v4: donors + assigned doctors / witnesses)
-- ------------------------------------------------------------
insert into public.donor_acceptances (id, request_id, donor_id, doctor_id, status) values
  ('50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002',
   '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000011', 'accepted'),
  ('50000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000003',
   '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000f', 'accepted')
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- 8. Donation offers (v3 — the "donate" side)
-- ------------------------------------------------------------
insert into public.donation_offers (id, donor_id, note, status) values
  ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002',
   'Universal donor (O-) here. I usually donate on weekends at blood banks around Valencia City. Message me anytime.', 'open'),
  ('30000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003',
   'Willing to travel within Valencia City and nearby Bukidnon municipalities. Prefer weekends.', 'open'),
  ('30000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000004',
   'Available weekday mornings. Regular donor at Valencia Adventist Medical Center blood bank.', 'open'),
  ('30000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000007',
   'Based in Valencia City — happy to help patients anywhere in Bukidnon.', 'open'),
  ('30000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-00000000000a',
   'O- donor in Valencia City. I can reach any hospital in Bukidnon with a day''s notice.', 'open'),
  ('30000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000006',
   'Pausing for now — back after my next eligibility date. Thank you!', 'paused')
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- 9. Hospital notifications (v4 — the business admin's inbox)
--    (The seeded requests above fire the notify_request_hospital
--    trigger on first run; these add a doctor-application and a
--    donor-accepted event so the demo panel is populated.)
-- ------------------------------------------------------------
insert into public.hospital_notifications (id, hospital_id, type, title, body, request_id, actor_id, read) values
  ('60000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000aa01', 'doctor_application',
   'New doctor application',
   'Dr. Liza Domingo (PRC-0055993, Pediatrics) applied to join Valencia Adventist Medical Center.',
   null, '00000000-0000-0000-0000-000000000011', false),
  ('60000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000aa01', 'donor_accepted',
   'A donor accepted a request at your hospital',
   'Maria Santos accepted the B- request of Angela Reyes — assigned doctor: Dr. Elena Ramos.',
   '10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', true)
on conflict (id) do nothing;


-- ------------------------------------------------------------
-- 9b. USER NOTIFICATIONS (v6.10 — every role's inbox)
--     Fixed UUIDs + ON CONFLICT DO NOTHING: idempotent. Mirrors what
--     the v6.10 triggers emit, so every demo account opens the app
--     with a populated bell + notifications tab on FIRST seed run
--     (later runs rely on live trigger emission).
-- ------------------------------------------------------------
insert into public.user_notifications (id, recipient_id, type, title, body, request_id, actor_id, read) values
  -- Maria (O- donor): confirmations for her two acceptances
  ('70000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'donor_accepted',
   'You accepted a request',
   'You are now a donor on the A+ request from Juan Dela Cruz — assigned doctor: Dr. Liza Domingo.',
   '10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', false),
  ('70000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'donor_accepted',
   'You accepted a request',
   'You are now a donor on the B- request from Angela Reyes — assigned doctor: Dr. Elena Ramos.',
   '10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', true),
  -- Juan (requester): a donor was found for his A+ request
  ('70000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003', 'donor_accepted',
   'A donor accepted your request',
   'Maria Santos accepted your A+ request — assigned doctor: Dr. Liza Domingo.',
   '10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', false),
  -- Angela (requester): donor + status for her B- request
  ('70000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000004', 'donor_accepted',
   'A donor accepted your request',
   'Maria Santos accepted your B- request — assigned doctor: Dr. Elena Ramos.',
   '10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', false),
  ('70000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000004', 'request_status',
   'Your request changed status',
   'Your B- request (3 units) changed status from pending to accepted.',
   '10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', false),
  -- Grace (requester): status of her live O+ request
  ('70000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000009', 'request_status',
   'Your request changed status',
   'Your O+ request (2 units) changed status from pending to pending — edited details.',
   '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000009', false),
  -- Dr. Ramos (doctor): witness assignment
  ('70000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-00000000000f', 'assignment',
   'You were assigned to a donation',
   'You are the witness doctor for the acceptance of donor Maria Santos on the B- request from Angela Reyes.',
   '10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', false),
  -- Dr. Domingo (doctor): witness assignment + application outcome
  ('70000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000011', 'assignment',
   'You were assigned to a donation',
   'You are the witness doctor for the acceptance of donor Maria Santos on the A+ request from Juan Dela Cruz.',
   '10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', false),
  ('70000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000011', 'doctor_application',
   'Your hospital application was accepted',
   'Your application to Valencia Medical Hospital was accepted.',
   null, '00000000-0000-0000-0000-00000000000d', true),
  -- Ana (admin): platform digest
  ('70000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000001', 'request_status',
   'A request changed status',
   'The B- request from Angela Reyes changed status from pending to accepted.',
   '10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', false)
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- Demo credentials summary (also shown as quick-fill chips in the app)
--   admin@demo.com        / admin123    — administrator (Ana Villanueva)
--   maria@demo.com        / maria123    — O- donor, Valencia City (universal donor)
--   grace@demo.com        / grace123    — AB+ requester with a live O+ request
--   paolo@demo.com        / paolo123    — O- donor, Valencia City
--   sofia@demo.com        / sofia123    — B- donor, Valencia City
--   biz.stmary@demo.com   / biz12345    — business: admin of Valencia Adventist (name kept for login demo)
--   biz.central@demo.com  / biz12345    — business: admin of Valencia Medical (name kept for login demo)
--   biz.davao@demo.com    / biz12345    — business: admin of La Viña General (also a doctor; login kept)
--   dr.ramos@demo.com     / doctor123   — doctor: Valencia Adventist roster
--   dr.aquino@demo.com    / doctor123   — doctor: Valencia Adventist roster
--   dr.domingo@demo.com   / doctor123   — doctor: Valencia Medical roster (+ pending Valencia Adventist application)
-- ------------------------------------------------------------

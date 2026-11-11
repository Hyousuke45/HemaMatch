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
--        maria@demo.com / maria123        (O- donor, NCR)
--        grace@demo.com / grace123        (AB+ requester, NCR)
--        biz.stmary@demo.com / biz12345   (business — St. Mary admin)
--        dr.ramos@demo.com / doctor123    (doctor — St. Mary roster)
--        ...and more donors/doctors
--   3. Demo blood requests, donor acceptances (with assigned doctors),
--      hospital doctor applications and hospital notifications.
--
-- The seed is idempotent: fixed UUIDs + ON CONFLICT DO NOTHING, so it can
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
  created_at, updated_at, confirmation_token, recovery_token
)
values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated',
   'admin@demo.com',   crypt('admin123',   gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Ana Villanueva","account_type":"user"}'::jsonb, now(), now(), '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated',
   'maria@demo.com',   crypt('maria123',   gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Maria Santos","account_type":"user"}'::jsonb, now(), now(), '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated',
   'juan@demo.com',   crypt('juan123',    gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Juan Dela Cruz","account_type":"user"}'::jsonb, now(), now(), '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated',
   'angela@demo.com', crypt('angela123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Angela Reyes","account_type":"user"}'::jsonb, now(), now(), '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated',
   'pedro@demo.com',  crypt('pedro123',   gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Pedro Ramos","account_type":"user"}'::jsonb, now(), now(), '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000006', 'authenticated', 'authenticated',
   'miguel@demo.com', crypt('miguel123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Miguel Lopez","account_type":"user"}'::jsonb, now(), now(), '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000007', 'authenticated', 'authenticated',
   'cristina@demo.com', crypt('cristina123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Cristina Flores","account_type":"user"}'::jsonb, now(), now(), '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000008', 'authenticated', 'authenticated',
   'rafael@demo.com', crypt('rafael123', gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Rafael Mendoza","account_type":"user"}'::jsonb, now(), now(), '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000009', 'authenticated', 'authenticated',
   'grace@demo.com',  crypt('grace123',   gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Grace Lim","account_type":"user"}'::jsonb, now(), now(), '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-00000000000a', 'authenticated', 'authenticated',
   'paolo@demo.com',  crypt('paolo123',   gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Paolo Villanueva","account_type":"user"}'::jsonb, now(), now(), '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-00000000000b', 'authenticated', 'authenticated',
   'sofia@demo.com',  crypt('sofia123',   gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Sofia Garcia","account_type":"user"}'::jsonb, now(), now(), '', ''),
  -- v4: business (hospital admin) accounts. NOTE: their hospitals are
  -- inserted directly below (the handle_new_user hospital creation is
  -- skipped because these users carry no hospital_* metadata).
  ('00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-00000000000c', 'authenticated', 'authenticated',
   'biz.stmary@demo.com',   crypt('biz12345',   gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Corazon Santiago","account_type":"business"}'::jsonb, now(), now(), '', ''),
  ('00000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-00000000000d', 'authenticated', 'authenticated',
   'biz.central@demo.com',  crypt('biz12345',   gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Melinda Torres","account_type":"business"}'::jsonb, now(), now(), '', ''),
  ('00000000-0000-0000-0000-00000000000e', '00000000-0000-0000-0000-00000000000e', 'authenticated', 'authenticated',
   'biz.davao@demo.com',    crypt('biz12345',   gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Rodrigo Bautista","account_type":"business"}'::jsonb, now(), now(), '', ''),
  -- v4.1: fourth business admin (Western Visayas hospital)
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000012', 'authenticated', 'authenticated',
   'biz.western@demo.com',  crypt('biz12345',   gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Teresita Uy","account_type":"business"}'::jsonb, now(), now(), '', ''),
  -- v4: doctor accounts
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-00000000000f', 'authenticated', 'authenticated',
   'dr.ramos@demo.com',   crypt('doctor123',  gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Dr. Elena Ramos","account_type":"doctor","doctor_license_id":"PRC-0092381","specialization":"Internal Medicine","doctor_contact_number":"0917-123-4567"}'::jsonb, now(), now(), '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000010', 'authenticated', 'authenticated',
   'dr.aquino@demo.com',  crypt('doctor123',  gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Dr. Marco Aquino","account_type":"doctor","doctor_license_id":"PRC-0077120","specialization":"Hematology","doctor_contact_number":"0918-555-1234"}'::jsonb, now(), now(), '', ''),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000011', 'authenticated', 'authenticated',
   'dr.domingo@demo.com', crypt('doctor123',  gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}'::jsonb, '{"full_name":"Dr. Liza Domingo","account_type":"doctor","doctor_license_id":"PRC-0055993","specialization":"Pediatrics","doctor_contact_number":"0920-777-8899"}'::jsonb, now(), now(), '', '')
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
-- 2. Profiles (created by the trigger; enrich with donor data)
--    avatar_url uses DiceBear (free, no account needed) so the
--    profile-photo feature is visible in the demo without any
--    Cloudinary setup. Replace freely with real Cloudinary URLs.
-- ------------------------------------------------------------
update public.profiles set blood_type = 'O+', region = 'NCR (Metro Manila)',           city = 'Manila',        is_available = false
  where id = '00000000-0000-0000-0000-000000000001'; -- Ana (admin)
update public.profiles set blood_type = 'O-', region = 'NCR (Metro Manila)',           city = 'Quezon City',   is_available = true,
  avatar_url = 'https://api.dicebear.com/9.x/avataaars/svg?seed=Maria%20Santos&backgroundColor=c1912f'
  where id = '00000000-0000-0000-0000-000000000002'; -- Maria
update public.profiles set blood_type = 'A+', region = 'Region IV-A (CALABARZON)',      city = 'Antipolo',      is_available = true,
  avatar_url = 'https://api.dicebear.com/9.x/avataaars/svg?seed=Juan%20Dela%20Cruz&backgroundColor=b6452c'
  where id = '00000000-0000-0000-0000-000000000003'; -- Juan
update public.profiles set blood_type = 'B+', region = 'NCR (Metro Manila)',           city = 'Makati',        is_available = true,
  avatar_url = 'https://api.dicebear.com/9.x/avataaars/svg?seed=Angela%20Reyes&backgroundColor=8a3033'
  where id = '00000000-0000-0000-0000-000000000004'; -- Angela
update public.profiles set blood_type = 'B+', region = 'NCR (Metro Manila)',           city = 'Pasig',         is_available = false
  where id = '00000000-0000-0000-0000-000000000005'; -- Pedro (intentionally unavailable: shows the availability filter)
update public.profiles set blood_type = 'AB-', region = 'Region III (Central Luzon)',  city = 'San Fernando',  is_available = false, -- paused listing (sync rule)
  avatar_url = 'https://api.dicebear.com/9.x/avataaars/svg?seed=Miguel%20Lopez&backgroundColor=4d5e5a'
  where id = '00000000-0000-0000-0000-000000000006'; -- Miguel
update public.profiles set blood_type = 'O+', region = 'Region VI (Western Visayas)',  city = 'Iloilo City',   is_available = true,
  avatar_url = 'https://api.dicebear.com/9.x/avataaars/svg?seed=Cristina%20Flores&backgroundColor=946b2d'
  where id = '00000000-0000-0000-0000-000000000007'; -- Cristina
update public.profiles set blood_type = 'A-', region = 'Region XI (Davao Region)',     city = 'Davao City',    is_available = true
  where id = '00000000-0000-0000-0000-000000000008'; -- Rafael
update public.profiles set blood_type = 'AB+', region = 'NCR (Metro Manila)',          city = 'Taguig',        is_available = false
  where id = '00000000-0000-0000-0000-000000000009'; -- Grace
update public.profiles set blood_type = 'O-', region = 'Region IV-A (CALABARZON)',      city = 'Bacoor',        is_available = true,
  avatar_url = 'https://api.dicebear.com/9.x/avataaars/svg?seed=Paolo%20Villanueva&backgroundColor=6b8e9e'
  where id = '00000000-0000-0000-0000-00000000000a'; -- Paolo
update public.profiles set blood_type = 'B-', region = 'NCR (Metro Manila)',           city = 'Mandaluyong',   is_available = true
  where id = '00000000-0000-0000-0000-00000000000b'; -- Sofia

-- v4: business admins (Corazon, Melinda, Rodrigo). Rodrigo is ALSO a
-- licensed doctor — the "business inherits doctor" demo.
update public.profiles set blood_type = 'O+', region = 'NCR (Metro Manila)',          city = 'Manila',        is_available = false, is_doctor = false,
  avatar_url = 'https://api.dicebear.com/9.x/avataaars/svg?seed=Corazon%20Santiago&backgroundColor=8a6d1f'
  where id = '00000000-0000-0000-0000-00000000000c'; -- Corazon (St. Mary)
update public.profiles set blood_type = 'A+', region = 'Region III (Central Luzon)',  city = 'San Fernando',  is_available = false, is_doctor = false,
  avatar_url = 'https://api.dicebear.com/9.x/avataaars/svg?seed=Melinda%20Torres&backgroundColor=4d5e5a'
  where id = '00000000-0000-0000-0000-00000000000d'; -- Melinda (Central Luzon)
update public.profiles set blood_type = 'AB-', region = 'Region XI (Davao Region)',   city = 'Davao City',    is_available = false,
  is_doctor = true, doctor_license_id = 'PRC-0033120', specialization = 'General Surgery', contact_number = '0921-222-3344',
  avatar_url = 'https://api.dicebear.com/9.x/avataaars/svg?seed=Rodrigo%20Bautista&backgroundColor=6d2a2a'
  where id = '00000000-0000-0000-0000-00000000000e'; -- Rodrigo (Davao, also a doctor)

-- v4.1: Teresita Uy — business admin of the Western Visayas hospital.
update public.profiles set blood_type = 'A-', region = 'Region VI (Western Visayas)', city = 'Iloilo City', is_available = false, is_doctor = false,
  avatar_url = 'https://api.dicebear.com/9.x/avataaars/svg?seed=Teresita%20Uy&backgroundColor=7a5a2a'
  where id = '00000000-0000-0000-0000-000000000012'; -- Teresita (Western Visayas)

-- v4: doctor credentials are already created by the trigger from the
-- sign-up metadata; enrich with location + photos.
update public.profiles set blood_type = 'O+', region = 'NCR (Metro Manila)',          city = 'Manila',        is_available = false,
  avatar_url = 'https://api.dicebear.com/9.x/avataaars/svg?seed=Elena%20Ramos&backgroundColor=7a4a21'
  where id = '00000000-0000-0000-0000-00000000000f'; -- Dr. Elena Ramos
update public.profiles set blood_type = 'A-', region = 'NCR (Metro Manila)',          city = 'Quezon City',   is_available = false,
  avatar_url = 'https://api.dicebear.com/9.x/avataaars/svg?seed=Marco%20Aquino&backgroundColor=33566b'
  where id = '00000000-0000-0000-0000-000000000010'; -- Dr. Marco Aquino
update public.profiles set blood_type = 'B+', region = 'Region III (Central Luzon)',  city = 'San Fernando',  is_available = false,
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
   'St. Mary General Hospital', 'NCR (Metro Manila)', 'Manila',
   '123 España Boulevard, Sampaloc, Manila', '(02) 8123-4567',
   'A tertiary general hospital in the heart of Manila with a 24/7 blood bank, trauma center and maternal care services. St. Mary coordinates volunteer donors with its on-duty physicians so every unit is screened and witnessed before transfusion.',
   'https://picsum.photos/seed/stmaryhospital/1200/560', 'verified', 'License verified by administrator.'),
  ('00000000-0000-0000-0000-00000000aa02', '00000000-0000-0000-0000-00000000000d',
   'Central Luzon Medical Center', 'Region III (Central Luzon)', 'San Fernando',
   'McArthur Highway, San Fernando, Pampanga', '(045) 456-7890',
   'The referral medical center of Central Luzon, housing a regional blood center, dialysis unit and surgical complex. Its physician-led donor program witnesses every HemaMatch transaction held on site.',
   'https://picsum.photos/seed/centralclinic/1200/560', 'verified', 'License verified by administrator.'),
  ('00000000-0000-0000-0000-00000000aa03', '00000000-0000-0000-0000-00000000000e',
   'Davao Regional Hospital', 'Region XI (Davao Region)', 'Davao City',
   'Southern Philippine Avenue, Davao City', '(082) 222-3333',
   'Mindanao''s largest government regional hospital, with an emergency blood reserve and an outpatient transfusion unit. Managed by Dr. Rodrigo Bautista, a practicing general surgeon who also witnesses donations personally.',
   'https://picsum.photos/seed/davaoregional/1200/560', 'pending', 'Awaiting license confirmation.'),
  ('00000000-0000-0000-0000-00000000aa04', '00000000-0000-0000-0000-000000000012',
   'Western Visayas Medical Center', 'Region VI (Western Visayas)', 'Iloilo City',
   'Quezon Street, Mandurriao, Iloilo City', '(033) 321-1234',
   'The premiere medical center of Western Visayas, operating a regional blood bank with 24/7 transfusion services. Its physician-led donor program screens and witnesses every HemaMatch donation held on site.',
   'https://picsum.photos/seed/westernvisayas/1200/560', 'verified', 'License verified by administrator.')
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- 5. Doctor rosters + one PENDING application (demo of the
--    apply -> admin verifies -> accepted flow)
-- ------------------------------------------------------------
insert into public.hospital_doctors (id, hospital_id, doctor_id, status, application_note, reviewed_by, reviewed_at) values
  ('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000aa01', '00000000-0000-0000-0000-00000000000f',
   'accepted', 'Internal medicine consultant at St. Mary since 2021.', '00000000-0000-0000-0000-00000000000c', now()),
  ('40000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000aa01', '00000000-0000-0000-0000-000000000010',
   'accepted', 'Hematologist — handles the blood bank referrals.', '00000000-0000-0000-0000-00000000000c', now()),
  ('40000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-00000000aa02', '00000000-0000-0000-0000-000000000011',
   'accepted', 'Pediatrician covering the NICU transfusion cases.', '00000000-0000-0000-0000-00000000000d', now()),
  ('40000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-00000000aa01', '00000000-0000-0000-0000-000000000011',
   'pending', 'I also hold clinic hours in Manila and can witness donations there.', null, null)
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
   'NCR (Metro Manila)', '00000000-0000-0000-0000-00000000aa01', 'critical', current_date + 7,
   'Patient scheduled for major surgery at St. Mary General Hospital needs O+ blood. Coordination with the hospital blood bank is ongoing.',
   'pending'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000006', 'B+', '{}', 4,
   'Region III (Central Luzon)', '00000000-0000-0000-0000-00000000aa02', 'urgent', current_date + 5,
   'Father needs B+ units for an operation at Central Luzon Medical Center. Donors matched through this app will still go through standard screening.',
   'accepted'),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000004', 'B-', '{}', 3,
   'NCR (Metro Manila)', '00000000-0000-0000-0000-00000000aa01', 'critical', current_date + 3,
   'Brother needs B- blood for an emergency procedure at St. Mary General Hospital. Looking for donors.',
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
   'Universal donor (O-) here. I usually donate on weekends — Quezon City or nearby Manila blood banks. Message me anytime.', 'open'),
  ('30000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003',
   'Willing to travel within CALABARZON and nearby Metro Manila hospitals. Prefer weekends.', 'open'),
  ('30000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000004',
   'Available weekday mornings. Regular donor at St. Mary General Hospital blood bank.', 'open'),
  ('30000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000007',
   'Based in Iloilo City — happy to help patients anywhere in Western Visayas.', 'open'),
  ('30000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-00000000000a',
   'O- donor in Bacoor. I can reach Makati or Taguig hospitals with a day''s notice.', 'open'),
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
   'Dr. Liza Domingo (PRC-0055993, Pediatrics) applied to join St. Mary General Hospital.',
   null, '00000000-0000-0000-0000-000000000011', false),
  ('60000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000aa01', 'donor_accepted',
   'A donor accepted a request at your hospital',
   'Maria Santos accepted the B- request of Angela Reyes — assigned doctor: Dr. Elena Ramos.',
   '10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', true)
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- Demo credentials summary (also shown as quick-fill chips in the app)
--   admin@demo.com        / admin123    — administrator (Ana Villanueva)
--   maria@demo.com        / maria123    — O- donor, NCR (universal donor)
--   grace@demo.com        / grace123    — AB+ requester with a live O+ request
--   paolo@demo.com        / paolo123    — O- donor, CALABARZON
--   sofia@demo.com        / sofia123    — B- donor, NCR
--   biz.stmary@demo.com   / biz12345    — business: admin of St. Mary General
--   biz.central@demo.com  / biz12345    — business: admin of Central Luzon MC
--   biz.davao@demo.com    / biz12345    — business: admin of Davao Regional (also a doctor)
--   dr.ramos@demo.com     / doctor123   — doctor: St. Mary roster
--   dr.aquino@demo.com    / doctor123   — doctor: St. Mary roster
--   dr.domingo@demo.com   / doctor123   — doctor: Central Luzon roster (+ pending St. Mary application)
-- ------------------------------------------------------------

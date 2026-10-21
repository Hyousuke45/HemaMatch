-- ============================================================
-- HemaMatch — seed data for Supabase (Phase 2)
-- ============================================================
-- Run AFTER schema.sql. These rows make the deployed app immediately
-- demonstrable. Demo user accounts are created through the app's
-- registration page (Supabase Auth owns auth.users), then you can
-- promote one to admin with the SQL note at the bottom.
-- ============================================================

-- Verified hospitals (needed by the request form)
insert into public.hospitals (name, region, city, address, contact_number, status, notes) values
  ('St. Mary General Hospital', 'NCR (Metro Manila)', 'Manila', '123 España Boulevard, Sampaloc, Manila', '(02) 8123-4567', 'verified', 'License verified by administrator.'),
  ('Central Luzon Medical Center', 'Region III (Central Luzon)', 'San Fernando', 'McArthur Highway, San Fernando, Pampanga', '(045) 456-7890', 'verified', 'License verified by administrator.'),
  ('Davao Regional Hospital', 'Region XI (Davao Region)', 'Davao City', 'Southern Philippine Avenue, Davao City', '(082) 222-3333', 'pending', 'Awaiting license confirmation.');

-- ------------------------------------------------------------
-- AFTER registering your demo accounts through the app, promote the
-- admin account. Replace the email and run in the SQL editor:
--
-- update public.profiles
-- set role = 'admin'
-- where id = (select id from auth.users where email = 'your-admin@demo.com');
--
-- (Run this once from the SQL editor as the service role — regular users
--  can never do this, which is exactly the anti-escalation rule.)
-- ------------------------------------------------------------

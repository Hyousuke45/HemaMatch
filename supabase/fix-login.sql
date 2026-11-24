-- ============================================================
-- HemaMatch — v6.9 LOGIN FIX (standalone patch)
-- ============================================================
-- Run this ONCE in the Supabase SQL editor if demo logins fail with:
--   "Database error querying schema"      (doctor accounts), or
--   "Invalid email or password."          (business accounts).
--
-- It repairs EXISTING auth.users/auth.identities rows in place:
--   1. GoTrue (Supabase Auth) scans several auth.users columns into
--      NON-NULLABLE Go strings. Rows inserted by the earlier seed left
--      them NULL, so sign-in crashed with a generic 500 "Database
--      error querying schema" (supabase/auth#1940). We backfill '' /
--      epoch values. (Re-running supabase/seed.sql after this is safe.)
--   2. Three business rows (biz.stmary/biz.central/biz.davao@demo.com)
--      were seeded with instance_id set to their own user UUID
--      instead of the project's all-zeros instance UUID, so GoTrue's
--      lookup missed them entirely -> "Invalid email or password".
--   3. Guarantees an auth.identities row (email provider) for every
--      demo account, with email_verified true.
--
-- Safe to re-run (idempotent). Applies ONLY to @demo.com accounts;
-- real users are never touched.
-- ============================================================

begin;

-- 1) NULL -> '' / epoch on every GoTrue-scanned column
update auth.users
set email_change                = coalesce(email_change, ''),
    email_change_token_new      = coalesce(email_change_token_new, ''),
    email_change_token_current  = coalesce(email_change_token_current, ''),
    email_change_sent_at        = coalesce(email_change_sent_at, '1970-01-01 00:00:00+00'),
    confirmation_token          = coalesce(confirmation_token, ''),
    recovery_token              = coalesce(recovery_token, ''),
    email_confirmed_at          = coalesce(email_confirmed_at, now()),
    encrypted_password          = coalesce(
      encrypted_password,
      case email
        when 'admin@demo.com'    then crypt('admin123',   gen_salt('bf'))
        when 'maria@demo.com'    then crypt('maria123',   gen_salt('bf'))
        when 'juan@demo.com'     then crypt('juan123',    gen_salt('bf'))
        when 'angela@demo.com'   then crypt('angela123',  gen_salt('bf'))
        when 'pedro@demo.com'    then crypt('pedro123',   gen_salt('bf'))
        when 'miguel@demo.com'   then crypt('miguel123',  gen_salt('bf'))
        when 'cristina@demo.com' then crypt('cristina123',gen_salt('bf'))
        when 'rafael@demo.com'   then crypt('rafael123',  gen_salt('bf'))
        when 'grace@demo.com'    then crypt('grace123',   gen_salt('bf'))
        when 'paolo@demo.com'    then crypt('paolo123',   gen_salt('bf'))
        when 'sofia@demo.com'    then crypt('sofia123',   gen_salt('bf'))
        when 'biz.stmary@demo.com'   then crypt('biz12345', gen_salt('bf'))
        when 'biz.central@demo.com'  then crypt('biz12345', gen_salt('bf'))
        when 'biz.davao@demo.com'    then crypt('biz12345', gen_salt('bf'))
        when 'biz.western@demo.com'  then crypt('biz12345', gen_salt('bf'))
        when 'dr.ramos@demo.com'     then crypt('doctor123', gen_salt('bf'))
        when 'dr.aquino@demo.com'    then crypt('doctor123', gen_salt('bf'))
        when 'dr.domingo@demo.com'   then crypt('doctor123', gen_salt('bf'))
        else encrypted_password
      end)
where email like '%@demo.com';

-- 2) instance_id -> the project's all-zeros instance UUID
update auth.users
set instance_id = '00000000-0000-0000-0000-000000000000'
where email like '%@demo.com'
  and (instance_id is null or instance_id <> '00000000-0000-0000-0000-000000000000');

-- 3) missing email-provider identity rows
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

commit;

-- Verification: should print one row per demo account, all non-null.
select email,
       instance_id = '00000000-0000-0000-0000-000000000000' as instance_ok,
       (email_change is not null
        and email_change_token_new is not null
        and email_change_token_current is not null
        and email_change_sent_at is not null
        and email_confirmed_at is not null
        and encrypted_password is not null) as gotrue_columns_ok,
       exists (select 1 from auth.identities i
               where i.user_id = auth.users.id and i.provider = 'email') as identity_ok
from auth.users
where email like '%@demo.com'
order by email;

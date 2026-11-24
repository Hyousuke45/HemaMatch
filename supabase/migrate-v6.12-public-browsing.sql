-- ============================================================
-- HemaMatch v6.12 — PUBLIC (signed-out) BROWSING MIGRATION
-- ------------------------------------------------------------
-- Run this ONCE in the Supabase SQL editor after deploying v6.12.
-- It is additive and re-runnable (drops before creates) — the signed-in
-- policies are untouched.
--
-- What it enables, mirroring the mock backend's public functions:
--   1. anon + authenticated can SELECT VERIFIED hospitals
--      (hospitals_select_public).
--   2. anon + authenticated can SELECT actionable donation_requests
--      (pending / accepted / completed) — requests_select_public.
--   3. anon + authenticated can SELECT ACCEPTED hospital_doctors rows
--      (roster names behind the doctor_count on public hospital pages).
--   4. get_hospital_detail_public(uuid) — SECURITY DEFINER RPC that
--      returns the full verified-hospital detail (description, location,
--      contact, stats and the doctor roster with license IDs + contact
--      numbers) WITHOUT requiring a session, plus a minimal admin
--      display name for the "Hospital admin" card.
--   5. get_public_profile_min(uuid) — first name + last initial only,
--      for the public request detail page. Not wired to any UI list
--      (public request rows show "A HemaMatch member") but available so
--      the anon get_public_profile_min call never crashes.
--
-- What it deliberately does NOT do:
--   * No anon access to profiles (the RPCs resolve names instead —
--     profiles stay authenticated-only, so donors' contact details,
--     blood types and emails are never anon-readable).
--   * No anon access to donor_acceptances, donation_records,
--     conversations, notifications or offers.
--   * Unverified hospitals and non-actionable (cancelled/draft)
--     requests stay invisible to signed-out visitors AND to regular
--     signed-in users alike.
-- ============================================================

-- 1) VERIFIED hospitals are publicly readable.
drop policy if exists "hospitals_select_public" on public.hospitals;
create policy "hospitals_select_public"
  on public.hospitals for select to anon, authenticated
  using (status = 'verified');

-- 2) Actionable requests are publicly readable.
drop policy if exists "requests_select_public" on public.donation_requests;
create policy "requests_select_public"
  on public.donation_requests for select to anon, authenticated
  using (status in ('pending', 'accepted', 'completed'));

-- 3) Accepted roster rows are publicly readable (doctor names on the
--    public hospital detail via the RPC below; this policy backs the
--    doctor_count on the public LIST page).
drop policy if exists "hospital_doctors_select_public" on public.hospital_doctors;
create policy "hospital_doctors_select_public"
  on public.hospital_doctors for select to anon, authenticated
  using (status = 'accepted');

-- 4) Full detail for a VERIFIED hospital, no session required.
--    Same shape as get_hospital_detail (admin/roster/stats), plus the
--    admin's display name only — no other profile fields.
create or replace function public.get_hospital_detail_public(p_hospital_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_hospital record;
  v_admin_name text;
  v_doctors jsonb;
  v_open integer;
  v_completed integer;
begin
  select * into v_hospital from public.hospitals where id = p_hospital_id;
  if v_hospital.id is null then
    return null;
  end if;
  if v_hospital.status <> 'verified' then
    raise exception 'This hospital is not verified yet.';
  end if;

  select full_name into v_admin_name
  from public.profiles where id = v_hospital.admin_id;

  select coalesce(jsonb_agg(row_to_json(d) order by d.full_name), '[]'::jsonb)
  into v_doctors
  from public.get_hospital_doctors(p_hospital_id) d;

  select count(*) into v_open from public.donation_requests
    where hospital_id = p_hospital_id and status in ('pending', 'accepted');
  select count(*) into v_completed from public.donation_requests
    where hospital_id = p_hospital_id and status = 'completed';

  return jsonb_build_object(
    'id', v_hospital.id,
    'name', v_hospital.name,
    'description', v_hospital.description,
    'region', v_hospital.region,
    'city', v_hospital.city,
    'address', v_hospital.address,
    'contact_number', v_hospital.contact_number,
    'photo_url', v_hospital.photo_url,
    'status', v_hospital.status,
    'admin_id', v_hospital.admin_id,
    'admin_name', v_admin_name,
    'admin_avatar_url', null,
    'admin_is_doctor', false,
    'doctor_count', coalesce(jsonb_array_length(v_doctors), 0),
    'doctors', v_doctors,
    'stats', jsonb_build_object(
      'open_requests', v_open,
      'completed_requests', v_completed
    )
  );
end;
$$;

grant execute on function public.get_hospital_detail_public(uuid) to anon, authenticated;

-- 5) Minimal public profile: first name + last initial ONLY, batch form.
--    Used by the public requests pages (falls back to 'A HemaMatch
--    member' when the profile is missing). Nothing else is exposed.
create or replace function public.get_public_profile_min(p_user_ids uuid[])
returns table (id uuid, display_name text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id,
         case
           when p.full_name is null then 'A HemaMatch member'
           else regexp_replace(p.full_name, '^(\S+)\s+(\S)\S*.*$', '\1 \2.')
         end as display_name
  from public.profiles p
  where p.id = any(p_user_ids);
$$;

grant execute on function public.get_public_profile_min(uuid[]) to anon, authenticated;

-- Done. Signed-out visitors can now:
--   * browse and search VERIFIED hospitals (/hospitals, /hospitals/:id)
--   * browse actionable blood requests (/requests, /requests/:id)
-- while every write, message, profile, acceptance and record stays
-- behind the signed-in policies exactly as before.

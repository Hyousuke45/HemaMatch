-- ============================================================
-- HemaMatch — PostgreSQL schema for Supabase (Phase 2)
-- ============================================================
-- Run order: paste this whole file into the Supabase SQL Editor and run it
-- once. It creates every table, relationship, constraint, trigger and RLS
-- policy the application needs.
--
-- SECURITY MODEL (the part to explain at your defense):
--   1. Supabase Auth manages credentials. We never store passwords.
--   2. Row Level Security (RLS) is enabled on EVERY table. Even if someone
--      bypasses the React app entirely, the database itself refuses
--      unauthorized reads/writes.
--   3. Users can NEVER change their own role: the protect_role_column
--      trigger forces role back to its old value unless the current
--      session belongs to an admin.
--   4. Only the URL + anon key exist in the browser. The service_role key
--      is never used client-side.
--   5. Important status changes are written to activity_logs by triggers —
--      client code has NO insert/update/delete permission on that table.
-- ============================================================

-- ============================================================
-- 1. PROFILES (1:1 with auth.users)
-- Purpose: application data for each account: display name, role,
-- donor attributes (blood type, region, availability).
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(full_name) between 2 and 80),
  role text not null default 'user' check (role in ('user', 'doctor', 'business', 'admin')),
  blood_type text check (blood_type in ('O-','O+','A-','A+','B-','B+','AB-','AB+')),
  region text,
  city text,
  is_available boolean not null default true,
  avatar_url text check (avatar_url is null or (avatar_url ~ '^https?://.' and char_length(avatar_url) <= 500)),
  -- v4: doctor credentials (doctor accounts, and business admins who are
  -- also licensed doctors — the "Business inherits Doctor" rule)
  is_doctor boolean not null default false,
  doctor_license_id text check (doctor_license_id is null or char_length(doctor_license_id) <= 40),
  specialization text check (specialization is null or char_length(specialization) <= 80),
  contact_number text check (contact_number is null or char_length(contact_number) <= 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- v3 upgrade path: databases created with the v2 schema get the new
-- column idempotently (fresh databases already have it above).
alter table public.profiles add column if not exists avatar_url text
  check (avatar_url is null or (avatar_url ~ '^https?://.' and char_length(avatar_url) <= 500));

-- v4 upgrade path: doctor credentials + widened role check. The old
-- constraint is dropped and re-created with the new types.
alter table public.profiles add column if not exists is_doctor boolean not null default false;
alter table public.profiles add column if not exists doctor_license_id text
  check (doctor_license_id is null or char_length(doctor_license_id) <= 40);
alter table public.profiles add column if not exists specialization text
  check (specialization is null or char_length(specialization) <= 80);
alter table public.profiles add column if not exists contact_number text
  check (contact_number is null or char_length(contact_number) <= 40);
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('user', 'doctor', 'business', 'admin'));

alter table public.profiles enable row level security;

-- Automatically create a profile row whenever a user signs up,
-- and write the registration event to the audit log.
-- v4: the account type (user / doctor / business) travels in
-- raw_user_meta_data; business registrations also create their hospital
-- record with the account as its admin.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := coalesce(new.raw_user_meta_data->>'account_type', 'user');
  v_hospital_id uuid;
begin
  if v_role not in ('user', 'doctor', 'business') then
    v_role := 'user';
  end if;

  insert into public.profiles (id, full_name, role, is_doctor, doctor_license_id, specialization, contact_number)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    v_role,
    false,
    case when v_role = 'doctor' then nullif(new.raw_user_meta_data->>'doctor_license_id', '') end,
    nullif(new.raw_user_meta_data->>'specialization', ''),
    nullif(new.raw_user_meta_data->>'doctor_contact_number', '')
  );

  if v_role = 'business' then
    insert into public.hospitals (admin_id, name, region, city, address, contact_number, description, status)
    values (
      new.id,
      new.raw_user_meta_data->>'hospital_name',
      new.raw_user_meta_data->>'hospital_region',
      nullif(new.raw_user_meta_data->>'hospital_city', ''),
      nullif(new.raw_user_meta_data->>'hospital_address', ''),
      nullif(new.raw_user_meta_data->>'hospital_contact_number', ''),
      coalesce(new.raw_user_meta_data->>'hospital_description', ''),
      'pending'
    )
    returning id into v_hospital_id;

    insert into public.activity_logs (actor_id, action, entity, entity_id, details)
    values (new.id, 'hospital.created', 'hospitals', v_hospital_id,
            'Hospital record created by business registration (' ||
            coalesce(new.raw_user_meta_data->>'hospital_name', '?') || ') — awaiting verification.');
  end if;

  insert into public.activity_logs (actor_id, action, entity, entity_id, details)
  values (new.id, 'user.registered', 'profiles', new.id,
          'New ' || v_role || ' account registered (' || new.email || ').');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ANTI-ESCALATION: a user can never grant themselves admin.
create or replace function public.protect_role_column()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_role text;
begin
  if new.role <> old.role then
    select role into current_role from public.profiles where id = auth.uid();
    if coalesce(current_role, 'user') <> 'admin' then
      new.role := old.role; -- silently revert; only admins may change roles
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_role on public.profiles;
create trigger protect_role
  before update on public.profiles
  for each row execute function public.protect_role_column();

-- Generic updated_at maintainer
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_updated_at on public.profiles;
create trigger touch_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- RLS policies for profiles
create policy "profiles_select_authenticated"
  on public.profiles for select to authenticated
  using (true); -- donor directory: name, blood type, region, availability only. Email lives in auth and is never exposed.

create policy "profiles_update_own"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());
-- No INSERT policy: rows are created only by the handle_new_user trigger.
-- No DELETE policy: profiles are never deleted from the client.

-- ============================================================
-- 2. HOSPITALS (v4: business-administered hospitals)
-- Each hospital has a business admin (profiles.role = 'business'),
-- a public description + photo (the detail-page background) and a
-- doctor roster. Verification stays platform-admin-only.
-- ============================================================
create table if not exists public.hospitals (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.profiles(id) on delete set null,
  name text not null unique check (char_length(name) between 3 and 120),
  region text not null,
  city text,
  address text,
  contact_number text,
  description text not null default '' check (char_length(description) <= 1200),
  photo_url text check (photo_url is null or (photo_url ~ '^https?://.' and char_length(photo_url) <= 500)),
  status text not null default 'pending' check (status in ('pending', 'verified', 'rejected')),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- v4 upgrade path
alter table public.hospitals add column if not exists admin_id uuid references public.profiles(id) on delete set null;
alter table public.hospitals add column if not exists description text not null default '' check (char_length(description) <= 1200);
alter table public.hospitals add column if not exists photo_url text check (photo_url is null or (photo_url ~ '^https?://.' and char_length(photo_url) <= 500));

alter table public.hospitals enable row level security;

drop trigger if exists touch_updated_at on public.hospitals;
create trigger touch_updated_at
  before update on public.hospitals
  for each row execute function public.set_updated_at();

create policy "hospitals_select_authenticated"
  on public.hospitals for select to authenticated
  using (true); -- regular UI filters to verified client-side; admin UI shows all

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin');
$$;

-- The hospital's own business admin.
create function public.is_hospital_admin(hospital_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.hospitals h
    where h.id = hospital_id and h.admin_id = auth.uid()
  );
$$;

-- Hospital records are created ONLY by administrators (platform) or by
-- the handle_new_user trigger (business registration).
create policy "hospitals_insert_admin" on public.hospitals for insert to authenticated with check (public.is_admin());
-- Updates: platform admins (full) OR the hospital's own business admin
-- (public profile fields only — guarded by the protect_hospital_fields trigger).
create policy "hospitals_update_admin"
  on public.hospitals for update to authenticated
  using (public.is_admin() or public.is_hospital_admin(id))
  with check (public.is_admin() or public.is_hospital_admin(id));
-- No DELETE policy: hospital records are never hard-deleted (audit integrity).

-- v4: a business admin may only change the PUBLIC profile fields — name,
-- region and status are protected (verification is platform-admin-only).
create or replace function public.protect_hospital_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    new.name := old.name;
    new.region := old.region;
    new.status := old.status;
    new.notes := old.notes;
    new.admin_id := old.admin_id;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_hospital on public.hospitals;
create trigger protect_hospital
  before update on public.hospitals
  for each row execute function public.protect_hospital_fields();

-- Log every hospital status change (trigger-written, clients cannot forge)
create or replace function public.log_hospital_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status <> old.status then
    insert into public.activity_logs (actor_id, action, entity, entity_id, details)
    values (
      auth.uid(),
      'hospital.status_changed',
      'hospitals',
      new.id,
      'Status changed from ' || old.status || ' to ' || new.status ||
      case when new.notes <> '' then ' — ' || new.notes else '' end
    );
  end if;
  return new;
end;
$$;

drop trigger if exists hospital_change_logged on public.hospitals;
create trigger hospital_change_logged
  after update on public.hospitals
  for each row execute function public.log_hospital_change();

-- ============================================================
-- 3. DONATION REQUESTS
-- Statuses: pending -> accepted -> completed | cancelled
-- ============================================================
create table if not exists public.donation_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  blood_type text not null check (blood_type in ('O-','O+','A-','A+','B-','B+','AB-','AB+')),
  preferred_donor_types text[] not null default '{}'
    check (preferred_donor_types <@ array['O-','O+','A-','A+','B-','B+','AB-','AB+']::text[]),
  units_needed integer not null default 1 check (units_needed between 1 and 10),
  region text not null,
  hospital_id uuid not null references public.hospitals(id),
  urgency text not null default 'routine' check (urgency in ('routine', 'urgent', 'critical')),
  needed_by date,
  description text check (char_length(coalesce(description, '')) <= 600),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- v4.1 upgrade path (run on an existing v4 database):
--   1. the single preferred_donor_type column becomes the multi-select
--      preferred_donor_types array (from the compatibility checkboxes);
--   2. the hospital becomes REQUIRED — the donation process happens
--      there. Requests without a hospital are backfilled to St. Mary
--      General Hospital (the demo hospital); adjust the backfill to
--      your data before running on a real database.
alter table public.donation_requests
  add column if not exists preferred_donor_types text[] not null default '{}';

-- Carry the old single choice over as a one-element array, then drop
-- the old column. Skipped on fresh databases (the column never exists).
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'donation_requests'
      and column_name = 'preferred_donor_type'
  ) then
    update public.donation_requests
      set preferred_donor_types = array[preferred_donor_type]::text[]
      where preferred_donor_type is not null;
    alter table public.donation_requests drop column preferred_donor_type;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'preferred_donor_types_valid'
      and conrelid = 'public.donation_requests'::regclass
  ) then
    alter table public.donation_requests
      add constraint preferred_donor_types_valid check (
        preferred_donor_types <@ array['O-','O+','A-','A+','B-','B+','AB-','AB+']::text[]
      );
  end if;
end $$;
-- Backfill missing hospitals, then enforce NOT NULL.
update public.donation_requests r
  set hospital_id = h.id
  from public.hospitals h
  where h.name = 'St. Mary General Hospital'
    and r.hospital_id is null;
alter table public.donation_requests alter column hospital_id set not null;

alter table public.donation_requests enable row level security;

drop trigger if exists touch_updated_at on public.donation_requests;
create trigger touch_updated_at
  before update on public.donation_requests
  for each row execute function public.set_updated_at();

-- Visibility rule: all authenticated users can browse all requests.
create policy "requests_select_authenticated"
  on public.donation_requests for select to authenticated
  using (true);

-- Users create requests only as themselves.
create policy "requests_insert_own"
  on public.donation_requests for insert to authenticated
  with check (requester_id = auth.uid());

-- Requester can edit own row; admin can correct any row; v4: the
-- hospital's business admin and the assigned doctor (witness) may
-- update status too (the guard trigger decides WHICH changes apply).
create policy "requests_update_own_or_admin"
  on public.donation_requests for update to authenticated
  using (
    requester_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.hospitals h
      where h.id = donation_requests.hospital_id and h.admin_id = auth.uid()
    )
    or exists (
      select 1 from public.donor_acceptances a
      where a.request_id = donation_requests.id
        and a.doctor_id = auth.uid()
        and a.status = 'accepted'
    )
  )
  with check (
    requester_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.hospitals h
      where h.id = donation_requests.hospital_id and h.admin_id = auth.uid()
    )
    or exists (
      select 1 from public.donor_acceptances a
      where a.request_id = donation_requests.id
        and a.doctor_id = auth.uid()
        and a.status = 'accepted'
    )
  );
-- Column/status legality is enforced by the trigger below (not just here):
-- a crafted UPDATE cannot mark someone else's request Completed.
-- No DELETE policy: cancelling is a status, not a deletion.

-- Status transition guard + audit
-- v4: the hospital's business admin and the ASSIGNED DOCTOR (the
-- middleman / witness of a transaction) may also manage the status.
create or replace function public.guard_request_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_requester boolean := new.requester_id = auth.uid();
  is_admin boolean := public.is_admin();
  is_hospital_admin boolean := exists (
    select 1 from public.hospitals h where h.id = old.hospital_id and h.admin_id = auth.uid()
  );
  is_assigned_doctor boolean := exists (
    select 1 from public.donor_acceptances a
    where a.request_id = old.id and a.doctor_id = auth.uid() and a.status = 'accepted'
  );
  v_reason text := coalesce(nullif(current_setting('app.status_reason', true), ''), '');
begin
  -- Only authorized users reach this trigger (see UPDATE policy), but
  -- re-check who is allowed to do WHAT:
  if new.status = 'completed' and not (is_admin or is_hospital_admin or is_assigned_doctor) then
    raise exception 'Only an administrator, the hospital, or the assigned doctor can mark a request as completed.';
  end if;

  -- Requesters may edit details only while the request is still Pending.
  if new.status = old.status and is_requester and not is_admin and not is_hospital_admin and old.status <> 'pending' then
    raise exception 'Only pending requests can be edited.';
  end if;

  if is_requester and not is_admin and not is_hospital_admin and not is_assigned_doctor and old.status <> 'pending' then
    -- after Pending, the owner may only move to accepted/cancelled
    if new.status not in ('accepted', 'cancelled') then
      raise exception 'After a request leaves Pending, only an administrator, the hospital or the assigned doctor can change its status.';
    end if;
  end if;

  -- legal transition map
  if new.status <> old.status then
    if not (
      (old.status = 'pending'   and new.status in ('accepted', 'cancelled')) or
      (old.status = 'accepted'  and new.status in ('completed', 'cancelled'))
    ) then
      raise exception 'Illegal status transition from % to %', old.status, new.status;
    end if;

    insert into public.activity_logs (actor_id, action, entity, entity_id, details)
    values (
      auth.uid(),
      'request.status_changed',
      'donation_requests',
      new.id,
      'Status changed from ' || old.status || ' to ' || new.status ||
      case when v_reason <> '' then ' — reason: ' || v_reason else '' end ||
      case when is_admin and not is_requester then ' (administrator action)' else '' end
    );
    -- v_reason is set transaction-locally by set_request_status(); clear it so
    -- later statements in the same transaction never inherit a stale reason.
    perform set_config('app.status_reason', '', true);
  elsif is_requester and old.status = 'pending' then
    insert into public.activity_logs (actor_id, action, entity, entity_id, details)
    values (auth.uid(), 'request.updated', 'donation_requests', new.id, 'Request details edited by requester.');
  end if;

  return new;
end;
$$;

drop trigger if exists request_guard on public.donation_requests;
create trigger request_guard
  before update on public.donation_requests
  for each row execute function public.guard_request_update();

-- ============================================================
-- 4. DONATION RECORDS (outcome records — the "transactions")
-- A successful record closes its request as completed.
-- v4: each record carries the ASSIGNED DOCTOR (the witness), and may be
-- written by the platform admin, the hospital's business admin, or the
-- assigned doctor.
-- ============================================================
create table if not exists public.donation_records (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.donation_requests(id) on delete cascade,
  donor_id uuid references public.profiles(id),
  doctor_id uuid references public.profiles(id),
  outcome text not null check (outcome in ('successful', 'failed')),
  reason text not null default '' check (char_length(reason) <= 300),
  recorded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint successful_requires_reason check (outcome = 'successful' or char_length(reason) > 0)
);

-- v4 upgrade path: the assigned doctor (witness)
alter table public.donation_records add column if not exists doctor_id uuid references public.profiles(id);

alter table public.donation_records enable row level security;

create policy "records_select_admin_or_involved"
  on public.donation_records for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.donation_requests r
      where r.id = donation_records.request_id and r.requester_id = auth.uid()
    )
    or donor_id = auth.uid()
    or doctor_id = auth.uid()
    or exists (
      select 1 from public.donation_requests r
        join public.hospitals h on h.id = r.hospital_id
      where r.id = donation_records.request_id and h.admin_id = auth.uid()
    )
  );

-- v4: insert — platform admin, the request hospital's business admin, or a
-- doctor assigned to the request (the witness / source of truth).
create policy "records_insert_authorized"
  on public.donation_records for insert to authenticated
  with check (
    recorded_by = auth.uid()
    and (
      public.is_admin()
      or exists (
        select 1 from public.donation_requests r
          join public.hospitals h on h.id = r.hospital_id
        where r.id = donation_records.request_id and h.admin_id = auth.uid()
      )
      or exists (
        select 1 from public.donor_acceptances a
        where a.request_id = donation_records.request_id
          and a.doctor_id = auth.uid()
          and a.status = 'accepted'
      )
    )
  );

-- A successful record closes the request (kept in sync by trigger)
create or replace function public.on_record_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.outcome = 'successful' then
    update public.donation_requests
      set status = 'completed', updated_at = now()
      where id = new.request_id and status = 'accepted';
    insert into public.activity_logs (actor_id, action, entity, entity_id, details)
    values (new.recorded_by, 'request.status_changed', 'donation_requests', new.request_id,
            'Status changed from accepted to completed (successful donation record).');
  end if;

  insert into public.activity_logs (actor_id, action, entity, entity_id, details)
  values (new.recorded_by, 'record.created', 'donation_records', new.id,
          'Outcome recorded: ' || new.outcome || case when new.reason <> '' then ' — ' || new.reason else '' end);

  return new;
end;
$$;

drop trigger if exists record_created on public.donation_records;
create trigger record_created
  after insert on public.donation_records
  for each row execute function public.on_record_created();
-- No UPDATE or DELETE policies: outcome records are insert-only for audit integrity.

-- ============================================================
-- 5. MESSAGING (1:1 conversations + v4 hospital conversations)
-- conversations -> conversation_participants -> messages
-- v4: a conversation may instead be linked to a HOSPITAL — messages go
-- to the hospital's admin and the chat header shows the hospital name.
-- ============================================================
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.donation_requests(id),
  hospital_id uuid references public.hospitals(id),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

-- v4 upgrade path
alter table public.conversations add column if not exists hospital_id uuid references public.hospitals(id);

alter table public.conversations enable row level security;

create table if not exists public.conversation_participants (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  unique (conversation_id, user_id)
);

alter table public.conversation_participants enable row level security;

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id),
  content text not null check (char_length(content) between 1 and 2000),
  created_at timestamptz not null default now()
);

alter table public.messages enable row level security;

-- Conversations are visible only to their participants.
create policy "conversations_select_participants"
  on public.conversations for select to authenticated
  using (
    exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = conversations.id and cp.user_id = auth.uid()
    )
  );
-- No INSERT policy for conversations: created only by the RPC below.

-- Trusted server-side function: atomically creates a conversation with
-- its two participants (client code cannot construct one directly).
create or replace function public.start_conversation(p_other_user uuid, p_request_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conversation_id uuid;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.';
  end if;
  if p_other_user = auth.uid() then
    raise exception 'You cannot start a conversation with yourself.';
  end if;
  if not exists (select 1 from public.profiles where id = p_other_user) then
    raise exception 'That user does not exist.';
  end if;

  -- reuse an existing conversation between the same two people for this request
  select c.id into v_conversation_id
  from public.conversations c
  join public.conversation_participants a on a.conversation_id = c.id and a.user_id = auth.uid()
  join public.conversation_participants b on b.conversation_id = c.id and b.user_id = p_other_user
  where p_request_id is null or c.request_id = p_request_id
  limit 1;

  if v_conversation_id is not null then
    return v_conversation_id;
  end if;

  insert into public.conversations (request_id, created_by)
  values (p_request_id, auth.uid())
  returning id into v_conversation_id;

  insert into public.conversation_participants (conversation_id, user_id)
  values (v_conversation_id, auth.uid()), (v_conversation_id, p_other_user);

  return v_conversation_id;
end;
$$;

grant execute on function public.start_conversation(uuid, uuid) to authenticated;

-- v4: message a HOSPITAL directly — the conversation's other participant
-- is the hospital's admin, and hospital_id marks the thread so the UI can
-- show the hospital name in the header.
create or replace function public.start_hospital_conversation(p_hospital_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conversation_id uuid;
  v_admin_id uuid;
  v_status text;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.';
  end if;

  select admin_id, status into v_admin_id, v_status from public.hospitals where id = p_hospital_id;
  if v_admin_id is null and v_status is null then
    raise exception 'Hospital not found.';
  end if;
  if v_status <> 'verified' and not public.is_admin() then
    raise exception 'This hospital is not verified yet.';
  end if;
  if v_admin_id is null then
    raise exception 'This hospital has no admin account yet — nobody would receive the message.';
  end if;
  if v_admin_id = auth.uid() then
    raise exception 'This is your hospital''s inbox — messages from other users arrive here.';
  end if;

  -- reuse the existing hospital conversation
  select c.id into v_conversation_id
  from public.conversations c
  join public.conversation_participants a on a.conversation_id = c.id and a.user_id = auth.uid()
  where c.hospital_id = p_hospital_id
  limit 1;

  if v_conversation_id is not null then
    return v_conversation_id;
  end if;

  insert into public.conversations (request_id, hospital_id, created_by)
  values (null, p_hospital_id, auth.uid())
  returning id into v_conversation_id;

  insert into public.conversation_participants (conversation_id, user_id)
  values (v_conversation_id, auth.uid()), (v_conversation_id, v_admin_id);

  insert into public.activity_logs (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'conversation.created', 'conversations', v_conversation_id,
          'Hospital conversation started (goes to the hospital admin).');

  return v_conversation_id;
end;
$$;

grant execute on function public.start_hospital_conversation(uuid) to authenticated;

-- Only participants may read the messages of a conversation.
create policy "messages_select_participants"
  on public.messages for select to authenticated
  using (
    exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = messages.conversation_id and cp.user_id = auth.uid()
    )
  );

-- Only a participant can send, and only in their own name.
create policy "messages_insert_participant"
  on public.messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = messages.conversation_id and cp.user_id = auth.uid()
    )
  );
-- No UPDATE / DELETE policies: chat history is immutable.

-- Supabase Realtime: new messages stream to signed-in participants.
alter publication supabase_realtime add table public.messages;

-- ============================================================
-- 6. MATCHING (preliminary filtering, executed server-side)
-- Returns ABO-compatible + available donors for a request.
-- The function checks that the caller owns the request (or is admin)
-- BEFORE returning any donor rows.
-- ============================================================
create or replace function public.get_matching_donors(p_request_id uuid)
returns table (
  id uuid,
  full_name text,
  blood_type text,
  region text,
  city text,
  same_region boolean,
  preferred_type boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.donation_requests;
begin
  select * into v_request from public.donation_requests where id = p_request_id;
  if v_request.id is null then
    raise exception 'Request not found.';
  end if;
  if v_request.requester_id <> auth.uid() and not public.is_admin() then
    raise exception 'Matching results are available only to the requester and administrators.';
  end if;

  return query
  select p.id, p.full_name, p.blood_type, p.region, p.city,
         (p.region = v_request.region) as same_region,
         -- v4.1: donors whose type is among the requester's checked
         -- preferred types rank first.
         (p.blood_type = any (coalesce(v_request.preferred_donor_types, '{}'::text[]))) as preferred_type
  from public.profiles p
  where p.blood_type is not null
    and p.is_available
    and p.id <> v_request.requester_id
    -- standard ABO/Rh compatibility chart (preliminary filtering ONLY):
    and (
      (v_request.blood_type = 'O-' and p.blood_type in ('O-')) or
      (v_request.blood_type = 'O+' and p.blood_type in ('O-','O+')) or
      (v_request.blood_type = 'A-' and p.blood_type in ('O-','A-')) or
      (v_request.blood_type = 'A+' and p.blood_type in ('O-','O+','A-','A+')) or
      (v_request.blood_type = 'B-' and p.blood_type in ('O-','B-')) or
      (v_request.blood_type = 'B+' and p.blood_type in ('O-','O+','B-','B+')) or
      (v_request.blood_type = 'AB-' and p.blood_type in ('O-','A-','B-','AB-')) or
      (v_request.blood_type = 'AB+' and p.blood_type in ('O-','O+','A-','A+','B-','B+','AB-','AB+'))
    )
  order by preferred_type desc, same_region desc, p.full_name asc;
end;
$$;

grant execute on function public.get_matching_donors(uuid) to authenticated;

-- ============================================================
-- 7. ACTIVITY LOGS (audit trail — trigger-written)
-- Clients can NEVER write here: no insert/update/delete policies exist.
-- ============================================================
create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id),
  action text not null,
  entity text not null,
  entity_id uuid,
  details text not null default '',
  created_at timestamptz not null default now()
);

alter table public.activity_logs enable row level security;

create policy "logs_select_admin"
  on public.activity_logs for select to authenticated
  using (public.is_admin());

-- Log profile changes minimally (no PII beyond names).
-- Role changes are skipped here: admin_set_role() writes its own, clearer entry.
create or replace function public.log_profile_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role then
    return new; -- logged by admin_set_role instead
  end if;
  insert into public.activity_logs (actor_id, action, entity, entity_id, details)
  values (new.id, 'profile.updated', 'profiles', new.id, 'Donor profile updated.');
  return new;
end;
$$;

drop trigger if exists profile_change_logged on public.profiles;
create trigger profile_change_logged
  after update on public.profiles
  for each row execute function public.log_profile_change();

-- ============================================================
-- 8. INDEXES (for the filters the app actually uses)
-- ============================================================
create index if not exists idx_requests_status on public.donation_requests(status);
create index if not exists idx_requests_blood_type on public.donation_requests(blood_type);
create index if not exists idx_requests_region on public.donation_requests(region);
create index if not exists idx_requests_requester on public.donation_requests(requester_id);
create index if not exists idx_profiles_donor on public.profiles(blood_type, is_available);
create index if not exists idx_messages_conversation on public.messages(conversation_id, created_at);
create index if not exists idx_participants_user on public.conversation_participants(user_id);
create index if not exists idx_hospitals_status on public.hospitals(status);
create index if not exists idx_logs_created on public.activity_logs(created_at desc);
create index if not exists idx_offers_status on public.donation_offers(status);

-- ============================================================
-- 9. HEMAMATCH PHASE 2 EXTENSIONS
-- Security-definer RPCs the browser calls instead of raw writes:
--   set_request_status() — every status change + its REASON is logged
--                         server-side (clients cannot write activity_logs)
--   admin_list_users()   — admin user directory (email lives in auth, so
--                          profiles alone cannot show it)
--   admin_set_role()     — the ONLY way a role can change (audit + self-
--                          demotion lockout guard)
--   get_public_stats()   — anonymous landing-page counters (aggregates only,
--                          no personal data)
--   admin_get_stats()    — admin dashboard counters in one round trip
-- ============================================================

-- 9.1 Participants may read membership rows of their own conversations
--     (needed to render "who is the other participant" in the UI).
create policy "participants_select_participant"
  on public.conversation_participants for select to authenticated
  using (
    exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = conversation_participants.conversation_id
        and cp.user_id = auth.uid()
    )
  );

-- 9.2 Status transitions with a REASON (recorded in the activity log).
--     The reason travels via a transaction-local setting that the
--     guard_request_update trigger reads — one logging point, no forgery:
--     a client can never write activity_logs directly.
create or replace function public.set_request_status(
  p_request_id uuid,
  p_new_status text,
  p_reason text default ''
)
returns public.donation_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.donation_requests;
  v_requester boolean;
  v_admin boolean;
begin
  select * into r from public.donation_requests where id = p_request_id;
  if r.id is null then
    raise exception 'Request not found.';
  end if;

  v_requester := r.requester_id = auth.uid();
  v_admin := public.is_admin();
  if not v_requester and not v_admin then
    raise exception 'Only the requester or an administrator can change this status.';
  end if;
  if p_new_status not in ('pending', 'accepted', 'completed', 'cancelled') then
    raise exception 'Invalid status.';
  end if;
  if p_new_status = 'completed' and not v_admin then
    raise exception 'Only an administrator can mark a request as completed.';
  end if;
  if p_new_status = r.status then
    return r; -- no-op, nothing logged
  end if;

  -- Hand the reason to the trigger (validated + logged there, once).
  perform set_config('app.status_reason', left(coalesce(p_reason, ''), 300), true);

  update public.donation_requests
    set status = p_new_status
    where id = p_request_id
    returning * into r;
  return r;
end;
$$;

grant execute on function public.set_request_status(uuid, text, text) to authenticated;

-- 9.3 Log request creation (audit parity with the mock backend)
create or replace function public.log_request_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.activity_logs (actor_id, action, entity, entity_id, details)
  values (
    new.requester_id, 'request.created', 'donation_requests', new.id,
    new.blood_type || ' request created (' || new.region || ', ' || new.urgency || ').'
  );
  return new;
end;
$$;

drop trigger if exists request_created_logged on public.donation_requests;
create trigger request_created_logged
  after insert on public.donation_requests
  for each row execute function public.log_request_created();

-- 9.4 Outcome-record validation, enforced in the DATABASE:
--     accepted requests only, and the recorded donor must be ABO-compatible.
--     (The admin UI only offers compatible donors — this is the backstop.)
create or replace function public.validate_donation_record()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_request_type text;
  v_donor_type text;
begin
  select status, blood_type into v_status, v_request_type
  from public.donation_requests where id = new.request_id;
  if v_status is distinct from 'accepted' then
    raise exception 'Outcome records can only be added to accepted requests.';
  end if;

  if new.donor_id is not null then
    select blood_type into v_donor_type from public.profiles where id = new.donor_id;
    if v_donor_type is not null and not (
      (v_request_type = 'O-' and v_donor_type in ('O-')) or
      (v_request_type = 'O+' and v_donor_type in ('O-','O+')) or
      (v_request_type = 'A-' and v_donor_type in ('O-','A-')) or
      (v_request_type = 'A+' and v_donor_type in ('O-','O+','A-','A+')) or
      (v_request_type = 'B-' and v_donor_type in ('O-','B-')) or
      (v_request_type = 'B+' and v_donor_type in ('O-','O+','B-','B+')) or
      (v_request_type = 'AB-' and v_donor_type in ('O-','A-','B-','AB-')) or
      (v_request_type = 'AB+' and v_donor_type in ('O-','O+','A-','A+','B-','B+','AB-','AB+'))
    ) then
      raise exception 'The selected donor has an incompatible blood type for this request.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists validate_record on public.donation_records;
create trigger validate_record
  before insert on public.donation_records
  for each row execute function public.validate_donation_record();

-- 9.5 Admin user directory. Emails live in auth.users, so the directory
--     needs a SECURITY DEFINER function. Access is admin-only, checked
--     inside the function itself.
create or replace function public.admin_list_users()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Administrator access required.';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', p.id,
      'email', u.email,
      'verified', (u.email_confirmed_at is not null),
      'full_name', p.full_name,
      'role', p.role,
      'blood_type', p.blood_type,
      'region', p.region,
      'city', p.city,
      'is_available', p.is_available,
      'avatar_url', p.avatar_url,
      'is_doctor', p.is_doctor,
      'doctor_license_id', p.doctor_license_id,
      'specialization', p.specialization,
      'contact_number', p.contact_number,
      'created_at', p.created_at
    ) order by p.full_name)
    from public.profiles p
    join auth.users u on u.id = p.id
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.admin_list_users() to authenticated;

-- 9.6 The ONLY path that can change a role. Admin-only, never your own
--     account (lockout protection), always audited.
create or replace function public.admin_set_role(p_target_user uuid, p_new_role text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_name text;
  v_old_role text;
begin
  if not public.is_admin() then
    raise exception 'Administrator access required.';
  end if;
  if p_target_user = auth.uid() then
    raise exception 'You cannot change your own role.';
  end if;
  if p_new_role not in ('user', 'admin') then
    raise exception 'Invalid role.';
  end if;

  select full_name, role into v_target_name, v_old_role
  from public.profiles where id = p_target_user;
  if v_target_name is null then
    raise exception 'User not found.';
  end if;
  if v_old_role = p_new_role then
    return jsonb_build_object('id', p_target_user, 'role', p_new_role);
  end if;

  update public.profiles set role = p_new_role where id = p_target_user;

  insert into public.activity_logs (actor_id, action, entity, entity_id, details)
  values (
    auth.uid(), 'user.role_changed', 'profiles', p_target_user,
    'Role of ' || v_target_name || ' changed to ' || p_new_role || '.'
  );

  return jsonb_build_object('id', p_target_user, 'role', p_new_role, 'full_name', v_target_name);
end;
$$;

grant execute on function public.admin_set_role(uuid, text) to authenticated;

-- 9.7 Anonymous landing-page counters. Aggregates only — no personal data.
create or replace function public.get_public_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_donors integer;
  v_open integer;
  v_completed integer;
  v_hospitals integer;
begin
  select count(*) into v_donors from public.profiles
    where blood_type is not null and is_available;
  select count(*) into v_open from public.donation_requests where status = 'pending';
  select count(*) into v_completed from public.donation_requests where status = 'completed';
  select count(*) into v_hospitals from public.hospitals where status = 'verified';
  return jsonb_build_object(
    'donors', v_donors,
    'open_requests', v_open,
    'completed', v_completed,
    'hospitals', v_hospitals
  );
end;
$$;

grant execute on function public.get_public_stats() to anon, authenticated;

-- 9.8 Admin dashboard stats in one round trip (live counts, never hardcoded).
create or replace function public.admin_get_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Administrator access required.';
  end if;
  return jsonb_build_object(
    'total_users', (select count(*) from public.profiles),
    'available_donors', (select count(*) from public.profiles
                          where blood_type is not null and is_available),
    'open_offers', (select count(*) from public.donation_offers where status = 'open'),
    'doctors', (select count(*) from public.profiles where role = 'doctor'),
    'businesses', (select count(*) from public.profiles where role = 'business'),
    'requests', jsonb_build_object(
      'total', (select count(*) from public.donation_requests),
      'pending', (select count(*) from public.donation_requests where status = 'pending'),
      'accepted', (select count(*) from public.donation_requests where status = 'accepted'),
      'completed', (select count(*) from public.donation_requests where status = 'completed'),
      'cancelled', (select count(*) from public.donation_requests where status = 'cancelled')
    ),
    'hospitals', jsonb_build_object(
      'total', (select count(*) from public.hospitals),
      'verified', (select count(*) from public.hospitals where status = 'verified'),
      'pending', (select count(*) from public.hospitals where status = 'pending'),
      'rejected', (select count(*) from public.hospitals where status = 'rejected')
    ),
    'records', jsonb_build_object(
      'total', (select count(*) from public.donation_records),
      'successful', (select count(*) from public.donation_records where outcome = 'successful'),
      'failed', (select count(*) from public.donation_records where outcome = 'failed')
    ),
    'conversations', (select count(*) from public.conversations)
  );
end;
$$;

grant execute on function public.admin_get_stats() to authenticated;

-- ============================================================
-- 10. HEMAMATCH v3 EXTENSIONS — donation offers + public profiles
-- New in v3:
--   donation_offers  — the "donate" side: one voluntary listing per
--                      donor ('open' = listed + matched, 'paused' = hidden)
--   upsert_my_offer()— the only write path; validates the profile and
--                      keeps profiles.is_available in sync (one source
--                      of truth for "listed")
--   get_public_profile() — directory-safe profile + donation count,
--                      shown ONLY from the request detail page
--   sync_offer_with_availability trigger — the reverse sync: toggling
--                      availability on the profile pauses/reopens the
--                      listing, so the two can never disagree
-- ============================================================

-- 10.1 DONATION OFFERS table
--      Voluntary, non-remunerated listings only. Under RA 7719 the
--      commercial sale of blood is prohibited in the Philippines, so
--      this schema has NO price/compensation columns anywhere.
create table if not exists public.donation_offers (
  id uuid primary key default gen_random_uuid(),
  donor_id uuid not null unique references public.profiles(id) on delete cascade,
  note text not null default '' check (char_length(note) <= 300),
  status text not null default 'open' check (status in ('open', 'paused')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.donation_offers enable row level security;

-- Donor directory: signed-in users may browse open listings.
create policy "offers_select_authenticated"
  on public.donation_offers for select to authenticated
  using (true);

-- Donors manage only their own listing.
create policy "offers_insert_own"
  on public.donation_offers for insert to authenticated
  with check (donor_id = auth.uid());

create policy "offers_update_own"
  on public.donation_offers for update to authenticated
  using (donor_id = auth.uid())
  with check (donor_id = auth.uid());
-- No DELETE policy: listings are paused, never erased (audit integrity).

drop trigger if exists touch_updated_at on public.donation_offers;
create trigger touch_updated_at
  before update on public.donation_offers
  for each row execute function public.set_updated_at();

-- 10.2 Audit logging for listings (trigger-written, like every
--      important change in HemaMatch).
create or replace function public.log_offer_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.activity_logs (actor_id, action, entity, entity_id, details)
    values (new.donor_id, 'offer.created', 'donation_offers', new.id,
            'Donor listing created (' || new.status || ').');
  elsif new.status is distinct from old.status then
    insert into public.activity_logs (actor_id, action, entity, entity_id, details)
    values (new.donor_id, 'offer.status_changed', 'donation_offers', new.id,
            'Donor listing changed from ' || old.status || ' to ' || new.status || '.');
  end if;
  return new;
end;
$$;

drop trigger if exists offer_created_logged on public.donation_offers;
create trigger offer_created_logged
  after insert on public.donation_offers
  for each row execute function public.log_offer_change();

drop trigger if exists offer_change_logged on public.donation_offers;
create trigger offer_change_logged
  after update on public.donation_offers
  for each row execute function public.log_offer_change();

-- 10.3 Reverse sync: toggling availability on the PROFILE pauses/reopens
--      the listing (the upsert_my_offer RPC does the forward sync).
--      This trigger never touches profiles again, so there is no loop.
create or replace function public.sync_offer_with_availability()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_available is distinct from old.is_available then
    if not new.is_available then
      update public.donation_offers
        set status = 'paused', updated_at = now()
        where donor_id = new.id and status = 'open';
    else
      update public.donation_offers
        set status = 'open', updated_at = now()
        where donor_id = new.id and status = 'paused';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_offer_on_availability on public.profiles;
create trigger sync_offer_on_availability
  after update of is_available on public.profiles
  for each row execute function public.sync_offer_with_availability();

-- 10.4 The ONLY write path for listings. Validates that the donor
--      profile is complete (blood type + region required to be listed),
--      upserts the single listing per donor, and syncs availability.
create or replace function public.upsert_my_offer(p_note text, p_status text)
returns public.donation_offers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
  v_offer public.donation_offers;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.';
  end if;
  if p_status not in ('open', 'paused') then
    raise exception 'Invalid listing status.';
  end if;

  select * into v_profile from public.profiles where id = auth.uid();
  if v_profile.id is null then
    raise exception 'Profile not found.';
  end if;
  if p_status = 'open' and (v_profile.blood_type is null or v_profile.region is null) then
    raise exception 'Set your blood type and region in your profile before listing yourself as a donor.';
  end if;

  insert into public.donation_offers (donor_id, note, status)
  values (auth.uid(), left(coalesce(p_note, ''), 300), p_status)
  on conflict (donor_id) do update
    set note = excluded.note,
        status = excluded.status,
        updated_at = now()
  returning * into v_offer;

  -- Forward sync: availability follows the listing (the trigger in
  -- 10.3 sees the same target state, so the two cannot disagree).
  if v_profile.is_available <> (p_status = 'open') then
    update public.profiles
      set is_available = (p_status = 'open')
      where id = auth.uid();
  end if;

  return v_offer;
end;
$$;

grant execute on function public.upsert_my_offer(text, text) to authenticated;

-- 10.5 Directory-safe public profile, shown ONLY from the request detail
--      page (requester or a matched donor). Aggregates the successful-
--      donation count server-side so donation_records rows are never
--      exposed to unrelated users. Email and role are never returned.
create or replace function public.get_public_profile(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
  v_donations integer;
  v_offer_note text;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.';
  end if;

  select * into v_profile from public.profiles where id = p_user_id;
  if v_profile.id is null then
    raise exception 'User not found.';
  end if;

  select count(*) into v_donations from public.donation_records
    where donor_id = p_user_id and outcome = 'successful';
  select note into v_offer_note from public.donation_offers
    where donor_id = p_user_id and status = 'open';

  return jsonb_build_object(
    'id', v_profile.id,
    'full_name', v_profile.full_name,
    'blood_type', v_profile.blood_type,
    'region', v_profile.region,
    'city', v_profile.city,
    'is_available', v_profile.is_available,
    'avatar_url', v_profile.avatar_url,
    'created_at', v_profile.created_at,
    'successful_donations', v_donations,
    'offer_note', v_offer_note,
    'role', v_profile.role,
    'is_doctor', (v_profile.role = 'doctor' or v_profile.is_doctor),
    'specialization', v_profile.specialization,
    'doctor_hospital_name', (
      select h.name from public.hospital_doctors hd
      join public.hospitals h on h.id = hd.hospital_id
      where hd.doctor_id = v_profile.id and hd.status = 'accepted'
      limit 1
    )
  );
end;
$$;

grant execute on function public.get_public_profile(uuid) to authenticated;

-- ============================================================
-- 11. HEMAMATCH v4 EXTENSIONS — account types, hospital rosters,
-- doctor applications, donor acceptances (assigned doctor), hospital
-- notifications and business (hospital admin) panels.
--
-- Client rules implemented here:
--   * Donor/Recipient is the base account; Doctor inherits it and works
--     under a specific hospital; Business (hospital admin) inherits it
--     and additionally inherits Doctor ONLY if the admin is a doctor
--     (profiles.is_doctor).
--   * Requests can carry a preferred donor type (from the compatible
--     donors dropdown).
--   * Attaching a hospital to a request notifies the hospital.
--   * When a donor accepts a request a doctor is assigned to them; they
--     may choose another doctor ONLY from the request's hospital.
--   * Doctors apply to a hospital (license ID + note); the hospital
--     admin verifies and accepts; accepted doctors join the roster.
--   * Hospital conversations: messaging a hospital goes to its admin.
-- ============================================================

-- ------------------------------------------------------------
-- 11.1 HOSPITAL DOCTORS (applications + roster)
-- One ACCEPTED row per doctor (a doctor works under ONE hospital).
-- ------------------------------------------------------------
create table if not exists public.hospital_doctors (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references public.hospitals(id) on delete cascade,
  doctor_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  application_note text not null default '' check (char_length(application_note) <= 500),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (hospital_id, doctor_id)
);

alter table public.hospital_doctors enable row level security;

-- The roster of a hospital is public (the directory shows doctors with
-- their license ID and contact number — client rule).
create policy "hospital_doctors_select_authenticated"
  on public.hospital_doctors for select to authenticated
  using (
    status = 'accepted'
    or doctor_id = auth.uid()
    or exists (
      select 1 from public.hospitals h
      where h.id = hospital_id and h.admin_id = auth.uid()
    )
    or public.is_admin()
  );

-- Doctors apply (or re-apply after a rejection) only in their own name.
create policy "hospital_doctors_insert_own"
  on public.hospital_doctors for insert to authenticated
  with check (
    doctor_id = auth.uid()
    and (status = 'pending')
  );

-- Status is reviewed by the hospital's admin (or a platform admin).
create policy "hospital_doctors_update_admins"
  on public.hospital_doctors for update to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.hospitals h
      where h.id = hospital_id and h.admin_id = auth.uid()
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from public.hospitals h
      where h.id = hospital_id and h.admin_id = auth.uid()
    )
  );
-- No DELETE policy: applications are a record, not a file.

-- The doctor's license + contact number must be on their profile before
-- they can apply (the application form requires them).
create or replace function public.validate_doctor_application()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_license text;
  v_contact text;
begin
  select role, doctor_license_id, contact_number into v_role, v_license, v_contact
  from public.profiles where id = new.doctor_id;

  if v_role <> 'doctor' and not coalesce((select is_doctor from public.profiles where id = new.doctor_id), false) then
    raise exception 'Only doctor accounts can apply to a hospital.';
  end if;
  if coalesce(v_license, '') = '' or coalesce(v_contact, '') = '' then
    raise exception 'Complete your doctor license ID and contact number first.';
  end if;
  return new;
end;
$$;

drop trigger if exists doctor_application_validated on public.hospital_doctors;
create trigger doctor_application_validated
  before insert or update on public.hospital_doctors
  for each row execute function public.validate_doctor_application();

-- Audit-log every application status change.
create or replace function public.log_doctor_application()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_doctor text;
  v_hospital text;
begin
  select full_name into v_doctor from public.profiles where id = new.doctor_id;
  select name into v_hospital from public.hospitals where id = new.hospital_id;

  if TG_OP = 'INSERT' then
    insert into public.activity_logs (actor_id, action, entity, entity_id, details)
    values (new.doctor_id, 'doctor_application.created', 'hospital_doctors', new.id,
            'Doctor applied to ' || coalesce(v_hospital, '?') || '.');
    -- v4 (client rule): the hospital is notified of the application.
    insert into public.hospital_notifications (hospital_id, type, title, body, actor_id)
    values (new.hospital_id, 'doctor_application', 'New doctor application',
            coalesce(v_doctor, 'A doctor') || ' applied to join ' || coalesce(v_hospital, 'the hospital') || '.',
            new.doctor_id);
  else
    if new.status <> old.status then
      insert into public.activity_logs (actor_id, action, entity, entity_id, details)
      values (auth.uid(), 'doctor_application.' || new.status, 'hospital_doctors', new.id,
              'Application of ' || coalesce(v_doctor, 'a doctor') || ' for ' ||
              coalesce(v_hospital, 'a hospital') || ' changed from ' || old.status || ' to ' || new.status || '.');
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists doctor_application_logged on public.hospital_doctors;
create trigger doctor_application_logged
  after insert or update on public.hospital_doctors
  for each row execute function public.log_doctor_application();

-- ------------------------------------------------------------
-- 11.2 DONOR ACCEPTANCES (donor accepts a request; a doctor from the
-- request's hospital is assigned to the transaction as the witness)
-- ------------------------------------------------------------
create table if not exists public.donor_acceptances (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.donation_requests(id) on delete cascade,
  donor_id uuid not null references public.profiles(id) on delete cascade,
  doctor_id uuid references public.profiles(id),
  status text not null default 'accepted' check (status in ('accepted', 'withdrawn', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (request_id, donor_id)
);

alter table public.donor_acceptances enable row level security;

create policy "acceptances_select_authenticated"
  on public.donor_acceptances for select to authenticated
  using (true);

create policy "acceptances_insert_own_donor"
  on public.donor_acceptances for insert to authenticated
  with check (donor_id = auth.uid());

create policy "acceptances_update_own_donor"
  on public.donor_acceptances for update to authenticated
  using (donor_id = auth.uid() or public.is_admin())
  with check (donor_id = auth.uid() or public.is_admin());
-- No DELETE policy: acceptances are a record.

drop trigger if exists touch_updated_at on public.donor_acceptances;
create trigger touch_updated_at
  before update on public.donor_acceptances
  for each row execute function public.set_updated_at();

-- The assigned doctor must be in the request's hospital doctor set; the
-- donor must be blood-type compatible; the first acceptance moves the
-- request to 'accepted'.
create or replace function public.guard_acceptance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request record;
  v_donor_blood text;
  v_count integer;
begin
  select * into v_request from public.donation_requests where id = new.request_id;
  if v_request.id is null then
    raise exception 'Request not found.';
  end if;
  if v_request.status not in ('pending', 'accepted') then
    raise exception 'This request is no longer accepting donors.';
  end if;
  if v_request.requester_id = new.donor_id then
    raise exception 'You cannot accept your own request.';
  end if;

  select blood_type into v_donor_blood from public.profiles where id = new.donor_id;
  if v_donor_blood is not null and not (
    v_donor_blood = any (array['O-']) and v_request.blood_type = any (array['O-','O+','A-','A+','B-','B+','AB-','AB+'])
    or v_donor_blood = 'O+' and v_request.blood_type = any (array['O+','A+','B+','AB+'])
    or v_donor_blood = 'A-' and v_request.blood_type = any (array['A-','A+','AB-','AB+'])
    or v_donor_blood = 'A+' and v_request.blood_type = any (array['A+','AB+'])
    or v_donor_blood = 'B-' and v_request.blood_type = any (array['B-','B+','AB-','AB+'])
    or v_donor_blood = 'B+' and v_request.blood_type = any (array['B+','AB+'])
    or v_donor_blood = 'AB-' and v_request.blood_type = any (array['AB-','AB+'])
    or v_donor_blood = 'AB+' and v_request.blood_type = 'AB+'
  ) then
    raise exception 'Your blood type (%) cannot donate to this request (%).', v_donor_blood, v_request.blood_type;
  end if;

  -- The assigned doctor must belong to the request's hospital.
  if new.doctor_id is not null then
    if v_request.hospital_id is null then
      raise exception 'This request has no hospital, so no doctor can be assigned.';
    end if;
    if not exists (
      select 1 from public.hospital_doctors hd
      where hd.hospital_id = v_request.hospital_id
        and hd.doctor_id = new.doctor_id
        and hd.status = 'accepted'
    ) and not exists (
      select 1 from public.hospitals h
        join public.profiles p on p.id = h.admin_id
      where h.id = v_request.hospital_id
        and p.id = new.doctor_id
        and (p.role = 'doctor' or p.is_doctor)
    ) then
      raise exception 'The selected doctor is not part of the hospital on this request.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists acceptance_guard on public.donor_acceptances;
create trigger acceptance_guard
  before insert or update on public.donor_acceptances
  for each row execute function public.guard_acceptance();

create or replace function public.on_acceptance_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_doctor text;
  v_hospital record;
  v_requester text;
begin
  -- The first acceptance moves the request to 'accepted'.
  update public.donation_requests
    set status = 'accepted', updated_at = now()
    where id = new.request_id and status = 'pending';

  select full_name into v_doctor from public.profiles where id = new.doctor_id;
  select full_name into v_requester from public.profiles where id = (select requester_id from public.donation_requests where id = new.request_id);
  select * into v_hospital from public.hospitals where id = (select hospital_id from public.donation_requests where id = new.request_id);

  insert into public.activity_logs (actor_id, action, entity, entity_id, details)
  values (new.donor_id, 'acceptance.created', 'donor_acceptances', new.id,
          'Donor accepted request ' || new.request_id ||
          case when v_doctor is not null then ' — assigned doctor: ' || v_doctor else ' — no doctor assigned' end || '.');

  -- v4 (client rule): the hospital is notified that a donor accepted.
  if v_hospital.id is not null then
    insert into public.hospital_notifications (hospital_id, type, title, body, request_id, actor_id)
    values (v_hospital.id, 'donor_accepted', 'A donor accepted a request at your hospital',
            (select full_name from public.profiles where id = new.donor_id) || ' accepted the request of ' ||
            coalesce(v_requester, 'a requester') ||
            case when v_doctor is not null then ' — assigned doctor: ' || v_doctor else '' end || '.',
            new.request_id, new.donor_id);
  end if;

  return new;
end;
$$;

drop trigger if exists acceptance_created on public.donor_acceptances;
create trigger acceptance_created
  after insert on public.donor_acceptances
  for each row execute function public.on_acceptance_created();

-- ------------------------------------------------------------
-- 11.3 HOSPITAL NOTIFICATIONS (the business admin's inbox)
-- Written by triggers/RPCs only; the hospital admin reads + marks read.
-- ------------------------------------------------------------
create table if not exists public.hospital_notifications (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references public.hospitals(id) on delete cascade,
  type text not null check (type in ('new_request', 'donor_accepted', 'doctor_application')),
  title text not null check (char_length(title) <= 160),
  body text not null check (char_length(body) <= 600),
  request_id uuid references public.donation_requests(id) on delete set null,
  actor_id uuid references public.profiles(id),
  read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.hospital_notifications enable row level security;

create policy "notifications_select_hospital_admin"
  on public.hospital_notifications for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.hospitals h
      where h.id = hospital_id and h.admin_id = auth.uid()
    )
  );

create policy "notifications_update_hospital_admin"
  on public.hospital_notifications for update to authenticated
  using (
    exists (
      select 1 from public.hospitals h
      where h.id = hospital_id and h.admin_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.hospitals h
      where h.id = hospital_id and h.admin_id = auth.uid()
    )
  );
-- No INSERT/DELETE policies for clients: notifications are
-- trigger/RPC-written only.

-- Notify a hospital when a request is created with (or edited to add)
-- this hospital. [RLS mirror of the mock notifyHospital()]
create or replace function public.notify_request_hospital()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_requester text;
  v_hospital record;
begin
  if new.hospital_id is null then
    return new;
  end if;
  if TG_OP = 'UPDATE' and new.hospital_id = old.hospital_id then
    return new;
  end if;

  select * into v_hospital from public.hospitals where id = new.hospital_id;
  select full_name into v_requester from public.profiles where id = new.requester_id;

  insert into public.hospital_notifications (hospital_id, type, title, body, request_id, actor_id)
  values (
    new.hospital_id,
    'new_request',
    'New blood request attached to your hospital',
    coalesce(v_requester, 'A user') || ' created a ' || new.urgency || ' ' || new.blood_type ||
      ' request (' || new.units_needed || ' unit' || case when new.units_needed > 1 then 's' else '' end ||
      ') for ' || coalesce(v_hospital.name, 'your hospital') || '.',
    new.id,
    new.requester_id
  );
  return new;
end;
$$;

drop trigger if exists request_hospital_notified on public.donation_requests;
create trigger request_hospital_notified
  after insert or update of hospital_id on public.donation_requests
  for each row execute function public.notify_request_hospital();

-- ------------------------------------------------------------
-- 11.4 v4 RPCs (security definer — the real gatekeepers)
-- ------------------------------------------------------------

-- Doctors assignable at a hospital: the accepted roster + the hospital
-- admin when they are also a licensed doctor.
create or replace function public.get_hospital_doctors(p_hospital_id uuid)
returns table (
  id uuid,
  full_name text,
  specialization text,
  doctor_license_id text,
  contact_number text,
  avatar_url text,
  via_application boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.full_name, p.specialization, p.doctor_license_id, p.contact_number, p.avatar_url, true
  from public.hospital_doctors hd
  join public.profiles p on p.id = hd.doctor_id
  where hd.hospital_id = p_hospital_id and hd.status = 'accepted'
  union all
  select p.id, p.full_name, p.specialization, p.doctor_license_id, p.contact_number, p.avatar_url, false
  from public.hospitals h
  join public.profiles p on p.id = h.admin_id
  where h.id = p_hospital_id and p.is_doctor
$$;

grant execute on function public.get_hospital_doctors(uuid) to authenticated;

-- Full hospital detail for the public hospital page: description,
-- location, admin and the doctor roster (license IDs + contact numbers).
create or replace function public.get_hospital_detail(p_hospital_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_hospital record;
  v_admin record;
  v_doctors jsonb;
  v_open integer;
  v_completed integer;
begin
  select * into v_hospital from public.hospitals where id = p_hospital_id;
  if v_hospital.id is null then
    return null;
  end if;
  if v_hospital.status <> 'verified' and not public.is_admin()
      and v_hospital.admin_id <> auth.uid() then
    raise exception 'This hospital is not verified yet.';
  end if;

  select id, full_name, avatar_url, role, is_doctor into v_admin
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
    'admin_id', v_hospital.admin_id,
    'name', v_hospital.name,
    'region', v_hospital.region,
    'city', v_hospital.city,
    'address', v_hospital.address,
    'contact_number', v_hospital.contact_number,
    'description', v_hospital.description,
    'photo_url', v_hospital.photo_url,
    'status', v_hospital.status,
    'notes', v_hospital.notes,
    'created_at', v_hospital.created_at,
    'admin_name', v_admin.full_name,
    'admin_avatar_url', v_admin.avatar_url,
    'admin_is_doctor', coalesce(v_admin.is_doctor, false),
    'doctors', v_doctors,
    'doctor_count', jsonb_array_length(v_doctors),
    'stats', jsonb_build_object('open_requests', v_open, 'completed_requests', v_completed)
  );
end;
$$;

grant execute on function public.get_hospital_detail(uuid) to authenticated;

-- The donor accepts a request; a doctor from the request's hospital is
-- assigned (explicitly chosen, or the first roster doctor automatically).
create or replace function public.accept_request_as_donor(p_request_id uuid, p_doctor_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request record;
  v_doctor uuid;
  v_count integer;
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.';
  end if;

  select * into v_request from public.donation_requests where id = p_request_id;
  if v_request.id is null then
    raise exception 'Request not found.';
  end if;
  if v_request.requester_id = auth.uid() then
    raise exception 'You cannot accept your own request.';
  end if;

  select count(*) into v_count from public.donor_acceptances
    where request_id = p_request_id and donor_id = auth.uid() and status <> 'withdrawn';
  if v_count > 0 then
    raise exception 'You have already accepted this request.';
  end if;

  if p_doctor_id is not null then
    v_doctor := p_doctor_id;
  elsif v_request.hospital_id is not null then
    select id into v_doctor from public.get_hospital_doctors(v_request.hospital_id) limit 1;
  end if;
  -- v_doctor may stay NULL when the request has no hospital/no doctors:
  -- the acceptance_guard trigger allows that.

  insert into public.donor_acceptances (request_id, donor_id, doctor_id, status)
  values (p_request_id, auth.uid(), v_doctor, 'accepted')
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'request_id', p_request_id, 'donor_id', auth.uid(),
                            'doctor_id', v_doctor, 'status', 'accepted');
end;
$$;

grant execute on function public.accept_request_as_donor(uuid, uuid) to authenticated;

-- The donor (or an admin) may switch to another doctor — still only from
-- the request's hospital (checked by the acceptance_guard trigger).
create or replace function public.set_acceptance_doctor(p_acceptance_id uuid, p_doctor_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_acceptance record;
begin
  select * into v_acceptance from public.donor_acceptances where id = p_acceptance_id;
  if v_acceptance.id is null then
    raise exception 'Acceptance not found.';
  end if;
  if v_acceptance.donor_id <> auth.uid() and not public.is_admin() then
    raise exception 'Only the donor who accepted can change the assigned doctor.';
  end if;
  if v_acceptance.status <> 'accepted' then
    raise exception 'The doctor can only be changed while the acceptance is active.';
  end if;

  update public.donor_acceptances
    set doctor_id = p_doctor_id, updated_at = now()
    where id = p_acceptance_id;

  insert into public.activity_logs (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'acceptance.doctor_changed', 'donor_acceptances', p_acceptance_id,
          'Assigned doctor changed to ' ||
          coalesce((select full_name from public.profiles where id = p_doctor_id), '?') || '.');

  return jsonb_build_object('id', p_acceptance_id, 'doctor_id', p_doctor_id);
end;
$$;

grant execute on function public.set_acceptance_doctor(uuid, uuid) to authenticated;

-- The donor withdraws their acceptance.
create or replace function public.withdraw_acceptance(p_acceptance_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_acceptance record;
begin
  select * into v_acceptance from public.donor_acceptances where id = p_acceptance_id;
  if v_acceptance.id is null then
    raise exception 'Acceptance not found.';
  end if;
  if v_acceptance.donor_id <> auth.uid() and not public.is_admin() then
    raise exception 'Only the donor who accepted can withdraw.';
  end if;
  if v_acceptance.status <> 'accepted' then
    raise exception 'This acceptance is no longer active.';
  end if;

  update public.donor_acceptances
    set status = 'withdrawn', updated_at = now()
    where id = p_acceptance_id;

  insert into public.activity_logs (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'acceptance.withdrawn', 'donor_acceptances', p_acceptance_id,
          'Donor withdrew their acceptance.');

  return jsonb_build_object('id', p_acceptance_id, 'status', 'withdrawn');
end;
$$;

grant execute on function public.withdraw_acceptance(uuid) to authenticated;

-- The doctor's view: transactions where they are the assigned witness.
create or replace function public.get_my_doctor_assignments()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
  v_is_doctor boolean;
begin
  select (role = 'doctor' or is_doctor) into v_is_doctor from public.profiles where id = auth.uid();
  if not coalesce(v_is_doctor, false) then
    raise exception 'Only doctor accounts have assignments.';
  end if;

  select coalesce(jsonb_agg(row_to_json(t) order by t.updated_at desc), '[]'::jsonb)
  into v_result
  from (
    select a.id, a.request_id, a.donor_id, a.doctor_id, a.status, a.created_at, a.updated_at,
           p.full_name as donor_name, p.avatar_url as donor_avatar_url, p.blood_type as donor_blood_type,
           r.blood_type as request_blood_type, r.units_needed, r.urgency, r.status as request_status,
           r.region, h.name as hospital_name,
           (select outcome from public.donation_records dr where dr.request_id = a.request_id limit 1) as record_outcome
    from public.donor_acceptances a
    join public.profiles p on p.id = a.donor_id
    join public.donation_requests r on r.id = a.request_id
    left join public.hospitals h on h.id = r.hospital_id
    where a.doctor_id = auth.uid() and a.status <> 'withdrawn'
  ) t;

  return v_result;
end;
$$;

grant execute on function public.get_my_doctor_assignments() to authenticated;

-- Business admin: their hospital + every doctor application (joined with
-- the doctor's credentials — the admin verifies these).
create or replace function public.business_get_my_hospital()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_hospital record;
  v_apps jsonb;
begin
  select * into v_hospital from public.hospitals where admin_id = auth.uid();
  if v_hospital.id is null then
    return null;
  end if;

  select coalesce(jsonb_agg(row_to_json(a) order by
    case a.status when 'pending' then 0 when 'accepted' then 1 else 2 end, a.created_at desc), '[]'::jsonb)
  into v_apps
  from (
    select hd.id, hd.hospital_id, hd.doctor_id, hd.status, hd.application_note,
           hd.reviewed_by, hd.reviewed_at, hd.created_at,
           p.full_name as doctor_name, p.avatar_url as doctor_avatar_url,
           p.doctor_license_id, p.specialization as doctor_specialization, p.contact_number as doctor_contact_number,
           (select full_name from public.profiles rp where rp.id = hd.reviewed_by) as reviewed_by_name
    from public.hospital_doctors hd
    join public.profiles p on p.id = hd.doctor_id
    where hd.hospital_id = v_hospital.id
  ) a;

  return jsonb_build_object(
    'id', v_hospital.id, 'admin_id', v_hospital.admin_id, 'name', v_hospital.name,
    'region', v_hospital.region, 'city', v_hospital.city, 'address', v_hospital.address,
    'contact_number', v_hospital.contact_number, 'description', v_hospital.description,
    'photo_url', v_hospital.photo_url, 'status', v_hospital.status, 'notes', v_hospital.notes,
    'created_at', v_hospital.created_at,
    'applications', v_apps,
    'doctor_count', (select count(*) from public.get_hospital_doctors(v_hospital.id)),
    'pending_applications', (select count(*) from public.hospital_doctors
                              where hospital_id = v_hospital.id and status = 'pending')
  );
end;
$$;

grant execute on function public.business_get_my_hospital() to authenticated;

-- Business admin: update the hospital's PUBLIC profile fields (name /
-- region / status are protected by the protect_hospital trigger).
create or replace function public.business_update_my_hospital(p_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hospital record;
begin
  select * into v_hospital from public.hospitals where admin_id = auth.uid();
  if v_hospital.id is null then
    raise exception 'No hospital is linked to your account.';
  end if;

  update public.hospitals set
    description = coalesce(p_patch->>'description', description),
    photo_url = coalesce(p_patch->>'photo_url', photo_url),
    city = coalesce(p_patch->>'city', city),
    address = coalesce(p_patch->>'address', address),
    contact_number = coalesce(p_patch->>'contact_number', contact_number),
    updated_at = now()
  where id = v_hospital.id;

  insert into public.activity_logs (actor_id, action, entity, entity_id, details)
  values (auth.uid(), 'hospital.updated', 'hospitals', v_hospital.id,
          'Hospital profile updated by its admin.');

  select * into v_hospital from public.hospitals where id = v_hospital.id;
  return jsonb_build_object('id', v_hospital.id, 'description', v_hospital.description,
                            'photo_url', v_hospital.photo_url, 'city', v_hospital.city,
                            'address', v_hospital.address, 'contact_number', v_hospital.contact_number);
end;
$$;

grant execute on function public.business_update_my_hospital(jsonb) to authenticated;

-- Doctors apply to a hospital (client rule: with their license ID and
-- note; the hospital admin verifies and accepts).
create or replace function public.apply_to_hospital(p_hospital_id uuid, p_note text default '')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile record;
  v_hospital record;
  v_existing record;
begin
  select * into v_profile from public.profiles where id = auth.uid();
  select * into v_hospital from public.hospitals where id = p_hospital_id;
  if v_hospital.id is null then
    raise exception 'Hospital not found.';
  end if;
  if v_hospital.admin_id = auth.uid() then
    raise exception 'You already manage this hospital — no application needed.';
  end if;
  if not (v_profile.role = 'doctor' or v_profile.is_doctor) then
    raise exception 'Only doctor accounts can apply to a hospital. Register as a doctor first.';
  end if;
  if coalesce(v_profile.doctor_license_id, '') = '' or coalesce(v_profile.contact_number, '') = '' then
    raise exception 'Complete your doctor license ID and contact number in your profile first.';
  end if;

  select * into v_existing from public.hospital_doctors
    where hospital_id = p_hospital_id and doctor_id = auth.uid();

  if v_existing.id is not null then
    if v_existing.status = 'accepted' then
      raise exception 'You are already part of this hospital''s roster.';
    end if;
    if v_existing.status = 'pending' then
      raise exception 'Your application to this hospital is already pending.';
    end if;
    update public.hospital_doctors
      set status = 'pending', application_note = coalesce(nullif(p_note, ''), application_note),
          reviewed_by = null, reviewed_at = null, created_at = now()
      where id = v_existing.id;
    return jsonb_build_object('success', true, 'resubmitted', true);
  end if;

  insert into public.hospital_doctors (hospital_id, doctor_id, status, application_note)
  values (p_hospital_id, auth.uid(), 'pending', coalesce(p_note, ''));

  return jsonb_build_object('success', true, 'resubmitted', false);
end;
$$;

grant execute on function public.apply_to_hospital(uuid, text) to authenticated;

-- The doctor's own applications, with the hospitals joined.
create or replace function public.list_my_doctor_applications()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  select coalesce(jsonb_agg(row_to_json(a) order by a.created_at desc), '[]'::jsonb)
  into v_result
  from (
    select hd.id, hd.hospital_id, hd.status, hd.application_note, hd.reviewed_at, hd.created_at,
           h.name as hospital_name, h.status as hospital_status, h.city as hospital_city,
           h.region as hospital_region,
           (select full_name from public.profiles rp where rp.id = hd.reviewed_by) as reviewed_by_name
    from public.hospital_doctors hd
    join public.hospitals h on h.id = hd.hospital_id
    where hd.doctor_id = auth.uid()
  ) a;

  return v_result;
end;
$$;

grant execute on function public.list_my_doctor_applications() to authenticated;

-- The hospital admin (or platform admin) reviews a doctor application.
create or replace function public.hospital_set_doctor_application_status(
  p_application_id uuid,
  p_status text,
  p_reason text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_app record;
  v_doctor record;
  v_hospital record;
  v_current_hospital uuid;
begin
  select * into v_app from public.hospital_doctors where id = p_application_id;
  if v_app.id is null then
    raise exception 'Application not found.';
  end if;

  select * into v_hospital from public.hospitals where id = v_app.hospital_id;
  if v_hospital.admin_id <> auth.uid() and not public.is_admin() then
    raise exception 'Only the hospital''s admin can review this application.';
  end if;
  if p_status not in ('accepted', 'rejected', 'pending') then
    raise exception 'Invalid status.';
  end if;
  if p_status = 'rejected' and coalesce(p_reason, '') = '' then
    raise exception 'A reason is required when rejecting a doctor application.';
  end if;

  select * into v_doctor from public.profiles where id = v_app.doctor_id;

  if p_status = 'accepted' then
    -- Client rule: a doctor works under ONE specific hospital.
    select hospital_id into v_current_hospital from public.hospital_doctors
      where doctor_id = v_app.doctor_id and status = 'accepted' limit 1;
    if v_current_hospital is not null and v_current_hospital <> v_app.hospital_id then
      raise exception 'This doctor already works under another hospital — they must leave it first.';
    end if;
  end if;

  update public.hospital_doctors
    set status = p_status, reviewed_by = auth.uid(), reviewed_at = now()
    where id = p_application_id;

  return jsonb_build_object('id', p_application_id, 'status', p_status);
end;
$$;

grant execute on function public.hospital_set_doctor_application_status(uuid, text, text) to authenticated;

-- Business admin: live statistics scoped to their hospital.
create or replace function public.business_get_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_hospital record;
  v_result jsonb;
begin
  select * into v_hospital from public.hospitals where admin_id = auth.uid();
  if v_hospital.id is null then
    raise exception 'No hospital is linked to your account.';
  end if;

  select jsonb_build_object(
    'hospital', jsonb_build_object('id', v_hospital.id, 'name', v_hospital.name, 'status', v_hospital.status),
    'requests', jsonb_build_object(
      'total', count(*),
      'pending', count(*) filter (where status = 'pending'),
      'accepted', count(*) filter (where status = 'accepted'),
      'completed', count(*) filter (where status = 'completed'),
      'cancelled', count(*) filter (where status = 'cancelled')
    ),
    'doctors', (select count(*) from public.get_hospital_doctors(v_hospital.id)),
    'pending_applications', (select count(*) from public.hospital_doctors
                              where hospital_id = v_hospital.id and status = 'pending'),
    'records', (
      select jsonb_build_object(
        'total', count(*),
        'successful', count(*) filter (where outcome = 'successful'),
        'failed', count(*) filter (where outcome = 'failed')
      ) from public.donation_records dr
      join public.donation_requests r on r.id = dr.request_id
      where r.hospital_id = v_hospital.id
    ),
    'unread_notifications', (select count(*) from public.hospital_notifications
                              where hospital_id = v_hospital.id and read = false)
  )
  into v_result
  from public.donation_requests where hospital_id = v_hospital.id;

  return v_result;
end;
$$;

grant execute on function public.business_get_stats() to authenticated;



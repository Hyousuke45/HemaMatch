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
  role text not null default 'user' check (role in ('user', 'admin')),
  blood_type text check (blood_type in ('O-','O+','A-','A+','B-','B+','AB-','AB+')),
  region text,
  city text,
  is_available boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Automatically create a profile row whenever a user signs up,
-- and write the registration event to the audit log.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );
  insert into public.activity_logs (actor_id, action, entity, entity_id, details)
  values (new.id, 'user.registered', 'profiles', new.id,
          'New account registered (' || new.email || ').');
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
-- 2. HOSPITALS (Light scope: admin-managed list + verification)
-- ============================================================
create table if not exists public.hospitals (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 3 and 120),
  region text not null,
  city text,
  address text,
  contact_number text,
  status text not null default 'pending' check (status in ('pending', 'verified', 'rejected')),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

-- Hospital records are created and changed ONLY by administrators.
create policy "hospitals_insert_admin" on public.hospitals for insert to authenticated with check (public.is_admin());
create policy "hospitals_update_admin" on public.hospitals for update to authenticated using (public.is_admin()) with check (public.is_admin());
-- No DELETE policy: hospital records are never hard-deleted (audit integrity).

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
  units_needed integer not null default 1 check (units_needed between 1 and 10),
  region text not null,
  hospital_id uuid references public.hospitals(id),
  urgency text not null default 'routine' check (urgency in ('routine', 'urgent', 'critical')),
  needed_by date,
  description text check (char_length(coalesce(description, '')) <= 600),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

-- Requester can edit own row; admin can correct any row.
create policy "requests_update_own_or_admin"
  on public.donation_requests for update to authenticated
  using (requester_id = auth.uid() or public.is_admin())
  with check (requester_id = auth.uid() or public.is_admin());
-- Column/status legality is enforced by the trigger below (not just here):
-- a crafted UPDATE cannot mark someone else's request Completed.
-- No DELETE policy: cancelling is a status, not a deletion.

-- Status transition guard + audit
create or replace function public.guard_request_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_requester boolean := new.requester_id = auth.uid();
  is_admin boolean := public.is_admin();
  v_reason text := coalesce(nullif(current_setting('app.status_reason', true), ''), '');
begin
  -- Only the owner (or an admin) reaches this trigger (see UPDATE policy),
  -- but re-check who is allowed to do WHAT:
  if new.status = 'completed' and not is_admin then
    raise exception 'Only an administrator can mark a request as completed.';
  end if;

  -- Requesters may edit details only while the request is still Pending.
  if new.status = old.status and is_requester and not is_admin and old.status <> 'pending' then
    raise exception 'Only pending requests can be edited.';
  end if;

  if is_requester and not is_admin and old.status <> 'pending' then
    -- after Pending, the owner may only move to accepted/cancelled
    if new.status not in ('accepted', 'cancelled') then
      raise exception 'After a request leaves Pending, only an administrator can change its status.';
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
-- 4. DONATION RECORDS (admin outcome records — the "transactions")
-- A successful record closes its request as completed.
-- ============================================================
create table if not exists public.donation_records (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.donation_requests(id) on delete cascade,
  donor_id uuid references public.profiles(id),
  outcome text not null check (outcome in ('successful', 'failed')),
  reason text not null default '' check (char_length(reason) <= 300),
  recorded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint successful_requires_reason check (outcome = 'successful' or char_length(reason) > 0)
);

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
  );

create policy "records_insert_admin"
  on public.donation_records for insert to authenticated
  with check (public.is_admin() and recorded_by = auth.uid());

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
-- 5. MESSAGING (1:1 conversations)
-- conversations -> conversation_participants -> messages
-- ============================================================
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.donation_requests(id),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

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
  same_region boolean
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
         (p.region = v_request.region) as same_region
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
  order by same_region desc, p.full_name asc;
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

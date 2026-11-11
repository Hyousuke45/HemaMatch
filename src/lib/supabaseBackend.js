// ============================================================
// HEMAMATCH PHASE 2 BACKEND — Supabase
// ------------------------------------------------------------
// Implements EXACTLY the same function contract as mockBackend.js,
// so no page or component changes when the switch flips.
//
// Security model (the DB is the real gatekeeper):
//   - Authorization is enforced by Row Level Security policies in
//     PostgreSQL (schema.sql), NOT by the JavaScript here. These are
//     thin wrappers: if a crafted request bypassed them, the database
//     would still refuse it.
//   - Privileged or reason-bearing actions (status changes with a
//     reason, role changes, user directory, stats) run through
//     SECURITY DEFINER RPCs that re-check permissions server-side
//     and write the audit log themselves.
//   - Only the project URL + anon key are used in the browser.
// ============================================================

import { supabase, isSupabaseConfigured } from './supabaseClient';
import { BLOOD_TYPES, REGIONS, OFFER_NOTE_MAX, donorTypesFor } from './constants';
import { isValidEmail, validatePassword } from './utils';

// ---------- helpers ----------

function sb() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      'Supabase is not configured yet. Copy .env.example to .env, fill in your project URL and anon key, then restart the dev server.'
    );
  }
  return supabase;
}

function fail(error, fallback = 'Something went wrong.') {
  const msg = error?.message || fallback;
  // friendlier mappings for common Supabase/Auth messages
  if (/user already registered/i.test(msg)) return new Error('An account with this email already exists.');
  if (/email not confirmed/i.test(msg)) return new Error('Please verify your email address before signing in. Check your inbox.');
  if (/invalid login credentials/i.test(msg)) return new Error('Invalid email or password.');
  if (/duplicate key/i.test(msg) && /hospitals/i.test(error?.details || '')) {
    return new Error('A hospital with this name already exists.');
  }
  return new Error(msg);
}

async function currentAuthUser() {
  const { data, error } = await sb().auth.getUser();
  if (error) throw fail(error, 'You must be signed in to do this.');
  return data.user; // may be null
}

async function requireUid() {
  const u = await currentAuthUser();
  if (!u) throw new Error('You must be signed in to do this.');
  return u.id;
}

async function myProfileRow() {
  const uid = await requireUid();
  const { data, error } = await sb().from('profiles').select('*').eq('id', uid).maybeSingle();
  if (error) throw fail(error, 'Could not load your profile.');
  return data;
}

// v4: a user acts as a doctor when the account type is doctor, OR they are
// a business (hospital) admin who is also a licensed doctor.
function actsAsDoctor(profile) {
  return profile?.role === 'doctor' || Boolean(profile?.is_doctor);
}

function mapAuthUser(authUser, profile) {
  const p = profile || {
    id: authUser.id,
    full_name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'User',
    role: 'user',
    blood_type: null,
    region: null,
    city: null,
    is_available: true,
    avatar_url: null,
    created_at: authUser.created_at
  };
  return {
    id: authUser.id,
    email: authUser.email,
    verified: Boolean(authUser.email_confirmed_at),
    profile: p
  };
}

// Request rows -> the joined shape the UI expects
function mapRequest(r) {
  if (!r) return null;
  return {
    ...r,
    requester_name: r.requester?.full_name ?? 'Unknown',
    requester_avatar_url: r.requester?.avatar_url ?? null,
    hospital_name: r.hospital?.name ?? null,
    hospital_status: r.hospital?.status ?? null
  };
}

const REQUEST_SELECT =
  '*, requester:profiles!donation_requests_requester_id_fkey(full_name, avatar_url), hospital:hospitals!donation_requests_hospital_id_fkey(name, status)';

// ============================================================
// AUTHENTICATION (Supabase Auth — passwords are hashed by Supabase;
// this app never stores or handles password material itself)
// ============================================================

async function getSession() {
  const { data, error } = await sb().auth.getSession();
  if (error) throw fail(error, 'Could not restore your session.');
  const au = data.session?.user;
  if (!au) return null;

  const { data: profile, error: pErr } = await sb()
    .from('profiles')
    .select('*')
    .eq('id', au.id)
    .maybeSingle();
  if (pErr) throw fail(pErr, 'Could not load your profile.');
  return { user: mapAuthUser(au, profile) };
}

// AuthContext listens to Supabase auth events so sign-in/out/email
// confirmation reflect app-wide instantly.
function onAuthStateChange(callback) {
  const { data } = sb().auth.onAuthStateChange((event, session) => {
    callback(event, session?.user ?? null);
  });
  return () => data.subscription.unsubscribe();
}

// v4: registration picks an account type (user / doctor / business).
// The profile row (with the doctor fields, and the hospital record for
// businesses) is created by the handle_new_user trigger from the
// raw_user_meta_data passed here.
async function register({
  full_name,
  email,
  password,
  account_type = 'user',
  doctor = {},
  hospital = {}
}) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanName = String(full_name || '').trim();
  if (!cleanName || cleanName.length < 2) throw new Error('Please enter your full name.');
  if (!isValidEmail(cleanEmail)) throw new Error('Please enter a valid email address.');
  const pwError = validatePassword(password);
  if (pwError) throw new Error(pwError);

  const type = ['user', 'doctor', 'business'].includes(account_type) ? account_type : 'user';
  const metaData = { full_name: cleanName, account_type: type };

  if (type === 'doctor') {
    const license = String(doctor.license_id || '').trim();
    const contact = String(doctor.contact_number || '').trim();
    const spec = String(doctor.specialization || '').trim();
    if (!license) throw new Error('Please enter your doctor license / PRC ID number.');
    if (!contact) throw new Error('Please enter your contact number.');
    metaData.doctor_license_id = license;
    metaData.doctor_contact_number = contact;
    metaData.specialization = spec;
  }
  if (type === 'business') {
    const hName = String(hospital.name || '').trim();
    if (hName.length < 3)
      throw new Error('Please enter your hospital\u2019s name (at least 3 characters).');
    if (!hospital.region) throw new Error('Please choose the region where your hospital is located.');
    metaData.hospital_name = hName;
    metaData.hospital_region = hospital.region;
    metaData.hospital_city = String(hospital.city || '').trim() || null;
    metaData.hospital_address = String(hospital.address || '').trim() || null;
    metaData.hospital_contact_number = String(hospital.contact_number || '').trim() || null;
    metaData.hospital_description = String(hospital.description || '').trim() || '';
  }

  const { error } = await sb().auth.signUp({
    email: cleanEmail,
    password,
    options: {
      data: metaData,
      emailRedirectTo: `${window.location.origin}/login`
    }
  });
  if (error) throw fail(error, 'Registration failed.');

  // Email verification is ENABLED: Supabase sends a real confirmation
  // email. The user clicks the link, then signs in.
  return { email: cleanEmail };
}

// In Supabase mode the confirmation happens by clicking the emailed
// link, so this re-sends the confirmation email.
async function verifyEmail(email) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  const { error } = await sb().auth.resend({
    type: 'signup',
    email: cleanEmail,
    emailRedirectTo: `${window.location.origin}/login`
  });
  if (error) throw fail(error, 'Could not resend the confirmation email.');
  return { resent: true, email: cleanEmail };
}

async function login({ email, password }) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  const { data, error } = await sb().auth.signInWithPassword({ email: cleanEmail, password });
  if (error) throw fail(error, 'Unable to sign in.');

  const au = data.user;
  const { data: profile, error: pErr } = await sb()
    .from('profiles')
    .select('*')
    .eq('id', au.id)
    .maybeSingle();
  if (pErr) throw fail(pErr, 'Could not load your profile.');
  return { user: mapAuthUser(au, profile) };
}

async function logout() {
  const { error } = await sb().auth.signOut();
  if (error) throw fail(error, 'Could not sign out.');
  return { success: true };
}

async function requestPasswordReset(email) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  // Deliberately vague (never reveal whether an account exists): errors
  // for unknown addresses are swallowed and treated as "sent".
  await sb().auth
    .resetPasswordForEmail(cleanEmail, { redirectTo: `${window.location.origin}/reset-password` })
    .catch(() => {});
  return { sent: true, email: cleanEmail };
}

// Used by the /reset-password page while the user holds a recovery
// session from clicking the emailed link.
async function resetPassword({ password }) {
  const pwError = validatePassword(password);
  if (pwError) throw new Error(pwError);
  const { error } = await sb().auth.updateUser({ password });
  if (error) throw fail(error, 'Could not set the new password.');
  return { success: true };
}

// ============================================================
// PROFILES
// RLS: users may update only their own row; the protect_role_column
// trigger additionally reverts any attempted role change.
// ============================================================

async function getMyProfile() {
  const p = await myProfileRow();
  if (!p) throw new Error('Profile not found.');
  return { ...p };
}

async function updateMyProfile(patch) {
  const uid = await requireUid();
  const current = await myProfileRow();

  const clean = {};
  if (patch.full_name !== undefined) {
    const name = String(patch.full_name || '').trim();
    if (name.length < 2) throw new Error('Name must be at least 2 characters.');
    clean.full_name = name;
  }
  if (patch.blood_type !== undefined) {
    if (patch.blood_type !== null && !BLOOD_TYPES.includes(patch.blood_type))
      throw new Error('Invalid blood type.');
    clean.blood_type = patch.blood_type || null;
  }
  if (patch.region !== undefined) {
    if (patch.region !== null && patch.region !== '' && !REGIONS.includes(patch.region))
      throw new Error('Invalid region.');
    clean.region = patch.region || null;
  }
  if (patch.city !== undefined) {
    const city = String(patch.city || '').trim();
    if (city.length > 60) throw new Error('City name too long.');
    clean.city = city || null;
  }
  if (patch.avatar_url !== undefined) {
    const url = patch.avatar_url === null || patch.avatar_url === '' ? null : String(patch.avatar_url).trim();
    if (url && (!/^https?:\/\//i.test(url) || url.length > 500))
      throw new Error('Photo must be a valid image URL (https://…) of at most 500 characters.');
    clean.avatar_url = url;
  }

  // v4: doctor credentials. A doctor must always keep a license + contact;
  // a business admin may toggle "I am also a licensed doctor".
  if (patch.is_doctor !== undefined) {
    if (current?.role !== 'business')
      throw new Error('Only business (hospital) accounts can toggle the doctor ability.');
    const next = Boolean(patch.is_doctor);
    if (next && !String(patch.doctor_license_id ?? current?.doctor_license_id ?? '').trim())
      throw new Error('Enter your doctor license / PRC ID to enable doctor abilities.');
    clean.is_doctor = next;
  }
  if (patch.doctor_license_id !== undefined) {
    const license = String(patch.doctor_license_id || '').trim();
    if (license.length > 40) throw new Error('License ID is too long (max 40 characters).');
    if (current?.role === 'doctor' && !license)
      throw new Error('A doctor account must always have a license ID.');
    clean.doctor_license_id = license || null;
  }
  if (patch.specialization !== undefined) {
    const spec = String(patch.specialization || '').trim();
    if (spec.length > 80) throw new Error('Specialization is too long (max 80 characters).');
    clean.specialization = spec || null;
  }
  if (patch.contact_number !== undefined) {
    const contact = String(patch.contact_number || '').trim();
    if (contact.length > 40) throw new Error('Contact number is too long (max 40 characters).');
    if (current?.role === 'doctor' && !contact)
      throw new Error('A doctor account must always have a contact number.');
    clean.contact_number = contact || null;
  }
  if (patch.is_available !== undefined) {
    clean.is_available = Boolean(patch.is_available);
    // The sync_offer_with_availability trigger keeps the donation
    // listing consistent with this flag — one source of truth.
  }

  // role is IGNORED on purpose: a user must never change their own role.
  if (patch.role !== undefined && patch.role !== current?.role)
    throw new Error('You cannot change your own role.');

  const { data, error } = await sb().from('profiles').update(clean).eq('id', uid).select().single();
  if (error) throw fail(error, 'Could not save profile.');
  return data;
}

// ============================================================
// PUBLIC PROFILE (directory-safe view of another user; shown only
// from the request detail page). Server-side RPC aggregates the
// successful-donation count without exposing donation_records rows.
// ============================================================

async function getPublicProfile(userId) {
  await requireUid();
  const { data, error } = await sb().rpc('get_public_profile', { p_user_id: userId });
  if (error) throw fail(error, 'Could not load this profile.');
  if (!data) throw new Error('User not found.');
  return data;
}

// ============================================================
// DONATION OFFERS (the "donate" side)
// RLS: authenticated may read; donors may write ONLY their own row.
// Writes go through the upsert_my_offer RPC (validation + availability
// sync + audit logging happen server-side).
// ============================================================

async function getMyOffer() {
  const uid = await requireUid();
  const { data, error } = await sb()
    .from('donation_offers')
    .select('*')
    .eq('donor_id', uid)
    .maybeSingle();
  if (error) throw fail(error, 'Could not load your donor listing.');
  return data ?? null;
}

async function upsertMyOffer({ note, status }) {
  await requireUid();
  if (!['open', 'paused'].includes(status)) throw new Error('Invalid listing status.');
  const cleanNote = String(note || '').trim();
  if (cleanNote.length > OFFER_NOTE_MAX)
    throw new Error(`Note is too long (max ${OFFER_NOTE_MAX} characters).`);

  const { data, error } = await sb().rpc('upsert_my_offer', {
    p_note: cleanNote,
    p_status: status
  });
  if (error) throw fail(error, 'Could not save your donor listing.');
  return data;
}

// Donor directory: OPEN listings joined with directory-safe profile
// fields. Same-region donors first (client-side ranking hint).
async function listDonors(filters = {}) {
  const uid = await requireUid();
  const { data, error } = await sb()
    .from('donation_offers')
    .select(
      '*, donor:profiles!donation_offers_donor_id_fkey(id, full_name, blood_type, region, city, avatar_url, created_at)'
    )
    .eq('status', 'open')
    .order('created_at', { ascending: false });
  if (error) throw fail(error, 'Could not load the donor directory.');

  let rows = (data || [])
    .filter((o) => o.donor && o.donor.id !== uid)
    .map((o) => ({
      id: o.donor.id,
      offer_id: o.id,
      full_name: o.donor.full_name,
      blood_type: o.donor.blood_type,
      region: o.donor.region,
      city: o.donor.city,
      avatar_url: o.donor.avatar_url ?? null,
      note: o.note,
      status: o.status,
      created_at: o.created_at,
      updated_at: o.updated_at,
      member_since: o.donor.created_at
    }));
  if (filters.blood_type) rows = rows.filter((r) => r.blood_type === filters.blood_type);
  if (filters.region) rows = rows.filter((r) => r.region === filters.region);

  const { data: me } = await sb().from('profiles').select('region').eq('id', uid).maybeSingle();
  const myRegion = me?.region;
  rows.sort((a, b) => {
    const aSame = myRegion && a.region === myRegion ? 1 : 0;
    const bSame = myRegion && b.region === myRegion ? 1 : 0;
    if (aSame !== bSame) return bSame - aSame;
    return new Date(b.created_at) - new Date(a.created_at);
  });
  return rows;
}

// ============================================================
// DONATION REQUESTS
// RLS: select for all authenticated; insert/update only own rows
// (admins may update any); the request_guard trigger validates every
// transition and writes the audit log.
// ============================================================

async function listRequests(filters = {}) {
  await requireUid();
  let query = sb().from('donation_requests').select(REQUEST_SELECT);
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.blood_type) query = query.eq('blood_type', filters.blood_type);
  if (filters.region) query = query.eq('region', filters.region);
  if (filters.mine) query = query.eq('requester_id', await requireUid());

  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw fail(error, 'Could not load requests.');

  let rows = (data || []).map(mapRequest);
  if (filters.search) {
    const q = String(filters.search).toLowerCase();
    rows = rows.filter(
      (r) =>
        (r.requester_name || '').toLowerCase().includes(q) ||
        (r.description || '').toLowerCase().includes(q) ||
        (r.blood_type || '').toLowerCase().includes(q) ||
        (r.region || '').toLowerCase().includes(q)
    );
  }
  return rows;
}

async function getMyRequests() {
  return listRequests({ mine: true });
}

async function getRequest(id) {
  const uid = await requireUid();
  const { data, error } = await sb()
    .from('donation_requests')
    .select(REQUEST_SELECT)
    .eq('id', id)
    .maybeSingle();
  if (error) throw fail(error, 'Could not load the request.');
  if (!data) throw new Error('Request not found.');
  const joined = mapRequest(data);

  // Outcome record (if any) with names resolved
  const { data: rec } = await sb()
    .from('donation_records')
    .select(
      '*, donor:profiles!donation_records_donor_id_fkey(full_name), doctor:profiles!donation_records_doctor_id_fkey(full_name), recorder:profiles!donation_records_recorded_by_fkey(full_name)'
    )
    .eq('request_id', id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  // v4: donor acceptances (with donor + assigned doctor names) and the
  // hospital's assignable doctor list.
  const { data: acceptances } = await sb()
    .from('donor_acceptances')
    .select(
      '*, donor:profiles!donor_acceptances_donor_id_fkey(full_name, avatar_url, blood_type), doctor:profiles!donor_acceptances_doctor_id_fkey(full_name, specialization)'
    )
    .eq('request_id', id)
    .neq('status', 'withdrawn')
    .order('created_at', { ascending: true });

  const mappedAcceptances = (acceptances || []).map((a) => ({
    ...a,
    donor_name: a.donor?.full_name ?? 'Unknown',
    donor_avatar_url: a.donor?.avatar_url ?? null,
    donor_blood_type: a.donor?.blood_type ?? null,
    doctor_name: a.doctor?.full_name ?? null,
    doctor_specialization: a.doctor?.specialization ?? null
  }));

  // v4: doctors assignable to this request = the hospital's accepted
  // roster + the hospital admin when they are also a doctor.
  let hospitalDoctors = [];
  if (joined.hospital_id) {
    const { data: roster } = await sb().rpc('get_hospital_doctors', {
      p_hospital_id: joined.hospital_id
    });
    hospitalDoctors = roster || [];
  }

  return {
    ...joined,
    compatible_types: donorTypesFor(joined.blood_type),
    hospital_doctors: hospitalDoctors,
    acceptances: mappedAcceptances,
    my_acceptance: mappedAcceptances.find((a) => a.donor_id === uid) ?? null,
    record: rec
      ? {
          ...rec,
          donor_name: rec.donor?.full_name ?? null,
          doctor_name: rec.doctor?.full_name ?? null,
          recorded_by_name: rec.recorder?.full_name ?? 'Administrator'
        }
      : null
  };
}

function validateRequestData(data) {
  if (!BLOOD_TYPES.includes(data.blood_type)) throw new Error('Please choose a valid blood type.');
  const units = Number(data.units_needed ?? 1);
  if (!Number.isInteger(units) || units < 1 || units > 10)
    throw new Error('Units needed must be a whole number between 1 and 10.');
  if (!data.region) throw new Error('Please choose a region.');
  // v4.1: the hospital is required — the donation process happens there.
  if (!data.hospital_id) throw new Error('Please choose the hospital for the donation process.');
  if (data.description && String(data.description).length > 600)
    throw new Error('Description is too long (max 600 characters).');

  // v4.1: the preferred donor types (multi-select checkboxes) must ALL
  // be COMPATIBLE with the requested blood type.
  const preferred = Array.from(new Set(data.preferred_donor_types || []));
  for (const t of preferred) {
    if (!BLOOD_TYPES.includes(t)) throw new Error('Invalid preferred donor blood type.');
    if (!donorTypesFor(data.blood_type).includes(t))
      throw new Error(
        `A donor with type ${t} cannot donate to a patient with type ${data.blood_type}.`
      );
  }

  return {
    blood_type: data.blood_type,
    preferred_donor_types: preferred,
    units_needed: units,
    region: data.region,
    urgency: ['routine', 'urgent', 'critical'].includes(data.urgency) ? data.urgency : 'routine',
    needed_by: data.needed_by || null,
    hospital_id: data.hospital_id,
    description: String(data.description || '').trim()
  };
}

async function createRequest(data) {
  const uid = await requireUid();
  const clean = validateRequestData(data);

  const { data: h } = await sb().from('hospitals').select('status').eq('id', clean.hospital_id).maybeSingle();
  if (!h || h.status !== 'verified') throw new Error('Only verified hospitals can be selected.');

  const { data: row, error } = await sb()
    .from('donation_requests')
    .insert({ ...clean, requester_id: uid }) // status defaults to 'pending'
    .select('id')
    .single();
  if (error) throw fail(error, 'Could not create the request.');
  return getRequest(row.id);
}

async function updateRequest(id, data) {
  const uid = await requireUid();
  const { data: existing, error: loadErr } = await sb()
    .from('donation_requests')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (loadErr) throw fail(loadErr, 'Could not load the request.');
  if (!existing) throw new Error('Request not found.');
  if (existing.requester_id !== uid) throw new Error('You can only edit your own request.');
  if (existing.status !== 'pending') throw new Error('Only pending requests can be edited.');

  const clean = validateRequestData({ ...existing, ...data });
  const { data: h } = await sb().from('hospitals').select('status').eq('id', clean.hospital_id).maybeSingle();
  if (!h || h.status !== 'verified') throw new Error('Only verified hospitals can be selected.');

  const { error } = await sb().from('donation_requests').update(clean).eq('id', id);
  if (error) throw fail(error, 'Could not save the request.');
  return getRequest(id);
}

// All status changes go through the RPC so the collected REASON is
// written to the activity log by the server. [RLS mirror] the
// guard trigger re-validates every transition independently.
async function setRequestStatus(id, status, reason = '') {
  await requireUid();
  const { error } = await sb().rpc('set_request_status', {
    p_request_id: id,
    p_new_status: status,
    p_reason: String(reason || '').slice(0, 300)
  });
  if (error) throw fail(error, 'Could not change the status.');
  return getRequest(id);
}

async function cancelRequest(id) {
  return setRequestStatus(id, 'cancelled', '');
}

// ============================================================
// MATCHING (preliminary filtering, executed server-side by the
// get_matching_donors RPC, which also checks the caller's right to
// see the results: requester or admin only)
// ============================================================

async function getMatches(requestId) {
  const request = await getRequest(requestId); // includes participant check

  const { data: donors, error } = await sb().rpc('get_matching_donors', {
    p_request_id: requestId
  });
  if (error) throw fail(error, 'Could not run matching.');

  return {
    request,
    donors: donors || [],
    compatible_types: donorTypesFor(request.blood_type)
  };
}

// ============================================================
// v4: DONOR ACCEPTANCES + DOCTOR ASSIGNMENT
// All writes run through SECURITY DEFINER RPCs that validate the
// doctor is in the request's hospital roster and notify the hospital.
// ============================================================

async function acceptRequestAsDonor(requestId, doctorId = null) {
  await requireUid();
  const { data, error } = await sb().rpc('accept_request_as_donor', {
    p_request_id: requestId,
    p_doctor_id: doctorId
  });
  if (error) throw fail(error, 'Could not accept this request.');
  return data;
}

async function setAcceptanceDoctor(acceptanceId, doctorId) {
  await requireUid();
  const { data, error } = await sb().rpc('set_acceptance_doctor', {
    p_acceptance_id: acceptanceId,
    p_doctor_id: doctorId
  });
  if (error) throw fail(error, 'Could not change the assigned doctor.');
  return data;
}

async function withdrawAcceptance(acceptanceId) {
  await requireUid();
  const { data, error } = await sb().rpc('withdraw_acceptance', {
    p_acceptance_id: acceptanceId
  });
  if (error) throw fail(error, 'Could not withdraw your acceptance.');
  return data;
}

async function getMyDoctorAssignments() {
  const uid = await requireUid();
  const { data, error } = await sb().rpc('get_my_doctor_assignments');
  if (error) throw fail(error, 'Could not load your assignments.');
  return data || [];
}

// ============================================================
// MESSAGING (1:1 conversations)
// RLS: only participants read/write; conversations are created only
// by the start_conversation RPC. Realtime streams INSERTs on messages.
// ============================================================

async function listConversations() {
  const uid = await requireUid();
  const { data: convs, error } = await sb()
    .from('conversations')
    .select(
      'id, request_id, hospital_id, created_at, participants:conversation_participants(user_id)'
    )
    .order('created_at', { ascending: false });
  if (error) throw fail(error, 'Could not load conversations.');
  const rows = convs || [];
  if (rows.length === 0) return [];

  // Other participants (names + blood types + photos + role context)
  const otherIds = rows
    .map((c) => c.participants?.find((p) => p.user_id !== uid)?.user_id)
    .filter(Boolean);
  const { data: others } = otherIds.length
    ? await sb()
        .from('profiles')
        .select('id, full_name, blood_type, avatar_url, role, is_doctor, specialization')
        .in('id', otherIds)
    : { data: [] };
  const otherMap = new Map((others || []).map((o) => [o.id, o]));

  // Linked requests (blood type + status)
  const requestIds = [...new Set(rows.map((c) => c.request_id).filter(Boolean))];
  const { data: reqs } = requestIds.length
    ? await sb().from('donation_requests').select('id, blood_type, status').in('id', requestIds)
    : { data: [] };
  const reqMap = new Map((reqs || []).map((r) => [r.id, r]));

  // v4: hospital conversations (message-the-hospital) + the hospital a
  // doctor chat partner works under.
  const hospitalIds = [...new Set(rows.map((c) => c.hospital_id).filter(Boolean))];
  const doctorHospitalIds = (others || [])
    .filter((o) => o.role === 'doctor')
    .map((o) => o.id);
  let hospitalMap = new Map();
  if (doctorHospitalIds.length) {
    const { data: doctorHospitals } = await sb()
      .from('hospital_doctors')
      .select('doctor_id, status, hospital:hospitals!hospital_doctors_hospital_id_fkey(id, name)')
      .in('doctor_id', doctorHospitalIds)
      .eq('status', 'accepted');
    (doctorHospitals || []).forEach((hd) => {
      if (hd.hospital) hospitalMap.set(`u-${hd.doctor_id}`, hd.hospital);
    });
  }
  if (hospitalIds.length) {
    const { data: convHospitals } = await sb()
      .from('hospitals')
      .select('id, name, photo_url')
      .in('id', hospitalIds);
    (convHospitals || []).forEach((h) => hospitalMap.set(h.id, h));
  }

  // Last message per conversation (MVP scale; ordered desc, first wins)
  const convIds = rows.map((c) => c.id);
  const { data: msgs } = await sb()
    .from('messages')
    .select('conversation_id, content, created_at')
    .in('conversation_id', convIds)
    .order('created_at', { ascending: false })
    .limit(500);
  const lastMap = new Map();
  (msgs || []).forEach((m) => {
    if (!lastMap.has(m.conversation_id)) lastMap.set(m.conversation_id, m);
  });

  const mapped = rows.map((c) => {
    const otherId = c.participants?.find((p) => p.user_id !== uid)?.user_id || null;
    const other = otherId ? otherMap.get(otherId) : null;
    const req = c.request_id ? reqMap.get(c.request_id) : null;
    const last = lastMap.get(c.id);
    const hospital = c.hospital_id ? hospitalMap.get(c.hospital_id) : null;
    const otherHospital = otherId ? hospitalMap.get(`u-${otherId}`) : null;
    return {
      id: c.id,
      other_user_id: otherId,
      other_name: other?.full_name ?? 'Unknown',
      other_blood_type: other?.blood_type ?? null,
      other_avatar_url: other?.avatar_url ?? null,
      other_role: other?.role ?? null,
      other_is_doctor: other ? actsAsDoctor(other) : false,
      other_specialization: other?.specialization ?? null,
      other_hospital_name: otherHospital?.name ?? null,
      hospital_id: c.hospital_id,
      hospital_name: hospital?.name ?? null,
      hospital_photo_url: hospital?.photo_url ?? null,
      request_id: c.request_id,
      request_blood_type: req?.blood_type ?? null,
      request_status: req?.status ?? null,
      last_message: last ? last.content : null,
      last_message_at: last ? last.created_at : c.created_at,
      created_at: c.created_at
    };
  });
  mapped.sort((a, b) => new Date(b.last_message_at) - new Date(a.last_message_at));
  return mapped;
}

async function getOrCreateConversation(otherUserId, requestId = null) {
  const uid = await requireUid();
  if (otherUserId === uid) throw new Error('You cannot start a conversation with yourself.');
  const { data: id, error } = await sb().rpc('start_conversation', {
    p_other_user: otherUserId,
    p_request_id: requestId
  });
  if (error) throw fail(error, 'Could not start the conversation.');
  return { id, existing: false }; // the RPC re-uses existing conversations itself
}

// v4: message a HOSPITAL directly — goes to the hospital's admin, and the
// chat header displays the hospital name.
async function getOrCreateHospitalConversation(hospitalId) {
  const uid = await requireUid();
  if (!hospitalId) throw new Error('Hospital not found.');
  const { data: id, error } = await sb().rpc('start_hospital_conversation', {
    p_hospital_id: hospitalId
  });
  if (error) throw fail(error, 'Could not start the conversation with the hospital.');
  return { id, existing: false };
}

async function getMessages(conversationId) {
  await requireUid();
  const { data, error } = await sb()
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  if (error) throw fail(error, 'Could not load messages.');
  return data || [];
}

async function sendMessage(conversationId, content) {
  const uid = await requireUid();
  const text = String(content || '').trim();
  if (!text) throw new Error('Message cannot be empty.');
  if (text.length > 2000) throw new Error('Message is too long (max 2000 characters).');

  const { data, error } = await sb()
    .from('messages')
    .insert({ conversation_id: conversationId, sender_id: uid, content: text })
    .select()
    .single();
  if (error) throw fail(error, 'Could not send the message.');
  return data;
}

// Realtime: new messages stream to signed-in participants over a
// Supabase channel (postgres_changes, filtered by conversation).
// Delivery is subject to the same RLS policies as normal SELECTs.
function subscribeMessages(conversationId, onChange) {
  const channel = sb()
    .channel(`messages-${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`
      },
      (payload) => onChange(payload.new)
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

// ============================================================
// HOSPITALS — v4: public directory + search + detail + doctor
// applications + business (admin) management.
// RLS: authenticated may read (verified ones only for regular users);
// verification stays platform-admin-only; the hospital's own business
// admin may edit its public profile fields.
// ============================================================

function mapHospital(h) {
  if (!h) return null;
  return {
    ...h,
    admin_name: h.admin?.full_name ?? null,
    admin_avatar_url: h.admin?.avatar_url ?? null,
    admin_is_doctor: h.admin ? actsAsDoctor(h.admin) : false,
    doctor_count: h.doctor_count ?? null,
    pending_applications: h.pending_applications ?? null
  };
}

async function listHospitals(filters = {}) {
  const uid = await requireUid();
  const { data, error } = await sb()
    .from('hospitals')
    .select(
      '*, admin:profiles!hospitals_admin_id_fkey(full_name, avatar_url, role, is_doctor), doctor_count'
    )
    .order('name', { ascending: true });
  if (error) throw fail(error, 'Could not load hospitals.');

  const { data: me } = await sb().from('profiles').select('role').eq('id', uid).maybeSingle();
  const isAdmin = me?.role === 'admin';
  // Regular users see verified hospitals (plus their own while it awaits
  // verification, so the business admin can still manage it).
  let rows = isAdmin ? data || [] : (data || []).filter((h) => h.status === 'verified' || h.admin_id === uid);
  let joined = rows.map(mapHospital);

  if (filters.search) {
    const q = String(filters.search).toLowerCase();
    joined = joined.filter(
      (h) =>
        h.name.toLowerCase().includes(q) ||
        (h.city || '').toLowerCase().includes(q) ||
        h.region.toLowerCase().includes(q) ||
        (h.description || '').toLowerCase().includes(q)
    );
  }
  if (filters.region) joined = joined.filter((h) => h.region === filters.region);
  if (filters.status) joined = joined.filter((h) => h.status === filters.status);
  return joined;
}

// Full hospital detail — description, location, admin and the doctor
// roster with license IDs and contact numbers (via RPC, RLS-safe).
async function getHospital(id) {
  const uid = await requireUid();
  const { data, error } = await sb().rpc('get_hospital_detail', { p_hospital_id: id });
  if (error) throw fail(error, 'Could not load the hospital.');
  if (!data) throw new Error('Hospital not found.');

  // The viewer's own application to this hospital (doctors).
  const { data: myApp } = await sb()
    .from('hospital_doctors')
    .select('*')
    .eq('hospital_id', id)
    .eq('doctor_id', uid)
    .maybeSingle();

  return {
    ...data,
    my_application: myApp ?? null,
    is_my_hospital: data.admin_id === uid
  };
}

// ---------- Business (hospital admin) management ----------

async function businessGetMyHospital() {
  const uid = await requireUid();
  const { data, error } = await sb().rpc('business_get_my_hospital');
  if (error) throw fail(error, 'Could not load your hospital.');
  if (!data) throw new Error('No hospital is linked to your account. Contact the administrators.');
  return data;
}

async function businessUpdateMyHospital(patch) {
  await requireUid();
  const clean = {};
  if (patch.description !== undefined) {
    const desc = String(patch.description || '').trim();
    if (desc.length > 1200) throw new Error('Description is too long (max 1200 characters).');
    clean.description = desc;
  }
  if (patch.photo_url !== undefined) {
    const url = patch.photo_url === null || patch.photo_url === '' ? null : String(patch.photo_url).trim();
    if (url && (!/^https?:\/\//i.test(url) || url.length > 500))
      throw new Error('Photo must be a valid image URL (https://…) of at most 500 characters.');
    clean.photo_url = url;
  }
  if (patch.city !== undefined) {
    const city = String(patch.city || '').trim();
    if (city.length > 60) throw new Error('City name too long.');
    clean.city = city || null;
  }
  if (patch.address !== undefined) {
    const address = String(patch.address || '').trim();
    if (address.length > 200) throw new Error('Address is too long (max 200 characters).');
    clean.address = address || null;
  }
  if (patch.contact_number !== undefined) {
    const contact = String(patch.contact_number || '').trim();
    if (contact.length > 40) throw new Error('Contact number is too long (max 40 characters).');
    clean.contact_number = contact || null;
  }
  // Guarded fields: a business can never rename / move / verify itself.
  if (
    (patch.name !== undefined) ||
    (patch.region !== undefined) ||
    (patch.status !== undefined)
  ) {
    throw new Error('Hospital name, region and verification are managed by platform administrators.');
  }

  const { data, error } = await sb().rpc('business_update_my_hospital', { p_patch: clean });
  if (error) throw fail(error, 'Could not save your hospital profile.');
  return data;
}

// ---------- Doctor applications ----------
// Doctors apply with their license ID (already on their profile) + a
// note; the hospital admin verifies and accepts.

async function applyToHospital(hospitalId, { note = '' } = {}) {
  await requireUid();
  const { data, error } = await sb().rpc('apply_to_hospital', {
    p_hospital_id: hospitalId,
    p_note: String(note || '').trim()
  });
  if (error) throw fail(error, 'Could not submit your application.');
  return data || { success: true };
}

async function listMyDoctorApplications() {
  await requireUid();
  const { data, error } = await sb().rpc('list_my_doctor_applications');
  if (error) throw fail(error, 'Could not load your applications.');
  return data || [];
}

async function hospitalSetDoctorApplicationStatus(applicationId, status, reason = '') {
  await requireUid();
  const { data, error } = await sb().rpc('hospital_set_doctor_application_status', {
    p_application_id: applicationId,
    p_status: status,
    p_reason: String(reason || '').trim()
  });
  if (error) throw fail(error, 'Could not review the application.');
  return data;
}

// ---------- Hospital notifications (business admin inbox) ----------

async function listHospitalNotifications() {
  await requireUid();
  const { data, error } = await sb().from('hospital_notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw fail(error, 'Could not load notifications.');
  // RLS: only the hospital's admin sees its notifications.
  return data || [];
}

async function markHospitalNotificationRead(id) {
  await requireUid();
  const { data, error } = await sb()
    .from('hospital_notifications')
    .update({ read: true })
    .eq('id', id)
    .select()
    .single();
  if (error) throw fail(error, 'Could not mark the notification.');
  return data;
}

async function markAllHospitalNotificationsRead() {
  await requireUid();
  const { error } = await sb()
    .from('hospital_notifications')
    .update({ read: true })
    .eq('read', false);
  if (error) throw fail(error, 'Could not mark the notifications.');
  return { success: true };
}

// ---------- Business stats ----------

async function businessGetStats() {
  await requireUid();
  const { data, error } = await sb().rpc('business_get_stats');
  if (error) throw fail(error, 'Could not load your statistics.');
  return data;
}

async function adminCreateHospital(data) {
  await requireUid();
  const name = String(data.name || '').trim();
  if (name.length < 3) throw new Error('Hospital name is required.');
  if (!data.region) throw new Error('Please choose a region.');

  const { data: row, error } = await sb()
    .from('hospitals')
    .insert({
      name,
      region: data.region,
      city: String(data.city || '').trim() || null,
      address: String(data.address || '').trim() || null,
      contact_number: String(data.contact_number || '').trim() || null,
      status: 'pending', // every hospital starts pending; admins verify
      notes: ''
    })
    .select()
    .single();
  if (error) throw fail(error, 'Could not add the hospital.');
  return row;
}

async function adminSetHospitalStatus(id, status, notes = '') {
  await requireUid();
  if (!['pending', 'verified', 'rejected'].includes(status)) throw new Error('Invalid status.');
  if (status === 'rejected' && !String(notes || '').trim())
    throw new Error('A reason is required when rejecting a hospital.');

  const { data: row, error } = await sb()
    .from('hospitals')
    .update({ status, notes: String(notes || '').trim() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw fail(error, 'Could not update the hospital.');
  return row;
}

// ============================================================
// DONATION RECORDS (admin outcome records — insert-only)
// The validate_donation_record trigger enforces accepted-only + donor
// ABO compatibility in the DATABASE; a successful record closes the
// request via the on_record_created trigger.
// ============================================================

async function listRecords() {
  await requireUid();
  const { data, error } = await sb()
    .from('donation_records')
    .select(
      '*, request:donation_requests!donation_records_request_id_fkey(blood_type, region, status, hospital_id), donor:profiles!donation_records_donor_id_fkey(full_name), doctor:profiles!donation_records_doctor_id_fkey(full_name), recorder:profiles!donation_records_recorded_by_fkey(full_name)'
    )
    .order('created_at', { ascending: false });
  if (error) throw fail(error, 'Could not load outcome records.');

  return (data || []).map((rec) => ({
    ...rec,
    request_blood_type: rec.request?.blood_type ?? null,
    request_region: rec.request?.region ?? null,
    request_status: rec.request?.status ?? null,
    request_hospital_id: rec.request?.hospital_id ?? null,
    donor_name: rec.donor?.full_name ?? null,
    doctor_name: rec.doctor?.full_name ?? null,
    recorded_by_name: rec.recorder?.full_name ?? 'Administrator'
  }));
}

// Business variant: records for requests attached to MY hospital.
async function businessListRecords() {
  const uid = await requireUid();
  const { data: h } = await sb()
    .from('hospitals')
    .select('id')
    .eq('admin_id', uid)
    .maybeSingle();
  if (!h) throw new Error('No hospital is linked to your account.');
  const all = await listRecords();
  return all.filter((rec) => rec.request_hospital_id === h.id);
}

async function createRecord({ request_id, donor_id, outcome, reason }) {
  const uid = await requireUid();
  if (!['successful', 'failed'].includes(outcome)) throw new Error('Invalid outcome.');
  const cleanReason = String(reason || '').trim();
  if (outcome === 'failed' && !cleanReason)
    throw new Error('A reason is required when recording a failed outcome.');

  // Friendly pre-check (the DB trigger is the authoritative backstop)
  const { data: r } = await sb().from('donation_requests').select('status').eq('id', request_id).maybeSingle();
  if (!r) throw new Error('Request not found.');
  if (r.status !== 'accepted') throw new Error('Outcome records can only be added to accepted requests.');

  // v4: the assigned doctor (witness) travels with the record.
  let doctorId = null;
  if (donor_id) {
    const { data: acc } = await sb()
      .from('donor_acceptances')
      .select('doctor_id')
      .eq('request_id', request_id)
      .eq('donor_id', donor_id)
      .neq('status', 'withdrawn')
      .maybeSingle();
    doctorId = acc?.doctor_id ?? null;
  }

  const { data: row, error } = await sb()
    .from('donation_records')
    .insert({
      request_id,
      donor_id: donor_id || null,
      doctor_id: doctorId,
      outcome,
      reason: cleanReason,
      recorded_by: uid
    })
    .select()
    .single();
  if (error) throw fail(error, 'Could not record the outcome.');
  return row;
}

// ============================================================
// USER MANAGEMENT (admin) — via SECURITY DEFINER RPCs.
// Roles can ONLY change through admin_set_role, which refuses to
// touch the caller's own account (lockout protection).
// ============================================================

async function listUsers() {
  await requireUid();
  const { data, error } = await sb().rpc('admin_list_users');
  if (error) throw fail(error, 'Could not load users.');
  return (data || []).map((u) => ({
    id: u.id,
    email: u.email,
    verified: u.verified,
    profile: {
      id: u.id,
      full_name: u.full_name,
      role: u.role,
      blood_type: u.blood_type,
      region: u.region,
      city: u.city,
      is_available: u.is_available,
      avatar_url: u.avatar_url ?? null,
      created_at: u.created_at
    }
  }));
}

async function toggleUserRole(userId) {
  const uid = await requireUid();
  if (userId === uid) throw new Error('You cannot change your own role.');

  const { data: target, error: tErr } = await sb()
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();
  if (tErr) throw fail(tErr, 'Could not load the user.');
  if (!target) throw new Error('User not found.');

  const newRole = target.role === 'admin' ? 'user' : 'admin';
  const { data, error } = await sb().rpc('admin_set_role', {
    p_target_user: userId,
    p_new_role: newRole
  });
  if (error) throw fail(error, 'Could not change the role.');
  return { id: userId, profile: { role: data?.role ?? newRole } };
}

// ============================================================
// ADMIN STATS + LOGS — every number is a live SQL count via RPC;
// nothing is hardcoded. Logs are trigger-written; the client has no
// write permission on activity_logs at all.
// ============================================================

async function getStats() {
  await requireUid();
  const { data, error } = await sb().rpc('admin_get_stats');
  if (error) throw fail(error, 'Could not load statistics.');
  return data;
}

async function listLogs() {
  await requireUid();
  const { data, error } = await sb()
    .from('activity_logs')
    .select('*, actor:profiles!activity_logs_actor_id_fkey(full_name)')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw fail(error, 'Could not load the activity log.');
  return (data || []).map((l) => ({ ...l, actor_name: l.actor?.full_name ?? 'System' }));
}

// Public counters for the landing page — RPC granted to anon,
// returns aggregates only (no personal data).
async function getPublicStats() {
  const { data, error } = await sb().rpc('get_public_stats');
  if (error) throw fail(error, 'Could not load public stats.');
  return data;
}

export default {
  // auth
  getSession,
  onAuthStateChange,
  register,
  verifyEmail,
  login,
  logout,
  requestPasswordReset,
  resetPassword,

  // profile
  getMyProfile,
  updateMyProfile,
  getPublicProfile,

  // donation offers ("donate" side)
  getMyOffer,
  upsertMyOffer,
  listDonors,

  // requests & matching
  listRequests,
  getMyRequests,
  getRequest,
  createRequest,
  updateRequest,
  cancelRequest,
  setRequestStatus,
  getMatches,

  // v4: donor acceptances + doctor assignment
  acceptRequestAsDonor,
  setAcceptanceDoctor,
  withdrawAcceptance,
  getMyDoctorAssignments,

  // messaging
  listConversations,
  getOrCreateConversation,
  getOrCreateHospitalConversation,
  getMessages,
  sendMessage,
  subscribeMessages,

  // hospitals (v4)
  listHospitals,
  getHospital,
  adminCreateHospital,
  adminSetHospitalStatus,
  businessGetMyHospital,
  businessUpdateMyHospital,
  applyToHospital,
  listMyDoctorApplications,
  hospitalSetDoctorApplicationStatus,
  listHospitalNotifications,
  markHospitalNotificationRead,
  markAllHospitalNotificationsRead,
  businessGetStats,

  // records
  listRecords,
  businessListRecords,
  createRecord,

  // users & admin
  listUsers,
  toggleUserRole,
  getStats,
  listLogs,

  // public
  getPublicStats
};

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
import { BLOOD_TYPES, REGIONS, donorTypesFor } from './constants';
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

function mapAuthUser(authUser, profile) {
  const p = profile || {
    id: authUser.id,
    full_name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'User',
    role: 'user',
    blood_type: null,
    region: null,
    city: null,
    is_available: true,
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
    hospital_name: r.hospital?.name ?? null,
    hospital_status: r.hospital?.status ?? null
  };
}

const REQUEST_SELECT =
  '*, requester:profiles!donation_requests_requester_id_fkey(full_name), hospital:hospitals!donation_requests_hospital_id_fkey(name, status)';

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

async function register({ full_name, email, password }) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanName = String(full_name || '').trim();
  if (!cleanName || cleanName.length < 2) throw new Error('Please enter your full name.');
  if (!isValidEmail(cleanEmail)) throw new Error('Please enter a valid email address.');
  const pwError = validatePassword(password);
  if (pwError) throw new Error(pwError);

  const { error } = await sb().auth.signUp({
    email: cleanEmail,
    password,
    options: {
      data: { full_name: cleanName },
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
  if (patch.is_available !== undefined) clean.is_available = Boolean(patch.is_available);

  // role is IGNORED on purpose: a user must never change their own role.
  if (patch.role !== undefined && patch.role !== current?.role)
    throw new Error('You cannot change your own role.');

  const { data, error } = await sb().from('profiles').update(clean).eq('id', uid).select().single();
  if (error) throw fail(error, 'Could not save profile.');
  return data;
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
  await requireUid();
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
      '*, donor:profiles!donation_records_donor_id_fkey(full_name), recorder:profiles!donation_records_recorded_by_fkey(full_name)'
    )
    .eq('request_id', id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  return {
    ...joined,
    record: rec
      ? {
          ...rec,
          donor_name: rec.donor?.full_name ?? null,
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
  if (data.description && String(data.description).length > 600)
    throw new Error('Description is too long (max 600 characters).');
  return {
    blood_type: data.blood_type,
    units_needed: units,
    region: data.region,
    urgency: ['routine', 'urgent', 'critical'].includes(data.urgency) ? data.urgency : 'routine',
    needed_by: data.needed_by || null,
    hospital_id: data.hospital_id || null,
    description: String(data.description || '').trim()
  };
}

async function createRequest(data) {
  const uid = await requireUid();
  const clean = validateRequestData(data);

  if (clean.hospital_id) {
    const { data: h } = await sb().from('hospitals').select('status').eq('id', clean.hospital_id).maybeSingle();
    if (!h || h.status !== 'verified') throw new Error('Only verified hospitals can be selected.');
  }

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
  if (clean.hospital_id) {
    const { data: h } = await sb().from('hospitals').select('status').eq('id', clean.hospital_id).maybeSingle();
    if (!h || h.status !== 'verified') throw new Error('Only verified hospitals can be selected.');
  }

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
// MESSAGING (1:1 conversations)
// RLS: only participants read/write; conversations are created only
// by the start_conversation RPC. Realtime streams INSERTs on messages.
// ============================================================

async function listConversations() {
  const uid = await requireUid();
  const { data: convs, error } = await sb()
    .from('conversations')
    .select('id, request_id, created_at, participants:conversation_participants(user_id)')
    .order('created_at', { ascending: false });
  if (error) throw fail(error, 'Could not load conversations.');
  const rows = convs || [];
  if (rows.length === 0) return [];

  // Other participants (names + blood types)
  const otherIds = rows
    .map((c) => c.participants?.find((p) => p.user_id !== uid)?.user_id)
    .filter(Boolean);
  const { data: others } = otherIds.length
    ? await sb().from('profiles').select('id, full_name, blood_type').in('id', otherIds)
    : { data: [] };
  const otherMap = new Map((others || []).map((o) => [o.id, o]));

  // Linked requests (blood type + status)
  const requestIds = [...new Set(rows.map((c) => c.request_id).filter(Boolean))];
  const { data: reqs } = requestIds.length
    ? await sb().from('donation_requests').select('id, blood_type, status').in('id', requestIds)
    : { data: [] };
  const reqMap = new Map((reqs || []).map((r) => [r.id, r]));

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
    return {
      id: c.id,
      other_user_id: otherId,
      other_name: other?.full_name ?? 'Unknown',
      other_blood_type: other?.blood_type ?? null,
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
// HOSPITALS (Light scope: admin-managed list + verification)
// RLS: everyone authenticated may read; only admins may write.
// ============================================================

async function listHospitals() {
  const uid = await requireUid();
  const { data, error } = await sb().from('hospitals').select('*').order('name', { ascending: true });
  if (error) throw fail(error, 'Could not load hospitals.');

  const { data: me } = await sb().from('profiles').select('role').eq('id', uid).maybeSingle();
  const isAdmin = me?.role === 'admin';
  // Regular users see verified hospitals only; admins manage the full list.
  return isAdmin ? data || [] : (data || []).filter((h) => h.status === 'verified');
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
      '*, request:donation_requests!donation_records_request_id_fkey(blood_type, region), donor:profiles!donation_records_donor_id_fkey(full_name), recorder:profiles!donation_records_recorded_by_fkey(full_name)'
    )
    .order('created_at', { ascending: false });
  if (error) throw fail(error, 'Could not load outcome records.');

  return (data || []).map((rec) => ({
    ...rec,
    request_blood_type: rec.request?.blood_type ?? null,
    request_region: rec.request?.region ?? null,
    donor_name: rec.donor?.full_name ?? null,
    recorded_by_name: rec.recorder?.full_name ?? 'Administrator'
  }));
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

  const { data: row, error } = await sb()
    .from('donation_records')
    .insert({
      request_id,
      donor_id: donor_id || null,
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

  // requests & matching
  listRequests,
  getMyRequests,
  getRequest,
  createRequest,
  updateRequest,
  cancelRequest,
  setRequestStatus,
  getMatches,

  // messaging
  listConversations,
  getOrCreateConversation,
  getMessages,
  sendMessage,
  subscribeMessages,

  // hospitals
  listHospitals,
  adminCreateHospital,
  adminSetHospitalStatus,

  // records
  listRecords,
  createRecord,

  // users & admin
  listUsers,
  toggleUserRole,
  getStats,
  listLogs,

  // public
  getPublicStats
};

// ============================================================
// PHASE 1 MOCK BACKEND
// Simulates the future Supabase backend so the entire UI works today,
// with no server. Data persists in localStorage (survives page refresh).
//
// Every authorization check here mirrors a real PostgreSQL rule in
// supabase/schema.sql — search "[RLS mirror]" to see exactly where each
// rule will live in Phase 2. When Supabase connects, these JS checks are
// REPLACED by database-enforced policies (defense in depth: the DB is the
// real gatekeeper, because anyone can bypass frontend code).
// ============================================================

import { createSeedDb } from './mockData';
import { BLOOD_TYPES, REGIONS, donorTypesFor } from './constants';
import { newId, nowIso, isValidEmail, validatePassword } from './utils';

const DB_KEY = 'HemaMatch_mock_db_v1';
const LATENCY = 220;

const delay = (ms = LATENCY) => new Promise((r) => setTimeout(r, ms));

// ---------- store ----------
let db = null;

function load() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* corrupted store -> re-seed below */
  }
  const seeded = createSeedDb();
  localStorage.setItem(DB_KEY, JSON.stringify(seeded));
  return seeded;
}

function getDb() {
  if (!db) db = load();
  return db;
}

function save() {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

function reset() {
  localStorage.removeItem(DB_KEY);
  db = null;
}

// ---------- helpers ----------

const findUser = (id) => getDb().users.find((u) => u.id === id) || null;
const findProfile = (id) => findUser(id)?.profile || null;

function currentUser() {
  const d = getDb();
  return d.currentUserId ? findUser(d.currentUserId) : null;
}

function requireUser() {
  const u = currentUser();
  if (!u) throw new Error('You must be signed in to do this.');
  return u;
}

// [RLS mirror] admin-only policies check profiles.role = 'admin'
function requireAdmin() {
  const u = requireUser();
  if (u.profile.role !== 'admin') throw new Error('Administrator access required.');
  return u;
}

function requireVerified() {
  const u = requireUser();
  if (!u.verified) throw new Error('Please verify your email address first.');
  return u;
}

// [RLS mirror] activity_logs rows are written by DB triggers in Phase 2.
// `actor` override is used for registration events, where the actor is the
// NEW account (the current session may belong to someone else or nobody).
function log(action, entity, entityId, details, actor) {
  const d = getDb();
  const a = actor || currentUser();
  d.activity_logs.unshift({
    id: newId('al'),
    actor_id: a?.id ?? null,
    actor_name: a?.profile?.full_name ?? 'System',
    action,
    entity,
    entity_id: entityId ?? null,
    details: details ?? '',
    created_at: nowIso()
  });
}

const publicUser = (u) => ({
  id: u.id,
  email: u.email,
  verified: u.verified,
  profile: { ...u.profile }
});

// ============================================================
// AUTHENTICATION
// [RLS mirror] Phase 2: Supabase Auth handles all of this. Passwords are
// hashed by Supabase — the mock stores them in plain text ONLY because
// this is a local simulation, never a real backend.
// ============================================================

async function getSession() {
  await delay(80);
  const u = currentUser();
  return u ? { user: publicUser(u) } : null;
}

async function register({ full_name, email, password }) {
  await delay();
  const d = getDb();
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanName = String(full_name || '').trim();

  if (!cleanName || cleanName.length < 2) throw new Error('Please enter your full name.');
  if (!isValidEmail(cleanEmail)) throw new Error('Please enter a valid email address.');
  const pwError = validatePassword(password);
  if (pwError) throw new Error(pwError);
  if (d.users.some((u) => u.email === cleanEmail))
    throw new Error('An account with this email already exists.');

  const user = {
    id: newId('u'),
    email: cleanEmail,
    password,
    verified: false, // email verification is ENABLED for this project
    profile: {
      id: null,
      full_name: cleanName,
      role: 'user', // [RLS mirror] default 'user'; nobody can self-assign 'admin'
      blood_type: null,
      region: null,
      city: null,
      is_available: true,
      created_at: nowIso()
    }
  };
  user.profile.id = user.id; // profiles.id = auth.users.id (1:1)
  d.users.push(user);
  log('user.registered', 'profiles', user.id, `New account registered (${cleanEmail}).`, user);
  save();
  return { email: cleanEmail };
}

// Simulates the user clicking the link in the verification email.
// Phase 2: Supabase sends a real email; this function disappears.
async function verifyEmail(email) {
  await delay();
  const d = getDb();
  const cleanEmail = String(email || '').trim().toLowerCase();
  const u = d.users.find((x) => x.email === cleanEmail);
  if (!u) throw new Error('No account found for this email.');
  u.verified = true;
  log('user.verified', 'profiles', u.id, 'Email address verified.', u);
  save();
  return { verified: true };
}

async function login({ email, password }) {
  await delay();
  const d = getDb();
  const cleanEmail = String(email || '').trim().toLowerCase();
  const u = d.users.find((x) => x.email === cleanEmail);
  if (!u || u.password !== password) throw new Error('Invalid email or password.');
  if (!u.verified)
    throw new Error('Please verify your email address before signing in. Check your inbox.');
  d.currentUserId = u.id;
  save();
  return { user: publicUser(u) };
}

async function logout() {
  await delay(60);
  getDb().currentUserId = null;
  save();
  return { success: true };
}

// Simulated password recovery. Phase 2: Supabase sends a real reset email.
async function requestPasswordReset(email) {
  await delay();
  const cleanEmail = String(email || '').trim().toLowerCase();
  // Deliberately vague (never reveal whether an account exists).
  return { sent: true, email: cleanEmail };
}

async function resetPassword({ email, password }) {
  await delay();
  const d = getDb();
  const cleanEmail = String(email || '').trim().toLowerCase();
  const u = d.users.find((x) => x.email === cleanEmail);
  if (!u) throw new Error('No account found for this email.');
  const pwError = validatePassword(password);
  if (pwError) throw new Error(pwError);
  u.password = password;
  log('user.password_reset', 'profiles', u.id, 'Password reset completed.');
  save();
  return { success: true };
}

// ============================================================
// PROFILES
// ============================================================

async function getMyProfile() {
  const u = requireUser();
  await delay(60);
  return { ...u.profile };
}

// [RLS mirror] policy: profiles update own row (id = auth.uid())
// + trigger protect_role_column: role can only be changed by an admin
async function updateMyProfile(patch) {
  await delay();
  const u = requireVerified();
  const p = u.profile;

  if (patch.full_name !== undefined) {
    const name = String(patch.full_name || '').trim();
    if (name.length < 2) throw new Error('Name must be at least 2 characters.');
    p.full_name = name;
  }
  if (patch.blood_type !== undefined) {
    if (patch.blood_type !== null && !BLOOD_TYPES.includes(patch.blood_type))
      throw new Error('Invalid blood type.');
    p.blood_type = patch.blood_type || null;
  }
  if (patch.region !== undefined) {
    if (patch.region !== null && patch.region !== '' && !REGIONS.includes(patch.region))
      throw new Error('Invalid region.');
    p.region = patch.region || null;
  }
  if (patch.city !== undefined) {
    const city = String(patch.city || '').trim();
    if (city.length > 60) throw new Error('City name too long.');
    p.city = city || null;
  }
  if (patch.is_available !== undefined) p.is_available = Boolean(patch.is_available);

  // role is IGNORED on purpose: a user must never change their own role.
  if (patch.role !== undefined && patch.role !== p.role)
    throw new Error('You cannot change your own role.');

  log('profile.updated', 'profiles', u.id, 'Donor profile updated.');
  save();
  return { ...p };
}

// ============================================================
// DONATION REQUESTS
// ============================================================

function joinRequest(r) {
  const d = getDb();
  const requester = findProfile(r.requester_id);
  const hospital = r.hospital_id ? d.hospitals.find((h) => h.id === r.hospital_id) : null;
  return {
    ...r,
    requester_name: requester?.full_name ?? 'Unknown',
    hospital_name: hospital?.name ?? null,
    hospital_status: hospital?.status ?? null
  };
}

// Visibility rule (documented): all authenticated users can browse requests.
async function listRequests(filters = {}) {
  await delay();
  requireVerified();
  const d = getDb();
  let rows = d.requests.map(joinRequest);

  if (filters.status) rows = rows.filter((r) => r.status === filters.status);
  if (filters.blood_type) rows = rows.filter((r) => r.blood_type === filters.blood_type);
  if (filters.region) rows = rows.filter((r) => r.region === filters.region);
  if (filters.mine) rows = rows.filter((r) => r.requester_id === d.currentUserId);
  if (filters.search) {
    const q = String(filters.search).toLowerCase();
    rows = rows.filter(
      (r) =>
        r.requester_name.toLowerCase().includes(q) ||
        (r.description || '').toLowerCase().includes(q) ||
        r.blood_type.toLowerCase().includes(q) ||
        r.region.toLowerCase().includes(q)
    );
  }
  rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return rows;
}

async function getMyRequests() {
  return listRequests({ mine: true });
}

async function getRequest(id) {
  await delay();
  requireVerified();
  const d = getDb();
  const r = d.requests.find((x) => x.id === id);
  if (!r) throw new Error('Request not found.');
  const joined = joinRequest(r);
  const record = d.donation_records.find((x) => x.request_id === id) || null;
  return {
    ...joined,
    record: record
      ? {
          ...record,
          donor_name: record.donor_id ? findProfile(record.donor_id)?.full_name : null,
          recorded_by_name: findProfile(record.recorded_by)?.full_name ?? 'Administrator'
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

// [RLS mirror] policy: donation_requests insert with requester_id = auth.uid()
async function createRequest(data) {
  await delay();
  const u = requireVerified();
  const clean = validateRequestData(data);
  const hospital = clean.hospital_id ? getDb().hospitals.find((h) => h.id === clean.hospital_id) : null;
  if (hospital && hospital.status !== 'verified')
    throw new Error('Only verified hospitals can be selected.'); // [RLS mirror] FK + status check

  const r = {
    id: newId('r'),
    requester_id: u.id,
    status: 'pending', // initial status; never trust a client-supplied status
    ...clean,
    created_at: nowIso(),
    updated_at: nowIso()
  };
  getDb().requests.push(r);
  log('request.created', 'donation_requests', r.id, `${clean.blood_type} request created (${clean.region}, ${clean.urgency}).`);
  save();
  return joinRequest(r);
}

// [RLS mirror] policy: requester can update own row while status = 'pending'
async function updateRequest(id, data) {
  await delay();
  const u = requireVerified();
  const d = getDb();
  const r = d.requests.find((x) => x.id === id);
  if (!r) throw new Error('Request not found.');
  if (r.requester_id !== u.id) throw new Error('You can only edit your own request.');
  if (r.status !== 'pending') throw new Error('Only pending requests can be edited.');

  const clean = validateRequestData({ ...r, ...data });
  const hospital = clean.hospital_id ? d.hospitals.find((h) => h.id === clean.hospital_id) : null;
  if (hospital && hospital.status !== 'verified') throw new Error('Only verified hospitals can be selected.');

  Object.assign(r, clean, { updated_at: nowIso() });
  log('request.updated', 'donation_requests', r.id, 'Request details edited by requester.');
  save();
  return joinRequest(r);
}

// [RLS mirror] trigger validate_request_transition:
//   cancelled: requester (own) or admin; only from pending/accepted
async function cancelRequest(id) {
  await delay();
  const u = requireVerified();
  const d = getDb();
  const r = d.requests.find((x) => x.id === id);
  if (!r) throw new Error('Request not found.');
  const isOwner = r.requester_id === u.id;
  const isAdmin = u.profile.role === 'admin';
  if (!isOwner && !isAdmin) throw new Error('You can only cancel your own request.');
  if (!['pending', 'accepted'].includes(r.status))
    throw new Error('Only pending or accepted requests can be cancelled.');

  r.status = 'cancelled';
  r.updated_at = nowIso();
  log('request.status_changed', 'donation_requests', r.id, 'Status changed to cancelled.');
  save();
  return joinRequest(r);
}

// [RLS mirror] trigger validate_request_transition:
//   accepted -> requester or admin; completed -> ADMIN ONLY
async function setRequestStatus(id, status, reason = '') {
  await delay();
  const u = requireVerified();
  const d = getDb();
  const r = d.requests.find((x) => x.id === id);
  if (!r) throw new Error('Request not found.');
  const isOwner = r.requester_id === u.id;
  const isAdmin = u.profile.role === 'admin';
  if (!isOwner && !isAdmin) throw new Error('Only the requester or an administrator can change this status.');
  if (!['pending', 'accepted', 'completed', 'cancelled'].includes(status))
    throw new Error('Invalid status.');

  if (status === 'completed' && !isAdmin)
    throw new Error('Only an administrator can mark a request as completed.');

  const transitions = {
    pending: ['accepted', 'cancelled'],
    accepted: ['completed', 'cancelled'],
    completed: [],
    cancelled: []
  };
  if (status !== r.status && !transitions[r.status].includes(status))
    throw new Error(`Cannot change status from ${r.status} to ${status}.`);

  const from = r.status;
  r.status = status;
  r.updated_at = nowIso();
  log(
    'request.status_changed',
    'donation_requests',
    r.id,
    `Status changed from ${from} to ${status}${reason ? ` — reason: ${reason}` : ''}${
      isAdmin && !isOwner ? ' (administrator action)' : ''
    }`
  );
  save();
  return joinRequest(r);
}

// ============================================================
// MATCHING (preliminary filtering only)
// [RLS mirror] Phase 2: one SQL query — select from profiles where
// is_available and blood_type = any(donor_types_for(request.blood_type))
// ============================================================

async function getMatches(requestId) {
  await delay();
  const u = requireVerified();
  const d = getDb();
  const r = d.requests.find((x) => x.id === requestId);
  if (!r) throw new Error('Request not found.');
  if (r.requester_id !== u.id && u.profile.role !== 'admin')
    throw new Error('Matching results are visible only to the requester and administrators.');

  const compatible = donorTypesFor(r.blood_type);
  const donors = d.users
    .filter(
      (x) =>
        x.verified &&
        x.profile.blood_type &&
        x.profile.is_available && // availability filter
        compatible.includes(x.profile.blood_type) && // ABO/Rh matrix filter
        x.id !== r.requester_id // requester never matches themself
    )
    .map((x) => ({
      id: x.id,
      full_name: x.profile.full_name,
      blood_type: x.profile.blood_type,
      region: x.profile.region,
      city: x.profile.city,
      same_region: x.profile.region === r.region, // ranking hint, not a hard filter
      created_at: x.profile.created_at
    }))
    .sort((a, b) => Number(b.same_region) - Number(a.same_region));

  return { request: joinRequest(r), donors, compatible_types: compatible };
}

// ============================================================
// MESSAGING (1:1 conversations, participant-checked)
// [RLS mirror] policies: only conversation participants may read/insert;
// Phase 2 uses the security-definer RPC start_conversation()
// ============================================================

function myConversations() {
  const d = getDb();
  const uid = d.currentUserId;
  const ids = d.conversation_participants.filter((p) => p.user_id === uid).map((p) => p.conversation_id);
  return d.conversations.filter((c) => ids.includes(c.id));
}

function isParticipant(conversationId, userId) {
  return getDb().conversation_participants.some(
    (p) => p.conversation_id === conversationId && p.user_id === userId
  );
}

async function listConversations() {
  await delay();
  const u = requireVerified();
  const d = getDb();

  const rows = myConversations().map((c) => {
    const otherId = d.conversation_participants
      .filter((p) => p.conversation_id === c.id && p.user_id !== u.id)
      .map((p) => p.user_id)[0];
    const other = findProfile(otherId);
    const msgs = d.messages
      .filter((m) => m.conversation_id === c.id)
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    const last = msgs[msgs.length - 1];
    const req = c.request_id ? d.requests.find((r) => r.id === c.request_id) : null;
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
  rows.sort((a, b) => new Date(b.last_message_at) - new Date(a.last_message_at));
  return rows;
}

// Creates the conversation if it does not exist yet.
// [RLS mirror] Phase 2: RPC start_conversation(other_user, request_id)
async function getOrCreateConversation(otherUserId, requestId = null) {
  await delay();
  const u = requireVerified();
  const other = findUser(otherUserId);
  if (!other) throw new Error('The person you are trying to reach does not exist.');
  if (otherUserId === u.id) throw new Error('You cannot start a conversation with yourself.');

  const d = getDb();
  const mine = new Set(
    d.conversation_participants.filter((p) => p.user_id === u.id).map((p) => p.conversation_id)
  );
  const existing = d.conversations.find(
    (c) =>
      mine.has(c.id) &&
      isParticipant(c.id, otherUserId) &&
      (requestId ? c.request_id === requestId : true)
  );
  if (existing) return { id: existing.id, existing: true };

  const c = { id: newId('c'), request_id: requestId, created_by: u.id, created_at: nowIso() };
  d.conversations.push(c);
  d.conversation_participants.push(
    { id: newId('cp'), conversation_id: c.id, user_id: u.id },
    { id: newId('cp'), conversation_id: c.id, user_id: otherUserId }
  );
  log('conversation.created', 'conversations', c.id, `Conversation started with ${other.profile.full_name}.`);
  save();
  return { id: c.id, existing: false };
}

async function getMessages(conversationId) {
  await delay(90);
  const u = requireVerified();
  // [RLS mirror] policy: messages select where participant of the conversation
  if (!isParticipant(conversationId, u.id))
    throw new Error('You are not a participant of this conversation.');
  return getDb()
    .messages.filter((m) => m.conversation_id === conversationId)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
}

async function sendMessage(conversationId, content) {
  const u = requireVerified();
  const text = String(content || '').trim();
  if (!text) throw new Error('Message cannot be empty.');
  if (text.length > 2000) throw new Error('Message is too long (max 2000 characters).');
  // [RLS mirror] policy: messages insert where participant AND sender = auth.uid()
  if (!isParticipant(conversationId, u.id))
    throw new Error('You are not a participant of this conversation.');

  await delay(120);
  const msg = {
    id: newId('m'),
    conversation_id: conversationId,
    sender_id: u.id,
    content: text,
    created_at: nowIso()
  };
  getDb().messages.push(msg);
  save();
  return msg;
}

// ============================================================
// HOSPITALS (Light scope: admin-managed list + verification badge)
// ============================================================

async function listHospitals() {
  await delay();
  const u = requireVerified();
  const d = getDb();
  // Regular users see verified hospitals only; admins manage the full list.
  const rows =
    u.profile.role === 'admin' ? d.hospitals : d.hospitals.filter((h) => h.status === 'verified');
  return [...rows].sort((a, b) => a.name.localeCompare(b.name));
}

// [RLS mirror] policy: hospitals insert/update — admin only
async function adminCreateHospital(data) {
  await delay();
  requireAdmin();
  const d = getDb();
  const name = String(data.name || '').trim();
  if (name.length < 3) throw new Error('Hospital name is required.');
  if (d.hospitals.some((h) => h.name.toLowerCase() === name.toLowerCase()))
    throw new Error('A hospital with this name already exists.');
  if (!data.region) throw new Error('Please choose a region.');

  const h = {
    id: newId('h'),
    name,
    region: data.region,
    city: String(data.city || '').trim() || null,
    address: String(data.address || '').trim() || null,
    contact_number: String(data.contact_number || '').trim() || null,
    status: 'pending', // every hospital starts pending; admins verify
    notes: '',
    created_at: nowIso()
  };
  d.hospitals.push(h);
  log('hospital.created', 'hospitals', h.id, `Hospital record added (${h.name}).`);
  save();
  return h;
}

async function adminSetHospitalStatus(id, status, notes = '') {
  await delay();
  requireAdmin();
  const d = getDb();
  const h = d.hospitals.find((x) => x.id === id);
  if (!h) throw new Error('Hospital not found.');
  if (!['pending', 'verified', 'rejected'].includes(status)) throw new Error('Invalid status.');
  if (status === 'rejected' && !notes.trim())
    throw new Error('A reason is required when rejecting a hospital.');

  const from = h.status;
  h.status = status;
  h.notes = notes.trim() || h.notes;
  log('hospital.status_changed', 'hospitals', h.id, `Status changed from ${from} to ${status}${notes ? ` — ${notes}` : ''}`);
  save();
  return h;
}

// ============================================================
// DONATION RECORDS (admin outcome records — the "transactions")
// ============================================================

async function listRecords() {
  await delay();
  requireAdmin();
  const d = getDb();
  return d.donation_records
    .map((rec) => ({
      ...rec,
      request_blood_type: d.requests.find((r) => r.id === rec.request_id)?.blood_type ?? null,
      request_region: d.requests.find((r) => r.id === rec.request_id)?.region ?? null,
      donor_name: rec.donor_id ? findProfile(rec.donor_id)?.full_name ?? null : null,
      recorded_by_name: findProfile(rec.recorded_by)?.full_name ?? 'Administrator'
    }))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

// [RLS mirror] policy: donation_records insert — admin only
// [RLS mirror] trigger: successful record closes the request (completed)
async function createRecord({ request_id, donor_id, outcome, reason }) {
  await delay();
  const admin = requireAdmin();
  const d = getDb();
  const r = d.requests.find((x) => x.id === request_id);
  if (!r) throw new Error('Request not found.');
  if (r.status !== 'accepted')
    throw new Error('Outcome records can only be added to accepted requests.');
  if (!['successful', 'failed'].includes(outcome)) throw new Error('Invalid outcome.');
  const cleanReason = String(reason || '').trim();
  if (outcome === 'failed' && !cleanReason)
    throw new Error('A reason is required when recording a failed outcome.');

  let donor = null;
  if (donor_id) {
    donor = findProfile(donor_id);
    if (!donor) throw new Error('Selected donor does not exist.');
    // The recorded donor must be ABO-compatible with the request (sanity check).
    if (donor.blood_type && !donorTypesFor(r.blood_type).includes(donor.blood_type))
      throw new Error('The selected donor has an incompatible blood type for this request.');
  }

  const rec = {
    id: newId('dr'),
    request_id,
    donor_id: donor_id || null,
    outcome,
    reason: cleanReason,
    recorded_by: admin.id,
    created_at: nowIso()
  };
  d.donation_records.push(rec);

  if (outcome === 'successful') {
    r.status = 'completed'; // successful record closes the request
    r.updated_at = nowIso();
    log('request.status_changed', 'donation_requests', r.id, 'Status changed from accepted to completed (successful donation record).');
  }
  log(
    'record.created',
    'donation_records',
    rec.id,
    `Outcome recorded for request ${r.id}: ${outcome}${cleanReason ? ` — ${cleanReason}` : ''}`
  );
  save();
  return rec;
}

// ============================================================
// USER MANAGEMENT (admin)
// ============================================================

async function listUsers() {
  await delay();
  requireAdmin();
  const d = getDb();
  return d.users
    .map((u) => ({ ...publicUser(u), password: undefined })) // never expose passwords
    .sort((a, b) => a.profile.full_name.localeCompare(b.profile.full_name));
}

// [RLS mirror] trigger protect_role_column / admin policy: role changes are
// admin-only, and an admin can never demote themself (lockout protection).
async function toggleUserRole(userId) {
  await delay();
  const admin = requireAdmin();
  if (userId === admin.id) throw new Error('You cannot change your own role.');
  const target = findUser(userId);
  if (!target) throw new Error('User not found.');

  target.profile.role = target.profile.role === 'admin' ? 'user' : 'admin';
  log(
    'user.role_changed',
    'profiles',
    target.id,
    `Role of ${target.profile.full_name} changed to ${target.profile.role}.`
  );
  save();
  return publicUser(target);
}

// ============================================================
// ADMIN STATS + LOGS
// All numbers are computed live from the data — nothing is hardcoded.
// [RLS mirror] Phase 2: SQL count() queries.
// ============================================================

async function getStats() {
  await delay();
  requireAdmin();
  const d = getDb();

  const count = (fn) => d.requests.filter(fn).length;
  const donors = d.users.filter((u) => u.profile.blood_type && u.profile.is_available).length;

  return {
    total_users: d.users.length,
    available_donors: donors,
    requests: {
      total: d.requests.length,
      pending: count((r) => r.status === 'pending'),
      accepted: count((r) => r.status === 'accepted'),
      completed: count((r) => r.status === 'completed'),
      cancelled: count((r) => r.status === 'cancelled')
    },
    hospitals: {
      total: d.hospitals.length,
      verified: d.hospitals.filter((h) => h.status === 'verified').length,
      pending: d.hospitals.filter((h) => h.status === 'pending').length,
      rejected: d.hospitals.filter((h) => h.status === 'rejected').length
    },
    records: {
      total: d.donation_records.length,
      successful: d.donation_records.filter((r) => r.outcome === 'successful').length,
      failed: d.donation_records.filter((r) => r.outcome === 'failed').length
    },
    conversations: d.conversations.length
  };
}

async function listLogs() {
  await delay();
  requireAdmin();
  return [...getDb().activity_logs].slice(0, 200);
}

// Public counters for the landing page (no personal data).
async function getPublicStats() {
  await delay(80);
  const d = getDb();
  return {
    donors: d.users.filter((u) => u.profile.blood_type && u.profile.is_available).length,
    open_requests: d.requests.filter((r) => r.status === 'pending').length,
    completed: d.requests.filter((r) => r.status === 'completed').length,
    hospitals: d.hospitals.filter((h) => h.status === 'verified').length
  };
}

export default {
  // dev helper (not used by the UI)
  resetMockData: reset,

  // auth
  getSession,
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

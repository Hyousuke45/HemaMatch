// ============================================================
// MOCK BACKEND — v4
// Simulates the Supabase backend so the entire UI works today,
// with no server. Data persists in localStorage (survives refresh).
//
// Every authorization check here mirrors a real PostgreSQL rule in
// supabase/schema.sql — search "[RLS mirror]" to see exactly where each
// rule lives in Phase 2. When Supabase connects, these JS checks are
// REPLACED by database-enforced policies (defense in depth).
//
// v4 additions: account types (user / doctor / business), hospital
// detail + search, doctor applications, donor acceptances with an
// assigned doctor, hospital notifications, hospital messaging and
// business (hospital admin) panels.
// ============================================================

import { createSeedDb } from './mockData';
import { BLOOD_TYPES, REGIONS, OFFER_NOTE_MAX, donorTypesFor } from './constants';
import { newId, nowIso, isValidEmail, validatePassword } from './utils';

// v5: key bumped — preferred donor types became a multi-select array
// (preferred_donor_types) and every request now carries a hospital.
const DB_KEY = 'hemamatch_mock_db_v5';
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

// ---------- mock realtime ----------
// Same-tab listeners for freshly sent messages. The UI uses the same
// subscribeMessages(conversationId, cb) contract in mock and Supabase mode.
const messageListeners = new Set();

function subscribeMessages(conversationId, onChange) {
  const listener = { conversationId, onChange };
  messageListeners.add(listener);
  return () => messageListeners.delete(listener);
}

function notifyMessageListeners(msg) {
  messageListeners.forEach((l) => {
    try {
      if (l.conversationId === msg.conversation_id) l.onChange(msg);
    } catch {
      /* listener errors must never break a send */
    }
  });
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

// A user acts as a doctor when their account type is doctor, OR when they
// are a business (hospital) admin who is also a licensed doctor — the
// client's inheritance rule: "Business … can only inherit the Doctor IF
// THE ADMIN IS ALSO A DOCTOR".
function actsAsDoctor(profile) {
  return profile?.role === 'doctor' || Boolean(profile?.is_doctor);
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

// ---------- v4: hospital helpers ----------

const findHospital = (id) => getDb().hospitals.find((h) => h.id === id) || null;

// The hospital this user administrates (business accounts).
function myHospital(user) {
  const u = user || currentUser();
  if (!u) return null;
  return getDb().hospitals.find((h) => h.admin_id === u.id) || null;
}

// The ONE hospital a doctor is accepted under (client rule: a doctor works
// under a specific hospital). Business admins who are also doctors are
// "doctors" of their own hospital.
function doctorHospitalId(userId) {
  const d = getDb();
  const p = findProfile(userId);
  if (!p) return null;
  if (p.role === 'business' && p.is_doctor) {
    const own = d.hospitals.find((h) => h.admin_id === userId);
    if (own) return own.id;
  }
  const accepted = d.hospital_doctors.find(
    (hd) => hd.doctor_id === userId && hd.status === 'accepted'
  );
  return accepted ? accepted.hospital_id : null;
}

// The doctors assignable to transactions at a hospital: the accepted
// roster, plus the business admin when they are also a licensed doctor.
function hospitalDoctorSet(hospitalId) {
  const d = getDb();
  if (!hospitalId) return [];
  const h = findHospital(hospitalId);
  if (!h) return [];
  const rows = d.hospital_doctors
    .filter((hd) => hd.hospital_id === hospitalId && hd.status === 'accepted')
    .map((hd) => {
      const p = findProfile(hd.doctor_id);
      return p
        ? {
            id: p.id,
            full_name: p.full_name,
            specialization: p.specialization || null,
            doctor_license_id: p.doctor_license_id || null,
            contact_number: p.contact_number || null,
            avatar_url: p.avatar_url || null,
            via_application: true
          }
        : null;
    })
    .filter(Boolean);
  const admin = findProfile(h.admin_id);
  if (admin && admin.is_doctor) {
    rows.push({
      id: admin.id,
      full_name: admin.full_name,
      specialization: admin.specialization || null,
      doctor_license_id: admin.doctor_license_id || null,
      contact_number: admin.contact_number || null,
      avatar_url: admin.avatar_url || null,
      via_application: false // hospital admin who is also a doctor
    });
  }
  return rows;
}

// Can this user manage the hospital (verify applications, records…)?
// [RLS mirror] policies check role = 'admin' OR hospitals.admin_id = auth.uid()
function canManageHospital(user, hospitalId) {
  if (!user) return false;
  if (user.profile.role === 'admin') return true;
  const h = findHospital(hospitalId);
  return Boolean(h && h.admin_id === user.id);
}

// v4: notify a hospital — notifications land in the business admin's panel.
// [RLS mirror] Phase 2: hospital_notifications insert via trigger/RPC.
function notifyHospital(hospitalId, type, title, body, requestId = null, actor = null) {
  const d = getDb();
  if (!hospitalId || !findHospital(hospitalId)) return;
  d.hospital_notifications.unshift({
    id: newId('hn'),
    hospital_id: hospitalId,
    type,
    title,
    body,
    request_id: requestId,
    actor_id: actor?.id ?? null,
    read: false,
    created_at: nowIso()
  });
}

// ============================================================
// AUTHENTICATION
// [RLS mirror] Phase 2: Supabase Auth handles all of this.
// ============================================================

async function getSession() {
  await delay(80);
  const u = currentUser();
  return u ? { user: publicUser(u) } : null;
}

// v4: registration now picks an account type.
//   user     -> plain Donor/Recipient account
//   doctor   -> Donor/Recipient + doctor credentials (they still apply to
//               a hospital separately — the hospital admin verifies them)
//   business -> creates the hospital record with this user as its admin
async function register({
  full_name,
  email,
  password,
  account_type = 'user',
  doctor = {},
  hospital = {}
}) {
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

  const type = ['user', 'doctor', 'business'].includes(account_type) ? account_type : 'user';

  // Doctor accounts must present their license and contact details.
  let doctorFields = {};
  if (type === 'doctor') {
    const license = String(doctor.license_id || '').trim();
    const contact = String(doctor.contact_number || '').trim();
    const spec = String(doctor.specialization || '').trim();
    if (!license) throw new Error('Please enter your doctor license / PRC ID number.');
    if (license.length > 40) throw new Error('License ID is too long (max 40 characters).');
    if (!contact) throw new Error('Please enter your contact number.');
    if (contact.length > 40) throw new Error('Contact number is too long (max 40 characters).');
    doctorFields = {
      doctor_license_id: license,
      specialization: spec || null,
      contact_number: contact
    };
  }

  // Business accounts create their hospital (starts Pending until a
  // platform administrator verifies it).
  let newHospital = null;
  if (type === 'business') {
    const hName = String(hospital.name || '').trim();
    if (hName.length < 3) throw new Error('Please enter your hospital\u2019s name (at least 3 characters).');
    if (d.hospitals.some((h) => h.name.toLowerCase() === hName.toLowerCase()))
      throw new Error('A hospital with this name already exists.');
    if (!hospital.region || !REGIONS.includes(hospital.region))
      throw new Error('Please choose the region where your hospital is located.');
    newHospital = {
      id: newId('h'),
      admin_id: null, // set below once the user id exists
      name: hName,
      region: hospital.region,
      city: String(hospital.city || '').trim() || null,
      address: String(hospital.address || '').trim() || null,
      contact_number: String(hospital.contact_number || '').trim() || null,
      description: String(hospital.description || '').trim() || '',
      photo_url: null,
      status: 'pending', // every hospital starts pending; admins verify
      notes: '',
      created_at: nowIso()
    };
  }

  const user = {
    id: newId('u'),
    email: cleanEmail,
    password,
    verified: false, // email verification is ENABLED for this project
    profile: {
      id: null,
      full_name: cleanName,
      role: type, // [RLS mirror] nobody can self-assign 'admin'
      blood_type: null,
      region: null,
      city: null,
      is_available: true,
      avatar_url: null,
      is_doctor: false,
      ...doctorFields,
      created_at: nowIso()
    }
  };
  user.profile.id = user.id; // profiles.id = auth.users.id (1:1)
  d.users.push(user);

  if (newHospital) {
    newHospital.admin_id = user.id;
    d.hospitals.push(newHospital);
    log(
      'hospital.created',
      'hospitals',
      newHospital.id,
      `Hospital record created by business registration (${newHospital.name}) — awaiting verification.`,
      user
    );
  }

  log(
    'user.registered',
    'profiles',
    user.id,
    type === 'user'
      ? `New account registered (${cleanEmail}).`
      : `New ${type} account registered (${cleanEmail}).`,
    user
  );
  save();
  return { email: cleanEmail };
}

// Simulates the user clicking the link in the verification email.
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
  if (patch.avatar_url !== undefined) {
    const url = patch.avatar_url === null || patch.avatar_url === '' ? null : String(patch.avatar_url).trim();
    if (url && (!/^https?:\/\//i.test(url) || url.length > 500))
      throw new Error('Photo must be a valid image URL (https://…) of at most 500 characters.');
    p.avatar_url = url;
  }

  // v4: doctor credentials. A doctor must always keep a license + contact;
  // a business admin may toggle "I am also a licensed doctor".
  if (patch.is_doctor !== undefined) {
    if (p.role !== 'business')
      throw new Error('Only business (hospital) accounts can toggle the doctor ability.');
    const next = Boolean(patch.is_doctor);
    if (next && !String(patch.doctor_license_id ?? p.doctor_license_id ?? '').trim())
      throw new Error('Enter your doctor license / PRC ID to enable doctor abilities.');
    p.is_doctor = next;
  }
  if (patch.doctor_license_id !== undefined) {
    const license = String(patch.doctor_license_id || '').trim();
    if (license.length > 40) throw new Error('License ID is too long (max 40 characters).');
    if (p.role === 'doctor' && !license)
      throw new Error('A doctor account must always have a license ID.');
    p.doctor_license_id = license || null;
  }
  if (patch.specialization !== undefined) {
    const spec = String(patch.specialization || '').trim();
    if (spec.length > 80) throw new Error('Specialization is too long (max 80 characters).');
    p.specialization = spec || null;
  }
  if (patch.contact_number !== undefined) {
    const contact = String(patch.contact_number || '').trim();
    if (contact.length > 40) throw new Error('Contact number is too long (max 40 characters).');
    if (p.role === 'doctor' && !contact)
      throw new Error('A doctor account must always have a contact number.');
    p.contact_number = contact || null;
  }

  if (patch.is_available !== undefined) {
    const next = Boolean(patch.is_available);
    if (next !== p.is_available) {
      p.is_available = next;
      // Keep the donation listing consistent with availability
      // [RLS mirror] SQL trigger sync_offer_with_availability does this in Phase 2
      const d = getDb();
      const offer = d.donation_offers.find((o) => o.donor_id === u.id);
      if (offer) {
        const nextStatus = next ? 'open' : 'paused';
        if (offer.status !== nextStatus) {
          const from = offer.status;
          offer.status = nextStatus;
          offer.updated_at = nowIso();
          log(
            'offer.status_changed',
            'donation_offers',
            offer.id,
            `Donor listing changed from ${from} to ${nextStatus} (availability toggle).`
          );
        }
      }
    }
  }

  // role is IGNORED on purpose: a user must never change their own role.
  if (patch.role !== undefined && patch.role !== p.role)
    throw new Error('You cannot change your own role.');

  log('profile.updated', 'profiles', u.id, 'Donor profile updated.');
  save();
  return { ...p };
}

// ============================================================
// PUBLIC PROFILE (directory-safe view of another user)
// Never exposes email or password — only what the donor directory
// already shows, plus aggregated donation history.
// [RLS mirror] Phase 2: security-definer RPC get_public_profile()
// ============================================================

async function getPublicProfile(userId) {
  await delay(120);
  requireVerified();
  const target = findProfile(userId);
  if (!target) throw new Error('User not found.');
  const d = getDb();
  const successful = d.donation_records.filter(
    (r) => r.donor_id === userId && r.outcome === 'successful'
  ).length;
  const openOffer = d.donation_offers.find((o) => o.donor_id === userId && o.status === 'open');
  const hospitalId = doctorHospitalId(userId);
  const hospital = hospitalId ? findHospital(hospitalId) : null;
  return {
    id: target.id,
    full_name: target.full_name,
    blood_type: target.blood_type,
    region: target.region,
    city: target.city,
    is_available: target.is_available,
    avatar_url: target.avatar_url || null,
    created_at: target.created_at,
    successful_donations: successful,
    offer_note: openOffer ? openOffer.note : null,
    // v4: doctors are public figures in the directory sense — their
    // hospital affiliation is shown (not their contact details).
    role: target.role,
    is_doctor: actsAsDoctor(target),
    specialization: actsAsDoctor(target) ? target.specialization || null : null,
    doctor_hospital_name: actsAsDoctor(target) && hospital ? hospital.name : null
  };
}

// ============================================================
// DONATION OFFERS (the "donate" side of the app)
// ============================================================

function joinOffer(o) {
  const p = findProfile(o.donor_id);
  return {
    ...o,
    id: o.donor_id, // the USER id — callers use donor.id to start conversations
    offer_id: o.id, // the listing id (kept for reference)
    full_name: p?.full_name ?? 'Unknown',
    blood_type: p?.blood_type ?? null,
    region: p?.region ?? null,
    city: p?.city ?? null,
    avatar_url: p?.avatar_url ?? null,
    member_since: p?.created_at ?? null
  };
}

async function getMyOffer() {
  await delay(80);
  const u = requireVerified();
  const offer = getDb().donation_offers.find((o) => o.donor_id === u.id);
  return offer ? { ...offer } : null;
}

// [RLS mirror] RPC upsert_my_offer(p_note, p_status)
async function upsertMyOffer({ note, status }) {
  await delay();
  const u = requireVerified();
  const p = u.profile;
  if (!['open', 'paused'].includes(status)) throw new Error('Invalid listing status.');
  const cleanNote = String(note || '').trim();
  if (cleanNote.length > OFFER_NOTE_MAX)
    throw new Error(`Note is too long (max ${OFFER_NOTE_MAX} characters).`);
  if (status === 'open' && (!p.blood_type || !p.region))
    throw new Error('Set your blood type and region in your profile before listing yourself as a donor.');

  const d = getDb();
  let offer = d.donation_offers.find((o) => o.donor_id === u.id);
  const isNew = !offer;
  if (isNew) {
    offer = { id: newId('o'), donor_id: u.id, created_at: nowIso() };
    d.donation_offers.push(offer);
  }
  const from = offer.status;
  offer.note = cleanNote;
  offer.status = status;
  offer.updated_at = nowIso();

  // One source of truth for "listed": the availability flag follows the offer
  if (p.is_available !== (status === 'open')) {
    p.is_available = status === 'open';
  }

  log(
    isNew ? 'offer.created' : 'offer.status_changed',
    'donation_offers',
    offer.id,
    isNew
      ? `Donor listing created (${status}).`
      : `Donor listing changed from ${from} to ${status}.`
  );
  save();
  return { ...offer };
}

// Donor directory: every OPEN listing, joined with directory-safe
// profile fields.
async function listDonors(filters = {}) {
  await delay();
  const u = requireVerified();
  const d = getDb();
  let rows = d.donation_offers.filter((o) => o.status === 'open').map(joinOffer);

  rows = rows.filter((r) => r.donor_id !== u.id);
  if (filters.blood_type) rows = rows.filter((r) => r.blood_type === filters.blood_type);
  if (filters.region) rows = rows.filter((r) => r.region === filters.region);

  const myRegion = u.profile.region;
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
// ============================================================

function joinRequest(r) {
  const d = getDb();
  const requester = findProfile(r.requester_id);
  const hospital = r.hospital_id ? d.hospitals.find((h) => h.id === r.hospital_id) : null;
  return {
    ...r,
    requester_name: requester?.full_name ?? 'Unknown',
    requester_avatar_url: requester?.avatar_url ?? null,
    hospital_name: hospital?.name ?? null,
    hospital_status: hospital?.status ?? null
  };
}

function joinAcceptance(a) {
  const d = getDb();
  const donor = findProfile(a.donor_id);
  const doctor = a.doctor_id ? findProfile(a.doctor_id) : null;
  const doctorHospital = doctor ? findHospital(doctorHospitalId(doctor.id)) : null;
  return {
    ...a,
    donor_name: donor?.full_name ?? 'Unknown',
    donor_avatar_url: donor?.avatar_url ?? null,
    donor_blood_type: donor?.blood_type ?? null,
    doctor_name: doctor?.full_name ?? null,
    doctor_specialization: doctor?.specialization ?? null,
    doctor_hospital_name: doctorHospital?.name ?? null
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
        r.region.toLowerCase().includes(q) ||
        (r.hospital_name || '').toLowerCase().includes(q)
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
  const u = requireVerified();
  const d = getDb();
  const r = d.requests.find((x) => x.id === id);
  if (!r) throw new Error('Request not found.');
  const record = d.donation_records.find((x) => x.request_id === id) || null;
  const acceptances = d.donor_acceptances
    .filter((a) => a.request_id === id && a.status !== 'withdrawn')
    .map(joinAcceptance);
  const myAcceptance =
    d.donor_acceptances.find(
      (a) => a.request_id === id && a.donor_id === u.id && a.status !== 'withdrawn'
    ) || null;
  return {
    ...joinRequest(r),
    compatible_types: donorTypesFor(r.blood_type),
    hospital_doctors: r.hospital_id ? hospitalDoctorSet(r.hospital_id) : [],
    acceptances,
    my_acceptance: myAcceptance ? joinAcceptance(myAcceptance) : null,
    record: record
      ? {
          ...record,
          donor_name: record.donor_id ? findProfile(record.donor_id)?.full_name : null,
          doctor_name: record.doctor_id ? findProfile(record.doctor_id)?.full_name : null,
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

// [RLS mirror] policy: donation_requests insert with requester_id = auth.uid()
async function createRequest(data) {
  await delay();
  const u = requireVerified();
  const clean = validateRequestData(data);
  const hospital = getDb().hospitals.find((h) => h.id === clean.hospital_id);
  if (!hospital || hospital.status !== 'verified')
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

  // v4 (client rule): "when the requester adds a hospital, the hospital
  // will be notified for it" — the notification reaches the business
  // admin's hospital panel.
  if (hospital) {
    notifyHospital(
      hospital.id,
      'new_request',
      'New blood request attached to your hospital',
      `${u.profile.full_name} created a ${clean.urgency} ${clean.blood_type} request (${clean.units_needed} unit${clean.units_needed === 1 ? '' : 's'}) for ${hospital.name}.`,
      r.id,
      u
    );
  }
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
  const hospital = d.hospitals.find((h) => h.id === clean.hospital_id);
  if (!hospital || hospital.status !== 'verified') throw new Error('Only verified hospitals can be selected.');

  const hospitalChanged = clean.hospital_id !== r.hospital_id;
  Object.assign(r, clean, { updated_at: nowIso() });
  log('request.updated', 'donation_requests', r.id, 'Request details edited by requester.');

  // A hospital attached during an edit notifies it too.
  if (hospital && hospitalChanged) {
    notifyHospital(
      hospital.id,
      'new_request',
      'New blood request attached to your hospital',
      `${u.profile.full_name} attached their ${clean.blood_type} request (${clean.units_needed} unit${clean.units_needed === 1 ? '' : 's'}) to ${hospital.name}.`,
      r.id,
      u
    );
  }
  save();
  return joinRequest(r);
}

// [RLS mirror] trigger validate_request_transition
async function cancelRequest(id) {
  await delay();
  const u = requireVerified();
  const d = getDb();
  const r = d.requests.find((x) => x.id === id);
  if (!r) throw new Error('Request not found.');
  const isOwner = r.requester_id === u.id;
  const isAdmin = u.profile.role === 'admin';
  const isHospitalAdmin = canManageHospital(u, r.hospital_id);
  if (!isOwner && !isAdmin && !isHospitalAdmin)
    throw new Error('You can only cancel your own request.');
  if (!['pending', 'accepted'].includes(r.status))
    throw new Error('Only pending or accepted requests can be cancelled.');

  r.status = 'cancelled';
  r.updated_at = nowIso();
  log('request.status_changed', 'donation_requests', r.id, 'Status changed to cancelled.');
  save();
  return joinRequest(r);
}

// [RLS mirror] trigger validate_request_transition:
//   accepted -> requester / admin / hospital admin / donor acceptance
//   completed -> admin, hospital admin, or a successful record
async function setRequestStatus(id, status, reason = '') {
  await delay();
  const u = requireVerified();
  const d = getDb();
  const r = d.requests.find((x) => x.id === id);
  if (!r) throw new Error('Request not found.');
  const isOwner = r.requester_id === u.id;
  const isAdmin = u.profile.role === 'admin';
  const isHospitalAdmin = canManageHospital(u, r.hospital_id);
  const isAssignedDoctor = d.donor_acceptances.some(
    (a) => a.request_id === id && a.doctor_id === u.id && a.status === 'accepted'
  );
  if (!isOwner && !isAdmin && !isHospitalAdmin && !isAssignedDoctor)
    throw new Error('Only the requester, the hospital, or the assigned doctor can change this status.');
  if (!['pending', 'accepted', 'completed', 'cancelled'].includes(status))
    throw new Error('Invalid status.');

  if (status === 'completed' && !isAdmin && !isHospitalAdmin && !isAssignedDoctor)
    throw new Error('Only an administrator, the hospital, or the assigned doctor can complete a request.');

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
// v4: DONOR ACCEPTANCES + DOCTOR ASSIGNMENT
// Client rule: "when the donor accepted the request, they will get a
// doctor assigned to them, but they can also select the doctor they
// want, only if that doctor IS in the same hospital as what the
// request inputted."
// ============================================================

// Donor accepts a request. doctorId is OPTIONAL:
//   - omitted/null -> a doctor of the request's hospital is auto-assigned
//   - provided     -> must belong to the request's hospital doctor set
async function acceptRequestAsDonor(requestId, doctorId = null) {
  await delay();
  const u = requireVerified();
  const d = getDb();
  const r = d.requests.find((x) => x.id === requestId);
  if (!r) throw new Error('Request not found.');
  if (r.requester_id === u.id) throw new Error('You cannot accept your own request.');
  if (!['pending', 'accepted'].includes(r.status))
    throw new Error('This request is no longer accepting donors.');

  const existing = d.donor_acceptances.find(
    (a) => a.request_id === requestId && a.donor_id === u.id && a.status !== 'withdrawn'
  );
  if (existing) throw new Error('You have already accepted this request.');

  // Resolve the assigned doctor (auto-assign when none was chosen).
  const hospital = r.hospital_id ? findHospital(r.hospital_id) : null;
  const doctors = hospital ? hospitalDoctorSet(hospital.id) : [];
  let assignedDoctorId = null;
  if (doctorId) {
    // [RLS mirror] the doctor must be in the request hospital's roster
    if (!doctors.some((doc) => doc.id === doctorId))
      throw new Error(
        hospital
          ? `The selected doctor is not part of ${hospital.name}. You can only choose a doctor from the hospital on this request.`
          : 'This request has no hospital, so no doctor can be assigned.'
      );
    assignedDoctorId = doctorId;
  } else if (doctors.length > 0) {
    assignedDoctorId = doctors[0].id; // auto-assign the first roster doctor
  }

  const acceptance = {
    id: newId('da'),
    request_id: requestId,
    donor_id: u.id,
    doctor_id: assignedDoctorId,
    status: 'accepted',
    created_at: nowIso(),
    updated_at: nowIso()
  };
  d.donor_acceptances.push(acceptance);

  // The first acceptance moves the request to Accepted.
  if (r.status === 'pending') {
    r.status = 'accepted';
    r.updated_at = nowIso();
  }

  const doctorName = assignedDoctorId ? findProfile(assignedDoctorId)?.full_name : null;
  log(
    'acceptance.created',
    'donor_acceptances',
    acceptance.id,
    `Donor ${u.profile.full_name} accepted request ${r.id}${
      doctorName ? ` — assigned doctor: ${doctorName}` : ' — no doctor assigned (request has no hospital)'
    }.`
  );

  // The hospital is notified that a donor accepted.
  if (hospital) {
    notifyHospital(
      hospital.id,
      'donor_accepted',
      'A donor accepted a request at your hospital',
      `${u.profile.full_name} accepted the ${r.blood_type} request of ${findProfile(r.requester_id)?.full_name ?? 'a requester'}${
        doctorName ? ` — assigned doctor: ${doctorName}` : ''
      }.`,
      r.id,
      u
    );
  }
  save();
  return joinAcceptance(acceptance);
}

// The donor (or an admin) can change the assigned doctor — still
// restricted to the request's hospital roster.
async function setAcceptanceDoctor(acceptanceId, doctorId) {
  await delay();
  const u = requireVerified();
  const d = getDb();
  const a = d.donor_acceptances.find((x) => x.id === acceptanceId);
  if (!a) throw new Error('Acceptance not found.');
  if (a.donor_id !== u.id && u.profile.role !== 'admin')
    throw new Error('Only the donor who accepted can change the assigned doctor.');
  if (a.status !== 'accepted')
    throw new Error('The doctor can only be changed while the acceptance is active.');

  const r = d.requests.find((x) => x.id === a.request_id);
  const doctors = r?.hospital_id ? hospitalDoctorSet(r.hospital_id) : [];
  if (!doctors.some((doc) => doc.id === doctorId))
    throw new Error('You can only choose a doctor from the hospital on this request.');

  a.doctor_id = doctorId;
  a.updated_at = nowIso();
  log(
    'acceptance.doctor_changed',
    'donor_acceptances',
    a.id,
    `Assigned doctor changed to ${findProfile(doctorId)?.full_name}.`
  );
  save();
  return joinAcceptance(a);
}

// A donor may withdraw their acceptance while the request is still open.
async function withdrawAcceptance(acceptanceId) {
  await delay();
  const u = requireVerified();
  const d = getDb();
  const a = d.donor_acceptances.find((x) => x.id === acceptanceId);
  if (!a) throw new Error('Acceptance not found.');
  if (a.donor_id !== u.id && u.profile.role !== 'admin')
    throw new Error('Only the donor who accepted can withdraw.');
  if (a.status !== 'accepted') throw new Error('This acceptance is no longer active.');

  a.status = 'withdrawn';
  a.updated_at = nowIso();
  log('acceptance.withdrawn', 'donor_acceptances', a.id, 'Donor withdrew their acceptance.');
  save();
  return joinAcceptance(a);
}

// The doctor's view: every transaction where they are the assigned
// witness, with the request, donor and hospital joined.
async function getMyDoctorAssignments() {
  await delay();
  const u = requireVerified();
  if (!actsAsDoctor(u.profile)) throw new Error('Only doctor accounts have assignments.');
  const d = getDb();
  const rows = d.donor_acceptances
    .filter((a) => a.doctor_id === u.id && a.status !== 'withdrawn')
    .map((a) => {
      const r = d.requests.find((x) => x.id === a.request_id);
      const record = d.donation_records.find((rec) => rec.request_id === a.request_id) || null;
      const hospital = r?.hospital_id ? findHospital(r.hospital_id) : null;
      return {
        ...joinAcceptance(a),
        // Flat request fields (mirrors the get_my_doctor_assignments RPC
        // output in Supabase mode, so MyAssignments renders identically).
        request: r ? joinRequest(r) : null,
        request_blood_type: r?.blood_type ?? null,
        request_units: r?.units_needed ?? null,
        request_urgency: r?.urgency ?? null,
        request_status: r?.status ?? null,
        request_region: r?.region ?? null,
        hospital_name: hospital?.name ?? null,
        record_outcome: record?.outcome ?? null,
        record
      };
    })
    .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
  return rows;
}

// ============================================================
// MATCHING (preliminary filtering only)
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
  const preferred = Array.isArray(r.preferred_donor_types) ? r.preferred_donor_types : [];
  const donors = d.users
    .filter(
      (x) =>
        x.verified &&
        x.profile.blood_type &&
        x.profile.is_available &&
        compatible.includes(x.profile.blood_type) &&
        x.id !== r.requester_id
    )
    .map((x) => ({
      id: x.id,
      full_name: x.profile.full_name,
      blood_type: x.profile.blood_type,
      region: x.profile.region,
      city: x.profile.city,
      avatar_url: x.profile.avatar_url || null,
      same_region: x.profile.region === r.region,
      preferred_type: preferred.includes(x.profile.blood_type),
      created_at: x.profile.created_at
    }))
    .sort((a, b) => {
      // Preferred donor types (from the compatibility checkboxes) rank
      // first, then same-region donors.
      if (a.preferred_type !== b.preferred_type) return Number(b.preferred_type) - Number(a.preferred_type);
      return Number(b.same_region) - Number(a.same_region);
    });

  return { request: joinRequest(r), donors, compatible_types: compatible };
}

// ============================================================
// MESSAGING (1:1 conversations, participant-checked)
// [RLS mirror] policies: only participants may read/insert
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

// v4: the display name context of a conversation row. Hospital
// conversations carry the hospital name in the header; doctor chats
// show the doctor's hospital beside their name (client rule).
function conversationDisplay(c, me) {
  const d = getDb();
  const otherId = d.conversation_participants
    .filter((p) => p.conversation_id === c.id && p.user_id !== me.id)
    .map((p) => p.user_id)[0];
  const other = findProfile(otherId);
  const hospital = c.hospital_id ? findHospital(c.hospital_id) : null;
  const otherHospitalId = other ? doctorHospitalId(other.id) : null;
  const otherHospital = otherHospitalId ? findHospital(otherHospitalId) : null;
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
}

async function listConversations() {
  await delay();
  const u = requireVerified();
  const rows = myConversations().map((c) => conversationDisplay(c, u));
  rows.sort((a, b) => new Date(b.last_message_at) - new Date(a.last_message_at));
  return rows;
}

// Creates the conversation if it does not exist yet.
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

  const c = { id: newId('c'), request_id: requestId, hospital_id: null, created_by: u.id, created_at: nowIso() };
  d.conversations.push(c);
  d.conversation_participants.push(
    { id: newId('cp'), conversation_id: c.id, user_id: u.id },
    { id: newId('cp'), conversation_id: c.id, user_id: otherUserId }
  );
  log('conversation.created', 'conversations', c.id, `Conversation started with ${other.profile.full_name}.`);
  save();
  return { id: c.id, existing: false };
}

// v4: message a HOSPITAL directly — it goes to the hospital's admin,
// and the chat header displays the hospital name.
async function getOrCreateHospitalConversation(hospitalId) {
  await delay();
  const u = requireVerified();
  const d = getDb();
  const hospital = findHospital(hospitalId);
  if (!hospital) throw new Error('Hospital not found.');
  if (u.profile.role !== 'admin' && hospital.status !== 'verified')
    throw new Error('This hospital is not verified yet.');
  if (hospital.admin_id === u.id)
    throw new Error('This is your hospital\u2019s inbox — messages from other users arrive here.');
  if (!hospital.admin_id)
    throw new Error('This hospital has no admin account yet — nobody would receive the message.');

  const mine = new Set(
    d.conversation_participants.filter((p) => p.user_id === u.id).map((p) => p.conversation_id)
  );
  const existing = d.conversations.find((c) => mine.has(c.id) && c.hospital_id === hospitalId);
  if (existing) return { id: existing.id, existing: true };

  const c = {
    id: newId('c'),
    request_id: null,
    hospital_id: hospitalId,
    created_by: u.id,
    created_at: nowIso()
  };
  d.conversations.push(c);
  d.conversation_participants.push(
    { id: newId('cp'), conversation_id: c.id, user_id: u.id },
    { id: newId('cp'), conversation_id: c.id, user_id: hospital.admin_id }
  );
  log(
    'conversation.created',
    'conversations',
    c.id,
    `Hospital conversation started with ${hospital.name} (goes to the admin).`
  );
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
  notifyMessageListeners(msg); // mock "realtime": instant same-tab delivery
  return msg;
}

// ============================================================
// HOSPITALS — v4: public directory + search + detail + doctor
// applications + business (admin) management.
// ============================================================

function joinHospital(h) {
  const d = getDb();
  const admin = h.admin_id ? findProfile(h.admin_id) : null;
  const doctors = hospitalDoctorSet(h.id);
  return {
    ...h,
    admin_name: admin?.full_name ?? null,
    admin_avatar_url: admin?.avatar_url ?? null,
    admin_is_doctor: admin ? actsAsDoctor(admin) : false,
    doctor_count: doctors.length,
    pending_applications: d.hospital_doctors.filter(
      (hd) => hd.hospital_id === h.id && hd.status === 'pending'
    ).length
  };
}

// Any verified user can browse/search hospitals. Regular users see
// VERIFIED hospitals; a business also sees their own (so they can manage
// it while it awaits verification); platform admins see everything.
async function listHospitals(filters = {}) {
  await delay();
  const u = requireVerified();
  const d = getDb();
  let rows;
  if (u.profile.role === 'admin') rows = d.hospitals;
  else rows = d.hospitals.filter((h) => h.status === 'verified' || h.admin_id === u.id);
  let joined = rows.map(joinHospital);

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

  return joined.sort((a, b) => a.name.localeCompare(b.name));
}

// Full hospital detail — description, location, the admin, and the
// doctor roster with license IDs and contact numbers (client rule:
// "view the admin… doctors… and the information of the doctors like
// the ID and contact number").
async function getHospital(id) {
  await delay();
  const u = requireVerified();
  const d = getDb();
  const h = findHospital(id);
  if (!h) throw new Error('Hospital not found.');
  if (h.status !== 'verified' && !canManageHospital(u, id))
    throw new Error('This hospital is not verified yet.');

  const joined = joinHospital(h);
  const openRequests = d.requests.filter(
    (r) => r.hospital_id === id && ['pending', 'accepted'].includes(r.status)
  ).length;
  const completed = d.requests.filter((r) => r.hospital_id === id && r.status === 'completed').length;

  // The viewer's own application to this hospital (doctors).
  const myApplication = d.hospital_doctors.find((hd) => hd.doctor_id === u.id && hd.hospital_id === id) || null;

  return {
    ...joined,
    doctors: hospitalDoctorSet(id),
    stats: { open_requests: openRequests, completed_requests: completed },
    my_application: myApplication ? { ...myApplication } : null,
    is_my_hospital: h.admin_id === u.id
  };
}

// ---------- Business (hospital admin) management ----------

// The hospital of the signed-in business admin, including pending
// doctor applications (for the management panel).
async function businessGetMyHospital() {
  await delay();
  const u = requireVerified();
  if (u.profile.role !== 'business')
    throw new Error('Only business (hospital) accounts have a hospital to manage.');
  const h = myHospital(u);
  if (!h) throw new Error('No hospital is linked to your account. Contact the administrators.');

  const d = getDb();
  const applications = d.hospital_doctors
    .filter((hd) => hd.hospital_id === h.id)
    .map((hd) => {
      const p = findProfile(hd.doctor_id);
      return {
        ...hd,
        doctor_name: p?.full_name ?? 'Unknown',
        doctor_avatar_url: p?.avatar_url ?? null,
        doctor_license_id: p?.doctor_license_id ?? null,
        doctor_specialization: p?.specialization ?? null,
        doctor_contact_number: p?.contact_number ?? null,
        doctor_email: p ? findUser(hd.doctor_id)?.email : null,
        reviewed_by_name: hd.reviewed_by ? findProfile(hd.reviewed_by)?.full_name : null
      };
    })
    .sort((a, b) => {
      // pending applications first, then accepted, then the rest
      const rank = { pending: 0, accepted: 1, rejected: 2 };
      if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
      return new Date(b.created_at) - new Date(a.created_at);
    });

  return { ...joinHospital(h), applications };
}

// Business admin edits their hospital's public profile: description,
// photo (the detail-page background), location and contact details.
// Name / region / verification status are managed by platform admins.
async function businessUpdateMyHospital(patch) {
  await delay();
  const u = requireVerified();
  const h = myHospital(u);
  if (!h) throw new Error('No hospital is linked to your account.');

  if (patch.description !== undefined) {
    const desc = String(patch.description || '').trim();
    if (desc.length > 1200) throw new Error('Description is too long (max 1200 characters).');
    h.description = desc;
  }
  if (patch.photo_url !== undefined) {
    const url = patch.photo_url === null || patch.photo_url === '' ? null : String(patch.photo_url).trim();
    if (url && (!/^https?:\/\//i.test(url) || url.length > 500))
      throw new Error('Photo must be a valid image URL (https://…) of at most 500 characters.');
    h.photo_url = url;
  }
  if (patch.city !== undefined) {
    const city = String(patch.city || '').trim();
    if (city.length > 60) throw new Error('City name too long.');
    h.city = city || null;
  }
  if (patch.address !== undefined) {
    const address = String(patch.address || '').trim();
    if (address.length > 200) throw new Error('Address is too long (max 200 characters).');
    h.address = address || null;
  }
  if (patch.contact_number !== undefined) {
    const contact = String(patch.contact_number || '').trim();
    if (contact.length > 40) throw new Error('Contact number is too long (max 40 characters).');
    h.contact_number = contact || null;
  }
  // Guarded fields: a business can never rename / move / verify itself.
  if (
    patch.name !== undefined && patch.name !== h.name ||
    patch.region !== undefined && patch.region !== h.region ||
    patch.status !== undefined && patch.status !== h.status
  ) {
    throw new Error('Hospital name, region and verification are managed by platform administrators.');
  }

  log('hospital.updated', 'hospitals', h.id, 'Hospital profile updated by its admin.');
  save();
  return joinHospital(h);
}

// ---------- Doctor applications ----------
// Client rule: "Doctors can apply to a business, they should put their
// ID and any other input field required for a doctor, and the admin of
// the hospital will verify and accept it, once accepted, the doctor is
// now part of the hospital."

async function applyToHospital(hospitalId, { note = '' } = {}) {
  await delay();
  const u = requireVerified();
  const d = getDb();
  const h = findHospital(hospitalId);
  if (!h) throw new Error('Hospital not found.');
  if (!actsAsDoctor(u.profile))
    throw new Error('Only doctor accounts can apply to a hospital. Register as a doctor first.');
  if (h.admin_id === u.id)
    throw new Error('You already manage this hospital — no application needed.');
  if (!u.profile.doctor_license_id || !u.profile.contact_number)
    throw new Error('Complete your doctor license ID and contact number in your profile first.');

  const existing = d.hospital_doctors.find(
    (hd) => hd.doctor_id === u.id && hd.hospital_id === hospitalId
  );
  if (existing) {
    if (existing.status === 'accepted')
      throw new Error('You are already part of this hospital\u2019s roster.');
    if (existing.status === 'pending') throw new Error('Your application to this hospital is already pending.');
    // rejected -> allow re-applying (the row flips back to pending)
    existing.status = 'pending';
    existing.application_note = String(note || '').trim() || existing.application_note;
    existing.reviewed_by = null;
    existing.reviewed_at = null;
    existing.created_at = nowIso();
    log('doctor_application.resubmitted', 'hospital_doctors', existing.id, `Doctor re-applied to ${h.name}.`);
  } else {
    const app = {
      id: newId('hd'),
      hospital_id: hospitalId,
      doctor_id: u.id,
      status: 'pending',
      application_note: String(note || '').trim(),
      reviewed_by: null,
      reviewed_at: null,
      created_at: nowIso()
    };
    d.hospital_doctors.push(app);
    log('doctor_application.created', 'hospital_doctors', app.id, `Doctor applied to ${h.name}.`);
  }

  notifyHospital(
    hospitalId,
    'doctor_application',
    'New doctor application',
    `${u.profile.full_name} (${u.profile.doctor_license_id}${u.profile.specialization ? `, ${u.profile.specialization}` : ''}) applied to join ${h.name}.`,
    null,
    u
  );
  save();
  return { success: true };
}

// The doctor's own applications, with the hospital joined.
async function listMyDoctorApplications() {
  await delay();
  const u = requireVerified();
  const d = getDb();
  return d.hospital_doctors
    .filter((hd) => hd.doctor_id === u.id)
    .map((hd) => {
      const h = findHospital(hd.hospital_id);
      return {
        ...hd,
        hospital_name: h?.name ?? 'Unknown',
        hospital_status: h?.status ?? null,
        hospital_city: h?.city ?? null,
        hospital_region: h?.region ?? null,
        reviewed_by_name: hd.reviewed_by ? findProfile(hd.reviewed_by)?.full_name : null
      };
    })
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

// The hospital admin (business) — or a platform admin — verifies and
// accepts/rejects a doctor application.
async function hospitalSetDoctorApplicationStatus(applicationId, status, reason = '') {
  await delay();
  const u = requireVerified();
  const d = getDb();
  const app = d.hospital_doctors.find((x) => x.id === applicationId);
  if (!app) throw new Error('Application not found.');
  if (!canManageHospital(u, app.hospital_id))
    throw new Error('Only the hospital\u2019s admin can review this application.');
  if (!['accepted', 'rejected', 'pending'].includes(status)) throw new Error('Invalid status.');
  if (status === 'rejected' && !String(reason || '').trim())
    throw new Error('A reason is required when rejecting a doctor application.');

  const doctor = findProfile(app.doctor_id);
  const hospital = findHospital(app.hospital_id);

  if (status === 'accepted') {
    // Client rule: a doctor works under ONE specific hospital.
    const currentHospitalId = doctorHospitalId(app.doctor_id);
    if (currentHospitalId && currentHospitalId !== app.hospital_id) {
      const current = findHospital(currentHospitalId);
      throw new Error(
        `This doctor already works under ${current?.name ?? 'another hospital'} — they must leave it first.`
      );
    }
    if (app.status === 'accepted') throw new Error('This application is already accepted.');
  }

  const from = app.status;
  app.status = status;
  app.reviewed_by = u.id;
  app.reviewed_at = nowIso();
  log(
    `doctor_application.${status}`,
    'hospital_doctors',
    app.id,
    `Application of ${doctor?.full_name ?? 'a doctor'} for ${hospital?.name ?? 'a hospital'} changed from ${from} to ${status}${reason ? ` — reason: ${reason}` : ''}.`
  );
  save();
  return app;
}

// ---------- Hospital notifications (business admin inbox) ----------

async function listHospitalNotifications() {
  await delay();
  const u = requireVerified();
  const h = myHospital(u);
  if (!h) throw new Error('No hospital is linked to your account.');
  const d = getDb();
  return d.hospital_notifications
    .filter((n) => n.hospital_id === h.id)
    .map((n) => ({
      ...n,
      actor_name: n.actor_id ? findProfile(n.actor_id)?.full_name ?? null : null,
      request_blood_type: n.request_id
        ? d.requests.find((r) => r.id === n.request_id)?.blood_type ?? null
        : null
    }))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

async function markHospitalNotificationRead(id) {
  await delay(60);
  const u = requireVerified();
  const h = myHospital(u);
  const n = getDb().hospital_notifications.find((x) => x.id === id);
  if (!n) throw new Error('Notification not found.');
  if (!h || n.hospital_id !== h.id) throw new Error('This notification is not for your hospital.');
  n.read = true;
  save();
  return n;
}

async function markAllHospitalNotificationsRead() {
  await delay(60);
  const u = requireVerified();
  const h = myHospital(u);
  if (!h) throw new Error('No hospital is linked to your account.');
  getDb()
    .hospital_notifications.filter((n) => n.hospital_id === h.id)
    .forEach((n) => {
      n.read = true;
    });
  save();
  return { success: true };
}

// ---------- Business stats ----------

// Live statistics scoped to the business admin's hospital.
async function businessGetStats() {
  await delay();
  const u = requireVerified();
  const h = myHospital(u);
  if (!h) throw new Error('No hospital is linked to your account.');
  const d = getDb();
  const mine = d.requests.filter((r) => r.hospital_id === h.id);
  const records = d.donation_records.filter((rec) =>
    mine.some((r) => r.id === rec.request_id)
  );
  return {
    hospital: { id: h.id, name: h.name, status: h.status },
    requests: {
      total: mine.length,
      pending: mine.filter((r) => r.status === 'pending').length,
      accepted: mine.filter((r) => r.status === 'accepted').length,
      completed: mine.filter((r) => r.status === 'completed').length,
      cancelled: mine.filter((r) => r.status === 'cancelled').length
    },
    doctors: hospitalDoctorSet(h.id).length,
    pending_applications: d.hospital_doctors.filter(
      (hd) => hd.hospital_id === h.id && hd.status === 'pending'
    ).length,
    records: {
      total: records.length,
      successful: records.filter((r) => r.outcome === 'successful').length,
      failed: records.filter((r) => r.outcome === 'failed').length
    },
    unread_notifications: d.hospital_notifications.filter((n) => n.hospital_id === h.id && !n.read)
      .length
  };
}

// ============================================================
// DONATION RECORDS (outcome records — the "transactions")
// v4: recorded by the platform admin, the hospital's business admin,
// or the assigned doctor (the witness / source of truth).
// ============================================================

function joinRecord(rec) {
  const d = getDb();
  const r = d.requests.find((x) => x.id === rec.request_id);
  return {
    ...rec,
    request_blood_type: r?.blood_type ?? null,
    request_region: r?.region ?? null,
    request_status: r?.status ?? null,
    request_hospital_id: r?.hospital_id ?? null,
    donor_name: rec.donor_id ? findProfile(rec.donor_id)?.full_name ?? null : null,
    doctor_name: rec.doctor_id ? findProfile(rec.doctor_id)?.full_name ?? null : null,
    recorded_by_name: findProfile(rec.recorded_by)?.full_name ?? 'Administrator'
  };
}

async function listRecords() {
  await delay();
  requireAdmin();
  return getDb()
    .donation_records.map(joinRecord)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

// Business variant: records for requests attached to MY hospital.
async function businessListRecords() {
  await delay();
  const u = requireVerified();
  const h = myHospital(u);
  if (!h) throw new Error('No hospital is linked to your account.');
  return getDb()
    .donation_records.map(joinRecord)
    .filter((rec) => rec.request_hospital_id === h.id)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

// [RLS mirror] policy + RPC: admin | hospital business admin | assigned doctor
// [RLS mirror] trigger: successful record closes the request (completed)
async function createRecord({ request_id, donor_id, outcome, reason }) {
  await delay();
  const u = requireVerified();
  const d = getDb();
  const r = d.requests.find((x) => x.id === request_id);
  if (!r) throw new Error('Request not found.');
  if (r.status !== 'accepted')
    throw new Error('Outcome records can only be added to accepted requests.');
  if (!['successful', 'failed'].includes(outcome)) throw new Error('Invalid outcome.');
  const cleanReason = String(reason || '').trim();
  if (outcome === 'failed' && !cleanReason)
    throw new Error('A reason is required when recording a failed outcome.');

  // v4 permissions: platform admin, the hospital's business admin, or a
  // doctor assigned to this request (the witness).
  const isAdmin = u.profile.role === 'admin';
  const isHospitalAdmin = canManageHospital(u, r.hospital_id);
  const isAssignedDoctor = d.donor_acceptances.some(
    (a) => a.request_id === request_id && a.doctor_id === u.id && a.status === 'accepted'
  );
  if (!isAdmin && !isHospitalAdmin && !isAssignedDoctor)
    throw new Error(
      'Only an administrator, the hospital\u2019s admin, or the assigned doctor can record an outcome.'
    );

  let donor = null;
  let witnessDoctorId = isAssignedDoctor ? u.id : null;
  if (donor_id) {
    donor = findProfile(donor_id);
    if (!donor) throw new Error('Selected donor does not exist.');
    // The recorded donor must be ABO-compatible with the request (sanity check).
    if (donor.blood_type && !donorTypesFor(r.blood_type).includes(donor.blood_type))
      throw new Error('The selected donor has an incompatible blood type for this request.');
    // The witness is the doctor assigned to THIS donor's acceptance.
    const acc = d.donor_acceptances.find(
      (a) => a.request_id === request_id && a.donor_id === donor_id && a.status !== 'withdrawn'
    );
    if (acc?.doctor_id) witnessDoctorId = acc.doctor_id;
  } else if (!witnessDoctorId) {
    // No donor specified: fall back to the first active acceptance's doctor.
    const acc = d.donor_acceptances.find(
      (a) => a.request_id === request_id && a.status === 'accepted'
    );
    witnessDoctorId = acc?.doctor_id ?? null;
  }

  const rec = {
    id: newId('dr'),
    request_id,
    donor_id: donor_id || null,
    doctor_id: witnessDoctorId,
    outcome,
    reason: cleanReason,
    recorded_by: u.id,
    created_at: nowIso()
  };
  d.donation_records.push(rec);

  if (outcome === 'successful') {
    r.status = 'completed'; // successful record closes the request
    r.updated_at = nowIso();
    // Completed acceptances (the donor's part is done).
    d.donor_acceptances
      .filter((a) => a.request_id === request_id && a.status === 'accepted')
      .forEach((a) => {
        a.status = 'completed';
        a.updated_at = nowIso();
      });
    log('request.status_changed', 'donation_requests', r.id, 'Status changed from accepted to completed (successful donation record).');
  }
  log(
    'record.created',
    'donation_records',
    rec.id,
    `Outcome recorded for request ${r.id}: ${outcome}${cleanReason ? ` — ${cleanReason}` : ''}`
  );
  save();
  return joinRecord(rec);
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
// v4: this toggle only switches user <-> admin. The account TYPES
// (doctor / business) are created at registration (or by re-registering);
// switching them behind the admin's back would break hospital links.
async function toggleUserRole(userId) {
  await delay();
  const admin = requireAdmin();
  if (userId === admin.id) throw new Error('You cannot change your own role.');
  const target = findUser(userId);
  if (!target) throw new Error('User not found.');
  if (!['user', 'admin'].includes(target.profile.role))
    throw new Error(
      'Doctor and business accounts cannot be toggled — their type is tied to their hospital records.'
    );

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
    open_offers: d.donation_offers.filter((o) => o.status === 'open').length,
    doctors: d.users.filter((u) => u.profile.role === 'doctor').length,
    businesses: d.users.filter((u) => u.profile.role === 'business').length,
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

// ============================================================
// HemaMatch constants
// Domain rules live here so they are defined exactly once.
// In Phase 2 these same values become PostgreSQL CHECK
// constraints and RLS policies (see supabase/schema.sql).
// ============================================================

export const APP_NAME = 'HemaMatch';

// The 8 human blood types
export const BLOOD_TYPES = ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'];

// ABO + Rh compatibility matrix.
// Source: standard public Red Cross compatibility chart.
// IMPORTANT: this is PRELIMINARY FILTERING ONLY. It is not a determination
// of medical compatibility. Actual eligibility is always decided by
// qualified healthcare professionals during donor screening.
export const CAN_RECEIVE_FROM = {
  'O-': ['O-'],
  'O+': ['O-', 'O+'],
  'A-': ['O-', 'A-'],
  'A+': ['O-', 'O+', 'A-', 'A+'],
  'B-': ['O-', 'B-'],
  'B+': ['O-', 'O+', 'B-', 'B+'],
  'AB-': ['O-', 'A-', 'B-', 'AB-'],
  'AB+': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+']
};

// Reverse map: which recipient types a given donor type can give to.
export const CAN_DONATE_TO = {
  'O-': ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
  'O+': ['O+', 'A+', 'B+', 'AB+'],
  'A-': ['A-', 'A+', 'AB-', 'AB+'],
  'A+': ['A+', 'AB+'],
  'B-': ['B-', 'B+', 'AB-', 'AB+'],
  'B+': ['B+', 'AB+'],
  'AB-': ['AB-', 'AB+'],
  'AB+': ['AB+']
};

// Donor blood types that can donate to the given recipient type.
export function donorTypesFor(requestBloodType) {
  return CAN_RECEIVE_FROM[requestBloodType] ?? [requestBloodType];
}

// Recipient blood types that a given donor type can help.
export function recipientTypesFor(donorBloodType) {
  return CAN_DONATE_TO[donorBloodType] ?? [donorBloodType];
}

// The 17 regions of the Philippines
export const REGIONS = [
  'NCR (Metro Manila)',
  'CAR (Cordillera Administrative Region)',
  'Region I (Ilocos Region)',
  'Region II (Cagayan Valley)',
  'Region III (Central Luzon)',
  'Region IV-A (CALABARZON)',
  'Region IV-B (MIMAROPA)',
  'Region V (Bicol Region)',
  'Region VI (Western Visayas)',
  'Region VII (Central Visayas)',
  'Region VIII (Eastern Visayas)',
  'Region IX (Zamboanga Peninsula)',
  'Region X (Northern Mindanao)',
  'Region XI (Davao Region)',
  'Region XII (SOCCSKSARGEN)',
  'Region XIII (Caraga)',
  'BARMM (Bangsamoro)'
];

// ============================================================
// ACCOUNT TYPES (v4 — role hierarchy requested by the client)
//   user     : Donor/Recipient — the base account. Can donate blood
//              and request blood. Every other type inherits this.
//   doctor   : Doctor — inherits everything a Donor/Recipient can do,
//              can be affiliated with ONE hospital (after the hospital
//              admin verifies their application) and is the middleman /
//              witness / source of truth for the transactions they are
//              assigned to.
//   business : Business (hospital) — the admin of a hospital. Inherits
//              the Donor/Recipient abilities, and additionally inherits
//              the Doctor abilities ONLY IF the admin is also a doctor
//              (profiles.is_doctor + license fields). Tracks records and
//              manages their hospital.
//   admin    : platform administrator (existing role).
// LAW NOTE: selling blood is deliberately NOT part of any type —
// RA 7719 prohibits the commercial sale of blood in the Philippines.
// ============================================================
export const ROLES = {
  user: 'user',
  doctor: 'doctor',
  business: 'business',
  admin: 'admin'
};

export const ACCOUNT_TYPES = {
  user: 'Donor / Recipient',
  doctor: 'Doctor',
  business: 'Business (Hospital)',
  admin: 'Administrator'
};

export const ACCOUNT_TYPE_DESCRIPTIONS = {
  user: 'Donate blood and request blood — the base account every user starts from.',
  doctor:
    'Everything a Donor/Recipient can do, plus work under a hospital (after the hospital admin verifies your application) and act as the witness for transactions.',
  business:
    'The admin of a hospital. Everything a Donor/Recipient can do, plus track records and manage your hospital — and doctor abilities too if you are also a licensed doctor.',
  admin: 'Platform administrator (internal).'
};

// Doctor applications to a hospital: reviewed by the hospital admin.
export const DOCTOR_APP_STATUS = {
  pending: 'Pending',
  accepted: 'Accepted',
  rejected: 'Rejected'
};

// Donor acceptances (v4): a donor accepting a request, with the doctor
// assigned to them for that transaction (witness / middleman).
export const ACCEPTANCE_STATUS = {
  accepted: 'Accepted',
  withdrawn: 'Withdrawn',
  completed: 'Completed'
};

// Request lifecycle. Transitions are guarded (see mockBackend / schema.sql):
//   pending -> accepted   : requester, admin, or a donor accepting it
//   pending -> cancelled  : requester or admin
//   accepted -> cancelled : requester or admin
//   accepted -> completed: admin, the hospital's business admin, or the
//                          assigned doctor (a successful record closes it)
export const REQUEST_STATUS = {
  pending: 'Pending',
  accepted: 'Accepted',
  completed: 'Completed',
  cancelled: 'Cancelled'
};

export const URGENCY = {
  routine: 'Routine',
  urgent: 'Urgent',
  critical: 'Critical'
};

// Hospital module: admin-managed list + verification badge, plus (v4)
// a business admin, description, photo and doctor roster.
export const HOSPITAL_STATUS = {
  pending: 'Pending',
  verified: 'Verified',
  rejected: 'Rejected'
};

// Hospital notifications (v4) — what the business admin sees in their panel.
export const NOTIFICATION_TYPES = {
  new_request: 'New blood request',
  donor_accepted: 'Donor accepted a request',
  doctor_application: 'Doctor application'
};

// Admin outcome records ("transactions" in this academic app = the recorded
// outcome of an accepted donation request)
export const OUTCOMES = {
  successful: 'Successful',
  failed: 'Failed'
};

// ============================================================
// DONATION OFFERS ("donate" side of the app)
// A donation offer is a donor's voluntary listing: "I am willing to
// donate — here is when/how". One listing per donor.
//   open   -> listed on the donor directory + included in matching
//   paused -> hidden from both (e.g. recent donation, travel)
// Keeping the offer in sync with profiles.is_available is a backend
// responsibility in BOTH modes (mock logic / SQL trigger + RPC).
// ============================================================
export const OFFER_STATUS = {
  open: 'Open',
  paused: 'Paused'
};

export const OFFER_NOTE_MAX = 300;

// IMPORTANT — legal note shown on the Donate page.
// HemaMatch facilitates VOLUNTARY, NON-REMUNERATED donation only.
// Under Republic Act No. 7719 (the National Blood Services Act of 1994),
// the commercial sale of blood is prohibited in the Philippines — so
// this app deliberately has NO selling feature, and no prices anywhere.
export const DONATION_LAW_NOTE =
  'Donation on HemaMatch is voluntary and non-remunerated. Under Republic Act No. 7719 (the National Blood Services Act of 1994), the commercial sale of blood is prohibited in the Philippines — HemaMatch therefore does not offer, and will never facilitate, paid or for-sale blood listings.';

export const MATCHING_DISCLAIMER =
  'Preliminary matching only. Blood-type filtering does not determine medical compatibility, and a listed donor is not guaranteed to be medically eligible. Actual compatibility and donor screening are determined by qualified healthcare professionals.';

export const APP_DISCLAIMER =
  'HemaMatch is an academic demonstration application that facilitates blood donation connections. It is not a certified medical platform, does not guarantee that any request will be fulfilled, and never presents unverified users or hospitals as verified.';

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

// Donor blood types that can donate to the given recipient type.
export function donorTypesFor(requestBloodType) {
  return CAN_RECEIVE_FROM[requestBloodType] ?? [requestBloodType];
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

// Request lifecycle. Transitions are guarded (see mockBackend / schema.sql):
//   pending -> accepted   : requester or admin
//   pending -> cancelled  : requester or admin
//   accepted -> cancelled : requester or admin
//   accepted -> completed: ADMIN ONLY (a completed status is never proof that
//                          a donation happened - it is a record-keeping state)
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

// Light hospital module (agreed scope): admin-managed list + verification badge
export const HOSPITAL_STATUS = {
  pending: 'Pending',
  verified: 'Verified',
  rejected: 'Rejected'
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
// Under Republic Act No. 7719 (National Blood Services Act of 1994)
// the Philippines promotes voluntary blood donation and prohibits
// the commercial sale of blood — so this app deliberately has NO
// selling feature, and no prices anywhere.
export const DONATION_LAW_NOTE =
  'Donation on HemaMatch is voluntary and non-remunerated. Under Republic Act No. 7719 (the National Blood Services Act of 1994), the commercial sale of blood is prohibited in the Philippines — HemaMatch therefore does not offer, and will never facilitate, paid or for-sale blood listings.';

export const MATCHING_DISCLAIMER =
  'Preliminary matching only. Blood-type filtering does not determine medical compatibility, and a listed donor is not guaranteed to be medically eligible. Actual compatibility and donor screening are determined by qualified healthcare professionals.';

export const APP_DISCLAIMER =
  'HemaMatch is an academic demonstration application that facilitates blood donation connections. It is not a certified medical platform, does not guarantee that any request will be fulfilled, and never presents unverified users or hospitals as verified.';

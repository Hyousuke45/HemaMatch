# HemaMatch — Change Report

**v4.1 — November 7, 2026** (latest) · compatible donor types as individual checkboxes (multi-select, varies by patient blood type), hospital field now required
**v4 — November 7, 2026** · account-type hierarchy (Donor/Recipient · Doctor · Business), compatible-donor dropdown, hospital notifications, donor-accept flow with assigned doctors, doctor applications, hospital directory with photo pages, hospital messaging
**v3.1 — November 3, 2026** · Donate tab in the mobile bottom navigation, real app icon files
**v3 — October 31, 2026** · black theme, profile views on request detail, donation offers, profile photos
**v2 — October 25, 2026** · rebrand, dark theme, mobile-first, Phase 2 Supabase backend

---

# HemaMatch — Change Report (v4.1)

**Date:** November 7, 2026 · **Scope:** two client asks on the request form — (1) the
compatible blood donors should display as individual checkboxes that vary with the
receiver's blood type instead of a single dropdown entry, and (2) the hospital is no
longer optional ("where would they do the process then").

## 1. Compatible donor types — one checkbox per blood type

"Preferred donor blood type" (single-select dropdown) became **"Preferred donor blood
types"** — a row of pill-style checkboxes, one **per blood type that can donate to the
chosen patient type**:

| Patient type | Checkboxes shown |
|---|---|
| O- | O- |
| O+ / A- / B- | 2 options each |
| A+ / B+ | 4 options each |
| AB- | 4 options |
| AB+ | all 8 types |

Several can be checked at once (the requester of an A- request can prefer O- **and**
A- donors). Changing the patient's blood type keeps only the still-compatible checked
types, so an incompatible preference can never be submitted — the same guarantee the
dropdown had. Checked types rank first in matching (each donor card now shows a gold
**"Preferred type"** badge; previously the preference was sorted on but never
displayed), and the request detail page shows the full list ("Prefers O-, A- donors").

The data model changed accordingly: `donation_requests.preferred_donor_type` (single
text) → **`preferred_donor_types text[]`** — in the mock backend (localStorage store
key bumped to `hemamatch_mock_db_v5`), the Supabase client, and `schema.sql`. The SQL
upgrade path carries an old single choice over as a one-element array and drops the
old column. The server still re-validates every checked type against the ABO/Rh
matrix in both backends, and the `get_matching_donors` RPC now also returns and sorts
by `preferred_type`.

## 2. The hospital is required

The request form's hospital dropdown lost its "Not specified" option — every request
now names the hospital where the donation process takes place. The label shows the
required marker, the browser blocks submit on an empty choice, and both backends
(mock + Supabase) reject a missing hospital (`validateRequestData`) and still only
accept administrator-verified hospitals. `schema.sql` makes the column
`hospital_id uuid not null` after backfilling any old rows to St. Mary General
Hospital (the demo hospital — adjust before running on real data).

Because of this, the demo data gained a fourth verified hospital in Region VI
(Western Visayas): **Western Visayas Medical Center**, Iloilo City, administered by
the new business demo account `biz.western@demo.com / biz12345` (Teresita Uy). The
two Iloilo demo requests (Cristina's A+ and Paolo's A-) now point at it, so no seeded
request is left hospital-less.

**Verified:** pglast (libpg_query) parses schema.sql + seed.sql clean; browser-tested
at 390×844 — checkbox counts per patient type (O- → 1 … AB+ → 8), multi-check,
preference pruning on patient-type change, hospital-required submit block, request
creation, edit form pre-fill, matching order (preferred types first) and the badge;
zero console/page errors; production build passes.

---

# HemaMatch — Change Report (v4)

**Date:** November 7, 2026 · **Scope:** the client's role-hierarchy request — account
types with inheritance, blood-compatibility dropdown, hospital notifications, doctor
assignment on donor acceptance, doctor applications with hospital-admin verification,
the public hospital directory with photo pages, and hospital messaging.

## 1. Account types with inheritance (registration)

Registration now asks **"I am registering as…"** with three options:

| Type | Inherits | Extra abilities |
|---|---|---|
| **Donor / Recipient** (`user`) | — (the base) | donate blood, request blood |
| **Doctor** (`doctor`) | everything the base has | hospital affiliation (after applying and being verified), assigned as the **witness / middleman / source of truth** for transactions |
| **Business (hospital)** (`business`) | everything the base has | admin of a hospital: track records, manage the hospital, review doctor applications — and **inherits the Doctor abilities ONLY if the admin is also a licensed doctor** (`profiles.is_doctor` + license fields, editable on the Profile page) |

- Doctor registrations require a **license/PRC ID and contact number** (specialization
  optional); businesses create their hospital record (name, region, city, address,
  contact, description) which starts **Pending** until a platform admin verifies it.
- The mobile tab bar adapts: business accounts get a **Hospital** tab, doctor accounts
  get a **Witness (assignments)** tab, admins keep **Admin**.
- The admin user list shows account types with doctor license details; the user ↔ admin
  toggle is disabled for doctor/business accounts (their type is tied to hospital links).
- **Note on "sell blood":** the client mentioned the base user can also *sell* blood.
  This is deliberately **not** implemented — RA 7719 (National Blood Services Act of
  1994) prohibits the commercial sale of blood in the Philippines, and the app keeps
  donation voluntary and non-remunerated everywhere.

## 2. Compatible-donor dropdown on requests

When a requester selects the blood type needed, a new **"Preferred donor blood type"**
dropdown lists **only the types that can donate to that patient type** (e.g. an O+
patient sees O- and O+ only), each labelled with what it donates to. Choosing one is
optional; the chosen type ranks first in matching. The compatibility matrix is defined
once in `constants.js` (both directions) and is enforced again by the backend — an
incompatible choice is rejected, and the Supabase `guard_acceptance` trigger re-checks
the donor's type on acceptance.

## 3. Hospital notifications

Attaching a hospital to a request (at creation or edit) writes a notification that
lands in the **business admin's inbox** (`My hospital → Notifications`). Donor
acceptances and doctor applications produce notifications too, with unread badges and
"mark read / mark all read". In Supabase mode these are written by the
`notify_request_hospital` trigger and the application/acceptance triggers — clients
have no INSERT permission on `hospital_notifications`.

## 4. Donor acceptance + assigned doctor

Any signed-in user (every account type inherits the donor abilities) can **Accept as
donor** on an open request. A doctor from **the hospital on the request** is
**auto-assigned** (first roster doctor) as the transaction's witness — or the donor
**chooses the doctor** from a dropdown restricted to that hospital's roster (roster +
the hospital admin when they are also a doctor). The doctor can be changed later while
the acceptance is active; a donor can withdraw. The first acceptance moves the request
to **Accepted**, and the hospital is notified. Requesters (and the hospital/assigned
doctor) see the acceptance list with each donor's assigned doctor and a
**Message doctor** shortcut.

## 5. Doctor applications (hospital-admin verification)

Doctors apply to a hospital from its public page — the dialog shows the credentials
being sent (license ID, specialization, contact number, all from the profile) plus an
optional note. The hospital admin reviews it in `My hospital → Doctor applications`
with the license and contact details visible, then **Accepts** (the doctor joins the
roster — one hospital per doctor, enforced server-side) or **Rejects** (a reason is
required; the doctor may re-apply). Doctors track their applications on their Profile
page.

## 6. Hospital directory + photo pages

- **Hospitals** page: search by name/city/region/description + a region filter; cards
  show the photo (with gradient fade into the card), a description snippet, location
  and doctor count. Regular users see verified hospitals only.
- **Hospital detail page**: the hospital **photo as the background with a gradient
  fade into the description** (client requirement), location, contact, the business
  admin, and the **doctor roster with license IDs and contact numbers**; doctors can
  apply from here; anyone can **Message hospital**.
- **My hospital** (business): stats, notifications, application review, profile editor
  (photo via Cloudinary or URL, description, location, contact) and outcome records
  with the witnessing doctor. Name/region/verification stay platform-admin-only
  (enforced by the `protect_hospital` trigger in Supabase mode).

## 7. Messaging changes

- **Message hospital** starts a conversation that goes to the hospital's admin; the
  thread header shows the **hospital name** ("Hospital · messages go to the
  administrator") with a **View hospital** link — in both participants' views and the
  conversation list.
- Doctor chats show the **doctor's hospital beside their name** (a badge in the header,
  and a prefix in the conversation list) so threads are never confusing.

## 8. Doctor witness view + records

- `My assignments` (doctors, and business admins who are doctors): every transaction
  they witness — request, donor, hospital, outcome — with links to coordinate.
- Outcome records now carry the **witnessing doctor** (auto-resolved from the donor's
  acceptance). Recording rights widened server-side: platform admin, the hospital's
  business admin, or the assigned doctor. A successful record still closes the request.
- `guard_request_update` (Supabase) now lets the hospital admin and the assigned doctor
  manage statuses — the doctor is the middleman for their transactions.

## 9. Database (supabase/schema.sql — section 11, idempotent upgrade)

New: `hospital_doctors` (applications/roster, one accepted row per doctor),
`donor_acceptances` (donor + assigned doctor + status), `hospital_notifications`;
new columns `profiles.is_doctor/doctor_license_id/specialization/contact_number`,
`hospitals.admin_id/description/photo_url`, `donation_requests.preferred_donor_type` (renamed to the `preferred_donor_types` array in v4.1),
`conversations.hospital_id`, `donation_records.doctor_id`; widened
`profiles.role` to `user|doctor|business|admin`. New RPCs: `get_hospital_doctors`,
`get_hospital_detail`, `accept_request_as_donor`, `set_acceptance_doctor`,
`withdraw_acceptance`, `get_my_doctor_assignments`, `apply_to_hospital`,
`list_my_doctor_applications`, `hospital_set_doctor_application_status`,
`business_get_my_hospital`, `business_update_my_hospital`, `business_get_stats`,
`start_hospital_conversation`. Fixed a pre-existing bug in the
`guard_acceptance` matrix (AB+ was treated as a universal donor; it donates to AB+
only). Mock-mode store key bumped to `hemamatch_mock_db_v4` (auto re-seeds).

## 10. Verification

- `npm run build` passes; dev server boots and serves the app.
- A 74-check smoke test (`scripts/smoke_test.mjs` on the repo) runs the entire mock
  backend through every new flow — all pass, including the rejection paths (doctor
  outside the hospital, incompatible preferred type, self-verification, double
  acceptance, doctor already under another hospital…).
- The compatibility matrix in `constants.js` and both SQL guards were programmatically
  checked against the client's exact spec.

---

# HemaMatch — Change Report (v3.1)

**Date:** November 3, 2026 · **Scope:** two client asks — (1) a **Donate** tab in the
mobile bottom navigation, (2) real **192/512 app icon files** in `public/` so the icon
can be swapped easily.

## 1. Donate in the mobile bottom navigation

The bottom tab bar went from 5 to **6 tabs**, with Donate in the thumb-friendly middle
(3rd) position:

| 1 | 2 | **3** | 4 | 5 | 6 |
|---|---|---|---|---|---|
| Home | Requests | **Donate** ❤ | Messages | Hospitals *(Admin sees: Admin)* | Profile |

- Same tap target height as before (56px) and unchanged 10px labels; grid tightened to
  `grid-cols-6` with slightly reduced horizontal padding so all six tabs fit on a 390px
  phone with no wrapping or overflow.
- New tab icon: an outlined **heart** — visually distinct from the Requests droplet and
  the standard "give/donate" glyph.
- The admin variant keeps its own 6th slot: `Home · Requests · Donate · Messages · Admin · Profile`.
- Verified in-browser at 390×844: all six tabs evenly spaced (65px grid), the active tab
  renders gold `#c1912f`, tapping Donate navigates to `/donate`, and the desktop layout
  still shows the top nav instead (`display: none` on the bottom bar at ≥ md).

## 2. App icons — `public/icon-192.png` + `public/icon-512.png`

The app previously used an inline SVG data-URI favicon only. Now there are **real PNG
files you can replace**:

- `public/icon-192.png` (192×192) and `public/icon-512.png` (512×512): the brand gold
  droplet (`#c1912f`) on the all-black `#000000` background — matches the header logo
  and the v3 theme. Generated by `scripts/make_icons.py` (bezier droplet, 8× supersampled
  Lanczos downscale; verified pixel colors programmatically).
- `index.html` rewritten to consume them: PNG favicons for both sizes,
  `apple-touch-icon` (iOS home screen), and a **`public/manifest.webmanifest`** (PWA
  manifest: name, `#000000` theme/background, both icons). The old inline SVG favicon
  was removed so the two PNGs are the single source of truth.
- **To change the app icon: overwrite the two PNGs (same names, same sizes) and redeploy.**
  No code or config edits needed — `index.html`, the manifest and Vercel all pick them up
  automatically. (README gained a "Changing the app icon" how-to.)

## 3. Verification performed (all passed)

- `npx vite build` — clean production build; `icon-192.png`, `icon-512.png` and
  `manifest.webmanifest` copied into `dist/`; all four URLs return 200 from the dev server.
- Browser (390×844): Grace login → bottom bar shows 6 tabs with Donate → tap Donate →
  `/donate` renders, active tab gold, `body` background still `rgb(0,0,0)`, zero page
  errors. Admin login → `Home | Requests | Donate | Messages | Admin | Profile`.
- Icon PNGs checked programmatically: exact 192/512 sizes, gold `rgb(193,145,47)` at the
  droplet center, black corners.

## 4. Files touched (v3.1 summary)

- `src/components/Layout.jsx` — Donate tab (heart icon), 6-column grid, padding tweak.
- `public/icon-192.png`, `public/icon-512.png` — new (generated by `scripts/make_icons.py`).
- `public/manifest.webmanifest` — new (PWA manifest).
- `index.html` — PNG favicons + apple-touch-icon + manifest link (inline SVG favicon removed).
- `README.md` — icon how-to section, project-structure entries, status-table rows.

---

# HemaMatch — Change Report (v3)

**Date:** October 31, 2026 · **Scope:** four client directives — (1) all-black consistent
background, (2) profile views on the request detail page only, (3) an option to **donate**
blood, not just request, (4) profile pictures via Cloudinary.

---

## 1. Background: all black, consistent everywhere

The client asked for the background to be **all black** on every page. The theme tokens were
re-mapped (no visual hierarchy lost — cards became subtle plum elevations on black):

| Token | Hex | v2 role | v3 role |
|---|---|---|---|
| `ink` | `#000000` | wells / overlays | **page background everywhere** (body, header, footer, tab bar) |
| `night` | `#220c12` | page background | **card surfaces** (the only non-black surface) |
| `blood` | `#430102` | card surfaces | **accent only**: blood-type badges, brand highlights |
| `cream` / `gold` | `#ebe0c2` / `#c1912f` | unchanged | unchanged |

- Page, header, footer, mobile tab bar: pure black with hairline cream borders.
- Inputs, admin controls and inset boxes: black "wells" inside plum cards.
- Verified in-browser: computed `body` background is `rgb(0,0,0)` on mobile and desktop;
  `theme-color` meta updated to `#000000`.

## 2. Profile views — request detail only (client scope rule)

- New **`PublicProfileSheet`** component: bottom sheet on phones, dialog on desktop.
- Reachable **only** from a blood-donation-request detail page: "View profile" on the
  requester row, and on every matched donor card. There is no standalone public profile
  route, and the donor directory intentionally shows cards only.
- Contents are **directory-safe by the server**: photo, name, blood type, region/city,
  availability, member-since, **count of recorded successful donations** (aggregated
  server-side), and the donor's open listing note. Never email, role or contact details.
- Supabase: new security-definer RPC **`get_public_profile(uuid)`**; donation-record rows
  are never exposed to unrelated users. Mock mode implements the identical shape.

## 3. Donate, not just request (voluntary only — RA 7719)

- New **`donation_offers`** table/collection: one voluntary listing per donor with a note
  and status. **Open** → listed in the "Available donors" directory AND included in request
  matching; **Paused** → hidden from both.
- New **Donate page** (`/donate`): listing editor with the legal note, profile-readiness
  check (blood type + region required), note field (≤ 300 chars), Pause/Reopen.
- New **Available donors page** (`/donors`): directory of open listings with blood-type and
  region filters, same-region ranking, photos, listing notes, and **Message donor** →
  creates a direct conversation.
- Navigation: Dashboard got a **Donate blood** action card + listing status line; the
  Requests page got a **Requests ↔ Available donors** segmented control; desktop nav gained
  a **Donate** link; the landing page gained a Donate CTA. The mobile tab bar stays at 5
  items (non-confusing, per the earlier directive).
- **One source of truth for "listed":** the availability flag and the listing can never
  disagree. Supabase: `upsert_my_offer()` RPC (forward sync) + `sync_offer_with_availability`
  trigger (reverse sync), both audit-logged by trigger. Mock mode mirrors both directions —
  verified live in both directions during testing.
- **Admin:** `admin_get_stats` now includes **open donor listings** (new Overview stat card).
- **"Sell" was intentionally not built:** RA 7719 (National Blood Services Act of 1994)
  prohibits the commercial sale of blood in the Philippines. The schema has no price or
  compensation columns anywhere, and the Donate page shows the legal note. This is a
  deliberate compliance decision for the defense.

## 4. Profile pictures — Cloudinary (with fallbacks)

- New **`src/lib/cloudinary.js`**: uploads via a Cloudinary **unsigned** preset —
  no secret in the browser (same philosophy as the Supabase anon key). Client-side
  guards: JPG/PNG/WEBP/GIF, ≤ 5 MB.
- `profiles.avatar_url` added (CHECK-constrained to http(s) URLs ≤ 500 chars); exposed
  through every join: requests, matching, conversations, donor directory, admin user
  list, public profile.
- **Profile page photo section:** upload button when Cloudinary is configured; automatic
  **paste-an-image-URL** fallback when it is not (so the feature demos before setup);
  remove-photo; explicit "Save profile to apply" flow.
- **`Avatar` component** now renders photos with size `xl`, falling back to the initials
  version if the image is missing or fails — the UI can never break.
- Photos appear in: header, dashboard, request detail, matching cards, donor directory,
  chat list + chat header, admin users table, profile sheet.
- Seeded demo accounts got generated photos (DiceBear, no account needed), so the feature
  is visible immediately in both modes.

## 5. Bug found & fixed during verification

- **Mock donor directory passed the listing id instead of the user id** to
  `getOrCreateConversation` ("The person you are trying to reach does not exist").
  `joinOffer` now maps `id` = user id, `offer_id` = listing id (Supabase mode already did).
  The Donors page also gained explicit error feedback for message failures.

## 6. Verification performed (all passed)

- Production build clean (`vite build` ✓).
- Mobile 390×844 browser walkthrough, zero page errors:
  - black background verified via computed styles (mobile + desktop);
  - login (Grace) → dashboard Donate card + listing status → **donor directory**
    (5 open listings, NCR first, photos + notes, paused listing hidden) →
    **Message donor → conversation created → message sent**;
  - request detail: matching shows only O−/O+ donors; **profile sheet** shows Paolo with
    1 recorded donation + listing note; non-owner (Maria) sees only the requester sheet;
  - **Donate page** (Maria): law note, prefilled note, Pause → directory hides her +
    availability auto-syncs to false → Reopen → restored; profile-page availability toggle
    pauses the listing too (reverse sync), then restored;
  - **avatar URL fallback**: pasted URL → save → header photo updated instantly;
  - admin Overview shows live **Open donor listings = 5**;
  - desktop 1440×900: Donate nav link present, bottom bar hidden, background black.
- Mock store key bumped to `hemamatch_mock_db_v3` (fresh seed data incl. offers + photos).

## 7. Files touched (v3 summary)

- **New:** `src/pages/Donate.jsx`, `src/pages/Donors.jsx`, `src/components/PublicProfileSheet.jsx`,
  `src/components/BrowseTabs.jsx`, `src/lib/cloudinary.js`
- **Rewritten:** `src/pages/Profile.jsx` (photo section), `src/components/DonorCard.jsx`,
  `README.md`
- **Updated:** `src/index.css` (all-black tokens), `Layout.jsx`, `ui.jsx` (photo avatar),
  `RequestDetail.jsx` (profile sheet), `Requests.jsx`, `Dashboard.jsx`, `Landing.jsx`,
  `Messages.jsx`, `AdminDashboard.jsx`, `AdminUsers.jsx`, `App.jsx` (2 routes),
  `mockData.js` (offers + photos + availability fix), `mockBackend.js` (offers, public
  profile, avatar, sync), `supabaseBackend.js` (same), `constants.js` (offers + RA 7719),
  `supabase/schema.sql` (section 10 + avatar column + stats), `supabase/seed.sql`,
  `.env.example`, `index.html` (theme-color)
- **Database objects added:** `donation_offers` table + 3 RLS policies + 2 log triggers +
  availability-sync trigger, `upsert_my_offer()` + `get_public_profile()` RPCs,
  `profiles.avatar_url`, `admin_get_stats.open_offers`, `admin_list_users.avatar_url`.

## 8. What was *not* changed (scope honesty)

- The 9-step workflow, statuses, ABO/Rh matrix, hospital module, messaging, admin model,
  security model and demo accounts are all preserved from v2.
- No blood-selling feature — intentionally (see §3), per RA 7719.
- The "Extras" scope (pledge button, reviews, notifications) remains unconfirmed and unbuilt.

---

# HemaMatch — Change Report (v2)

**Date:** October 25, 2026 · **Scope:** client-requested redesign + Phase 2 backend

This release applies three client directives — (1) rebrand to **HemaMatch**, (2) the dark
"blood thirst" theme, (3) **mobile-first** UX — and completes **Phase 2**: the Supabase
(PostgreSQL) backend is now fully implemented behind the same API contract, so switching
from mock data to the cloud database requires **zero page-code changes**.

---

## 1. Rebrand: BloodLink → HemaMatch

| Where | Change |
|---|---|
| Browser title / favicon | "HemaMatch — Blood Donation & Matching"; favicon now a **gold** blood drop (#c1912f) |
| In-app brand | "Hema**Match**" wordmark (gold accent) everywhere: header, landing hero, footer |
| Copy | All user-visible "BloodLink" mentions updated (landing, forms, disclaimers, README) |
| Package | `package.json` name → `hemamatch` |
| Data store | Mock data key → `hemamatch_mock_db_v1` (fresh demo data on first load) |

## 2. Dark "blood thirst" theme (client palette)

Client hexes are used **exactly as provided**, mapped to a complete design system:

| Token | Hex | Role |
|---|---|---|
| `night` | `#220c12` | page background |
| `blood` | `#430102` | cards & surfaces |
| `ink` | `#000000` | header, footer, admin bar, input wells, dialog overlay |
| `cream` | `#ebe0c2` | primary text |
| `gold` | `#c1912f` | actions, links, active states, brand accent |

- Rebuilt the design system (`src/index.css`): gold primary buttons with dark text
  (WCAG-friendly), translucent semantic status badges tuned for dark surfaces, dark
  inputs/selects/date pickers (`color-scheme: dark`), gold focus rings, slim dark scrollbars.
- Re-themed **every** page and component (landing, auth, dashboard, requests, matching,
  messages, profile, all 6 admin pages, cards, badges, alerts, dialogs, empty/error states).
- Chat bubbles: your messages **gold** with dark text; the other side dark with cream text.
- Confirm dialogs now use a proper **red danger button** when the action is destructive
  (previously both variants looked identical).

## 3. Mobile-first UX (non-confusing, thumb-friendly)

- **Bottom tab bar** on phones: Home · Requests · Messages · Hospitals · Profile
  (admins get an **Admin** tab instead of Hospitals). No more hamburger menu.
- **44px+ touch targets** on all buttons/inputs; 16px input font on phones (prevents iOS zoom).
- **Safe-area support** (`viewport-fit=cover` + `env(safe-area-inset-bottom)`) for notched devices.
- **Sign-in/out fixes:** mobile header avatar → straight to Profile; a clear **Sign out**
  button added to the Profile page (it was unreachable on phones before).
- **Sticky form actions:** the request form's Create/Cancel bar stays pinned above the tab
  bar while scrolling on mobile; dialogs dock as bottom sheets on phones.
- Admin tabs and landing stats scroll horizontally instead of wrapping/squishing.
- Bigger mobile chat composer with icon send button, explicit back arrow, list ↔ thread
  switching preserved; `100dvh` heights for correct mobile-browser sizing.
- Desktop unchanged: top navigation + avatar dropdown (bottom bar auto-hides ≥768px).

## 4. Phase 2 — Supabase backend (implemented)

**New file `src/lib/supabaseBackend.js`** implements the full 30-operation contract that the
mock backend defined: auth (sign-up, sign-in, logout, sessions, resend confirmation, real
password-reset), profiles, requests (filters/search), matching, messaging (with **Realtime**),
hospitals, outcome records, user management, stats, logs, public stats.

- **Switch logic** (`dataService.js`): automatic — Supabase mode when `VITE_SUPABASE_URL` +
  `VITE_SUPABASE_ANON_KEY` exist; mock otherwise; `VITE_USE_MOCK` forces either.
- **Real email flows:** registration now sends a real confirmation email (with a Resend
  button + rate-limit hint); password reset emails open a new **`/reset-password`** page that
  sets the new password under the recovery session.
- **Realtime chat:** new messages stream over a Supabase channel (RLS-enforced); a 4s safety
  poll keeps both modes eventually consistent; mock mode delivers same-tab instantly.
- **AuthContext** subscribes to `onAuthStateChange` — sign-in/out/confirmations reflect app-wide.

### Database (schema.sql) — new Phase 2 extensions
| Object | Purpose |
|---|---|
| `set_request_status(id, status, reason)` | every status change goes through this RPC so the **reason the UI collects is written to the activity log by the server** (via a transaction-local setting the `request_guard` trigger reads — clients can never write audit rows) |
| `admin_list_users()` | admin user directory incl. email (lives in `auth.users`) — role re-checked server-side |
| `admin_set_role(target, role)` | the **only** path to change a role: admin-only, never your own account, always audited |
| `get_public_stats()` | anonymous landing counters (aggregates only) |
| `admin_get_stats()` | dashboard counters in one round trip — live SQL counts, nothing hardcoded |
| `validate_donation_record` trigger | outcome records: accepted requests only + donor **ABO compatibility enforced in the DB** |
| `log_request_created` trigger | audit parity for request creation |
| participants select policy | participants can read membership rows of their own conversations |
| `request_guard` additions | reason-aware logging; requesters may edit details **only while Pending** (was JS-only before) |

### Seed data (seed.sql) — upgraded
- Creates the **same 11 demo accounts** as mock mode, directly in SQL: bcrypt-hashed
  passwords, **pre-confirmed emails** (no dependency on live email during the defense demo),
  profiles enriched with blood types/regions/availability.
- Promotes `admin@demo.com` with an explicit, commented trigger-disable bootstrap (the
  anti-escalation trigger is exactly why roles change only through the documented path).
- Seeds 3 hospitals + 3 requests; fully idempotent (fixed UUIDs + `ON CONFLICT DO NOTHING`).

## 5. Verification performed (all passed)

- Production build: clean (`vite build` ✓).
- Browser walkthrough on **mobile 390×844** and **desktop 1440×900**, zero console errors:
  landing → login (quick-fill admin) → dashboard → admin stats (11 users / 8 donors /
  7 requests — live counts) → request detail matching (O+ request → only O−/O+ donors,
  same-region first) → new conversation → **message send → store → live render** →
  register → simulated email verify → dashboard → profile sign-out.
- Sticky footer verified on long pages; bottom bar correctly hidden ≥768px.

## 6. Files touched (summary)

- **New:** `src/lib/supabaseBackend.js`, `src/pages/ResetPassword.jsx`, `.env.example`, `CHANGELOG.md`
- **Rewritten:** `src/index.css` (design system), `src/components/ui.jsx`, `Layout.jsx`,
  `AdminLayout.jsx`, `Landing.jsx`, `Messages.jsx`, `Register.jsx`, `ForgotPassword.jsx`,
  `supabase/seed.sql`, `README.md`
- **Updated:** all remaining pages/components (theme + mobile), `constants.js`, `dataService.js`,
  `AuthContext.jsx`, `App.jsx` (new route), `mockBackend.js` (realtime emitter + rename),
  `supabase/schema.sql` (extensions), `package.json`, `index.html`

## 7. What was *not* changed (scope honesty)

- Domain rules, the 9-step workflow, statuses, disclaimers, security model, demo accounts,
  folder structure — all preserved from the approved Phase 1 build.
- The "Extras" scope (pledge button, reviews, notifications) remains out of scope pending
  confirmation.

# HemaMatch — Change Report

**v6.10 — November 24, 2026** (latest) · feat: notifications for every role
**v6.9 — November 24, 2026** · fix: demo doctor/business logins (GoTrue 500 + instance_id bug)
**v6.8 — November 24, 2026** · all demo data scoped to Valencia City, Bukidnon (Region X) — real Valencia hospitals
**v6.7 — November 24, 2026** · infinite recursion in the conversation_participants RLS policy fixed (security-definer helper; 4 policies rewritten)
**v6.6 — November 24, 2026** · seed.sql FK crash fixed (explicit idempotent profiles insert) + the empty hospital dropdown explained & fixed with visible error/empty states
**v6.5 — November 24, 2026** · last "blood type needed" wording removed; hospitals list crash (phantom doctor_count column) fixed; schema.sql validated statement-by-statement in a real Postgres and made re-runnable
**v6.4 — November 21, 2026** · blood-type labelling clarified (form + request panel), browse tabs locked to equal size, New-request button moved below the tabs
**v6.3 — November 21, 2026** · dashboard declutter: donor-profile card removed, stats condensed into one card, quick actions rebalanced (icon beside label on mobile, 6 columns)
**v6.2 — November 21, 2026** · dashboard typography + redesigned hospital notifications (concise → expandable → full tab), origin-aware back navigation
**v6.1 — November 19, 2026** · mobile-first navigation restored per client feedback: bottom tab bar on phones, desktop sidebar untouched
**v6 — November 19, 2026** · global UI/UX redesign per the client's design instructions: spec palette, sidebar + topbar application shell, Lucide icons, role dashboards with statistics
**v5 — November 19, 2026** · full light-theme redesign after the DentaBook reference (dentabook.forgroup.space): white surfaces, DM Sans, hairline borders, single red accent
**v4.1 — November 7, 2026** · compatible donor types as individual checkboxes (multi-select, varies by patient blood type), hospital field now required compatible donor types as individual checkboxes (multi-select, varies by patient blood type), hospital field now required
**v4 — November 7, 2026** · account-type hierarchy (Donor/Recipient · Doctor · Business), compatible-donor dropdown, hospital notifications, donor-accept flow with assigned doctors, doctor applications, hospital directory with photo pages, hospital messaging
**v3.1 — November 3, 2026** · Donate tab in the mobile bottom navigation, real app icon files
**v3 — October 31, 2026** · black theme, profile views on request detail, donation offers, profile photos
**v2 — October 25, 2026** · rebrand, dark theme, mobile-first, Phase 2 Supabase backend













---

# HemaMatch — Change Report (v6.10)

**Date:** November 24, 2026 · **Scope:** notifications for every role
(admin, donor, requester, doctor, business) — previously business-only.

## 1. What changed

The `/notifications` tab, the topbar bell and its unread badge are now
available to EVERY signed-in account. A new `user_notifications` inbox
(same shape as the hospital one, but addressed to a single user) is
written automatically by the database whenever something happens to you:

| Event | Who is notified |
| --- | --- |
| Your request changes status (with reason) | the requester + every accepted donor |
| A donor accepts a request | the requester + the donor (receipt) + the assigned doctor |
| A doctor is assigned / re-assigned to an acceptance | the doctor |
| A hospital reviews your doctor application | the doctor (accepted / rejected + reason) |
| An outcome record is created | the donor + the requester |

Business accounts keep their hospital inbox; the `/notifications` page
merges both streams into one tab (hospital rows keep their mark-read
semantics), and the bell counts both.

## 2. Where

- **`supabase/schema.sql`** — `public.user_notifications` table (RLS:
  select/update own rows only; no client insert/delete), `notify_user()`
  helper, and emission wired into the existing SECURITY DEFINER
  triggers/RPCs (`guard_request_update`, `on_acceptance_created`,
  `set_acceptance_doctor`, `hospital_set_doctor_application_status`,
  `on_record_created`).
- **`supabase/seed.sql`** — 10 demo rows so every account (admin,
  maria, juan, angela, grace, dr.ramos, dr.domingo…) opens the app with
  a populated bell on first seed run; later runs rely on live triggers.
- **`src/lib/mockBackend.js`** — `notifyUser()` mirrors the SQL
  emission on the same five events; `listUserNotifications` /
  `markUserNotificationRead` / `markAllUserNotificationsRead`.
- **`src/lib/supabaseBackend.js`** — the same three functions against
  the table (RLS scopes rows per user).
- **`src/pages/Notifications.jsx`** — all roles; business sees the
  merged stream (user + hospital inbox).
- **`src/components/NotificationList.jsx`** — rows carry a `source`
  tag; mark-read routes to the right backend; two new type labels
  (Request status, Doctor assignment).
- **`src/components/SidebarLayout.jsx`** — Notifications nav entry for
  all roles (Communicate section); bell + unread badge for everyone.

## 3. Verification

- PGlite: table + RLS (own rows only, no client insert/delete,
  retarget-proof), emission for all five events, idempotent re-runs —
  ALL USER-NOTIFICATION CHECKS PASSED.
- Mock harness: seeded inbox per role, live emission on
  accept/status-change, mark-read + mark-all, foreign mark-read
  rejected — ALL MOCK CHECKS PASSED.
- Full schema validator + login-semantics validator: ALL CHECKS
  PASSED. Frontend build passes.

## 4. Deploying

Re-run `supabase/schema.sql` then `supabase/seed.sql` in the Supabase
SQL editor (both are idempotent; the seed self-heals older rows and now
seeds the demo user notifications). No .env or frontend changes needed.

---

# HemaMatch — Change Report (v6.9)

**Date:** November 24, 2026 · **Scope:** login failures on the live
Supabase project (doctor / business / business+doctor demo accounts).

## 1. Symptoms and root causes

| Login attempt | Browser error | Root cause |
| --- | --- | --- |
| `dr.ramos@demo.com` (Doctor) | "Database error querying schema" (HTTP 500) | GoTrue scans `auth.users` columns (`email_change`, `email_change_token_new`, `email_change_token_current`, `email_change_sent_at`) into NON-NULLABLE Go strings; the seed left them NULL → `sql: Scan error … converting NULL to string` → generic 500 (supabase/auth#1940) |
| `biz.stmary@demo.com` (Business) | "Invalid email or password." (HTTP 400) | copy-paste bug: the three business rows had `instance_id` set to **their own user UUID** instead of the project's all-zeros instance UUID → GoTrue's instance-scoped lookup never matched them |
| `biz.davao@demo.com` (Business+Doctor) | "Invalid email or password." (HTTP 400) | same `instance_id` bug |

## 2. Fixes

1. **`supabase/seed.sql`** — the `auth.users` INSERT now supplies every
   GoTrue-scanned column: `email_change`, `email_change_token_new`,
   `email_change_token_current` as `''`, and `email_change_sent_at` as
   the epoch. The three business rows got the correct all-zeros
   `instance_id`. A **self-healing block** (section 1c) also repairs
   rows seeded by older versions on re-run, and re-asserts the
   `auth.identities` email-provider rows.
2. **`supabase/fix-login.sql`** (NEW, standalone patch) — run this once
   in the Supabase SQL editor on the live project to repair existing
   broken rows WITHOUT re-running the whole seed: backfills ''/epoch on
   all GoTrue-scanned columns, resets instance_id to the all-zeros
   instance UUID, re-hashes any NULL passwords with the demo passwords,
   and inserts missing `auth.identities` rows. Ends with a verification
   SELECT printing one row per demo account with three ok-flags.
   Idempotent; touches only `@demo.com` accounts.
3. **`src/lib/supabaseBackend.js`** — the "Database error querying schema"
   500 now surfaces as a friendly message pointing at the patch file
   instead of the raw GoTrue error.

## 3. Verification (PGlite, GoTrue-semantics simulation)

- Fresh seed → all 10 chip accounts log in OK (admin, 3 doctors, 4
  businesses, donor, requester), including the three previously broken
  business rows and the doctor row.
- Seed re-run (idempotency) → all logins still OK.
- Old broken shape recreated (NULL token columns + wrong instance_id) →
  all logins fail exactly as reported; applying `fix-login.sql` alone →
  all 10 repaired.
- Full schema validator: ALL SCHEMA CHECKS PASSED (RLS recursion guards
  still green; 4 Valencia hospitals with rosters 0/0/2/1).
- Frontend build passes.

## 4. Deploying

Run `supabase/fix-login.sql` in the Supabase SQL editor (fastest fix on
the live project), or re-run the updated `supabase/seed.sql` (its
self-healing section repairs the existing rows). Then sign in with the
login-screen quick-fill chips as usual.

---

# HemaMatch — Change Report (v6.8)

**Date:** November 24, 2026 · **Scope:** geography of all demo/seed data.

## 1. What changed

Per the client's request, ALL demo data — hospitals, donor/requester/doctor
profiles, blood requests, donation offers, notifications, chat transcripts,
form placeholders and the landing demo card — is now scoped to **Valencia
City, Bukidnon, Region X (Northern Mindanao), Philippines**.

## 2. Hospitals (real Valencia City facilities)

| ID | Hospital | Address | Contact |
| --- | --- | --- | --- |
| aa01 | Valencia Adventist Medical Center | Sayre Highway, Brgy. Poblacion, Valencia City | (088) 828-7777 |
| aa02 | Valencia Medical Hospital | Sayre Highway, Brgy. Poblacion, Valencia City | (088) 828-8888 |
| aa03 | La Viña General Hospital | National Highway, Brgy. La Viña, Valencia City | (088) 828-9999 |
| aa04 | Abella Midway Hospital | Sayre Highway, Brgy. Poblacion, Valencia City | (088) 828-6666 |

All four: region `Region X (Northern Mindanao)`, city `Valencia City`,
Bukidnon postal 8709, area code 088, Sayre Highway addresses.

## 3. Data sweep

- 18/18 profiles with region → `Region X (Northern Mindanao)` / `Valencia City`
- 3/3 blood requests → Region X
- All offer notes, request descriptions, notification bodies, doctor
  application notes, seeded chat messages: old city references replaced
- mock mode (mockData.js) mirrors the SQL seed exactly
- Region dropdown keeps the full 17-region Philippine list — real users
  can still register from anywhere; only the SEEDED demo data is scoped
- Demo login emails kept (`biz.stmary@demo.com` etc.) — they are login
  credentials, not location data; labels now show the hospital names
- schema.sql backfill migration reference updated to Valencia Adventist

## 4. Verification

- Full schema validator passes: seed executes cleanly, RLS recursion guard
  [10]/[11] still green, idempotent re-run OK
- Dedicated scope check: 4/4 hospitals, 18/18 profiles, 3/3 requests in
  Valencia City + Region X; 28 seeded text rows contain no old-location
  strings (NCR/Manila/Iloilo/Davao/St. Mary/...)
- Frontend build passes

## 5. Deploying

Re-run `supabase/seed.sql` after schema (idempotent `on conflict do
nothing` on every row). No schema changes were needed — region/city are
free text with no CHECK constraints.

---

# HemaMatch — Change Report (v6.7)

**Date:** November 24, 2026 · **Scope:** RLS policy recursion in the messaging tables.

## 1. The error

    infinite recursion detected in policy for relation "conversation_participants"

Reproduced locally in embedded Postgres before fixing.

## 2. Root cause

The `participants_select_participant` policy **on** `conversation_participants`
subqueried `public.conversation_participants` in its own `USING` clause. Postgres
applies a table's RLS to queries inside a policy — including the policy's own
subquery — so evaluating the policy re-triggered the same policy: error 42P17
(infinite recursion). Every access path that touched the table died, including
the app's `listConversations()` nested select (conversations +
`conversation_participants(user_id)`), which is where the error surfaced.

Three sibling policies on `conversations` and `messages` scanned the same
table from outside, which is legal — but they re-entered the broken
participants policy through it, so messaging failed wholesale.

## 3. Fix (schema.sql)

1. New `security definer` helper `public.is_conversation_participant(uuid)`:
   runs outside RLS (the schema's established pattern, e.g. `is_admin()`), so
   its internal scan of `conversation_participants` does not re-enter any
   policy. Placed after the messaging tables (SQL validates function bodies
   at creation); granted to `authenticated`.
2. Four policies rewritten to call the helper instead of subquerying the
   table directly:
   - `conversations_select_participants` → `using (public.is_conversation_participant(conversations.id))`
   - `messages_select_participants` → same pattern
   - `messages_insert_participant` → `with check (sender_id = auth.uid() and public.is_conversation_participant(...))`
   - `participants_select_participant` → `using (public.is_conversation_participant(conversation_id))`
     — the caller now sees every membership row of conversations they take
     part in (needed to render "who is the other participant").
3. Drop-if-exists guards kept, so the schema stays re-runnable.

## 4. Verification (embedded Postgres, real RLS enforcement)

- Participant sees their conversation: participants=2, messages=1,
  conversations=1. Outsider sees all three = 0 (no leak).
- Outsider INSERT into messages: blocked by RLS.
- The app's exact `listConversations()` nested-select query shape runs
  clean and returns both participant ids.
- Recursion sweep across all 12 public tables as `authenticated`: 0 errors.
- Validator gains permanent checks `[10]` (RLS runtime participant/outsider
  semantics + app query shape) and `[11]` (recursion sweep); the full suite
  passes, including the v6.6 seed re-run simulation.
- Messages.jsx already renders load errors via EmptyState (no silent-empty
  trap like the v6.6 dropdown).

## 5. Deploying the fix

The schema is idempotent — re-run `supabase/schema.sql` in the Supabase SQL
editor (the policy `drop ... if exists` guards make it safe on an existing
project). No seed or client changes are required.

---

# HemaMatch — Change Report (v6.6)

**Date:** November 24, 2026 · **Scope:** seed.sql reliability + request-form hospital dropdown UX.

## 1. The seed crash: `hospitals_admin_id_fkey ... not present in table "profiles"`

Root cause: the seed inserted `auth.users` rows with `ON CONFLICT (id) DO
NOTHING` and relied on the `handle_new_user` **trigger** to create each
profile. When an auth row already existed (an earlier partial seed run, or a
`public`-schema reset while `auth.users` persisted), the INSERT was skipped —
so the trigger never fired, no profile row was created, and the hospitals
INSERT died on the foreign key to `profiles`.

Fix: section 1b now inserts all 18 `public.profiles` rows **explicitly**
(same values the trigger would write: role from account_type, doctor license
fields for doctor accounts) with `ON CONFLICT (id) DO NOTHING`. The seed no
longer depends on trigger timing in any scenario, and the enrichment UPDATEs
that follow apply in every case.

Verified in the embedded-Postgres validator with a new check that reproduces
the exact crashed state (auth rows present, `public.profiles` empty): the
seed now completes — profiles=18, hospitals=4, roster=4, requests=3.

## 2. The empty hospital dropdown

Two stacked causes:

- **Primary:** the seed crash above stopped the script *before* the
  hospitals were inserted — nothing verified existed to list. With the seed
  fixed, the dropdown populates again.
- **Secondary (UX):** if `listHospitals()` failed or returned nothing, the
  form silently rendered an empty `<select>` with no feedback. The dropdown
  now has three explicit states: a **loading** line, an **error box with the
  reason and a Retry button**, and a friendly **empty state** ("No verified
  hospitals yet — an administrator has to verify a hospital before requests
  can name it"). All three states were verified in the browser.

**Also verified:** normal state lists the verified hospitals
(St. Mary — Manila, Central Luzon — San Fernando, Western Visayas — Iloilo
City); production build passes.

---

# HemaMatch — Change Report (v6.5)

**Date:** November 24, 2026 · **Scope:** client round 6 — wording + a live-database crash + schema hardening.

## 1. "Blood type needed" — gone for good

The v6.4 rename missed one string the user still saw: the form's validation
error on submit ("Please choose the blood type needed."). It now reads
"Please choose your blood type." A full-project sweep confirms no
user-visible "type needed" wording remains (form labels, helpers, request
panel, cards, validation).

## 2. Live mode crashed on the hospitals directory

`column hospitals.doctor_count does not exist` — `listHospitals()` selected
`doctor_count` as if it were a real column of `hospitals`. It never was: it
is a computed field of the `get_hospital_detail` RPC. The select now drops
the phantom column and the count is computed the same way the RPC computes
it: one query over `hospital_doctors` (accepted rows, RLS-readable by every
signed-in user), plus the business admin when they are a doctor and not
already on the roster.

## 3. Schema.sql validated in a real Postgres, then fixed

The whole file was executed statement-by-statement in an embedded Postgres
(PGlite) with a Supabase `auth` stub, then run a second time to test
re-runnability. Both runs pass now. Real bugs this surfaced and their fixes:

- **Forward references.** The donation_requests policies referenced
  `donor_acceptances`, and a section-8 index referenced `donation_offers`
  — both tables were only created hundreds of lines later, so a fresh
  database hit "relation does not exist". The 11.2 donor-acceptances block
  now lives right after the donation_requests table; the offers index moved
  next to its table.
- **Business signup crash.** `handle_new_user()` inserted a hospital with a
  NULL name for business accounts without hospital metadata (the seeded demo
  admins) — NOT NULL violation. The trigger now skips hospital creation
  when no hospital_name metadata exists.
- **Reserved word.** `protect_role_column()` declared a plpgsql variable
  named `current_role`, shadowing PostgreSQL's CURRENT_ROLE keyword.
  Renamed to `v_actor_role`.
- **Re-runnability.** 26 `create policy` statements had no
  `drop policy if exists` guards and two functions lacked `or replace` —
  re-running the schema on a live database failed 28 times. All guarded
  now (and `alter publication supabase_realtime` is wrapped in a
  pg_publication existence check).

The validator itself is kept as
`scripts/validate-schema.mjs` (runs schema.sql + seed.sql + smoke tests +
double-run; auth stub included, pgcrypto stubbed locally only).

**Verified in-browser:** hospitals directory renders with doctor counts;
request form submits with the new validation text; "My blood type" first
label; production build passes.

---

# HemaMatch — Change Report (v6.4)

**Date:** November 21, 2026 · **Scope:** client round 5 — blood-type labelling and browse-tab stability.

## What changed

1. **Request form — "Blood type needed" renamed to "My blood type".** The old label
   read like the type being requested was something you pick from a list of "needed"
   types. This is the patient's own blood type. The compatible-donor display moved
   with it: the helper line and the "Preferred donor blood types" checkbox group now
   sit directly beneath "My blood type", and "Units needed" moved below that — the
   form reads as one group: my type → who can donate to me → how many units.

2. **Request panel shows both, explicitly.** The request detail header now reads
   "Blood type A- · can receive from O-, A-" under the title, and the details list
   has separate rows: "Blood type (patient)" and "Blood types that can donate
   (ABO/Rh)". The browse cards got the same one-line treatment ("A- can receive
   from O-, A-"), so the patient's type and the needed donor types are never
   confused anywhere.

3. **Browse tab buttons never change size.** The two segmented-control buttons
   ("Blood requests" / "Available donors") are now equal cells of one CSS grid with
   a fixed min-height instead of flex items sized by their content — identical
   width and height on both pages, in both active and inactive states, on mobile
   and desktop.

4. **"+ New request" moved below the tabs.** It used to sit top-right on the
   requests page only, so switching to "Available donors" removed it and the tab
   row jumped upward. Both pages now share the same header structure (title → tabs
   row), the button sits under the tabs on the requests page, and the tabs render
   at the exact same position on both pages (verified pixel-identical: same Y, same
   175×44 mobile / 169×44 desktop button size, same wrapper). The donors page
   subtitle was shortened so both headers wrap identically.

**No backend or schema changes.**

**Verified in-browser:** 390px and 1280px — tab buttons equal size and same
position on both pages; New request below the tabs (mobile, full-width) and beside
them (desktop, same row); form label order My blood type → Preferred donor blood
types → Units needed with the compatible-types helper under the select; request
panel header line, both dl rows and the card line present; "Blood type needed"
absent everywhere; no horizontal overflow. Production build passes.

---

# HemaMatch — Change Report (v6.3)

**Date:** November 21, 2026 · **Scope:** client follow-up — dashboard layout decluttering.

## What changed

1. **"My donor profile" card removed** — it duplicated the profile entry point that
   already exists in the top-right profile menu. The donor-listing status line that
   lived inside it is gone from the dashboard too; listing management stays on the
   Donate page.

2. **The four stat tiles (My requests / Pending / Accepted / Completed) are now ONE
   card** — a single surface with an internal 2×2 grid on mobile and a single row of
   four on desktop, separated by hairline dividers instead of four separate bordered
   cards. Same numbers, calmer layout, less vertical space.

3. **"Find donors" joined the quick actions** alongside Request blood, Donate blood,
   Browse requests, Find a hospital and Messages — six actions total (it used to be a
   small secondary button inside the removed donor-profile card).

4. **Quick action buttons rebalanced on mobile** — icon and label now sit SIDE BY SIDE
   in one horizontal row (icon left, label center, subtle chevron right) instead of
   the icon stacking above the name. All six rows are equal-height single-line pills.
   Desktop is unchanged: the roomy icon-over-text cards, now in a 6-column grid that
   matches the six actions, with the one-line descriptions still visible there only.

**No backend or schema changes.**

**Verified in-browser:** 390px — donor-profile card gone (regular and business
dashboards); stats render as one card with exactly one horizontal + one vertical
divider in the 2×2 mobile grid and no stray borders; six quick-action rows, icon
bounding box fully left of the label with vertical overlap (side by side), uniform
66px row heights; no horizontal overflow. 1280px — stats collapse to a single row
(3 vertical dividers, no horizontal line under the first two cells after fixing a
stray divider); quick-action cards stack icon-over-label with descriptions visible;
no overflow. Production build passes.

---

# HemaMatch — Change Report (v6.2)

**Date:** November 21, 2026 · **Scope:** client follow-up — dashboard font size, concise
expandable notifications, origin-aware back navigation, full notifications tab.

## What changed

1. **Dashboard typography, one notch smaller** — page title 24→20px, stat numbers
   30→24px, section headings 18→16px, hints and subtitles trimmed to match. Still
   clearly hierarchical, just no longer oversized.

2. **Notifications are now concise by default and expandable** — a collapsed row shows
   only the unread dot, title, type and time. Clicking the row expands it to reveal the
   full message body, the sender, and exactly two actions: **View details** (opens the
   related request) and **Mark as read**. The actions exist only in the expanded state.

3. **The My-hospital panel shows at most 5 notifications**, with a **"View more (N more)"**
   link at the bottom that navigates to the new notifications tab. "Mark all as read"
   stays in the panel header.

4. **Back navigation is origin-aware** — opening a request from a notification's
   "View details" makes the request page's back link read "← Back to My hospital" (or
   "← Back to notifications") and actually return there, instead of always dumping the
   user on /requests. Direct visits from the requests list keep the old behavior.

5. **New /notifications tab** (business accounts) — the full inbox with much more
   control: status filter (All / Unread / Read), type filter (requests, donor
   acceptances, doctor applications, outcomes), free-text search over title/body/sender,
   newest/oldest sort, mark-all-as-read and a live unread counter. Reached from the
   panel's "View more", the sidebar and the topbar bell.

6. **Topbar bell upgraded** — for business accounts it opens the notifications tab and
   carries a live unread badge (e.g. "5"); for everyone else it still opens Messages.
   The sidebar's Hospital section gains a "Notifications" entry (desktop/tablet); the
   mobile tab bar keeps its 6 thumb-reachable tabs unchanged.

**No backend or schema changes** — everything rides the existing
`listHospitalNotifications` / `markHospitalNotificationRead` /
`markAllHospitalNotificationsRead` service calls.

**Verified in-browser:** 390px — collapsed rows show title+time only; expanding reveals
body + View details + Mark as read (doctor-application rows correctly have no View
details since they carry no request); panel caps at 5 with "View more (1 more)"; View
details → request page shows "← Back to My hospital" and returns there; the same flow
from /notifications returns to /notifications; unread filter 5 of 6 shown; search
"doctor" → 1 doctor-application row; sort options present; bell badge shows 5; mobile
tab bar intact and 8-page sweep overflow-free; dashboard h1 renders at 20px, stats at
24px. 1280px — grace's sidebar unchanged, business sidebar lists My hospital +
Notifications, bell badge live, no overflow. Production build passes.

---

# HemaMatch — Change Report (v6.1)

**Date:** November 19, 2026 · **Scope:** client follow-up — "don't remove the bottom
navigation, make this mobile first, but the desktop UI is fine".

## What changed

- **Bottom tab bar restored on phones (< md)**, now with Lucide icons in the v6 design
  language: Home / Requests / Donate / Messages / role-slot / Profile, 56px
  thumb-reachable targets, active tab in crimson, translucent white bar with the
  safe-area padding (pb-safe).
- **Role-aware 6th tab** (unchanged v5 logic): admins get **Admin**, business (hospital)
  accounts get **Hospital**, doctors get **Witness**, everyone else gets **Hospitals**.
- **The mobile drawer is gone again**: the topbar hamburger was removed — on phones,
  primary navigation is the tab bar; the sidebar (with every section, including the
  role ones) remains the navigation for md+ tablets and desktops, exactly as delivered
  in v6.
- Layout clearances updated for the fixed bar: main content `pb-28`, footer `pb-20`,
  `pb-safe` on the bar itself; the Messages thread height recalculated
  (`100dvh-15.5rem` on phones) so the composer always sits above the tab bar.
- No routes, guards, Supabase calls or business logic touched — shell-only change.

**Verified in-browser:** 390px — tab bar fixed to the bottom on all pages, correct
role tab for each demo account (user / admin / business / doctor), composer input and
every page's content clear the bar, zero horizontal overflow across
dashboard/requests/new/donors/hospitals/messages/profile/donate/my-assignments;
768px — tab bar hidden, icon-rail sidebar; 1280px — unchanged v6 desktop (256px
sidebar with labels, topbar bell, no overflow). Production build passes.

---

# HemaMatch — Change Report (v6)

**Date:** November 19, 2026 · **Scope:** the client's global UI/UX design & development
instructions — DentaBook as visual inspiration, exact HemaMatch brand palette, sidebar
navigation, professional healthcare SaaS look. Zero functional changes: all routes,
guards, Supabase integrations, business logic and role permissions untouched.

## 1. Brand palette (spec-exact)

Primary deep crimson #B91C35 (buttons, active nav, links, highlights) · secondary dark
burgundy #861B32 · accent soft rose #FCE8EC (blood-type tints, icon chips) · background
off-white #FAFAFB · surfaces pure white · text #202124 / #737780 · semantic
success/warning/danger retained. Red used strategically; the interface stays calm.

## 2. Application shell (SidebarLayout, new component)

- Desktop: fixed left sidebar (logo lockup, grouped sections — General / Communicate /
  role sections: Hospital for business admins, Witness for doctors, Administration for
  admins) with Lucide icons + labels, active page highlighted in soft-rose/red,
  collapsible to a 72px icon rail (tooltips when collapsed).
- Tablet (md): icon-rail sidebar.
- Mobile (< md): slide-in drawer with scrim, auto-closes on navigation; topbar carries
  the hamburger + compact brand.
- Topbar: context title, message/notification bell, profile dropdown (avatar, role
  badge, My profile, Sign out).
- The old top-nav + bottom-tab-bar shell is now the PUBLIC shell only (landing, login,
  register, reset, 404); signed-in pages all render inside the sidebar shell.
- Routing restructured in App.jsx accordingly (page wrapped as children of
  SidebarLayout inside ProtectedRoute — guards unchanged, admin sub-routes unchanged).

## 3. Icons — Lucide everywhere

lucide-react installed; every inline SVG replaced (sidebar, topbar, dashboard, cards,
messages, hospitals, profile, register, browse tabs, spinner/empty/error states).
Consistent outline style, ~1.9-2 stroke, no emoji, no mixed styles.

## 4. Dashboards

- User Dashboard: welcome header + "New request" action, four live stat tiles (My
  requests / Pending / Accepted / Completed — computed from getMyRequests), role
  context cards (doctor/business), donor-profile card, five quick-action cards with
  icon chips, recent requests (first 4 + "View all"), status legend.
- Admin Dashboard: four headline stat tiles with icon chips (Registered users /
  Available donors / Pending requests / Completed donations — live from getStats),
  quick actions (Manage requests / Record an outcome / Review users / Verify
  hospitals), compact mini-stats for accounts, requests and outcome records, recent
  administrative activity feed with action chips.
- BloodTypeBadge: solid crimson with white text — blood types are now immediately
  identifiable everywhere (spec §6).
- DonorCard: Lucide location/calendar icons, "Compatible type" chip, icon buttons.
- RequestCard: icon-enriched meta, clearer hierarchy.

## 5. Fixes

- SidebarLayout renders route children passed as props OR the Outlet (nested admin
  routes rely on the Outlet).
- Guard order: SidebarLayout sits inside ProtectedRoute so the auth context is always
  present.

**Verified in-browser:** all pages at 1280/768/390 across roles (user, admin, business,
doctor): sidebar sections per role, collapse to rail with tooltips, mobile drawer with
auto-close, zero horizontal overflow on every page, crimson-on-white chat bubbles,
solid-crimson blood badges (#B91C35 + white verified), quick actions, live dashboard
numbers (18 users / 7 donors / 3 pending for admin; 1 request for Grace), zero console
errors on fresh loads (only pre-existing React Router v7 future-flag warnings).
Production build passes.

---

# HemaMatch — Change Report (v5)

**Date:** November 19, 2026 · **Scope:** the client's request to make the UI better and
simplistic, using dentabook.forgroup.space as the reference. The dark "blood thirst"
theme is replaced end-to-end by a clean light design system; no behavior, routing or
data changes.

## 1. What was taken from the reference

The DentaBook site was measured live (computed styles, tokens, layout anatomy) and
reduced to a design system: DM Sans with tight negative tracking on display headings,
white page and surfaces, ink #16323e text, muted #657985 secondary text, hairline
#e1eaed borders instead of shadows (shadow only on floating/feature cards),
10-12px radii, 7-10px button radii, one calm accent, tinted pale sections, a white
header with a quiet bottom border, and the two-tone wordmark + tiny-caps tagline
logo lockup.

## 2. How it was applied

- **Design tokens remapped, not scattered.** The app already spoke in 6 semantic
  tokens, so the theme flips in one place: `ink`/`night` → white surfaces, `cream` →
  ink text, `gold` → blood red #b3132b (actions, links, highlights), `blood` → pale
  red badge tint. Plus new `muted`, `line`, `pale` utilities.
- **Component classes restyled** (buttons: solid red primary, hairline secondary;
  inputs: white with #d9e5e9 border; cards: white, radius 12, border not shadow;
  chips, labels 13px/600).
- **Atoms retuned for light surfaces** in `ui.jsx`: status badges (tinted 50s with
  800-grade text), alerts, avatars (pastel 100s), BloodTypeBadge (pale red, red text),
  confirm-dialog scrim.
- **Sweep across all 30+ JSX files** (scripted, then reviewed): dark-theme opacities
  → muted ramp, `bg-cream/5` hovers → pale, overlays → light scrim, status colors →
  700-grade.
- **Layout**: white sticky header with two-tone "Hema**Match**" + "GIVE BLOOD. SAVE
  LIVES." tagline, quiet nav links (active = red), white footer on #fbfdfd, light
  bottom tab bar.
- **Landing rebuilt on the reference's homepage pattern**: eyebrow, 60px tight
  heading with highlighted word, floating request card with soft shadow, quick-action
  link cards with arrow links, ABO/Rh strip on a pale well.
- **Font**: Inter → DM Sans (400-700), `theme-color` → white, `color-scheme: light`.

## 3. Fixes found during verification

- Chat bubbles: mine = red bubble with white text (was gold-on-night); theirs =
  pale well with hairline border.
- Messages grid overflowed its column at phone width (pre-existing, invisible on
  dark theme) — fixed with `minmax(0,1fr)` + `min-w-0`.

**Verified:** every page scanned in-browser at 390×844 and 1280×900 (landing, login,
register, dashboard, requests, request form incl. compatibility checkbox pills,
request detail, messages thread, hospitals, hospital detail, donate, profile, all six
admin pages): zero horizontal overflow, zero dark surfaces left, no low-contrast text
(only white-on-red buttons), zero console/page errors; pixel-checked screenshots
confirm white backgrounds + red accent everywhere. Production build passes.

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

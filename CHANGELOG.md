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

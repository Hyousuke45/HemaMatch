# HemaMatch — Blood Donation & Matching Web Application

Academic MVP connecting people who need blood with volunteer donors.
**Stack:** React 19 + Vite 6 + Tailwind CSS 4 (frontend) · Supabase = PostgreSQL + Auth + Realtime (Phase 2) · Vercel (Phase 3 deployment)

> **Medical disclaimer:** Blood-type matching in this app is **preliminary filtering only**. It never determines medical compatibility, and a listed donor is not guaranteed to be eligible. Actual compatibility and donor screening are always decided by qualified healthcare professionals. This is an academic demonstration platform, not a certified medical system.

---

## Where the project stands (Phase 2 — backend wired)

| Layer | Status |
|---|---|
| Every page & component | Built and wired together, **dark "blood thirst" theme, mobile-first** (bottom tab bar, 44px touch targets, safe areas) |
| Data | Two interchangeable backends behind one contract: **mock** (localStorage) and **Supabase** (PostgreSQL + RLS). Chosen automatically by `.env` — see Step 3 |
| Auth | Mock mode simulates the email link; **Supabase mode uses real Supabase Auth** — real confirmation & reset emails, session listener, `/reset-password` page |
| Matching | Full ABO/Rh matrix + region + availability, same-region ranked first — runs **server-side** (`get_matching_donors`) in Supabase mode |
| Messaging | 1:1 conversations, participant-checked, **Supabase Realtime** streaming in Supabase mode (mock mode: instant same-tab delivery + light poll) |
| Admin | Live statistics (SQL counts via `admin_get_stats`), request corrections **with server-logged reasons** (`set_request_status`), outcome records, user roles (`admin_set_role`), hospital verification, activity log |
| Security | RLS on every table, anti-self-escalation trigger, security-definer RPCs, trigger-written audit log — see *Security model* below |

See **CHANGELOG.md** for the full list of v2 changes (rebrand, dark theme, mobile UX, Phase 2 backend).

---

## Step 1 — Run the app (mock mode, zero setup)

```bash
npm install        # or: bun install
npm run dev        # or: bun run dev
```

Open **http://localhost:3000** (the preview panel also shows it — click "Open in New Tab").

### Demo accounts (seeded)

| Account | Email | Password | Role / notes |
|---|---|---|---|
| Ana Villanueva | `admin@demo.com` | `admin123` | Administrator |
| Maria Santos | `maria@demo.com` | `maria123` | Donor, O-, NCR, available |
| Grace Lim | `grace@demo.com` | `grace123` | Requester of an **O+ critical request** (great for matching demo) |
| Angela Reyes | `angela@demo.com` | `angela123` | Has a B- accepted request with a **failed outcome record** |
| Sofia Garcia | `sofia@demo.com` | `sofia123` | Completed request + successful record |

The same accounts exist in **Supabase mode** — `supabase/seed.sql` creates them with real bcrypt-hashed passwords and pre-confirmed emails (see Step 3), so the login quick-fill chips work in the live demo.

**Reset demo data anytime:** open the browser DevTools console and run
`localStorage.removeItem('hemamatch_mock_db_v1')` (data re-seeds on next load).

### 10-minute defense demo script

1. **Landing page** — mobile-first dark theme; live stats, the 3-step flow, and the medical disclaimer.
2. **Register** a new account → the email-verification screen appears:
   - mock mode → click **"Simulate clicking the verification link"**;
   - Supabase mode → the **real confirmation email** arrives (or use a pre-verified demo account — Supabase limits emails to ~2–3/hour on the free tier, so don't rely on live sign-ups during the defense).
3. **Complete your donor profile** (blood type, region, availability) — *Profile* page.
4. **Login as `grace@demo.com`** → open her O+ request → show **Potential donors (preliminary match)**: only O−/O+ available donors appear, same-region (NCR) first, with the disclaimer. Explain: this is filtering, not medical clearance.
5. Click **Message donor** → send a message in the chat. On a second device/browser, login as `maria@demo.com` → the message is already there (**Realtime** in Supabase mode).
6. **Login as `admin@demo.com`** → *Admin*:
   - **Overview**: every statistic is computed live from the database.
   - **Requests**: change a pending request to Accepted — a confirmation dialog asks for a reason; in Supabase mode the reason is written to the activity log **by the database** (`set_request_status` RPC).
   - **Outcome records**: record a **Successful** outcome for an accepted request → the request automatically becomes **Completed** → check the **Activity log**: both events are recorded.
   - **Hospitals**: verify the pending *Davao Regional Hospital*.
   - **Users**: role toggling is guarded (you can never change your own role) and logged.
7. **Security talking points:** users never see each other's emails; only admins complete requests; only participants read a conversation; every important change is audit-logged; nobody can grant themselves admin.

---

## Step 2 — Project structure

```
src/
  lib/
    constants.js        # blood types, ABO matrix, regions, statuses, disclaimers
    utils.js            # formatting + validation helpers
    mockData.js         # seeded demo data (mirrors schema.sql 1:1)
    mockBackend.js      # backend A: localStorage simulation + [RLS mirror] checks
    supabaseBackend.js  # backend B: Supabase Auth + Postgres queries + RPCs + Realtime
    dataService.js      # THE SWITCH: picks mock vs supabase from .env; exports isMock
    supabaseClient.js   # Supabase client (anon key only, inert until .env exists)
  context/AuthContext.jsx   # global auth state + Supabase onAuthStateChange listener
  hooks/useAsync.js
  components/         # Layout (mobile bottom tab bar), route guards, admin shell,
                      # cards, UI atoms (dark theme)
  pages/              # Landing, auth pages (+ ResetPassword), Dashboard, Profile,
                      # Requests, RequestForm, RequestDetail, Messages, Hospitals
  pages/admin/        # Overview, Requests, Records, Users, Hospitals, Logs
supabase/
  schema.sql          # FULL PostgreSQL schema: tables, constraints, triggers,
                      # RLS policies, security-definer RPCs, realtime, indexes
                      # + Phase 2 additions (set_request_status, admin_list_users,
                      # admin_set_role, get_public_stats, admin_get_stats, ...)
  seed.sql            # demo accounts (bcrypt + pre-confirmed) + hospitals + requests
.env.example          # the only two public vars the browser ever gets
```

Both backends export the **same function names** (`dataService.js` documents the contract), so pages never change when the backend switches. Search `// [RLS mirror]` in `mockBackend.js` to see where every JS check lives in PostgreSQL.

---

## Step 3 — Connect Supabase (Phase 2 — now implemented)

The code is ready; you only need the project and the environment file:

1. Create a free project at **supabase.com** (region: Singapore — closest to PH).
2. **SQL Editor** → paste the whole `supabase/schema.sql` → **Run**. This creates every table, RLS policy, trigger, index and RPC.
3. **SQL Editor** → paste the whole `supabase/seed.sql` → **Run**. This creates the 11 demo accounts (real bcrypt passwords, pre-confirmed emails — no sign-up emails needed during the demo), 3 hospitals, 3 requests, and promotes `admin@demo.com` to administrator.
4. Copy **Project Settings → API** values into a new `.env` file (copy `.env.example` as a template):
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```
   ⚠️ Only these two ever go in the frontend. The `service_role` key must NEVER appear in a `VITE_` variable.
5. Restart the dev server. The mode is chosen automatically:
   - both Supabase vars present → **Supabase mode**
   - missing → **mock mode**
   - force either one with `VITE_USE_MOCK=true|false`
6. Re-test the whole demo script **against the cloud database**, including cross-role checks (regular users must get empty results / errors from admin endpoints — that's RLS working).

### What changes between the modes (UX only)

| Flow | Mock | Supabase |
|---|---|---|
| Email verification after sign-up | "Simulate clicking the link" button | Real email + **Resend** button + sign-in |
| Password recovery | Simulated inline reset | Real reset email → `/reset-password` page (recovery session) |
| Chat delivery | Same-tab instant + 4s safety poll | **Realtime channel** + 4s safety poll |
| Everything else | identical | identical (authorization enforced by RLS, not JS) |

**Storage note (for future scope):** hospital document uploads would use a *private* Supabase Storage bucket with signed URLs — out of scope in the agreed Light hospital module.

## Step 4 — Deploy to Vercel (Phase 3)

1. Push the project to GitHub (make sure `.env` is git-ignored).
2. **vercel.com → New Project → Import** the repo (framework auto-detects Vite).
3. Add the two `VITE_SUPABASE_*` variables in Vercel's project settings → deploy.
4. Verify on the live URL: auth, a request→match→message flow, and admin pages.
5. Supabase free-tier note: projects pause after ~7 days of inactivity — open the dashboard the day before your defense to restore it.

---

## Security model (what to say at the defense)

- **RLS on every table** — even with full API keys, the database itself refuses unauthorized reads/writes.
- **No self-escalation** — the `protect_role_column` trigger reverts any non-admin attempt to change a role; the only path to change a role is the admin-only `admin_set_role()` RPC, which also refuses to touch the caller's own account (lockout protection) and writes an audit entry.
- **Messages are participant-checked** in SQL, not just hidden in the UI; conversations are created only by the secured `start_conversation()` RPC; Realtime delivery follows the same RLS.
- **Status transitions are guarded** by the `request_guard` trigger: only admins can complete requests; illegal jumps are rejected by the database. The `set_request_status()` RPC is the audited path for every status change — **including the human reason** — via a transaction-local setting the trigger reads (clients can never write `activity_logs`).
- **Outcome records are validated and insert-only** — `validate_donation_record` enforces accepted-requests-only and donor ABO compatibility in the database; no update/delete policies exist, for audit integrity.
- **The activity log is trigger-written** — clients have no INSERT/UPDATE/DELETE policy on it and cannot forge entries.
- **Matching runs in a secured function** (`get_matching_donors`) that first checks the caller is the requester or an admin.
- **Admin stats & user directory run through RPCs** (`admin_get_stats`, `admin_list_users`) that re-check the caller's role server-side — nothing is trusted from the browser, and no statistic is hardcoded.
- **Email enumeration is avoided** — password reset always answers "sent", regardless of whether the account exists.

## Known limitations (honest scope statement)

- In mock mode nothing leaves the browser; cloud persistence requires Step 3.
- Matching is preliminary filtering — not medical compatibility (by design and by requirement).
- Hospital module is the agreed **Light** scope: admin-managed records + verification badge; no document uploads or staff accounts yet.
- Supabase's free tier limits auth emails (~2–3/hour) — for the defense demo, use the pre-verified seed accounts.
- No end-to-end encryption in chat — out of scope by requirement, and honestly documented as such.

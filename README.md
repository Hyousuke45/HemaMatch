# HemaMatch — Blood Donation & Matching Web Application

Academic MVP connecting people who need blood with volunteer donors.
**Stack:** React 19 + Vite 6 + Tailwind CSS 4 (frontend) · Supabase = PostgreSQL + Auth + Storage + Realtime (Phase 2) · Vercel (Phase 3 deployment)

> **Medical disclaimer:** Blood-type matching in this app is **preliminary filtering only**. It never determines medical compatibility, and a listed donor is not guaranteed to be eligible. Actual compatibility and donor screening are always decided by qualified healthcare professionals. This is an academic demonstration platform, not a certified medical system.

---

## Where the project stands (Phase 1 — complete)

| Layer | Status |
|---|---|
| Every page & component | Built and wired together |
| Data | **Mock mode** — a localStorage-backed mock database with realistic seeded data (works offline, no server needed) |
| Auth | Mock auth with **email verification flow simulated** (per your "Enabled" choice; real emails arrive with Supabase in Phase 2) |
| Matching | Full ABO/Rh matrix + region + availability filters, same-region ranked first |
| Messaging | 1:1 conversations, participant-checked, 2.5s polling (Supabase Realtime replaces it in Phase 2) |
| Admin | Live statistics, request corrections, outcome records, user roles, hospital verification, activity log — all audited |
| Supabase | `supabase/schema.sql` (full PostgreSQL schema **with RLS policies, triggers, and secured RPCs**) is written and ready to run |

The mock backend mirrors every authorization rule 1:1 — search `// [RLS mirror]` in `src/lib/mockBackend.js` to see exactly where each check moves to PostgreSQL in Phase 2.

---

## Step 1 — Run the app (mock mode)

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

**Reset demo data anytime:** open the browser DevTools console and run
`localStorage.removeItem('HemaMatch_mock_db_v1')` (data re-seeds on next load).

### 10-minute defense demo script

1. **Landing page** — point out live stats, the 3-step flow, and the medical disclaimer.
2. **Register** a new account → the email-verification screen appears → click **"Simulate clicking the verification link"** (mock mode; Phase 2 sends a real email) → you land on the dashboard.
3. **Complete your donor profile** (blood type, region, availability) — *Profile* page.
4. **Login as `grace@demo.com`** → open her O+ request → show **Potential donors (preliminary match)**: only O−/O+ available donors appear, same-region (NCR) first, with the disclaimer. Explain: this is filtering, not medical clearance.
5. Click **Message donor** → send a message in the chat.
6. **Login as `maria@demo.com`** → *Messages* — Grace's message is already there (two-sided messaging). Note timestamps.
7. **Login as `admin@demo.com`** → *Admin*:
   - **Overview**: every statistic is computed live from the database (12 users, 7+ requests, correct status breakdown).
   - **Requests**: change a pending request to Accepted — a confirmation dialog asks for a reason and writes it to the activity log.
   - **Outcome records**: record a **Successful** outcome for an accepted request → the request automatically becomes **Completed** → check the **Activity log**: both events are recorded.
   - **Hospitals**: verify the pending *Davao Regional Hospital*.
   - **Users**: role toggling is guarded (you can never change your own role) and logged.
8. **Security talking points:** users never see each other's emails; only admins complete requests; only participants read a conversation; every important change is audit-logged; nobody can grant themselves admin (enforced again by RLS in Phase 2).

---

## Step 2 — Project structure

```
src/
  lib/
    constants.js      # blood types, ABO matrix, regions, statuses, disclaimers
    utils.js          # formatting + validation helpers
    mockData.js       # seeded demo data (mirrors schema.sql 1:1)
    mockBackend.js    # Phase-1 backend: auth + CRUD + authorization checks
    dataService.js    # THE SWITCH: USE_MOCK=true now, false after Phase 2
    supabaseClient.js # Phase 2 connection point (reads .env, anon key only)
  context/AuthContext.jsx   # global auth state (mock now, Supabase Auth later)
  hooks/useAsync.js
  components/         # Layout, route guards, admin shell, cards, UI atoms
  pages/              # Landing, auth pages, Dashboard, Profile, Requests,
                      # RequestForm, RequestDetail, Messages, Hospitals
  pages/admin/        # Overview, Requests, Records, Users, Hospitals, Logs
supabase/
  schema.sql          # FULL PostgreSQL schema: tables, constraints, triggers,
                      # RLS policies, security-definer RPCs, realtime, indexes
  seed.sql            # seeded hospitals + admin-promotion note
```

---

## Step 3 — Connect Supabase (Phase 2)

1. Create a free project at **supabase.com** (region: Singapore — closest to PH).
2. Open **SQL Editor** → paste the whole `supabase/schema.sql` → **Run**. This creates every table, RLS policy, trigger, and RPC. Then run `supabase/seed.sql`.
3. Copy **Project Settings → API** values into a new `.env` file:
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```
   ⚠️ Only these two ever go in the frontend. The `service_role` key must NEVER appear in a `VITE_` variable.
4. Create `src/lib/supabaseBackend.js` implementing the same function names listed in `dataService.js`, using `@supabase/supabase-js`. Flip `USE_MOCK = false` in `dataService.js`. No page code changes.
5. Register demo accounts through the app (Supabase Auth creates `auth.users`; the `handle_new_user` trigger creates their profiles). Promote your admin per the note in `seed.sql`.
6. Re-test the whole demo script **against the cloud database**, including cross-role checks (regular users must get empty results / errors from admin endpoints — that's RLS working).

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
- **No self-escalation** — the `protect_role_column` trigger reverts any non-admin attempt to change a role; hospital verification updates are admin-policy-only.
- **Messages are participant-checked** in SQL, not just hidden in the UI; conversations are created only by the secured `start_conversation()` RPC.
- **Status transitions are guarded** by a trigger: only admins can complete requests; illegal jumps are rejected by the database.
- **Outcome records are insert-only** — no update/delete policies, for audit integrity.
- **The activity log is trigger-written** — clients have no INSERT/UPDATE/DELETE policy on it and cannot forge entries.
- **Matching runs in a secured function** (`get_matching_donors`) that first checks the caller is the requester or an admin.

## Known limitations (honest scope statement)

- Phase 1 runs on mock data; cloud persistence arrives with Phase 2 (in progress).
- Matching is preliminary filtering — not medical compatibility (by design and by requirement).
- Hospital module is the agreed **Light** scope: admin-managed records + verification badge; no document uploads or staff accounts yet.
- Chat uses polling until Supabase Realtime is wired (Phase 2).
- No password reset by real email until Supabase Auth is connected.

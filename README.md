# HemaMatch — Blood Donation & Matching Web Application

Academic MVP connecting people who need blood with volunteer donors — and letting volunteers **offer to donate**, not just request.
**Stack:** React 19 + Vite 6 + Tailwind CSS 4 (frontend) · Supabase = PostgreSQL + Auth + Realtime (Phase 2) · Cloudinary (profile photos, optional) · Vercel (Phase 3 deployment)

> **Medical disclaimer:** Blood-type matching in this app is **preliminary filtering only**. It never determines medical compatibility, and a listed donor is not guaranteed to be eligible. Actual compatibility and donor screening are always decided by qualified healthcare professionals. This is an academic demonstration platform, not a certified medical system.
>
> **Legal note (RA 7719):** HemaMatch facilitates **voluntary, non-remunerated** donation only. The National Blood Services Act of 1994 prohibits the commercial sale of blood in the Philippines — the app therefore contains no selling, pricing or compensation features of any kind.

---

## Where the project stands (v3)

| Layer | Status |
|---|---|
| Theme | Dark **"blood thirst"** theme, **all-black background everywhere** (`#000000` page, `#220c12` card surfaces, `#430102` blood-red accents, `#c1912f` gold actions, `#ebe0c2` cream text) — consistent on every page |
| UX | **Mobile-first** (bottom tab bar — Home · Requests · **Donate** · Messages · Hospitals/Admin · Profile, 44px touch targets, 16px inputs, safe areas, bottom-sheet dialogs) |
| Data | Two interchangeable backends behind one contract: **mock** (localStorage) and **Supabase** (PostgreSQL + RLS). Chosen automatically by `.env` — see Step 3 |
| Auth | Mock mode simulates the email link; **Supabase mode uses real Supabase Auth** — real confirmation & reset emails, session listener, `/reset-password` page |
| Requests | Create/browse/edit requests, status lifecycle (Pending → Accepted → Completed/Cancelled) with guarded transitions and server-logged reasons |
| **Donation offers (v3)** | The **Donate** side: any user can list themselves as a volunteer donor (Open/Paused, with a note). Open listings appear in the **Available donors** directory AND in request matching. Availability and listing status **always stay in sync** (backend-enforced both ways) |
| **Profile views (v3)** | On a **blood-donation-request detail page only**: "View profile" on the requester and on each matched donor opens a directory-safe profile sheet (photo, blood type, location, availability, member since, recorded successful donations, listing note). No standalone public profiles — privacy by design |
| **Profile photos (v3)** | Cloudinary **unsigned** uploads (no secret in the browser) with a paste-an-image-URL fallback, initials fallback if a photo fails to load. Photos appear in the header, chat, requests, donor cards and profile sheet |
| Matching | Full ABO/Rh matrix + region + availability, same-region ranked first — runs **server-side** (`get_matching_donors`) in Supabase mode |
| Messaging | 1:1 conversations, participant-checked, **Supabase Realtime** streaming in Supabase mode (mock mode: instant same-tab delivery + light poll) |
| Admin | Live statistics (SQL counts via `admin_get_stats`, incl. open donor listings), request corrections **with server-logged reasons** (`set_request_status`), outcome records, user roles (`admin_set_role`), hospital verification, activity log |
| App icon | `public/icon-192.png` + `public/icon-512.png` (gold droplet on black) wired as favicon, apple-touch-icon and PWA manifest — **replace the two files to rebrand, no code changes** |

See **CHANGELOG.md** for the full change history (v2: rebrand/theme/mobile/Phase 2 · v3: black theme, profile views, donation offers, photos).

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
| Maria Santos | `maria@demo.com` | `maria123` | Donor, O-, NCR, **open donor listing**, has a photo |
| Grace Lim | `grace@demo.com` | `grace123` | Requester of an **O+ critical request** (great for matching demo) |
| Angela Reyes | `angela@demo.com` | `angela123` | Has a B- accepted request with a **failed outcome record**; **open donor listing** |
| Paolo Villanueva | `paolo@demo.com` | `paolo123` | O- donor, CALABARZON, **1 recorded successful donation**, open listing |
| Miguel Lopez | `miguel@demo.com` | `miguel123` | **Paused donor listing** — demonstrates the paused state |

The same accounts exist in **Supabase mode** — `supabase/seed.sql` creates them with real bcrypt-hashed passwords, pre-confirmed emails, profile photos and donor listings (see Step 3), so the login quick-fill chips work in the live demo.

**Reset demo data anytime:** open the browser DevTools console and run
`localStorage.removeItem('hemamatch_mock_db_v3')` (data re-seeds on next load).

### 12-minute defense demo script

1. **Landing page** — all-black dark theme, live stats, the 3-step flow, and the medical + RA 7719 disclaimers.
2. **Register** a new account → the email-verification screen appears:
   - mock mode → click **"Simulate clicking the verification link"**;
   - Supabase mode → the **real confirmation email** arrives (or use a pre-verified demo account — Supabase limits emails to ~2–3/hour on the free tier, so don't rely on live sign-ups during the defense).
3. **Complete your donor profile** (photo, blood type, region, availability) — *Profile* page. Show the photo upload/URL field.
4. **The donate side (v3):** open **Donate** (Dashboard card or desktop nav) → show the RA 7719 "voluntary, never for sale" note → the listing editor (note + Open/Paused) → then open **Requests → "Available donors"** tab: directory cards with photos, notes and same-region ranking. Click **Message donor** → chat opens.
5. **Login as `grace@demo.com`** → open her O+ request → show **Potential donors (preliminary match)**: only O−/O+ available donors appear, same-region (NCR) first, with the disclaimer. Explain: this is filtering, not medical clearance.
6. **Profile views (v3):** on the same request, click **View profile** under the requester, then on a matched donor card → the profile sheet shows directory-safe info only (never email), the recorded successful-donation count and the donor's listing note. Point out the privacy footer.
7. **Sync proof (v3):** login as `maria@demo.com` → *Donate* → **Pause listing** → the donor directory no longer shows her AND her profile availability flipped to "Not available" automatically. Reopen it to restore. (Both directions are enforced by the backend: `upsert_my_offer` RPC + `sync_offer_with_availability` trigger in Supabase mode.)
8. **Matching → chat:** back as Grace, click **Message donor** → send a message. On a second device/browser, login as `maria@demo.com` → the message is already there (**Realtime** in Supabase mode) — with her photo in the conversation list.
9. **Login as `admin@demo.com`** → *Admin*:
   - **Overview**: every statistic is computed live, including **Open donor listings**.
   - **Requests**: change a pending request to Accepted — a confirmation dialog asks for a reason; in Supabase mode the reason is written to the activity log **by the database** (`set_request_status` RPC).
   - **Outcome records**: record a **Successful** outcome for an accepted request → the request automatically becomes **Completed** → check the **Activity log**: both events are recorded (plus any listing changes from step 7).
   - **Hospitals**: verify the pending *Davao Regional Hospital*.
   - **Users**: role toggling is guarded (you can never change your own role) and logged; photos shown in the directory.
10. **Security talking points:** users never see each other's emails; profile sheets are directory-safe by the server (`get_public_profile` RPC); only admins complete requests; only participants read a conversation; every important change — including listing changes — is audit-logged; nobody can grant themselves admin; donation is voluntary-only per RA 7719.

---

## Step 2 — Project structure

```
src/
  lib/
    constants.js        # blood types, ABO matrix, regions, statuses, offers,
                        # RA 7719 note, disclaimers
    utils.js             # formatting + validation helpers
    cloudinary.js        # v3: UNSIGNED profile-photo uploads + validation
    mockData.js          # seeded demo data (mirrors schema.sql 1:1, incl.
                        # donation_offers + avatar URLs)
    mockBackend.js       # backend A: localStorage simulation + [RLS mirror]
                         # checks, incl. offers + public profile + avatar
    supabaseBackend.js   # backend B: Supabase Auth + Postgres queries + RPCs
                         # + Realtime, incl. offers + public profile + avatar
    dataService.js       # THE SWITCH: picks mock vs supabase from .env
    supabaseClient.js    # Supabase client (anon key only, inert until .env)
  context/AuthContext.jsx    # global auth state + Supabase onAuthStateChange
  hooks/useAsync.js
  components/
    Layout.jsx          # mobile bottom tab bar + desktop nav (Donate link)
    PublicProfileSheet.jsx   # v3: directory-safe profile sheet (request
                             # detail only — bottom sheet on phones)
    BrowseTabs.jsx      # v3: Requests <-> Available donors segmented control
    DonorCard.jsx       # donor card (matching + directory), photo, note
    ui.jsx              # badges, alerts, avatar (photo + initials fallback),
                        # confirm dialog, empty/error states
  pages/                # Landing, auth (+ ResetPassword), Dashboard, Profile
                        # (photo section), Requests, RequestForm, RequestDetail
                        # (profile sheet + admin controls), Messages, Hospitals
  pages/Donate.jsx      # v3: my voluntary donor listing (Open/Paused)
  pages/Donors.jsx     # v3: available-donors directory (filters + message)
  pages/admin/          # Overview, Requests, Records, Users, Hospitals, Logs
public/
  icon-192.png          # app icon (gold droplet on black) — favicon,
  icon-512.png          #   apple-touch-icon, PWA manifest. REPLACE THESE TWO
                        #   FILES to change the app icon; no code changes
  manifest.webmanifest  # PWA manifest (name, colors, both icons)
supabase/
  schema.sql            # FULL PostgreSQL schema: tables, constraints, triggers,
                        # RLS policies, security-definer RPCs, realtime, indexes
                        # + Phase 2 additions + v3 section 10: donation_offers,
                        # upsert_my_offer, get_public_profile, availability sync
  seed.sql              # demo accounts (bcrypt + pre-confirmed + photos),
                        # hospitals, requests, donor listings
.env.example            # public vars only: Supabase URL/anon + Cloudinary
```

Both backends export the **same function names** (`dataService.js` documents the contract), so pages never change when the backend switches. Search `// [RLS mirror]` in `mockBackend.js` to see where every JS check lives in PostgreSQL.

### Changing the app icon (no code required)

The app icon is **two files in `public/`** — nothing else to configure:

- `public/icon-192.png` — 192×192, used as the browser favicon, the apple-touch-icon (home-screen icon on iOS) and the small manifest icon
- `public/icon-512.png` — 512×512, the large manifest icon (Android/Chrome install)

To rebrand, just **overwrite those two files with your own square PNGs** (keep the same names and sizes). `index.html` and `public/manifest.webmanifest` already point at them, so after a refresh or redeploy every icon updates together. To regenerate the current gold-droplet icon programmatically, run `python scripts/make_icons.py`.

---

## Step 3 — Connect Supabase (Phase 2) & Cloudinary (photos)

The code is ready; you only need the projects and the environment file:

1. Create a free project at **supabase.com** (region: Singapore — closest to PH).
2. **SQL Editor** → paste the whole `supabase/schema.sql` → **Run**. This creates every table, RLS policy, trigger, index and RPC — **including all v3 objects** (`donation_offers`, `upsert_my_offer`, `get_public_profile`, the availability-sync trigger, `profiles.avatar_url`). Already have the v2 schema running? Just re-run this file — the v3 section upgrades it in place (`create or replace` / `if not exists` throughout).
3. **SQL Editor** → paste the whole `supabase/seed.sql` → **Run**. This creates the 11 demo accounts (real bcrypt passwords, pre-confirmed emails, profile photos), 3 hospitals, 3 requests, **6 donor listings**, and promotes `admin@demo.com` to administrator.
4. Copy **Project Settings → API** values into a new `.env` file (copy `.env.example` as a template):
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```
   ⚠️ Only these two Supabase values ever go in the frontend. The `service_role` key must NEVER appear in a `VITE_` variable.

**3c. Cloudinary — profile photo uploads (v3, optional but recommended):**

1. Create a free account at **cloudinary.com** (free tier: ~25 credits/month — far more than a demo needs).
2. Dashboard home → copy your **Cloud name**.
3. **Settings → Upload → "Add upload preset"** → set **Signing Mode: `Unsigned`** → save → copy the **preset name**. (Optionally restrict allowed formats to images and set folder `hemamatch/avatars`.)
4. Add both to `.env`:
   ```
   VITE_CLOUDINARY_CLOUD_NAME=your-cloud-name
   VITE_CLOUDINARY_UPLOAD_PRESET=your-unsigned-preset
   ```
5. Restart the dev server → the Profile page now shows an **Upload photo** button (JPG/PNG/WEBP/GIF, ≤ 5 MB) instead of the URL field.

No Cloudinary account yet? The Profile page automatically falls back to a **paste-an-image-URL** field, so the photo feature still demos today — and the seeded accounts already have generated photos.

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
| Donor listings & matching | Client logic (mirrors SQL) | Enforced by tables + RPC + trigger (`upsert_my_offer`, `get_matching_donors`) |
| Everything else | identical | identical (authorization enforced by RLS, not JS) |

**Storage note (for future scope):** profile photos use Cloudinary URLs today; they could equally live in a *private* Supabase Storage bucket with signed URLs — the profile row just stores a URL, so swapping providers touches only `src/lib/cloudinary.js`.

## Step 4 — Deploy to Vercel (Phase 3)

1. Push the project to GitHub (make sure `.env` is git-ignored).
2. **vercel.com → New Project → Import** the repo (framework auto-detects Vite).
3. Add **all four** variables in Vercel's project settings → deploy:
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
   - `VITE_CLOUDINARY_CLOUD_NAME`, `VITE_CLOUDINARY_UPLOAD_PRESET`
4. Verify on the live URL: auth, a request→match→message flow, the donate/donors flow, photo upload, and admin pages.
5. Supabase free-tier note: projects pause after ~7 days of inactivity — open the dashboard the day before your defense to restore it.

---

## Security model (what to say at the defense)

- **RLS on every table** — even with full API keys, the database itself refuses unauthorized reads/writes.
- **No self-escalation** — the `protect_role_column` trigger reverts any non-admin attempt to change a role; the only path to change a role is the admin-only `admin_set_role()` RPC, which also refuses to touch the caller's own account (lockout protection) and writes an audit entry.
- **Messages are participant-checked** in SQL, not just hidden in the UI; conversations are created only by the secured `start_conversation()` RPC; Realtime delivery follows the same RLS.
- **Status transitions are guarded** by the `request_guard` trigger: only admins can complete requests; illegal jumps are rejected by the database. The `set_request_status()` RPC is the audited path for every status change — **including the human reason** — via a transaction-local setting the trigger reads (clients can never write `activity_logs`).
- **Donor listings have one source of truth (v3)** — writes go only through `upsert_my_offer()` (validates the profile, upserts the single listing per donor, syncs availability, logged by trigger); the reverse direction is enforced by the `sync_offer_with_availability` trigger on `profiles`, so the toggle and the listing can never disagree. There are **no price/compensation columns anywhere** — RA 7719 compliance is baked into the schema.
- **Profile sheets are directory-safe by the server (v3)** — `get_public_profile()` returns only public fields + an aggregated donation count; it never returns emails or roles, and donation-record rows are not exposed to unrelated users.
- **Photos are just URLs on the profile row (v3)** — uploads use a Cloudinary **unsigned** preset (no secret in the browser; the preset can only upload images); URL shape is validated by a CHECK constraint in PostgreSQL.
- **Outcome records are validated and insert-only** — `validate_donation_record` enforces accepted-requests-only and donor ABO compatibility in the database; no update/delete policies exist, for audit integrity.
- **The activity log is trigger-written** — clients have no INSERT/UPDATE/DELETE policy on it and cannot forge entries.
- **Matching runs in a secured function** (`get_matching_donors`) that first checks the caller is the requester or an admin.
- **Admin stats & user directory run through RPCs** (`admin_get_stats`, `admin_list_users`) that re-check the caller's role server-side — nothing is trusted from the browser, and no statistic is hardcoded.
- **Email enumeration is avoided** — password reset always answers "sent", regardless of whether the account exists.

## Known limitations (honest scope statement)

- In mock mode nothing leaves the browser; cloud persistence requires Step 3.
- Matching is preliminary filtering — not medical compatibility (by design and by requirement).
- Blood **selling** is not supported — deliberately and permanently: RA 7719 prohibits the commercial sale of blood; HemaMatch offers voluntary donation listings only.
- Hospital module is the agreed **Light** scope: admin-managed records + verification badge; no document uploads or staff accounts yet.
- Profile photos require internet access (Cloudinary or any public image URL); without them the initials avatar is shown — nothing breaks.
- Supabase's free tier limits auth emails (~2–3/hour) — for the defense demo, use the pre-verified seed accounts.
- No end-to-end encryption in chat — out of scope by requirement, and honestly documented as such.

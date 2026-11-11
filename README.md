# HemaMatch — Blood Donation & Matching Web Application

Academic MVP connecting people who need blood with volunteer donors — and letting volunteers **offer to donate**, not just request.
**Stack:** React 19 + Vite 6 + Tailwind CSS 4 (frontend) · Supabase = PostgreSQL + Auth + Realtime (Phase 2) · Cloudinary (profile photos, optional) · Vercel (Phase 3 deployment)

> **Medical disclaimer:** Blood-type matching in this app is **preliminary filtering only**. It never determines medical compatibility, and a listed donor is not guaranteed to be eligible. Actual compatibility and donor screening are always decided by qualified healthcare professionals. This is an academic demonstration platform, not a certified medical system.
>
> **Legal note (RA 7719):** HemaMatch facilitates **voluntary, non-remunerated** donation only. The National Blood Services Act of 1994 prohibits the commercial sale of blood in the Philippines — the app therefore contains no selling, pricing or compensation features of any kind.

---

## Where the project stands (v4.1)

| Layer | Status |
|---|---|
| Account types (v4) | Registration picks your type: **Donor/Recipient** (base — donate + request blood), **Doctor** (inherits the base, plus hospital affiliation after the hospital admin verifies their application), **Business (hospital)** (inherits the base; the hospital admin — it additionally inherits the Doctor abilities **only if the admin is also a licensed doctor**, via the "I am also a licensed doctor" profile toggle) |
| Requests (v4.1) | "Preferred donor blood types" — **one checkbox per blood type compatible with the patient's type** (O- patient → 1 checkbox, A+ → 4, AB+ → all 8; several can be checked); the **hospital is required** (the donation process happens there) and attaching it **notifies the hospital** (business admin's inbox) |
| Donor accept (v4) | Any donor can accept a request → a doctor from the request's hospital is **auto-assigned** as the witness, or the donor **chooses the doctor** — restricted to that hospital's roster; the doctor can be changed while the acceptance is active; the hospital is notified |
| Doctor applications (v4) | Doctors apply to a hospital with their license ID / specialization / contact number + a note; the **hospital admin verifies and accepts/rejects**; accepted doctors join the roster (one hospital per doctor); rejected doctors may re-apply |
| Hospital directory (v4) | Every user can search hospitals by name/city/region/description; the hospital page shows the **photo background with a gradient fade into the description**, location, the business admin, and the doctor roster with **license IDs and contact numbers**; "Message hospital" opens a chat that goes to the admin |
| Business panel (v4) | `My hospital`: live stats, **notifications inbox** (new requests / donor acceptances / doctor applications), doctor application review, hospital profile editing (photo, description, location, contact) and **outcome records with the witnessing doctor** |
| Doctor panel (v4) | `My assignments`: every transaction the doctor is assigned to as the witness/middleman — the request, donor, hospital and recorded outcome |
| Messaging (v4) | Hospital threads show the **hospital name in the header** ("messages go to the administrator"); doctor chats show the **doctor's hospital beside their name** |
| Theme | Dark **"blood thirst"** theme, all-black background everywhere |
| UX | **Mobile-first** (bottom tab bar, 44px touch targets, safe areas, bottom-sheet dialogs); the tab bar adapts to the account type (Admin / Hospital / Witness) |
| Data | Two interchangeable backends behind one contract: **mock** (localStorage) and **Supabase** (PostgreSQL + RLS). Chosen automatically by `.env` |
| Auth | Mock mode simulates the email link; **Supabase mode uses real Supabase Auth** |
| Requests | Create/browse/edit requests, status lifecycle with guarded transitions and server-logged reasons |
| Donation offers | Any user can list themselves as a volunteer donor (Open/Paused) |
| Profile views | Directory-safe profile sheets on request pages; doctor affiliation shown for doctors |
| Profile photos | Cloudinary unsigned uploads with URL fallback |
| Matching | Full ABO/Rh matrix + region + availability + preferred-type ranking (checked types first, badged "Preferred type"), server-side in Supabase mode |
| Admin | Live statistics, request corrections with reasons, outcome records, user roles, hospital verification, activity log |

See **CHANGELOG.md** for the full change history.

---

## Demo accounts (v4.1)

| Account | Email | Password | Role / notes |
|---|---|---|---|
| Ana Villanueva | `admin@demo.com` | `admin123` | Administrator |
| Maria Santos | `maria@demo.com` | `maria123` | Donor, O-, NCR, **open donor listing** |
| Grace Lim | `grace@demo.com` | `grace123` | Requester of an **O+ critical request** (preferred donor types **O-**) |
| Teresita Uy | `biz.western@demo.com` | `biz12345` | **Business** — admin of Western Visayas Medical Center (Iloilo) |
| Corazon Santiago | `biz.stmary@demo.com` | `biz12345` | **Business** — admin of St. Mary General Hospital (has a pending doctor application + notifications to review) |
| Melinda Torres | `biz.central@demo.com` | `biz12345` | **Business** — admin of Central Luzon Medical Center |
| Rodrigo Bautista | `biz.davao@demo.com` | `biz12345` | **Business + Doctor** — admin of Davao Regional Hospital who is also a licensed surgeon (inherits the Doctor abilities) |
| Dr. Elena Ramos | `dr.ramos@demo.com` | `doctor123` | **Doctor** — St. Mary roster, witness on an active transaction |
| Dr. Marco Aquino | `dr.aquino@demo.com` | `doctor123` | **Doctor** — St. Mary roster |
| Dr. Liza Domingo | `dr.domingo@demo.com` | `doctor123` | **Doctor** — Central Luzon roster, **pending application** to St. Mary |

The same accounts exist in **Supabase mode** — `supabase/seed.sql` creates them with real bcrypt-hashed passwords, pre-confirmed emails, profile photos, hospital rosters, donor acceptances and notifications.

**Reset demo data anytime:** open the browser DevTools console and run
`localStorage.removeItem('hemamatch_mock_db_v5')` (data re-seeds on next load).

### v4.1 demo script (10 minutes)

1. **Register** → pick each account type to see the role-specific fields (doctor: license/specialization/contact; business: hospital record) → verify email (simulated in mock mode).
2. **Create a request** as Grace: choose blood type **O+** → the *Preferred donor blood types* checkboxes show **O- and O+** only (switch to **AB+** and all 8 appear; **O-** shows a single checkbox) → check **O-** → pick the **hospital** (required — "Not specified" no longer exists) → **St. Mary General Hospital**.
3. Login as `biz.stmary@demo.com` → **My hospital** → the **notification inbox** shows the new request; **review the pending doctor application** (Dr. Liza Domingo — verify her license ID and contact number) → accept or reject it.
4. Login as `maria@demo.com` → open Grace's request → **Accept as donor** → choose **Dr. Elena Ramos** (only St. Mary doctors are selectable — try picking a Davao doctor and it is refused) → the request flips to **Accepted** and the hospital is notified.
5. Login as `dr.ramos@demo.com` → **My assignments** → the transaction appears with Maria as the donor. Open it, message the donor, then **Set Completed** (or record an outcome) — the doctor is the witness/source of truth.
6. Login as `biz.stmary@demo.com` → **My hospital** → the acceptance notification is there; **outcome records** list the transaction with the witnessing doctor; edit the hospital **photo + description** and check the public page's gradient fade.
7. **Hospitals** (any account): search "Davao", open a hospital — photo background, gradient fade, description under it, admin, doctors with license IDs + contact numbers → **Message hospital** → the thread header shows the hospital name; on the business admin's side the reply arrives in the same thread.
8. Login as `biz.davao@demo.com` (business + doctor) → the profile shows the **"I am also a licensed doctor"** toggle enabled → **My assignments** works for this account too (inherited Doctor abilities).

---

## Project structure (v4 additions marked)

```
src/
  lib/
    constants.js        # blood types, ABO matrix (BOTH directions), regions,
                        # account types, doctor-application + acceptance
                        # statuses, RA 7719 note, disclaimers
    utils.js            # formatting + validation helpers
    cloudinary.js       # UNSIGNED photo uploads (avatars + hospital photos)
    mockData.js         # seeded demo data incl. doctors, businesses,
                        # rosters, acceptances, notifications
    mockBackend.js      # backend A: localStorage + [RLS mirror] checks,
                        # incl. acceptances, doctor applications, hospital
                        # chat, notifications, business panels
    supabaseBackend.js  # backend B: same contract on Supabase (RPCs)
    dataService.js      # THE SWITCH: picks mock vs supabase from .env
  context/AuthContext.jsx    # auth state + isAdmin/isDoctor/isBusiness
  components/
    Layout.jsx          # role-aware bottom tab bar + desktop nav
    PublicProfileSheet.jsx   # directory-safe profile sheet (+ doctor info)
    DonorCard.jsx / RequestCard.jsx / ui.jsx / BrowseTabs.jsx
  pages/
    Landing, Login, Register (account-type picker), Dashboard (role cards),
    Profile (doctor credentials + application list), Requests, RequestForm
    (compatible-donor dropdown), RequestDetail (donor-accept flow +
    assigned doctor), Donate, Donors, Messages (hospital threads),
    Hospitals (search), HospitalDetail (photo + gradient fade + roster),
    MyHospital (business panel), MyAssignments (doctor witness view)
  pages/admin/          # Overview, Requests, Records (witness column),
                        # Users (account types), Hospitals, Logs
supabase/
  schema.sql            # v4 section 11: hospital_doctors, donor_acceptances,
                        # hospital_notifications, business/doctor RPCs
  seed.sql              # demo accounts incl. doctors + businesses
```

Both backends export the **same function names** (`dataService.js` documents the contract), so pages never change when the backend switches.

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

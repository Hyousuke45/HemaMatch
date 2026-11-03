import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Alert, Avatar, StatusBadge } from '../components/ui';
import dataService from '../lib/dataService';
import { isCloudinaryConfigured, uploadAvatar, validateImageFile } from '../lib/cloudinary';
import { BLOOD_TYPES, REGIONS } from '../lib/constants';
import { formatDate } from '../lib/utils';

// Donor profile page. Users may edit ONLY their own profile — the backend
// enforces this ([RLS mirror] "profiles update own row"), so editing
// someone else's row is impossible even with crafted requests.
//
// v3 — PROFILE PHOTO:
//   Upload path  : Cloudinary UNSIGNED preset (no secret in the browser;
//                  see src/lib/cloudinary.js for the 2-minute setup).
//   Fallback path: paste an image URL directly, so the feature works in
//                  the demo even before Cloudinary is configured.
//   The stored value is just an https URL on the profile row
//   (profiles.avatar_url) — swappable for Supabase Storage later
//   without touching any other component.
export default function Profile() {
  const { user, refreshUser, logout } = useAuth();
  const navigate = useNavigate();
  const p = user.profile;

  const [form, setForm] = useState({
    full_name: p.full_name || '',
    blood_type: p.blood_type || '',
    region: p.region || '',
    city: p.city || '',
    is_available: Boolean(p.is_available)
  });
  const [avatarUrl, setAvatarUrl] = useState(p.avatar_url || '');
  const [photoError, setPhotoError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const [feedback, setFeedback] = useState(null); // { tone, message }
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // ---- Photo handling ----
  const handleFileChosen = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file
    if (!file) return;
    setPhotoError(null);
    const validationError = validateImageFile(file);
    if (validationError) {
      setPhotoError(validationError);
      return;
    }
    setUploading(true);
    try {
      const url = await uploadAvatar(file);
      setAvatarUrl(url);
      setFeedback({
        tone: 'info',
        message: 'Photo uploaded — press "Save profile" to apply it.'
      });
    } catch (err) {
      setPhotoError(err?.message || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = () => {
    setAvatarUrl('');
    setPhotoError(null);
    setFeedback({ tone: 'info', message: 'Photo removed — press "Save profile" to apply.' });
  };

  // ---- Form submit ----
  const handleSubmit = async (e) => {
    e.preventDefault();
    setFeedback(null);
    setBusy(true);
    try {
      await dataService.updateMyProfile({
        full_name: form.full_name,
        blood_type: form.blood_type || null,
        region: form.region || null,
        city: form.city,
        is_available: form.is_available,
        avatar_url: avatarUrl || null
      });
      await refreshUser();
      setFeedback({ tone: 'success', message: 'Profile saved.' });
    } catch (err) {
      setFeedback({ tone: 'error', message: err?.message || 'Could not save profile.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold text-cream">My profile</h1>
      <p className="mt-1 text-sm text-cream/65">
        Your donor profile powers matching: blood type, region and availability.
      </p>

      <form onSubmit={handleSubmit} className="card mt-6 space-y-5 p-6">
        {/* Read-only identity */}
        <div className="grid gap-4 border-b border-cream/10 pb-5 sm:grid-cols-2">
          <div>
            <label className="label">Email (read-only)</label>
            <input className="input bg-ink" value={user.email} disabled readOnly />
          </div>
          <div className="flex items-end gap-2 pb-1">
            <label className="label">Account role</label>
            {p.role === 'admin' ? <StatusBadge status="verified" label="Administrator" /> : <StatusBadge status="routine" label="User" />}
            <span className="text-xs text-cream/45">since {formatDate(p.created_at)}</span>
          </div>
        </div>

        {/* ---- v3: Profile photo ---- */}
        <div className="border-b border-cream/10 pb-5">
          <span className="label">Profile photo</span>
          <div className="flex flex-wrap items-center gap-5">
            <Avatar name={form.full_name || '?'} src={avatarUrl || null} size="xl" />
            <div className="flex flex-col gap-2">
              {isCloudinaryConfigured ? (
                <>
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={uploading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {uploading ? 'Uploading…' : avatarUrl ? 'Change photo' : 'Upload photo'}
                  </button>
                  {avatarUrl && (
                    <button type="button" className="btn-danger !min-h-9 !py-1.5" onClick={removePhoto}>
                      Remove photo
                    </button>
                  )}
                  <p className="max-w-xs text-xs text-cream/45">
                    JPG, PNG, WEBP or GIF · up to 5 MB. Uploaded directly to Cloudinary —
                    only the resulting image URL is stored on your profile.
                  </p>
                </>
              ) : (
                <>
                  <div className="w-full max-w-sm">
                    <input
                      className="input"
                      type="url"
                      value={avatarUrl}
                      onChange={(e) => setAvatarUrl(e.target.value)}
                      placeholder="Paste an image URL (https://…)"
                      aria-label="Photo URL"
                    />
                  </div>
                  {avatarUrl && (
                    <button type="button" className="btn-danger !min-h-9 !py-1.5" onClick={removePhoto}>
                      Remove photo
                    </button>
                  )}
                  <p className="max-w-md text-xs leading-relaxed text-cream/45">
                    Cloudinary is not configured yet — add{' '}
                    <code className="text-cream/70">VITE_CLOUDINARY_CLOUD_NAME</code> and{' '}
                    <code className="text-cream/70">VITE_CLOUDINARY_UPLOAD_PRESET</code> to{' '}
                    <code className="text-cream/70">.env</code> to enable one-tap photo
                    uploads (free account; see README step 3c). Until then you can paste an
                    image URL above.
                  </p>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={handleFileChosen}
                aria-label="Choose a profile photo"
              />
            </div>
          </div>
          {photoError && (
            <div className="mt-3">
              <Alert tone="error">{photoError}</Alert>
            </div>
          )}
        </div>

        <div>
          <label className="label" htmlFor="full_name">
            Full name
          </label>
          <input id="full_name" required className="input" value={form.full_name} onChange={set('full_name')} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="blood_type">
              Blood type
            </label>
            <select id="blood_type" className="input" value={form.blood_type} onChange={set('blood_type')}>
              <option value="">Not set</option>
              {BLOOD_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-cream/45">Required for appearing in donor matches.</p>
          </div>
          <div>
            <label className="label" htmlFor="city">
              City / municipality
            </label>
            <input id="city" className="input" value={form.city} onChange={set('city')} placeholder="e.g. Quezon City" maxLength={60} />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="region">
            Region
          </label>
          <select id="region" className="input" value={form.region} onChange={set('region')}>
            <option value="">Not set</option>
            {REGIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-cream/45">Same-region donors are shown first in matching results.</p>
        </div>

        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-cream/15 p-4 hover:bg-cream/5">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 accent-gold"
            checked={form.is_available}
            onChange={(e) => setForm((f) => ({ ...f, is_available: e.target.checked }))}
          />
          <span>
            <span className="block text-sm font-semibold text-cream">I am currently available to donate</span>
            <span className="mt-0.5 block text-xs text-cream/65">
              Unavailable donors are excluded from matching results. You can toggle this anytime —
              it is not a commitment to donate. If you have a donor listing, pausing this also
              pauses the listing (they always stay in sync).
            </span>
          </span>
        </label>

        {feedback && <Alert tone={feedback.tone}>{feedback.message}</Alert>}

        <div className="flex justify-end">
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save profile'}
          </button>
        </div>
      </form>

      {/* v3 — donor listing shortcut */}
      <Link to="/donate" className="card mt-4 flex items-center justify-between gap-4 p-5 transition-colors hover:border-gold/40">
        <span>
          <span className="block font-semibold text-cream">Offer to donate blood</span>
          <span className="mt-0.5 block text-sm text-cream/65">
            Manage your voluntary donor listing — open or paused anytime.
          </span>
        </span>
        <span className="text-gold" aria-hidden="true">
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </span>
      </Link>

      <p className="mt-4 text-xs leading-relaxed text-cream/45">
        Privacy: other signed-in users can only see your name, photo, blood type, general location and
        availability — never your email address. Private communication happens exclusively
        through in-app messaging.
      </p>

      {/* Mobile-friendly sign out (desktop also offers it in the header menu) */}
      <button
        type="button"
        className="btn-danger mt-4 w-full md:max-w-xs"
        onClick={async () => {
          await logout();
          navigate('/login');
        }}
      >
        Sign out
      </button>
    </div>
  );
}

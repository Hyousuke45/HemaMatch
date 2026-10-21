import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Alert, StatusBadge } from '../components/ui';
import dataService from '../lib/dataService';
import { BLOOD_TYPES, REGIONS } from '../lib/constants';
import { formatDate } from '../lib/utils';

// Donor profile page. Users may edit ONLY their own profile — the backend
// enforces this ([RLS mirror] "profiles update own row"), so editing
// someone else's row is impossible even with crafted requests.
export default function Profile() {
  const { user, refreshUser } = useAuth();
  const p = user.profile;

  const [form, setForm] = useState({
    full_name: p.full_name || '',
    blood_type: p.blood_type || '',
    region: p.region || '',
    city: p.city || '',
    is_available: Boolean(p.is_available)
  });
  const [feedback, setFeedback] = useState(null); // { tone, message }
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

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
        is_available: form.is_available
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
      <h1 className="text-2xl font-bold text-gray-900">My profile</h1>
      <p className="mt-1 text-sm text-gray-500">
        Your donor profile powers matching: blood type, region and availability.
      </p>

      <form onSubmit={handleSubmit} className="card mt-6 space-y-5 p-6">
        {/* Read-only identity */}
        <div className="grid gap-4 border-b border-gray-100 pb-5 sm:grid-cols-2">
          <div>
            <label className="label">Email (read-only)</label>
            <input className="input bg-gray-50" value={user.email} disabled readOnly />
          </div>
          <div className="flex items-end gap-2 pb-1">
            <label className="label">Account role</label>
            {p.role === 'admin' ? <StatusBadge status="verified" label="Administrator" /> : <StatusBadge status="routine" label="User" />}
            <span className="text-xs text-gray-400">since {formatDate(p.created_at)}</span>
          </div>
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
            <p className="mt-1 text-xs text-gray-400">Required for appearing in donor matches.</p>
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
          <p className="mt-1 text-xs text-gray-400">Same-region donors are shown first in matching results.</p>
        </div>

        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 p-4 hover:bg-gray-50">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 accent-red-600"
            checked={form.is_available}
            onChange={(e) => setForm((f) => ({ ...f, is_available: e.target.checked }))}
          />
          <span>
            <span className="block text-sm font-semibold text-gray-900">I am currently available to donate</span>
            <span className="mt-0.5 block text-xs text-gray-500">
              Unavailable donors are excluded from matching results. You can toggle this anytime —
              it is not a commitment to donate.
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

      <p className="mt-4 text-xs leading-relaxed text-gray-400">
        Privacy: other signed-in users can only see your name, blood type, general location and
        availability — never your email address. Private communication happens exclusively
        through in-app messaging.
      </p>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import useAsync from '../hooks/useAsync';
import dataService from '../lib/dataService';
import { useAuth } from '../context/AuthContext';
import { isCloudinaryConfigured, uploadAvatar, validateImageFile } from '../lib/cloudinary';
import {
  Alert,
  Avatar,
  ConfirmDialog,
  EmptyState,
  InlineLoader,
  ErrorState,
  StatCard,
  StatusBadge
} from '../components/ui';
import { formatDate, formatDateTime } from '../lib/utils';
import { DOCTOR_APP_STATUS, OUTCOMES } from '../lib/constants';

// ============================================================
// MY HOSPITAL — the Business (hospital admin) panel. v4.
// The business inherits every Donor/Recipient ability and additionally:
//   * manages the hospital's public profile (photo background,
//     description, location, contact)
//   * tracks records: requests attached to the hospital + outcome
//     records (with the witnessing doctor)
//   * reviews doctor applications: verify the license ID and accept
//     or reject — accepted doctors join the roster
//   * receives hospital NOTIFICATIONS (new requests, donor
//     acceptances, doctor applications)
// If the admin is ALSO a licensed doctor, they inherit the Doctor
// abilities too (see My assignments in the nav).
// ============================================================

// ---------- Notifications inbox ----------
function Notifications() {
  const { data: notifications, loading, error, reload } = useAsync(
    () => dataService.listHospitalNotifications(),
    []
  );
  const [busy, setBusy] = useState(false);

  if (loading) return <InlineLoader label="Loading notifications…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const unread = (notifications || []).filter((n) => !n.read).length;

  const markAll = async () => {
    setBusy(true);
    try {
      await dataService.markAllHospitalNotificationsRead();
      await reload();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold text-cream">
          Notifications{' '}
          {unread > 0 && (
            <span className="ml-1 rounded-full bg-gold px-2 py-0.5 text-xs font-bold text-night">
              {unread} new
            </span>
          )}
        </p>
        {unread > 0 && (
          <button
            type="button"
            className="btn-secondary !min-h-9 !px-3 !py-1.5 !text-xs"
            onClick={markAll}
            disabled={busy}
          >
            Mark all as read
          </button>
        )}
      </div>

      {notifications?.length === 0 ? (
        <p className="mt-3 text-sm text-cream/65">
          Nothing yet — you will be notified when a requester attaches your hospital to a request,
          a donor accepts one, or a doctor applies to join you.
        </p>
      ) : (
        <div className="mt-4 space-y-2">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`flex items-start gap-3 rounded-xl border p-3.5 ${
                n.read ? 'border-cream/10 bg-ink/60' : 'border-gold/40 bg-gold/10'
              }`}
            >
              <span
                className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? 'bg-cream/25' : 'bg-gold'}`}
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-cream">{n.title}</p>
                <p className="mt-0.5 text-sm leading-relaxed text-cream/70">{n.body}</p>
                <p className="mt-1 text-xs text-cream/45">
                  {n.actor_name ? `${n.actor_name} · ` : ''}
                  {formatDateTime(n.created_at)}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                {n.request_id && (
                  <Link to={`/requests/${n.request_id}`} className="btn-secondary !min-h-8 !px-2.5 !py-1 !text-[11px]">
                    View request
                  </Link>
                )}
                {!n.read && (
                  <button
                    type="button"
                    className="text-xs font-semibold text-gold hover:underline"
                    onClick={async () => {
                      await dataService.markHospitalNotificationRead(n.id);
                      await reload();
                    }}
                  >
                    Mark read
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- Doctor applications ----------
function DoctorApplications({ applications, onChange }) {
  const [confirm, setConfirm] = useState(null); // { app, next }
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);

  const pending = applications.filter((a) => a.status === 'pending');
  const reviewed = applications.filter((a) => a.status !== 'pending');

  const openConfirm = (app, next) =>
    setConfirm({
      app,
      next,
      requireReason: next === 'rejected',
      title:
        next === 'accepted'
          ? `Accept ${app.doctor_name} into your hospital?`
          : `Reject the application of ${app.doctor_name}?`,
      message:
        next === 'accepted'
          ? 'Verify the license ID below before accepting. Once accepted, the doctor joins your roster and can be assigned to witness donations. The decision is written to the activity log.'
          : 'A rejected doctor can re-apply later. A reason is required and will be logged.'
    });

  const handleConfirm = async (reason) => {
    setBusy(true);
    setActionError(null);
    try {
      await dataService.hospitalSetDoctorApplicationStatus(confirm.app.id, confirm.next, reason);
      setConfirm(null);
      await onChange();
    } catch (err) {
      setActionError(err?.message || 'Could not review the application.');
      throw err;
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card p-6">
      <p className="font-semibold text-cream">Doctor applications</p>
      <p className="mt-1 text-sm text-cream/65">
        Doctors apply with their license ID and details — verify them here. Accepted doctors join
        your roster and can be assigned to witness donation transactions.
      </p>
      {actionError && (
        <div className="mt-3">
          <Alert tone="error">{actionError}</Alert>
        </div>
      )}

      {pending.length === 0 && reviewed.length === 0 && (
        <p className="mt-4 text-sm text-cream/65">
          No applications yet. Doctors apply from your hospital&apos;s public page.
        </p>
      )}

      {pending.length > 0 && (
        <div className="mt-4 space-y-3">
          {pending.map((a) => (
            <div key={a.id} className="rounded-xl border border-gold/40 bg-gold/10 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <Avatar name={a.doctor_name} src={a.doctor_avatar_url} size="lg" />
                  <div>
                    <p className="font-semibold text-cream">{a.doctor_name}</p>
                    <p className="text-xs text-cream/70">
                      {a.doctor_specialization || 'Specialization not stated'}
                    </p>
                    <p className="mt-1 text-xs text-cream/60">
                      License ID:{' '}
                      <span className="font-semibold text-cream/85">{a.doctor_license_id || '—'}</span>{' '}
                      · Contact:{' '}
                      <span className="font-semibold text-cream/85">{a.doctor_contact_number || '—'}</span>
                    </p>
                    {a.doctor_email && <p className="text-xs text-cream/55">{a.doctor_email}</p>}
                    {a.application_note && (
                      <p className="mt-2 rounded-lg border border-cream/10 bg-ink p-2.5 text-sm leading-relaxed text-cream/75">
                        “{a.application_note}”
                      </p>
                    )}
                    <p className="mt-1 text-xs text-cream/45">Applied {formatDate(a.created_at)}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="button" className="btn-primary !min-h-9 !px-3 !py-1.5 !text-xs" onClick={() => openConfirm(a, 'accepted')}>
                    Accept
                  </button>
                  <button type="button" className="btn-danger !min-h-9 !px-3 !py-1.5 !text-xs" onClick={() => openConfirm(a, 'rejected')}>
                    Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {reviewed.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-cream/45">Reviewed</p>
          <div className="mt-2 divide-y divide-cream/10">
            {reviewed.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center gap-2 py-2.5 text-sm">
                <span className="font-medium text-cream">{a.doctor_name}</span>
                <StatusBadge status={a.status === 'accepted' ? 'verified' : 'rejected'} label={DOCTOR_APP_STATUS[a.status]} />
                {a.doctor_license_id && <span className="text-xs text-cream/55">{a.doctor_license_id}</span>}
                <span className="ml-auto text-xs text-cream/45">
                  {a.reviewed_by_name ? `by ${a.reviewed_by_name} · ` : ''}
                  {formatDate(a.reviewed_at || a.created_at)}
                </span>
                {a.status === 'rejected' && (
                  <button
                    type="button"
                    className="btn-secondary !min-h-8 !px-2.5 !py-1 !text-[11px]"
                    onClick={() => openConfirm(a, 'accepted')}
                  >
                    Accept now
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.title}
        message={confirm?.message}
        confirmLabel={confirm?.next === 'accepted' ? 'Accept doctor' : 'Reject application'}
        danger={confirm?.next === 'rejected'}
        requireReason={confirm?.requireReason}
        onClose={() => setConfirm(null)}
        onConfirm={handleConfirm}
      />
    </div>
  );
}

// ---------- Tracked records ----------
function TrackedRecords() {
  const { data: records, loading, error, reload } = useAsync(() => dataService.businessListRecords(), []);

  if (loading) return <InlineLoader label="Loading records…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <div className="card p-6">
      <p className="font-semibold text-cream">Outcome records at your hospital</p>
      <p className="mt-1 text-sm text-cream/65">
        Every recorded transaction at {''}
        your hospital — with the donor and the witnessing doctor.
      </p>

      {records?.length === 0 ? (
        <p className="mt-4 text-sm text-cream/65">
          No outcome records yet. Records are written when an accepted request is completed.
        </p>
      ) : (
        <div className="mt-4 divide-y divide-cream/10">
          {(records || []).map((rec) => (
            <div key={rec.id} className="py-3.5">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={rec.outcome} label={OUTCOMES[rec.outcome] || rec.outcome} />
                <span className="text-sm font-semibold text-cream">
                  {rec.request_blood_type} request
                  {rec.request_id && (
                    <Link to={`/requests/${rec.request_id}`} className="ml-2 text-xs font-medium text-gold hover:underline">
                      view
                    </Link>
                  )}
                </span>
                <span className="ml-auto text-xs text-cream/45">{formatDateTime(rec.created_at)}</span>
              </div>
              <p className="mt-1 text-sm text-cream/75">{rec.reason || 'No reason recorded.'}</p>
              <p className="mt-0.5 text-xs text-cream/55">
                {rec.donor_name ? `Donor: ${rec.donor_name}` : 'Donor not specified'}
                {rec.doctor_name ? ` · Witnessed by: ${rec.doctor_name}` : ''}
                {` · Recorded by ${rec.recorded_by_name}`}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- Hospital profile editor ----------
function HospitalProfileEditor({ hospital, onSaved }) {
  const [form, setForm] = useState({
    description: hospital.description || '',
    city: hospital.city || '',
    address: hospital.address || '',
    contact_number: hospital.contact_number || '',
    photo_url: hospital.photo_url || ''
  });
  const [photoError, setPhotoError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setForm({
      description: hospital.description || '',
      city: hospital.city || '',
      address: hospital.address || '',
      contact_number: hospital.contact_number || '',
      photo_url: hospital.photo_url || ''
    });
  }, [hospital]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleFileChosen = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
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
      setForm((f) => ({ ...f, photo_url: url }));
      setFeedback({ tone: 'info', message: 'Photo uploaded — press "Save hospital profile" to apply it.' });
    } catch (err) {
      setPhotoError(err?.message || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      await dataService.businessUpdateMyHospital({
        description: form.description,
        city: form.city,
        address: form.address,
        contact_number: form.contact_number,
        photo_url: form.photo_url || null
      });
      setFeedback({ tone: 'success', message: 'Hospital profile saved.' });
      await onSaved();
    } catch (err) {
      setFeedback({ tone: 'error', message: err?.message || 'Could not save the hospital profile.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="card space-y-5 p-6">
      <div>
        <p className="font-semibold text-cream">Hospital profile</p>
        <p className="mt-1 text-sm text-cream/65">
          This is what every user sees on your hospital&apos;s page. Name, region and verification
          are managed by the platform administrators.
        </p>
      </div>

      {/* Photo (the hospital page background) */}
      <div>
        <span className="label">Hospital photo (page background)</span>
        <div className="flex flex-wrap items-center gap-4">
          <div className="h-24 w-40 overflow-hidden rounded-xl border border-cream/15 bg-ink">
            {form.photo_url ? (
              <img src={form.photo_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-cream/40">
                No photo yet
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2">
            {isCloudinaryConfigured ? (
              <>
                <label className="btn-secondary cursor-pointer" disabled={uploading}>
                  {uploading ? 'Uploading…' : 'Upload photo'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={handleFileChosen}
                    aria-label="Choose a hospital photo"
                  />
                </label>
                {form.photo_url && (
                  <button
                    type="button"
                    className="btn-danger !min-h-9 !py-1.5"
                    onClick={() => setForm((f) => ({ ...f, photo_url: '' }))}
                  >
                    Remove photo
                  </button>
                )}
              </>
            ) : (
              <div className="w-full max-w-sm">
                <input
                  className="input"
                  type="url"
                  value={form.photo_url}
                  onChange={set('photo_url')}
                  placeholder="Paste an image URL (https://…)"
                  aria-label="Hospital photo URL"
                />
              </div>
            )}
            <p className="max-w-xs text-xs text-cream/45">
              The photo becomes the background of your hospital page, fading into the description
              below it.
            </p>
          </div>
        </div>
        {photoError && (
          <div className="mt-3">
            <Alert tone="error">{photoError}</Alert>
          </div>
        )}
      </div>

      <div>
        <label className="label" htmlFor="h-description">
          Description
        </label>
        <textarea
          id="h-description"
          className="input min-h-[110px]"
          value={form.description}
          onChange={set('description')}
          placeholder="What your hospital offers — blood bank hours, specialties, transfusion services…"
          maxLength={1200}
        />
        <p className="mt-1 text-xs text-cream/45">Shown right under the photo on your hospital page.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="label" htmlFor="h-city">
            City / municipality
          </label>
          <input id="h-city" className="input" value={form.city} onChange={set('city')} maxLength={60} />
        </div>
        <div>
          <label className="label" htmlFor="h-contact">
            Contact number
          </label>
          <input
            id="h-contact"
            className="input"
            value={form.contact_number}
            onChange={set('contact_number')}
            placeholder="(02) 1234-5678"
            maxLength={40}
          />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="h-address">
          Address
        </label>
        <input id="h-address" className="input" value={form.address} onChange={set('address')} maxLength={200} />
      </div>

      {feedback && <Alert tone={feedback.tone}>{feedback.message}</Alert>}

      <div className="flex justify-end">
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save hospital profile'}
        </button>
      </div>
    </form>
  );
}

// ---------- Main page ----------
export default function MyHospital() {
  const { isBusiness } = useAuth();
  const { data: hospital, loading, error, reload } = useAsync(
    async () => (isBusiness ? dataService.businessGetMyHospital() : null),
    [isBusiness]
  );
  const { data: stats } = useAsync(
    async () => (isBusiness ? dataService.businessGetStats() : null),
    [isBusiness]
  );

  if (!isBusiness)
    return (
      <EmptyState
        title="Business accounts only"
        message="This panel belongs to hospital administrator (business) accounts."
      />
    );
  if (loading) return <InlineLoader label="Loading your hospital…" />;
  if (error)
    return (
      <div className="mx-auto max-w-3xl">
        <ErrorState message={error} onRetry={reload} />
      </div>
    );

  return (
    <div className="flex flex-col gap-6">
      {/* Header with mini hero */}
      <div className="card overflow-hidden">
        <div className="relative h-36 w-full sm:h-44">
          {hospital.photo_url ? (
            <img src={hospital.photo_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-blood text-cream/30">
              <svg className="h-12 w-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 21V6.2A2.2 2.2 0 016.7 4h10.6a2.2 2.2 0 012.2 2.2V21M4.5 21h15M9.4 4V2.6M14.6 4V2.6M12 8.2v6m-3-3h6" />
              </svg>
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-night via-night/55 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-center gap-2 p-5">
            <h1 className="text-xl font-bold text-cream sm:text-2xl">{hospital.name}</h1>
            <StatusBadge status={hospital.status} />
            <Link to={`/hospitals/${hospital.id}`} className="ml-auto btn-secondary !min-h-9 !px-3 !py-1.5 !text-xs">
              View public page
            </Link>
          </div>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-1 p-5 text-sm text-cream/70">
          <span>
            {hospital.city ? `${hospital.city} · ` : ''}
            {hospital.region}
          </span>
          {hospital.contact_number && <span>{hospital.contact_number}</span>}
          <span>Admin: {hospital.admin_name || '—'}</span>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Open requests" value={stats.requests?.pending ?? 0} hint="attached to your hospital" tone="amber" />
          <StatCard label="Accepted requests" value={stats.requests?.accepted ?? 0} hint="donors committed" tone="sky" />
          <StatCard label="Doctors on roster" value={stats.doctors ?? 0} hint={`${stats.pending_applications ?? 0} pending application(s)`} />
          <StatCard
            label="Outcome records"
            value={stats.records?.total ?? 0}
            hint={`${stats.records?.successful ?? 0} successful · ${stats.records?.failed ?? 0} failed`}
            tone="green"
          />
        </div>
      )}

      <Notifications />
      <DoctorApplications applications={hospital.applications || []} onChange={reload} />
      <HospitalProfileEditor hospital={hospital} onSaved={reload} />
      <TrackedRecords />

      <p className="text-xs leading-relaxed text-cream/45">
        As a business account you keep every Donor/Recipient ability (donate, request blood). If
        you are also a licensed doctor, enable it on your profile to inherit the Doctor abilities —
        you will then witness transactions at your own hospital.
      </p>
    </div>
  );
}

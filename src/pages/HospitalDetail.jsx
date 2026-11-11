import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import useAsync from '../hooks/useAsync';
import dataService from '../lib/dataService';
import { useAuth } from '../context/AuthContext';
import {
  Alert,
  Avatar,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  InlineLoader,
  StatusBadge
} from '../components/ui';
import { DOCTOR_APP_STATUS } from '../lib/constants';

// Hospital detail (v4) — the public hospital profile page.
//   * The hospital's PHOTO is the page background; the DESCRIPTION sits
//     right under it, on a gradient fade (client requirement).
//   * Anyone can view the admin of the hospital, the doctor roster and
//     the doctors' information (license ID + contact number — client
//     requirement).
//   * "Message hospital" opens a direct chat that goes to the admin and
//     displays the hospital name in the header.
//   * Doctors can APPLY to join the hospital (the admin verifies and
//     accepts from the hospital panel).
export default function HospitalDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAdmin, isDoctor } = useAuth();

  const { data: h, loading, error, reload } = useAsync(() => dataService.getHospital(id), [id]);

  // Message hospital
  const [busyMessage, setBusyMessage] = useState(false);
  const [messageError, setMessageError] = useState(null);

  // Doctor application
  const [applyOpen, setApplyOpen] = useState(false);
  const [applyNote, setApplyNote] = useState('');
  const [applyBusy, setApplyBusy] = useState(false);
  const [applyError, setApplyError] = useState(null);
  const [applyDone, setApplyDone] = useState(null); // { tone, message }

  const handleMessageHospital = async () => {
    setMessageError(null);
    setBusyMessage(true);
    try {
      const { id: conversationId } = await dataService.getOrCreateHospitalConversation(id);
      navigate(`/messages/${conversationId}`);
    } catch (err) {
      setMessageError(err?.message || 'Could not start the conversation.');
    } finally {
      setBusyMessage(false);
    }
  };

  const openApply = () => {
    setApplyError(null);
    setApplyNote('');
    setApplyOpen(true);
  };

  const handleApply = async () => {
    setApplyError(null);
    setApplyBusy(true);
    try {
      await dataService.applyToHospital(id, { note: applyNote });
      setApplyOpen(false);
      setApplyDone({
        tone: 'success',
        message:
          'Application submitted! The hospital admin will verify your license and details — you will see the status under your profile and on this page.'
      });
      await reload();
    } catch (err) {
      setApplyError(err?.message || 'Could not submit your application.');
    } finally {
      setApplyBusy(false);
    }
  };

  if (loading) return <InlineLoader label="Loading hospital…" />;
  if (error)
    return (
      <div className="mx-auto max-w-3xl">
        <ErrorState message={error} onRetry={reload} />
      </div>
    );

  const doctors = h.doctors || [];
  const myApp = h.my_application;
  const isMyHospital = h.is_my_hospital;

  return (
    <div className="mx-auto max-w-4xl">
      <Link to="/hospitals" className="text-sm font-medium text-cream/65 hover:text-cream">
        &larr; Back to hospitals
      </Link>

      <div className="mt-4 flex flex-col gap-6">
        {/* ---------- Hero: photo background + gradient fade + description ---------- */}
        <div className="card overflow-hidden">
          <div className="relative h-56 w-full sm:h-72">
            {h.photo_url ? (
              <img
                src={h.photo_url}
                alt={`Photo of ${h.name}`}
                className="h-full w-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.parentElement.classList.add('bg-blood');
                }}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-blood text-cream/30">
                <svg className="h-16 w-16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 21V6.2A2.2 2.2 0 016.7 4h10.6a2.2 2.2 0 012.2 2.2V21M4.5 21h15M9.4 4V2.6M14.6 4V2.6M12 8.2v6m-3-3h6" />
                </svg>
              </div>
            )}
            {/* Gradient fade from the photo into the card surface, with the
                hospital name + status emerging out of it (client rule). */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-night via-night/55 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold text-cream drop-shadow sm:text-3xl">{h.name}</h1>
                {h.status === 'verified' ? (
                  <StatusBadge status="verified" label="Verified" />
                ) : (
                  <StatusBadge status={h.status} />
                )}
              </div>
              <p className="mt-1 text-sm font-medium text-cream/85 drop-shadow">
                {h.city ? `${h.city} · ` : ''}
                {h.region}
              </p>
            </div>
          </div>

          {/* Description sits directly under the faded photo */}
          <div className="p-5 sm:p-6">
            <p className="text-sm leading-relaxed text-cream/80">
              {h.description || 'This hospital has not added a description yet.'}
            </p>

            <dl className="mt-5 grid gap-x-6 gap-y-3 border-t border-cream/10 pt-5 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-cream/45">Location</dt>
                <dd className="mt-0.5 font-medium text-cream">{h.address || 'Address not provided'}</dd>
              </div>
              <div>
                <dt className="text-cream/45">Contact number</dt>
                <dd className="mt-0.5 font-medium text-cream">{h.contact_number || '—'}</dd>
              </div>
              <div>
                <dt className="text-cream/45">Open requests at this hospital</dt>
                <dd className="mt-0.5 font-medium text-cream">{h.stats?.open_requests ?? 0}</dd>
              </div>
              <div>
                <dt className="text-cream/45">Completed requests</dt>
                <dd className="mt-0.5 font-medium text-cream">{h.stats?.completed_requests ?? 0}</dd>
              </div>
            </dl>

            {/* Actions */}
            <div className="mt-6 flex flex-wrap gap-2 border-t border-cream/10 pt-5">
              {!isMyHospital && (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleMessageHospital}
                  disabled={busyMessage}
                >
                  {busyMessage ? 'Opening chat…' : 'Message hospital'}
                </button>
              )}
              {isMyHospital && (
                <Link to="/my-hospital" className="btn-primary">
                  Manage my hospital
                </Link>
              )}

              {/* Doctors: apply to join this hospital */}
              {isDoctor && !isMyHospital && !myApp && (
                <button type="button" className="btn-secondary" onClick={openApply}>
                  Apply as a doctor
                </button>
              )}
              {myApp && (
                <span className="inline-flex items-center gap-2 rounded-xl border border-cream/15 px-3 py-2 text-sm">
                  <span className="text-cream/65">Your application:</span>
                  <StatusBadge status={myApp.status === 'accepted' ? 'verified' : myApp.status} label={DOCTOR_APP_STATUS[myApp.status] || myApp.status} />
                </span>
              )}
            </div>

            {messageError && (
              <div className="mt-4">
                <Alert tone="error">{messageError}</Alert>
              </div>
            )}
            {applyDone && (
              <div className="mt-4">
                <Alert tone={applyDone.tone}>{applyDone.message}</Alert>
              </div>
            )}
          </div>
        </div>

        {/* ---------- Hospital admin ---------- */}
        <div className="card p-6">
          <p className="font-semibold text-cream">Hospital admin</p>
          {h.admin_name ? (
            <div className="mt-3 flex items-center gap-3">
              <Avatar name={h.admin_name} src={h.admin_avatar_url} size="lg" />
              <div>
                <p className="font-medium text-cream">{h.admin_name}</p>
                <p className="text-xs text-cream/60">
                  Business administrator
                  {h.admin_is_doctor ? ' · also a licensed doctor (witnesses donations)' : ''}
                </p>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-sm text-cream/65">
              This hospital has no admin account linked yet — a platform administrator is onboarding it.
            </p>
          )}
          <p className="mt-3 text-xs leading-relaxed text-cream/45">
            Messaging the hospital goes directly to this administrator.
          </p>
        </div>

        {/* ---------- Doctor roster (license IDs + contact numbers) ---------- */}
        <div className="card p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold text-cream">Doctors ({doctors.length})</p>
            <span className="text-xs text-cream/50">
              Assigned doctors witness every donation transaction at this hospital
            </span>
          </div>

          {doctors.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                title="No doctors on the roster yet"
                message={
                  isDoctor
                    ? 'Doctors apply from this page — the hospital admin verifies each application.'
                    : 'Verified doctors of this hospital will appear here with their license ID and contact number.'
                }
              />
            </div>
          ) : (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {doctors.map((doc) => (
                <div key={doc.id} className="flex items-start gap-3 rounded-xl border border-cream/10 bg-ink p-4">
                  <Avatar name={doc.full_name} src={doc.avatar_url} size="lg" />
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-1.5 font-semibold text-cream">
                      {doc.full_name}
                      {doc.via_application === false && (
                        <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-semibold text-gold-light">
                          Hospital admin
                        </span>
                      )}
                    </p>
                    {doc.specialization && (
                      <p className="text-xs font-medium text-cream/70">{doc.specialization}</p>
                    )}
                    <p className="mt-1 text-xs text-cream/55">
                      License ID:{' '}
                      <span className="font-semibold text-cream/80">{doc.doctor_license_id || '—'}</span>
                    </p>
                    <p className="text-xs text-cream/55">
                      Contact: <span className="font-semibold text-cream/80">{doc.contact_number || '—'}</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Doctor application dialog */}
      {applyOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center sm:px-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="card max-h-[85vh] w-full max-w-md overflow-y-auto rounded-b-none p-6 pb-safe sm:rounded-b-2xl">
            <h3 className="text-lg font-semibold text-cream">Apply to {h.name}</h3>
            <p className="mt-2 text-sm leading-relaxed text-cream/75">
              Your application will be reviewed by the hospital&apos;s administrator
              {h.admin_name ? ` (${h.admin_name})` : ''}. These details from your profile are sent
              with it:
            </p>
            <div className="mt-3 space-y-1 rounded-xl border border-cream/10 bg-ink p-3 text-sm">
              <p className="text-cream/80">
                Name: <span className="font-semibold">{user.profile.full_name}</span>
              </p>
              <p className="text-cream/80">
                License ID:{' '}
                <span className="font-semibold">{user.profile.doctor_license_id || '— missing!'}</span>
              </p>
              <p className="text-cream/80">
                Specialization:{' '}
                <span className="font-semibold">{user.profile.specialization || '—'}</span>
              </p>
              <p className="text-cream/80">
                Contact number:{' '}
                <span className="font-semibold">{user.profile.contact_number || '— missing!'}</span>
              </p>
            </div>
            <div className="mt-4">
              <label className="label" htmlFor="apply_note">
                Note to the hospital admin (optional)
              </label>
              <textarea
                id="apply_note"
                className="input min-h-[80px]"
                value={applyNote}
                onChange={(e) => setApplyNote(e.target.value)}
                placeholder="e.g. I handle the evening transfusion cases…"
                maxLength={500}
              />
            </div>
            {applyError && (
              <p className="mt-3 text-sm font-medium text-red-400" role="alert">
                {applyError}
              </p>
            )}
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" className="btn-secondary" onClick={() => setApplyOpen(false)} disabled={applyBusy}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleApply}
                disabled={applyBusy || !user.profile.doctor_license_id || !user.profile.contact_number}
              >
                {applyBusy ? 'Submitting…' : 'Submit application'}
              </button>
            </div>
            {(!user.profile.doctor_license_id || !user.profile.contact_number) && (
              <p className="mt-3 text-xs text-amber-300">
                Add your license ID and contact number in{' '}
                <Link to="/profile" className="font-semibold underline">
                  your profile
                </Link>{' '}
                before applying.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

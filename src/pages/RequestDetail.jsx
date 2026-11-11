import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import useAsync from '../hooks/useAsync';
import dataService from '../lib/dataService';
import DonorCard from '../components/DonorCard';
import PublicProfileSheet from '../components/PublicProfileSheet';
import { Alert, Avatar, BloodTypeBadge, ConfirmDialog, ErrorState, InlineLoader, PageLoader, StatusBadge } from '../components/ui';
import { formatDate, formatDateTime } from '../lib/utils';
import { MATCHING_DISCLAIMER, URGENCY, donorTypesFor } from '../lib/constants';

// Request detail page: information, status actions, the v4 donor-accept
// flow (with doctor assignment from the request's hospital), preliminary
// matching (requester + admin only) and the recorded outcome.
//
// v4 rules implemented here:
//   * A DONOR (any signed-in non-requester user — every account type
//     inherits the donor/recipient abilities) can accept the request.
//     They get a doctor assigned automatically, or they can pick one —
//     only from the hospital on this request.
//   * The hospital's business admin and the assigned doctor can manage
//     the request status and record outcomes (the doctor is the
//     witness / source of truth).
export default function RequestDetail() {
  const { id } = useParams();
  const { user, isAdmin, isDoctor, isBusiness } = useAuth();
  const navigate = useNavigate();

  const { data: request, loading, error, reload } = useAsync(() => dataService.getRequest(id), [id]);
  const { data: matches, loading: matchesLoading, error: matchesError, reload: reloadMatches } = useAsync(
    async () => {
      if (!request) return null;
      if (request.requester_id !== user.id && !isAdmin) return null; // matches are requester/admin-only
      return dataService.getMatches(id);
    },
    [request?.id]
  );

  const [confirm, setConfirm] = useState(null); // { kind, title, message, action, requireReason, danger }
  const [actionError, setActionError] = useState(null);
  const [busyAction, setBusyAction] = useState(false);
  const [viewProfileId, setViewProfileId] = useState(null); // profile sheet

  // v4: donor accept flow state
  const [acceptOpen, setAcceptOpen] = useState(false);
  const [chosenDoctor, setChosenDoctor] = useState('');
  const [acceptError, setAcceptError] = useState(null);
  const [acceptBusy, setAcceptBusy] = useState(false);
  const [doctorEditOpen, setDoctorEditOpen] = useState(null); // acceptance being re-assigned
  const [newDoctor, setNewDoctor] = useState('');

  const isOwner = request && request.requester_id === user.id;
  // v4.1: preferred donor types is now a multi-select array.
  const preferredTypes = Array.isArray(request?.preferred_donor_types)
    ? request.preferred_donor_types
    : [];
  // Who may manage this request beyond the owner: platform admins, the
  // hospital's business admin, and the assigned doctor (the witness).
  // Every action below is re-checked by the backend.
  const canManage =
    request &&
    (isAdmin ||
      isOwner ||
      (isBusiness && request.hospital_id) ||
      request.acceptances?.some((a) => a.doctor_id === user.id && a.status === 'accepted'));

  const startConversationWith = async (otherUserId) => {
    setActionError(null);
    setBusyAction(true);
    try {
      const { id: conversationId } = await dataService.getOrCreateConversation(otherUserId, request.id);
      navigate(`/messages/${conversationId}`);
    } catch (err) {
      setActionError(err?.message || 'Could not start the conversation.');
    } finally {
      setBusyAction(false);
    }
  };

  const runStatusAction = async (fn) => {
    await fn();
    await reload();
  };

  // ---------- v4: donor accepts the request ----------
  const openAcceptFlow = () => {
    setAcceptError(null);
    setChosenDoctor('');
    setAcceptOpen(true);
  };

  const handleAccept = async () => {
    setAcceptError(null);
    setAcceptBusy(true);
    try {
      await dataService.acceptRequestAsDonor(id, chosenDoctor || null);
      setAcceptOpen(false);
      await reload();
    } catch (err) {
      setAcceptError(err?.message || 'Could not accept this request.');
    } finally {
      setAcceptBusy(false);
    }
  };

  const openDoctorEdit = (acceptance) => {
    setAcceptError(null);
    setNewDoctor(acceptance.doctor_id || '');
    setDoctorEditOpen(acceptance);
  };

  const handleDoctorChange = async () => {
    setAcceptError(null);
    setAcceptBusy(true);
    try {
      await dataService.setAcceptanceDoctor(doctorEditOpen.id, newDoctor);
      setDoctorEditOpen(null);
      await reload();
    } catch (err) {
      setAcceptError(err?.message || 'Could not change the assigned doctor.');
    } finally {
      setAcceptBusy(false);
    }
  };

  const handleWithdraw = (acceptance) =>
    setConfirm({
      kind: 'withdraw',
      title: 'Withdraw your acceptance?',
      message:
        'The requester and the assigned doctor will no longer expect you for this request. You can accept again while it is still open.',
      confirmLabel: 'Withdraw',
      danger: true,
      action: async () => {
        await dataService.withdrawAcceptance(acceptance.id);
        await reload();
      }
    });

  // ---------- status actions ----------
  const openAcceptConfirm = () =>
    setConfirm({
      kind: 'accept',
      title: 'Mark this request as Accepted?',
      message:
        'Accepted means a participant (usually a donor you coordinated with) has agreed to proceed. It is not proof that a donation has happened.',
      confirmLabel: 'Mark as Accepted',
      action: (reason) => runStatusAction(() => dataService.setRequestStatus(id, 'accepted', reason))
    });

  const openCancelConfirm = () =>
    setConfirm({
      kind: 'cancel',
      title: 'Cancel this request?',
      message: 'The request will be closed as Cancelled. This cannot be undone.',
      confirmLabel: 'Cancel request',
      danger: true,
      action: (reason) => runStatusAction(() => dataService.cancelRequest(id))
    });

  const openAdminStatusConfirm = (status) =>
    setConfirm({
      kind: 'admin-status',
      title: `Change status to ${status}?`,
      message: `A reason is recommended and the change is written to the activity log.`,
      confirmLabel: `Set ${status}`,
      danger: true,
      requireReason: status === 'cancelled' || status === 'completed',
      action: (reason) => runStatusAction(() => dataService.setRequestStatus(id, status, reason))
    });

  if (loading) return <PageLoader />;
  if (error)
    return (
      <div className="mx-auto max-w-2xl">
        <ErrorState message={error} onRetry={reload} />
      </div>
    );

  const myAcceptance = request.my_acceptance;
  const hospitalDoctors = request.hospital_doctors || [];
  const acceptances = request.acceptances || [];
  const openForDonors = ['pending', 'accepted'].includes(request.status);
  const alreadyAccepted = Boolean(myAcceptance);

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/requests" className="text-sm font-medium text-cream/65 hover:text-cream">
        &larr; Back to requests
      </Link>

      <div className="mt-4 flex flex-col gap-6">
        {/* Header */}
        <div className="card p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <BloodTypeBadge type={request.blood_type} size="lg" />
              <div>
                <h1 className="text-xl font-bold text-cream">
                  {request.units_needed} {request.units_needed === 1 ? 'unit' : 'units'} of{' '}
                  {request.blood_type} blood
                </h1>
                <p className="text-sm text-cream/65">
                  {request.region} · created {formatDate(request.created_at)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={request.urgency} label={URGENCY[request.urgency]} />
              <StatusBadge status={request.status} />
            </div>
          </div>

          <dl className="mt-5 grid gap-x-6 gap-y-3 border-t border-cream/10 pt-5 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-cream/45">Requester</dt>
              <dd className="mt-0.5 flex items-center gap-2 font-medium text-cream">
                <Avatar name={request.requester_name} src={request.requester_avatar_url} size="sm" />
                {request.requester_name}
                {isOwner && <span className="text-xs font-semibold text-gold">(you)</span>}
                <button
                  type="button"
                  className="text-xs font-semibold text-gold hover:underline"
                  onClick={() => setViewProfileId(request.requester_id)}
                >
                  View profile
                </button>
              </dd>
            </div>
            <div>
              <dt className="text-cream/45">Urgency</dt>
              <dd className="mt-0.5 font-medium text-cream">{URGENCY[request.urgency]}</dd>
            </div>
            <div>
              <dt className="text-cream/45">Hospital</dt>
              <dd className="mt-0.5 font-medium text-cream">
                {request.hospital_id ? (
                  <span className="flex items-center gap-1.5">
                    <Link to={`/hospitals/${request.hospital_id}`} className="text-gold hover:underline">
                      {request.hospital_name}
                    </Link>
                    {request.hospital_status === 'verified' && (
                      <StatusBadge status="verified" label="Verified" />
                    )}
                  </span>
                ) : (
                  'Not specified'
                )}
              </dd>
            </div>
            <div>
              <dt className="text-cream/45">Needed by</dt>
              <dd className="mt-0.5 font-medium text-cream">{formatDate(request.needed_by)}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-cream/45">Compatible donor types (ABO/Rh)</dt>
              <dd className="mt-0.5 font-medium text-cream">
                {donorTypesFor(request.blood_type).join(', ')}
                {preferredTypes.length > 0 && (
                  <span className="ml-2 rounded-full bg-gold/15 px-2 py-0.5 text-xs font-semibold text-gold-light">
                    Prefers {preferredTypes.join(', ')} donors
                  </span>
                )}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-cream/45">Details</dt>
              <dd className="mt-0.5 leading-relaxed text-cream/85">
                {request.description || 'No additional details provided.'}
              </dd>
            </div>
          </dl>

          {/* Actions */}
          <div className="mt-6 flex flex-wrap gap-2 border-t border-cream/10 pt-5">
            {isOwner && request.status === 'pending' && (
              <>
                <Link to={`/requests/${id}/edit`} className="btn-secondary">
                  Edit request
                </Link>
                <button type="button" className="btn-primary" onClick={openAcceptConfirm}>
                  Mark as Accepted
                </button>
              </>
            )}
            {isOwner && ['pending', 'accepted'].includes(request.status) && (
              <button type="button" className="btn-danger" onClick={openCancelConfirm}>
                Cancel request
              </button>
            )}

            {/* v4: any donor/recipient (i.e. every account type) can accept */}
            {!isOwner && openForDonors && !alreadyAccepted && (
              <button type="button" className="btn-primary" onClick={openAcceptFlow}>
                Accept as donor
              </button>
            )}

            {/* Non-owner: reach the requester */}
            {!isOwner && (
              <button
                type="button"
                className="btn-secondary"
                disabled={busyAction}
                onClick={() => startConversationWith(request.requester_id)}
              >
                {busyAction ? 'Opening chat…' : 'Message requester'}
              </button>
            )}

            {/* v4: the hospital's business admin / assigned doctor controls */}
            {canManage && !isOwner && request.status !== 'completed' && request.status !== 'cancelled' && (
              <div className="flex w-full flex-wrap items-center gap-2 rounded-lg border border-cream/10 bg-ink p-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-cream/45">
                  {isAdmin ? 'Admin controls' : isBusiness ? 'Hospital controls' : 'Assigned doctor controls'}
                </span>
                {request.status === 'pending' && (
                  <button type="button" className="btn-secondary !py-1.5 !text-xs" onClick={() => openAdminStatusConfirm('accepted')}>
                    Set Accepted
                  </button>
                )}
                <button type="button" className="btn-secondary !py-1.5 !text-xs" onClick={() => openAdminStatusConfirm('completed')}>
                  Set Completed
                </button>
                <button type="button" className="btn-secondary !py-1.5 !text-xs" onClick={() => openAdminStatusConfirm('cancelled')}>
                  Cancel (correction)
                </button>
              </div>
            )}
          </div>

          {actionError && (
            <div className="mt-4">
              <Alert tone="error">{actionError}</Alert>
            </div>
          )}
        </div>

        {/* v4: my acceptance (donor view) — the assigned doctor card */}
        {myAcceptance && (
          <div className="card p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-semibold text-cream">You are donating for this request</p>
              <div className="flex items-center gap-2">
                <StatusBadge status={myAcceptance.status === 'completed' ? 'completed' : 'accepted'} label={myAcceptance.status === 'completed' ? 'Completed' : 'Active acceptance'} />
                {myAcceptance.status === 'accepted' && (
                  <button
                    type="button"
                    className="btn-secondary !py-1.5 !text-xs"
                    onClick={() => openDoctorEdit(myAcceptance)}
                  >
                    Change doctor
                  </button>
                )}
                {myAcceptance.status === 'accepted' && (
                  <button type="button" className="btn-danger !py-1.5 !text-xs" onClick={() => handleWithdraw(myAcceptance)}>
                    Withdraw
                  </button>
                )}
              </div>
            </div>
            <div className="mt-4 rounded-xl border border-cream/10 bg-ink p-4">
              {myAcceptance.doctor_name ? (
                <div className="flex items-start gap-3">
                  <Avatar name={myAcceptance.doctor_name} size="lg" />
                  <div>
                    <p className="font-semibold text-cream">
                      {myAcceptance.doctor_name}
                      <span className="ml-2 text-xs font-medium text-cream/55">
                        Assigned doctor · witness for this transaction
                      </span>
                    </p>
                    {myAcceptance.doctor_specialization && (
                      <p className="text-xs text-cream/65">{myAcceptance.doctor_specialization}</p>
                    )}
                    {myAcceptance.doctor_hospital_name && (
                      <p className="mt-0.5 text-xs text-cream/55">{myAcceptance.doctor_hospital_name}</p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-cream/65">
                  No doctor is assigned — this request has no hospital with a doctor roster, so no
                  witness could be assigned. The hospital will coordinate directly.
                </p>
              )}
            </div>
          </div>
        )}

        {/* v4: all acceptances — visible to the requester, admins and the
            hospital admin / assigned doctor (the middleman view) */}
        {acceptances.length > 0 && (isOwner || isAdmin || canManage) && (
          <div className="card p-6">
            <p className="font-semibold text-cream">
              Donors &amp; assigned doctors {isOwner && <span className="text-sm font-normal text-cream/55">(visible to you as the requester)</span>}
            </p>
            <div className="mt-4 space-y-3">
              {acceptances.map((a) => (
                <div key={a.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-cream/10 bg-ink p-4">
                  <Avatar name={a.donor_name} src={a.donor_avatar_url} size="lg" />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-semibold text-cream">
                      {a.donor_name}
                      {a.donor_blood_type && <BloodTypeBadge type={a.donor_blood_type} />}
                      <StatusBadge status={a.status === 'completed' ? 'completed' : 'accepted'} label={a.status === 'completed' ? 'Completed' : 'Accepted'} />
                    </p>
                    <p className="mt-1 text-xs text-cream/60">
                      {a.doctor_name ? (
                        <>
                          Assigned doctor:{' '}
                          <span className="font-semibold text-cream/85">{a.doctor_name}</span>
                          {a.doctor_hospital_name ? ` · ${a.doctor_hospital_name}` : ''}
                        </>
                      ) : (
                        'No doctor assigned (no hospital roster on this request).'
                      )}
                    </p>
                  </div>
                  {a.doctor_id && (
                    <button
                      type="button"
                      className="btn-secondary !min-h-9 !px-3 !py-1.5 !text-xs"
                      onClick={() => startConversationWith(a.doctor_id)}
                    >
                      Message doctor
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Outcome record */}
        {request.record && (
          <div className="card p-6">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-cream">Donation outcome record</p>
              <StatusBadge status={request.record.outcome} />
            </div>
            <p className="mt-3 text-sm leading-relaxed text-cream/75">
              {request.record.reason || 'No reason recorded.'}
            </p>
            <p className="mt-3 text-xs text-cream/45">
              {request.record.donor_name ? `Donor: ${request.record.donor_name} · ` : ''}
              {request.record.doctor_name ? `Witnessed by: ${request.record.doctor_name} · ` : ''}
              Recorded by {request.record.recorded_by_name} · {formatDateTime(request.record.created_at)}
            </p>
            {request.record.outcome === 'failed' && (
              <p className="mt-2 text-xs text-cream/65">
                The request remains open so other donors can still help.
              </p>
            )}
          </div>
        )}

        {/* Matching (requester + admin) */}
        {(isOwner || isAdmin) && (
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold text-cream">Potential donors (preliminary match)</h2>
              <button
                type="button"
                className="text-sm font-medium text-gold hover:underline"
                onClick={reloadMatches}
              >
                Refresh
              </button>
            </div>

            <div className="mb-4">
              <Alert tone="warning" title="Preliminary matching only">
                {MATCHING_DISCLAIMER}
              </Alert>
            </div>

            {matchesLoading && <InlineLoader label="Finding potential donors…" />}
            {!matchesLoading && matchesError && <ErrorState message={matchesError} />}

            {!matchesLoading && !matchesError && matches && matches.donors.length === 0 && (
              <div className="card px-6 py-10 text-center">
                <p className="font-semibold text-cream">No available donors match yet</p>
                <p className="mx-auto mt-1 max-w-md text-sm text-cream/65">
                  Donors must be ABO/Rh-compatible, currently available, and have a completed
                  profile. Check back later — availability changes.
                </p>
              </div>
            )}

            {!matchesLoading && !matchesError && matches && matches.donors.length > 0 && (
              <>
                <p className="mb-3 text-sm text-cream/65">
                  Compatible donor blood types:{' '}
                  <span className="font-semibold text-cream">
                    {matches.compatible_types.join(', ')}
                  </span>
                  {preferredTypes.length > 0
                    ? ` · prefers ${preferredTypes.join(', ')} donors (shown first)`
                    : ' · same-region donors shown first'}.
                </p>
                <div className="grid gap-4 md:grid-cols-2">
                  {matches.donors.map((d) => (
                    <DonorCard
                      key={d.id}
                      donor={d}
                      onMessage={(donor) => startConversationWith(donor.id)}
                      onViewProfile={(donor) => setViewProfileId(donor.id)}
                    />
                  ))}
                </div>
              </>
            )}
          </section>
        )}
      </div>

      {/* v4 — donor accept dialog: pick a doctor from the request's hospital */}
      {acceptOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center sm:px-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="card max-h-[85vh] w-full max-w-md overflow-y-auto rounded-b-none p-6 pb-safe sm:rounded-b-2xl">
            <h3 className="text-lg font-semibold text-cream">Accept as donor</h3>
            <p className="mt-2 text-sm leading-relaxed text-cream/75">
              Thank you! A doctor will be assigned to witness your donation. You can also choose
              the doctor yourself — only doctors from{' '}
              <span className="font-semibold text-cream">{request.hospital_name || 'the hospital on this request'}</span>{' '}
              are selectable.
            </p>

            <div className="mt-4">
              <label className="label" htmlFor="chosen_doctor">
                Assigned doctor
              </label>
              {hospitalDoctors.length > 0 ? (
                <>
                  <select
                    id="chosen_doctor"
                    className="input"
                    value={chosenDoctor}
                    onChange={(e) => setChosenDoctor(e.target.value)}
                  >
                    <option value="">Assign automatically ({hospitalDoctors[0].full_name})</option>
                    {hospitalDoctors.map((doc) => (
                      <option key={doc.id} value={doc.id}>
                        {doc.full_name}
                        {doc.specialization ? ` — ${doc.specialization}` : ''}
                        {doc.via_application === false ? ' (hospital admin)' : ''}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-cream/45">
                    Doctors listed here belong to {request.hospital_name}. You can change the
                    assigned doctor later while your acceptance is active.
                  </p>
                </>
              ) : (
                <p className="rounded-xl border border-cream/10 bg-ink p-3 text-sm text-cream/65">
                  {request.hospital_name
                    ? `${request.hospital_name} has no verified doctors yet — no doctor can be assigned. The hospital admin will coordinate directly.`
                    : 'This request has no hospital, so no doctor can be assigned. The requester will coordinate directly.'}
                </p>
              )}
            </div>

            {acceptError && (
              <p className="mt-3 text-sm font-medium text-red-400" role="alert">
                {acceptError}
              </p>
            )}

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" className="btn-secondary" onClick={() => setAcceptOpen(false)} disabled={acceptBusy}>
                Cancel
              </button>
              <button type="button" className="btn-primary" onClick={handleAccept} disabled={acceptBusy}>
                {acceptBusy ? 'Accepting…' : 'Accept request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* v4 — change assigned doctor dialog (donor's active acceptance) */}
      {doctorEditOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center sm:px-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="card w-full max-w-md rounded-b-none p-6 pb-safe sm:rounded-b-2xl">
            <h3 className="text-lg font-semibold text-cream">Change assigned doctor</h3>
            <p className="mt-2 text-sm leading-relaxed text-cream/75">
              Pick another doctor from {request.hospital_name || 'the hospital on this request'}.
            </p>
            <div className="mt-4">
              <label className="label" htmlFor="new_doctor">
                Doctor
              </label>
              <select
                id="new_doctor"
                className="input"
                value={newDoctor}
                onChange={(e) => setNewDoctor(e.target.value)}
              >
                {hospitalDoctors.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.full_name}
                    {doc.specialization ? ` — ${doc.specialization}` : ''}
                    {doc.via_application === false ? ' (hospital admin)' : ''}
                  </option>
                ))}
              </select>
            </div>
            {acceptError && (
              <p className="mt-3 text-sm font-medium text-red-400" role="alert">
                {acceptError}
              </p>
            )}
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" className="btn-secondary" onClick={() => setDoctorEditOpen(null)} disabled={acceptBusy}>
                Cancel
              </button>
              <button type="button" className="btn-primary" onClick={handleDoctorChange} disabled={acceptBusy || !newDoctor}>
                {acceptBusy ? 'Saving…' : 'Change doctor'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* v3 — directory-safe profile sheet (request-detail only) */}
      <PublicProfileSheet
        userId={viewProfileId}
        onClose={() => setViewProfileId(null)}
        onMessage={(profile) => {
          setViewProfileId(null);
          startConversationWith(profile.id);
        }}
        messageLabel="Message"
      />

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.title}
        message={confirm?.message}
        confirmLabel={confirm?.confirmLabel}
        danger={confirm?.danger}
        requireReason={confirm?.requireReason}
        onClose={() => setConfirm(null)}
        onConfirm={confirm?.action || (() => {})}
      />
    </div>
  );
}

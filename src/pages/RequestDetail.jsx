import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import useAsync from '../hooks/useAsync';
import dataService from '../lib/dataService';
import DonorCard from '../components/DonorCard';
import { Alert, Avatar, BloodTypeBadge, ConfirmDialog, ErrorState, InlineLoader, PageLoader, StatusBadge } from '../components/ui';
import { formatDate, formatDateTime } from '../lib/utils';
import { MATCHING_DISCLAIMER, URGENCY } from '../lib/constants';

// Request detail page: information, status actions, preliminary matching
// (requester + admin only), and the recorded outcome (admin records).
export default function RequestDetail() {
  const { id } = useParams();
  const { user, isAdmin } = useAuth();
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

  const isOwner = request && request.requester_id === user.id;

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

  const openAcceptConfirm = () =>
    setConfirm({
      kind: 'accept',
      title: 'Mark this request as Accepted?',
      message:
        'Accepted means a participant (usually a donor you coordinated with) has agreed to proceed. It is not proof that a donation has happened. Only an administrator can later mark it Completed.',
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
      message: `Administrator action — a reason is recommended and the change is written to the activity log.`,
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
                <Avatar name={request.requester_name} size="sm" />
                {request.requester_name}
                {isOwner && <span className="text-xs font-semibold text-gold">(you)</span>}
              </dd>
            </div>
            <div>
              <dt className="text-cream/45">Urgency</dt>
              <dd className="mt-0.5 font-medium text-cream">{URGENCY[request.urgency]}</dd>
            </div>
            <div>
              <dt className="text-cream/45">Hospital</dt>
              <dd className="mt-0.5 font-medium text-cream">
                {request.hospital_name ? (
                  <span className="flex items-center gap-1.5">
                    {request.hospital_name}
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

            {/* Non-owner donor: reach the requester */}
            {!isOwner && ['pending', 'accepted'].includes(request.status) && (
              <button
                type="button"
                className="btn-primary"
                disabled={busyAction}
                onClick={() => startConversationWith(request.requester_id)}
              >
                {busyAction ? 'Opening chat…' : 'Message requester'}
              </button>
            )}

            {/* Admin corrections */}
            {isAdmin && request.status !== 'completed' && request.status !== 'cancelled' && (
              <div className="flex w-full flex-wrap items-center gap-2 rounded-lg bg-night p-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-cream/45">
                  Admin controls
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

        {/* Outcome record (written by administrators) */}
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
                  </span>{' '}
                  · same-region donors shown first.
                </p>
                <div className="grid gap-4 md:grid-cols-2">
                  {matches.donors.map((d) => (
                    <DonorCard
                      key={d.id}
                      donor={d}
                      onMessage={(donor) => startConversationWith(donor.id)}
                    />
                  ))}
                </div>
              </>
            )}
          </section>
        )}
      </div>

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

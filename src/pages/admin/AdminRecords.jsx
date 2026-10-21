import { useState } from 'react';
import useAsync from '../../hooks/useAsync';
import dataService from '../../lib/dataService';
import { donorTypesFor, OUTCOMES } from '../../lib/constants';
import { Alert, BloodTypeBadge, ConfirmDialog, EmptyState, InlineLoader, ErrorState, StatusBadge } from '../../components/ui';
import { formatDateTime } from '../../lib/utils';

// Outcome records ("transaction records" of this academic app):
// administrators record the result of an ACCEPTED request.
//   successful -> request is closed as Completed
//   failed      -> reason required; request stays open for other donors
export default function AdminRecords() {
  const [showForm, setShowForm] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [formError, setFormError] = useState(null);

  const { data: records, loading, error, reload } = useAsync(() => dataService.listRecords(), []);
  const { data: requests } = useAsync(() => dataService.listRequests({ status: 'accepted' }), []);
  const { data: users } = useAsync(() => dataService.listUsers(), []);

  const [form, setForm] = useState({ request_id: '', donor_id: '', outcome: 'successful', reason: '' });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const selectedRequest = requests?.find((r) => r.id === form.request_id) || null;
  const donorOptions = (users || []).filter((u) => {
    if (!selectedRequest || !u.profile.blood_type) return false;
    return donorTypesFor(selectedRequest.blood_type).includes(u.profile.blood_type);
  });

  const openConfirm = (e) => {
    e.preventDefault();
    setFormError(null);
    if (!form.request_id) return setFormError('Choose the accepted request this record belongs to.');
    if (form.outcome === 'failed' && !form.reason.trim())
      return setFormError('A reason is required when recording a failed outcome.');
    setConfirm({
      title: `Record outcome: ${OUTCOMES[form.outcome]}?`,
      message:
        form.outcome === 'successful'
          ? 'A successful record closes the request as Completed. This is recorded in the activity log and is treated as the definitive outcome.'
          : 'A failed record keeps the request open so other donors can still help. The reason is stored with the record and in the activity log.'
    });
  };

  const handleConfirm = async () => {
    await dataService.createRecord({
      request_id: form.request_id,
      donor_id: form.donor_id || null,
      outcome: form.outcome,
      reason: form.reason
    });
    setForm({ request_id: '', donor_id: '', outcome: 'successful', reason: '' });
    await reload();
  };

  const acceptedRequests = requests || [];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-gray-500">
          Outcome records define the &quot;transaction&quot; of this system: the recorded result of an
          accepted donation request. Records are insert-only for audit integrity.
        </p>
        <button
          type="button"
          className="btn-primary"
          onClick={() => setShowForm((v) => !v)}
          disabled={acceptedRequests.length === 0}
          title={acceptedRequests.length === 0 ? 'There are no accepted requests to record outcomes for' : undefined}
        >
          {showForm ? 'Close form' : '+ Record an outcome'}
        </button>
      </div>

      {acceptedRequests.length === 0 && (
        <Alert tone="info">
          There are currently no accepted requests. Outcomes can only be recorded once a request
          has been marked Accepted.
        </Alert>
      )}

      {/* Create record */}
      {showForm && (
        <form onSubmit={openConfirm} className="card space-y-4 p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="label" htmlFor="record_request">
                Accepted request <span className="text-red-600">*</span>
              </label>
              <select id="record_request" className="input" value={form.request_id} onChange={set('request_id')} required>
                <option value="">Choose…</option>
                {acceptedRequests.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.blood_type} · {r.requester_name} · {r.region}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="record_donor">
                Donor (optional)
              </label>
              <select id="record_donor" className="input" value={form.donor_id} onChange={set('donor_id')} disabled={!selectedRequest}>
                <option value="">Not recorded</option>
                {donorOptions.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.profile.full_name} ({u.profile.blood_type})
                  </option>
                ))}
              </select>
              {selectedRequest && (
                <p className="mt-1 text-xs text-gray-400">
                  Only ABO-compatible donors are listed for this request.
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="label" htmlFor="record_outcome">
              Outcome <span className="text-red-600">*</span>
            </label>
            <div className="flex gap-2">
              {Object.entries(OUTCOMES).map(([k, v]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, outcome: k }))}
                  className={
                    form.outcome === k
                      ? 'btn-primary'
                      : 'btn-secondary'
                  }
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label" htmlFor="record_reason">
              Reason {form.outcome === 'failed' && <span className="text-red-600">*</span>}
            </label>
            <textarea
              id="record_reason"
              className="input min-h-[80px]"
              value={form.reason}
              onChange={set('reason')}
              placeholder={
                form.outcome === 'failed'
                  ? 'Required — e.g. “Donor deferred during screening (low hemoglobin).”'
                  : 'Optional — e.g. “Donation completed at St. Mary General Hospital.”'
              }
              maxLength={300}
            />
          </div>

          {formError && <Alert tone="error">{formError}</Alert>}

          <div className="flex justify-end">
            <button type="submit" className="btn-primary">
              Continue
            </button>
          </div>
        </form>
      )}

      {/* Records list */}
      {loading && <InlineLoader label="Loading records…" />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && records?.length === 0 && (
        <EmptyState title="No outcome records yet" message="Record an outcome for an accepted request to see it here." />
      )}

      {!loading && !error && records?.length > 0 && (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-400">
                <th className="px-4 py-3">Outcome</th>
                <th className="px-4 py-3">Request</th>
                <th className="px-4 py-3">Donor</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Recorded</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {records.map((rec) => (
                <tr key={rec.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <StatusBadge status={rec.outcome} />
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2">
                      <BloodTypeBadge type={rec.request_blood_type || '?'} />
                      <span className="text-gray-600">{rec.request_region}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">{rec.donor_name || '—'}</td>
                  <td className="max-w-[280px] px-4 py-3 text-gray-600">{rec.reason || '—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {rec.recorded_by_name}
                    <br />
                    {formatDateTime(rec.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.title}
        message={confirm?.message}
        confirmLabel="Save record"
        danger
        onClose={() => setConfirm(null)}
        onConfirm={handleConfirm}
      />
    </div>
  );
}

import { useState } from 'react';
import { Link } from 'react-router-dom';
import useAsync from '../../hooks/useAsync';
import dataService from '../../lib/dataService';
import { BLOOD_TYPES, REQUEST_STATUS } from '../../lib/constants';
import { BloodTypeBadge, ConfirmDialog, EmptyState, InlineLoader, ErrorState, StatusBadge } from '../../components/ui';
import { formatDate } from '../../lib/utils';

// Admin request management: search/filter + controlled, audited status
// corrections. The backend rejects impossible transitions, so the UI
// offers only legal ones.
export default function AdminRequests() {
  const [filters, setFilters] = useState({ status: '', blood_type: '', search: '' });
  const [confirm, setConfirm] = useState(null);

  const { data, loading, error, reload } = useAsync(
    () =>
      dataService.listRequests({
        status: filters.status || undefined,
        blood_type: filters.blood_type || undefined,
        search: filters.search || undefined
      }),
    [filters.status, filters.blood_type, filters.search]
  );

  const set = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }));

  // Which transitions are legal from each status (mirrors backend rules)
  const allowedNext = (status) => {
    switch (status) {
      case 'pending':
        return ['accepted', 'cancelled'];
      case 'accepted':
        return ['completed', 'cancelled'];
      default:
        return [];
    }
  };

  const openConfirm = (r, next) =>
    setConfirm({
      r,
      next,
      requireReason: next === 'cancelled' || next === 'completed',
      title: `Set request ${r.id} to “${REQUEST_STATUS[next]}”?`,
      message:
        next === 'completed'
          ? 'Only administrators can complete a request. This records that the donation process has been closed. A reason is written to the activity log.'
          : 'This is a controlled correction and will be written to the activity log.'
    });

  const handleConfirm = async (reason) => {
    await dataService.setRequestStatus(confirm.r.id, confirm.next, reason);
    await reload();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="card grid gap-3 p-4 md:grid-cols-3">
        <input className="input" placeholder="Search requester, description…" value={filters.search} onChange={set('search')} aria-label="Search" />
        <select className="input" value={filters.status} onChange={set('status')} aria-label="Status filter">
          <option value="">All statuses</option>
          {Object.entries(REQUEST_STATUS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select className="input" value={filters.blood_type} onChange={set('blood_type')} aria-label="Blood type filter">
          <option value="">All blood types</option>
          {BLOOD_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      {loading && <InlineLoader label="Loading requests…" />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && data?.length === 0 && (
        <EmptyState title="No requests found" message="No requests match the current filters." />
      )}

      {!loading && !error && data?.length > 0 && (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-400">
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Requester</th>
                <th className="px-4 py-3">Region</th>
                <th className="px-4 py-3">Urgency</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <BloodTypeBadge type={r.blood_type} />
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">{r.requester_name}</td>
                  <td className="px-4 py-3 text-gray-600">{r.region}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={r.urgency} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-4 py-3 text-gray-500">{formatDate(r.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <Link to={`/requests/${r.id}`} className="btn-secondary !px-2.5 !py-1 !text-xs">
                        View
                      </Link>
                      {allowedNext(r.status).map((next) => (
                        <button
                          key={next}
                          type="button"
                          className="btn-secondary !px-2.5 !py-1 !text-xs"
                          onClick={() => openConfirm(r, next)}
                        >
                          {next === 'accepted' ? 'Accept' : next === 'completed' ? 'Complete' : 'Cancel'}
                        </button>
                      ))}
                    </div>
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
        confirmLabel="Apply change"
        danger
        requireReason={confirm?.requireReason}
        onClose={() => setConfirm(null)}
        onConfirm={handleConfirm}
      />
    </div>
  );
}

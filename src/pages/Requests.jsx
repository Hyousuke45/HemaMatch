import { useState } from 'react';
import { Link } from 'react-router-dom';
import useAsync from '../hooks/useAsync';
import dataService from '../lib/dataService';
import RequestCard from '../components/RequestCard';
import { EmptyState, InlineLoader, ErrorState } from '../components/ui';
import { BLOOD_TYPES, REGIONS, REQUEST_STATUS } from '../lib/constants';

// Browse all donation requests. Visibility rule (documented): every
// authenticated user can see every request, with status badges.
export default function Requests() {
  const [filters, setFilters] = useState({ status: '', blood_type: '', region: '', search: '' });
  const { data, loading, error, reload } = useAsync(
    () => dataService.listRequests({
      status: filters.status || undefined,
      blood_type: filters.blood_type || undefined,
      region: filters.region || undefined,
      search: filters.search || undefined
    }),
    [filters.status, filters.blood_type, filters.region]
  );

  const set = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }));
  const hasFilters = filters.status || filters.blood_type || filters.region || filters.search;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Blood donation requests</h1>
          <p className="mt-1 text-sm text-gray-500">
            All requests are visible to signed-in users. Choose one to view details and message the requester.
          </p>
        </div>
        <Link to="/requests/new" className="btn-primary">
          + New request
        </Link>
      </div>

      {/* Filters */}
      <div className="card grid gap-3 p-4 md:grid-cols-4">
        <input
          className="input"
          placeholder="Search requester, description…"
          value={filters.search}
          onChange={set('search')}
          aria-label="Search requests"
        />
        <select className="input" value={filters.status} onChange={set('status')} aria-label="Filter by status">
          <option value="">All statuses</option>
          {Object.entries(REQUEST_STATUS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select className="input" value={filters.blood_type} onChange={set('blood_type')} aria-label="Filter by blood type">
          <option value="">All blood types</option>
          {BLOOD_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <select className="input" value={filters.region} onChange={set('region')} aria-label="Filter by region">
            <option value="">All regions</option>
            {REGIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          {hasFilters && (
            <button
              type="button"
              className="btn-secondary shrink-0"
              onClick={() => setFilters({ status: '', blood_type: '', region: '', search: '' })}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {loading && <InlineLoader label="Loading requests…" />}
      {!loading && error && <ErrorState message={error} onRetry={reload} />}

      {!loading && !error && data?.length === 0 && (
        <EmptyState
          title="No requests found"
          message={
            hasFilters
              ? 'No requests match your filters. Try clearing them.'
              : 'There are no donation requests yet. Be the first to create one.'
          }
          action={
            <Link to="/requests/new" className="btn-primary">
              Create a request
            </Link>
          }
        />
      )}

      {!loading && !error && data?.length > 0 && (
        <>
          <p className="text-sm text-gray-500">
            Showing <span className="font-semibold text-gray-900">{data.length}</span>{' '}
            {data.length === 1 ? 'request' : 'requests'}
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            {data.map((r) => (
              <RequestCard key={r.id} request={r} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

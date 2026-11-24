import { useState } from 'react';
import { Link } from 'react-router-dom';
import useAsync from '../hooks/useAsync';
import dataService from '../lib/dataService';
import RequestCard from '../components/RequestCard';
import BrowseTabs from '../components/BrowseTabs';
import { EmptyState, InlineLoader, ErrorState } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { BLOOD_TYPES, REGIONS, REQUEST_STATUS } from '../lib/constants';

// Browse all donation requests. Visibility rule (documented): every
// authenticated user can see every request, with status badges.
// v6.12: signed-out visitors browse actionable requests (pending /
// accepted / completed) read-only — requester names masked.
export default function Requests() {
  const { user } = useAuth();
  const [filters, setFilters] = useState({ status: '', blood_type: '', region: '', search: '' });
  const { data, loading, error, reload } = useAsync(
    () =>
      user
        ? dataService.listRequests({
            status: filters.status || undefined,
            blood_type: filters.blood_type || undefined,
            region: filters.region || undefined,
            search: filters.search || undefined
          })
        : // public variant already limits to actionable statuses
          dataService.listRequestsPublic({
            blood_type: filters.blood_type || undefined,
            region: filters.region || undefined,
            search: filters.search || undefined
          }),
    [filters.status, filters.blood_type, filters.region, Boolean(user)]
  );

  const set = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }));
  const hasFilters = filters.status || filters.blood_type || filters.region || filters.search;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div>
          <h1 className="text-2xl font-bold text-cream">Blood donation requests</h1>
          <p className="mt-1 text-sm text-muted">
            {user
              ? 'All requests are visible to signed-in users. Choose one to view details and message the requester.'
              : 'Browse open blood requests without an account — register to contact requesters and donate.'}
          </p>
        </div>
        {/* v3: browse requests or browse donors who offered to donate.
            v6.4: the tabs come FIRST and the New-request button sits BELOW
            them — switching tabs never moves the button (it is absent on the
            donors page, which used to shift the tab row up when leaving
            /requests). Both pages now share: title → tabs → action. */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <BrowseTabs />
          {user ? (
            <Link to="/requests/new" className="btn-primary">
              + New request
            </Link>
          ) : (
            <Link to="/register" className="btn-primary">
              Register to help
            </Link>
          )}
        </div>
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
            user ? (
              <Link to="/requests/new" className="btn-primary">
                Create a request
              </Link>
            ) : (
              <Link to="/register" className="btn-primary">
                Register to create one
              </Link>
            )
          }
        />
      )}

      {!loading && !error && data?.length > 0 && (
        <>
          <p className="text-sm text-muted">
            Showing <span className="font-semibold text-cream">{data.length}</span>{' '}
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

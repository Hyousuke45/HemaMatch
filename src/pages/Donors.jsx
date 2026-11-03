import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useAsync from '../hooks/useAsync';
import dataService from '../lib/dataService';
import BrowseTabs from '../components/BrowseTabs';
import DonorCard from '../components/DonorCard';
import { Alert, EmptyState, ErrorState, InlineLoader } from '../components/ui';
import { BLOOD_TYPES, REGIONS } from '../lib/constants';
// ============================================================
// AVAILABLE DONORS (v3 — the "donate" side)
// Directory of every OPEN donor listing, joined with directory-safe
// profile fields. Per the client's scope rule, this page shows the
// listing card only — full profile views exist exclusively on the
// blood-donation-request detail page. Same-region donors are ranked
// first, mirroring the matching page.
// ============================================================
export default function Donors() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState({ blood_type: '', region: '' });
  const [messageError, setMessageError] = useState(null);

  const { data, loading, error, reload } = useAsync(
    () =>
      dataService.listDonors({
        blood_type: filters.blood_type || undefined,
        region: filters.region || undefined
      }),
    [filters.blood_type, filters.region]
  );

  const set = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }));
  const hasFilters = filters.blood_type || filters.region;

  const startConversationWith = async (donor) => {
    setMessageError(null);
    try {
      const { id: conversationId } = await dataService.getOrCreateConversation(donor.id, null);
      navigate(`/messages/${conversationId}`);
    } catch (err) {
      setMessageError(err?.message || 'Could not start the conversation.');
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-cream">Available donors</h1>
          <p className="mt-1 text-sm text-cream/65">
            People who volunteered to donate. Message one directly — coordination and screening
            details are agreed in private chat.
          </p>
        </div>
        <BrowseTabs />
      </div>

      {/* Filters */}
      <div className="card grid gap-3 p-4 md:grid-cols-3">
        <select
          className="input"
          value={filters.blood_type}
          onChange={set('blood_type')}
          aria-label="Filter by blood type"
        >
          <option value="">All blood types</option>
          {BLOOD_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
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
            className="btn-secondary"
            onClick={() => setFilters({ blood_type: '', region: '' })}
          >
            Clear filters
          </button>
        )}
      </div>

      <div>
        <Alert tone="warning" title="Preliminary filtering only">
          A donor listed here is not guaranteed to be medically eligible, and blood-type
          filtering does not determine medical compatibility. Actual compatibility and donor
          screening are determined by qualified healthcare professionals.
        </Alert>
      </div>

      {messageError && (
        <div>
          <Alert tone="error">{messageError}</Alert>
        </div>
      )}

      {loading && <InlineLoader label="Loading donors…" />}
      {!loading && error && <ErrorState message={error} onRetry={reload} />}

      {!loading && !error && data?.length === 0 && (
        <EmptyState
          title="No available donors found"
          message={
            hasFilters
              ? 'No open donor listings match your filters. Try clearing them.'
              : 'No one is listed as an available donor yet. If you can donate, be the first!'
          }
          action={
            <Link to="/donate" className="btn-primary">
              I want to donate
            </Link>
          }
        />
      )}

      {!loading && !error && data?.length > 0 && (
        <>
          <p className="text-sm text-cream/65">
            Showing <span className="font-semibold text-cream">{data.length}</span>{' '}
            {data.length === 1 ? 'donor listing' : 'donor listings'}
            {hasFilters ? ' (filtered)' : ' · same-region donors first'}
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            {data.map((d) => (
              <DonorCard key={d.id} donor={d} onMessage={startConversationWith} />
            ))}
          </div>
        </>
      )}

      <p className="text-xs text-cream/45">
        Want to appear here? Create your donor listing on the{' '}
        <Link to="/donate" className="font-medium text-gold hover:underline">
          Donate blood
        </Link>{' '}
        page.
      </p>
    </div>
  );
}

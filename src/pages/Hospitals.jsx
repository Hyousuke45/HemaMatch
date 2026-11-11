import { Link } from 'react-router-dom';
import { useState } from 'react';
import useAsync from '../hooks/useAsync';
import dataService from '../lib/dataService';
import { useAuth } from '../context/AuthContext';
import { EmptyState, InlineLoader, ErrorState, StatusBadge } from '../components/ui';
import { REGIONS } from '../lib/constants';

// Hospital directory (v4): every user can search for a hospital, view
// its description, location, admin, doctors and doctor information on
// the detail page. Regular users see VERIFIED hospitals only — an
// unverified hospital is never displayed as verified anywhere.
export default function Hospitals() {
  const { isAdmin, isBusiness } = useAuth();
  const [search, setSearch] = useState('');
  const [region, setRegion] = useState('');

  const { data, loading, error, reload } = useAsync(() => dataService.listHospitals(), []);

  // Client-side search filter (name / city / region / description)
  const filtered = (data || []).filter((h) => {
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      h.name.toLowerCase().includes(q) ||
      (h.city || '').toLowerCase().includes(q) ||
      h.region.toLowerCase().includes(q) ||
      (h.description || '').toLowerCase().includes(q);
    const matchesRegion = !region || h.region === region;
    return matchesSearch && matchesRegion;
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-cream">Hospitals</h1>
          <p className="mt-1 text-sm text-cream/65">
            Search for a hospital — view its description, location, admin and doctors.
          </p>
        </div>
        {isAdmin && (
          <Link to="/admin/hospitals" className="btn-secondary">
            Manage hospitals
          </Link>
        )}
        {isBusiness && (
          <Link to="/my-hospital" className="btn-secondary">
            My hospital
          </Link>
        )}
      </div>

      {/* Search + region filter */}
      <div className="card grid gap-3 p-4 md:grid-cols-[1fr_240px]">
        <input
          className="input"
          placeholder="Search by hospital name, city or description…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search hospitals"
        />
        <select
          className="input"
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          aria-label="Filter by region"
        >
          <option value="">All regions</option>
          {REGIONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>

      {loading && <InlineLoader label="Loading hospitals…" />}
      {error && <ErrorState message={error} onRetry={reload} />}

      {!loading && !error && filtered.length === 0 && (
        <EmptyState
          title={search || region ? 'No hospitals match your search' : 'No verified hospitals yet'}
          message={
            search || region
              ? 'Try a different name, city or region.'
              : 'Hospital records are reviewed and verified by administrators before appearing here.'
          }
        />
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((h) => (
            <Link
              key={h.id}
              to={`/hospitals/${h.id}`}
              className="card group overflow-hidden transition-colors hover:border-gold/40"
            >
              {/* Photo header with gradient fade into the card */}
              <div className="relative h-36 w-full overflow-hidden bg-ink">
                {h.photo_url ? (
                  <img
                    src={h.photo_url}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-cream/25">
                    <svg className="h-10 w-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 21V6.2A2.2 2.2 0 016.7 4h10.6a2.2 2.2 0 012.2 2.2V21M4.5 21h15M9.4 4V2.6M14.6 4V2.6M12 8.2v6m-3-3h6" />
                    </svg>
                  </div>
                )}
                {/* gradient fade: photo -> card surface */}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-night via-night/40 to-transparent" />
                <div className="absolute bottom-2 left-4 right-4">
                  <p className="line-clamp-1 text-base font-bold text-cream drop-shadow">{h.name}</p>
                </div>
                {h.status !== 'verified' && (
                  <div className="absolute right-3 top-3">
                    <StatusBadge status={h.status} />
                  </div>
                )}
              </div>

              <div className="p-5">
                {h.description ? (
                  <p className="line-clamp-2 text-sm leading-relaxed text-cream/70">{h.description}</p>
                ) : (
                  <p className="text-sm italic text-cream/45">No description provided yet.</p>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-cream/10 pt-3 text-xs text-cream/60">
                  <span className="font-medium text-cream/80">
                    {h.city ? `${h.city} · ` : ''}
                    {h.region}
                  </span>
                  <span className="ml-auto">
                    {h.doctor_count > 0
                      ? `${h.doctor_count} doctor${h.doctor_count === 1 ? '' : 's'}`
                      : 'No doctors yet'}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <p className="text-xs leading-relaxed text-cream/45">
        Verified hospitals can be attached to blood requests — the hospital is notified whenever a
        requester adds it, and its doctors witness every donation transaction.
      </p>
    </div>
  );
}

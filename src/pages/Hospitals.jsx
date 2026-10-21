import { Link } from 'react-router-dom';
import useAsync from '../hooks/useAsync';
import dataService from '../lib/dataService';
import { useAuth } from '../context/AuthContext';
import { EmptyState, InlineLoader, ErrorState, StatusBadge } from '../components/ui';

// Public hospital directory (Light scope).
// Regular users see VERIFIED hospitals only — an unverified hospital is
// never displayed as verified anywhere in the app.
export default function Hospitals() {
  const { isAdmin } = useAuth();
  const { data, loading, error, reload } = useAsync(() => dataService.listHospitals());

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Hospitals</h1>
          <p className="mt-1 text-sm text-gray-500">
            Administrator-verified hospitals that can be attached to blood requests.
          </p>
        </div>
        {isAdmin && (
          <Link to="/admin/hospitals" className="btn-secondary">
            Manage hospitals
          </Link>
        )}
      </div>

      {loading && <InlineLoader label="Loading hospitals…" />}
      {error && <ErrorState message={error} onRetry={reload} />}

      {!loading && !error && data?.length === 0 && (
        <EmptyState
          title="No verified hospitals yet"
          message="Hospital records are reviewed and verified by administrators before appearing here."
        />
      )}

      {!loading && !error && data?.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {data.map((h) => (
            <div key={h.id} className="card p-5">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-gray-900">{h.name}</p>
                <StatusBadge status={h.status} />
              </div>
              <p className="mt-2 text-sm text-gray-500">
                {h.city ? `${h.city} · ` : ''}
                {h.region}
              </p>
              {h.address && <p className="mt-1 text-xs leading-relaxed text-gray-500">{h.address}</p>}
              {h.contact_number && (
                <p className="mt-1 text-xs text-gray-500">Contact: {h.contact_number}</p>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="text-xs leading-relaxed text-gray-400">
        Light hospital module (agreed MVP scope): an admin-managed directory with verification
        status. Hospital document uploads and staff accounts are a documented future enhancement.
      </p>
    </div>
  );
}

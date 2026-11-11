import { Link } from 'react-router-dom';
import useAsync from '../hooks/useAsync';
import dataService from '../lib/dataService';
import { useAuth } from '../context/AuthContext';
import { Avatar, BloodTypeBadge, EmptyState, InlineLoader, ErrorState, StatusBadge } from '../components/ui';
import { formatDate, formatDateTime } from '../lib/utils';
import { URGENCY } from '../lib/constants';

// ============================================================
// MY ASSIGNMENTS — the Doctor's view (v4).
// A doctor is the middleman, witness and source of truth for every
// transaction they are assigned to. This page lists those
// transactions: the request, the donor, the hospital and the recorded
// outcome, with links to coordinate in chat.
// Reached by doctors (and business admins who are also doctors).
// ============================================================
export default function MyAssignments() {
  const { isDoctor } = useAuth();
  const { data: assignments, loading, error, reload } = useAsync(
    async () => (isDoctor ? dataService.getMyDoctorAssignments() : null),
    [isDoctor]
  );

  if (!isDoctor)
    return (
      <EmptyState
        title="Doctor accounts only"
        message="Only doctor accounts (and hospital admins who are also doctors) have witnessed transactions."
      />
    );
  if (loading) return <InlineLoader label="Loading your assignments…" />;
  if (error)
    return (
      <div className="mx-auto max-w-3xl">
        <ErrorState message={error} onRetry={reload} />
      </div>
    );

  const rows = assignments || [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-cream">My assignments</h1>
        <p className="mt-1 text-sm text-cream/65">
          Transactions where you are the assigned doctor — the witness and source of truth for each
          donation. Coordinate with the donor and the requester in chat, and record the outcome
          from the request page.
        </p>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No assignments yet"
          message="You will be assigned when a donor accepts a request at your hospital — they can also pick you directly when accepting."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {rows.map((a) => (
            <div key={a.id} className="card p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  {a.request_blood_type && <BloodTypeBadge type={a.request_blood_type} size="lg" />}
                  <div>
                    <p className="text-sm font-semibold text-cream">
                      {a.request?.units_needed ?? '—'}{' '}
                      {(a.request?.units_needed ?? 1) === 1 ? 'unit' : 'units'} · {URGENCY[a.request?.urgency] || a.request?.urgency || ''}
                    </p>
                    <p className="text-xs text-cream/65">
                      {a.request?.region || a.region || '—'}
                      {a.hospital_name ? ` · ${a.hospital_name}` : ''}
                    </p>
                  </div>
                </div>
                <StatusBadge
                  status={a.record_outcome ? a.record_outcome : a.request_status || a.status}
                />
              </div>

              <div className="mt-4 flex items-center gap-3 rounded-xl border border-cream/10 bg-ink p-3">
                <Avatar name={a.donor_name} src={a.donor_avatar_url} size="md" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-cream">{a.donor_name}</p>
                  <p className="text-xs text-cream/60">
                    Donor{a.donor_blood_type ? ` · ${a.donor_blood_type}` : ''}
                  </p>
                </div>
                <span className="ml-auto text-[11px] text-cream/45">
                  accepted {formatDate(a.created_at)}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-cream/10 pt-3">
                {a.request_id && (
                  <Link to={`/requests/${a.request_id}`} className="btn-primary !min-h-9 !px-3 !py-1.5 !text-xs">
                    Open request
                  </Link>
                )}
                <span className="ml-auto text-[11px] text-cream/45">
                  updated {formatDateTime(a.updated_at)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs leading-relaxed text-cream/45">
        Remember: as the witness you confirm only what you observed — the actual medical eligibility
        of the donor is always established by the hospital&apos;s standard screening process.
      </p>
    </div>
  );
}

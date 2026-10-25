import { Link } from 'react-router-dom';
import useAsync from '../../hooks/useAsync';
import dataService from '../../lib/dataService';
import { formatDateTime } from '../../lib/utils';
import { EmptyState, InlineLoader, ErrorState, StatCard } from '../../components/ui';

// Admin overview. EVERY number is computed live from the data store —
// nothing is hardcoded. Phase 2: identical layout fed by SQL count()s.
export default function AdminDashboard() {
  const { data: stats, loading, error, reload } = useAsync(() => dataService.getStats());
  const { data: logs, loading: logsLoading } = useAsync(() => dataService.listLogs(), []);

  if (loading) return <InlineLoader label="Loading statistics…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!stats) return null;

  return (
    <div className="flex flex-col gap-6">
      {/* People */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-cream/45">
          Accounts
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Registered users" value={stats.total_users} hint="All accounts" />
          <StatCard label="Available donors" value={stats.available_donors} tone="red" hint="Profile complete + available" />
          <StatCard label="Conversations" value={stats.conversations} hint="Private 1:1 chats" />
          <StatCard label="Verified hospitals" value={stats.hospitals.verified} tone="green" hint={`${stats.hospitals.pending} pending review`} />
        </div>
      </section>

      {/* Requests */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-cream/45">
          Donation requests
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard label="Total" value={stats.requests.total} />
          <StatCard label="Pending" value={stats.requests.pending} tone="amber" />
          <StatCard label="Accepted" value={stats.requests.accepted} tone="sky" />
          <StatCard label="Completed" value={stats.requests.completed} tone="green" />
          <StatCard label="Cancelled" value={stats.requests.cancelled} tone="gray" />
        </div>
        <div className="mt-3 flex gap-2">
          <Link to="/admin/requests" className="btn-secondary !py-1.5 !text-xs">
            Manage requests
          </Link>
          <Link to="/admin/records" className="btn-secondary !py-1.5 !text-xs">
            Record an outcome
          </Link>
        </div>
      </section>

      {/* Records */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-cream/45">
          Outcome records
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Total records" value={stats.records.total} />
          <StatCard label="Successful" value={stats.records.successful} tone="green" />
          <StatCard label="Failed" value={stats.records.failed} tone="red" />
        </div>
      </section>

      {/* Recent activity */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-cream/45">
          Recent administrative activity
        </h2>
        {logsLoading && <InlineLoader label="Loading activity…" />}
        {!logsLoading && (!logs || logs.length === 0) && (
          <EmptyState title="No activity yet" message="Important changes will be logged here." />
        )}
        {!logsLoading && logs?.length > 0 && (
          <div className="card divide-y divide-cream/10">
            {logs.slice(0, 6).map((l) => (
              <div key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm">
                <span className="font-mono text-xs font-semibold text-gold-light">{l.action}</span>
                <span className="text-cream/85">{l.details}</span>
                <span className="ml-auto text-xs text-cream/45">
                  {l.actor_name} · {formatDateTime(l.created_at)}
                </span>
              </div>
            ))}
            <div className="px-4 py-2.5">
              <Link to="/admin/logs" className="text-sm font-medium text-gold hover:underline">
                View full activity log &rarr;
              </Link>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

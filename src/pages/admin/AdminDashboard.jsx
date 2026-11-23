import { Link } from 'react-router-dom';
import useAsync from '../../hooks/useAsync';
import dataService from '../../lib/dataService';
import { formatDateTime } from '../../lib/utils';
import { EmptyState, InlineLoader, ErrorState } from '../../components/ui';
import {
  Users,
  Droplets,
  Stethoscope,
  Building2,
  HeartHandshake,
  Building,
  ClipboardList,
  Clock,
  CheckCircle2,
  XCircle,
  ScrollText,
  ArrowRight,
  Activity
} from 'lucide-react';

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
      {/* Key figures — the four headline numbers first */}
      <section aria-label="Key figures">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile icon={Users} label="Registered users" value={stats.total_users} hint="All accounts" />
          <StatTile icon={Droplets} label="Available donors" value={stats.available_donors} tone="red" hint="Profile complete + available" />
          <StatTile icon={Clock} label="Pending requests" value={stats.requests.pending} tone="amber" hint="Awaiting action" />
          <StatTile icon={CheckCircle2} label="Completed donations" value={stats.requests.completed} tone="green" hint="Closed successfully" />
        </div>
      </section>

      {/* Quick actions */}
      <section className="flex flex-wrap gap-2" aria-label="Quick actions">
        <Link to="/admin/requests" className="btn-secondary !py-2 !text-[13px]">
          <ClipboardList className="h-4 w-4" strokeWidth={1.9} aria-hidden="true" />
          Manage requests
        </Link>
        <Link to="/admin/records" className="btn-secondary !py-2 !text-[13px]">
          <Activity className="h-4 w-4" strokeWidth={1.9} aria-hidden="true" />
          Record an outcome
        </Link>
        <Link to="/admin/users" className="btn-secondary !py-2 !text-[13px]">
          <Users className="h-4 w-4" strokeWidth={1.9} aria-hidden="true" />
          Review users
        </Link>
        <Link to="/admin/hospitals" className="btn-secondary !py-2 !text-[13px]">
          <Building2 className="h-4 w-4" strokeWidth={1.9} aria-hidden="true" />
          Verify hospitals
        </Link>
      </section>

      {/* Accounts detail */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-muted">Accounts</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <MiniStat icon={Stethoscope} label="Doctors" value={stats.doctors ?? '—'} />
          <MiniStat icon={Building} label="Businesses" value={stats.businesses ?? '—'} />
          <MiniStat icon={HeartHandshake} label="Open donor listings" value={stats.open_offers} />
          <MiniStat icon={Building} label="Verified hospitals" value={stats.hospitals.verified} tone="green" />
          <MiniStat icon={Clock} label="Hospitals pending" value={stats.hospitals.pending} tone="amber" />
        </div>
      </section>

      {/* Requests breakdown */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-muted">Donation requests</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <MiniStat icon={ClipboardList} label="Total" value={stats.requests.total} />
          <MiniStat icon={Clock} label="Pending" value={stats.requests.pending} tone="amber" />
          <MiniStat icon={ArrowRight} label="Accepted" value={stats.requests.accepted} tone="sky" />
          <MiniStat icon={CheckCircle2} label="Completed" value={stats.requests.completed} tone="green" />
          <MiniStat icon={XCircle} label="Cancelled" value={stats.requests.cancelled} tone="gray" />
        </div>
      </section>

      {/* Records */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-muted">Outcome records</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <MiniStat icon={ScrollText} label="Total records" value={stats.records.total} />
          <MiniStat icon={CheckCircle2} label="Successful" value={stats.records.successful} tone="green" />
          <MiniStat icon={XCircle} label="Failed" value={stats.records.failed} tone="red" />
        </div>
      </section>

      {/* Recent activity */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-muted">Recent administrative activity</h2>
        {logsLoading && <InlineLoader label="Loading activity…" />}
        {!logsLoading && (!logs || logs.length === 0) && (
          <EmptyState title="No activity yet" message="Important changes will be logged here." />
        )}
        {!logsLoading && logs?.length > 0 && (
          <div className="card divide-y divide-line">
            {logs.slice(0, 6).map((l) => (
              <div key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm">
                <span className="rounded bg-blood px-2 py-0.5 font-mono text-xs font-semibold text-gold">
                  {l.action}
                </span>
                <span className="text-cream/85">{l.details}</span>
                <span className="ml-auto text-xs text-muted">
                  {l.actor_name} · {formatDateTime(l.created_at)}
                </span>
              </div>
            ))}
            <div className="px-4 py-2.5">
              <Link to="/admin/logs" className="inline-flex items-center gap-1 text-sm font-medium text-gold hover:underline">
                View full activity log
                <ArrowRight className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              </Link>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

// Headline stat tile — icon chip + prominent number.
function StatTile({ icon: Icon, label, value, hint, tone = 'default' }) {
  const tones = {
    default: 'text-cream',
    red: 'text-gold-light',
    amber: 'text-amber-700',
    green: 'text-emerald-700',
    sky: 'text-sky-700',
    gray: 'text-muted'
  };
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted">{label}</p>
        <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-blood text-gold">
          <Icon className="h-4 w-4" strokeWidth={1.9} aria-hidden="true" />
        </span>
      </div>
      <p className={`mt-1 text-3xl font-bold tracking-tight ${tones[tone] || tones.default}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

// Compact secondary stat.
function MiniStat({ icon: Icon, label, value, tone = 'default' }) {
  const tones = {
    default: 'text-cream',
    red: 'text-gold-light',
    amber: 'text-amber-700',
    green: 'text-emerald-700',
    sky: 'text-sky-700',
    gray: 'text-muted'
  };
  return (
    <div className="card flex items-center gap-3 p-4">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-pale text-muted">
        <Icon className="h-4 w-4" strokeWidth={1.9} aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted">{label}</p>
        <p className={`text-xl font-bold tracking-tight ${tones[tone] || tones.default}`}>{value}</p>
      </div>
    </div>
  );
}

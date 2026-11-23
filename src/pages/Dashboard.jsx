import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import useAsync from '../hooks/useAsync';
import dataService from '../lib/dataService';
import { Avatar, BloodTypeBadge, EmptyState, InlineLoader, StatusBadge } from '../components/ui';
import RequestCard from '../components/RequestCard';
import { formatDate, classNames } from '../lib/utils';
import {
  Droplet,
  HeartHandshake,
  ClipboardList,
  Building2,
  MessageCircle,
  ArrowRight,
  Stethoscope,
  Users
} from 'lucide-react';

const QUICK_ACTIONS = [
  {
    to: '/requests/new',
    icon: Droplet,
    title: 'Request blood',
    body: 'Create a donation request for a patient in need.'
  },
  {
    to: '/donate',
    icon: HeartHandshake,
    title: 'Donate blood',
    body: 'List yourself as a volunteer donor — open or paused anytime.'
  },
  {
    to: '/requests',
    icon: ClipboardList,
    title: 'Browse requests',
    body: 'See who needs blood near you and offer help.'
  },
  {
    to: '/donors',
    icon: Users,
    title: 'Find donors',
    body: 'Browse the donor directory by blood type and region.'
  },
  {
    to: '/hospitals',
    icon: Building2,
    title: 'Find a hospital',
    body: 'Search hospitals, view doctors and message them directly.'
  },
  {
    to: '/messages',
    icon: MessageCircle,
    title: 'Messages',
    body: 'Chat privately with requesters and donors.'
  }
];

export default function Dashboard() {
  const { user, isDoctor, isBusiness } = useAuth();
  const { data: myRequests, loading, error } = useAsync(() => dataService.getMyRequests());
  const { data: myOffer, loading: offerLoading } = useAsync(() => dataService.getMyOffer(), []);
  const { data: myAssignments } = useAsync(
    async () => (isDoctor ? dataService.getMyDoctorAssignments() : null),
    [isDoctor]
  );

  const p = user.profile;

  // Dashboard stats — computed from the user's live data, never hardcoded.
  const pendingCount = myRequests?.filter((r) => r.status === 'pending').length ?? 0;
  const activeCount = myRequests?.filter((r) => r.status === 'accepted').length ?? 0;
  const completedCount = myRequests?.filter((r) => r.status === 'completed').length ?? 0;

  return (
    <div className="flex flex-col gap-8">
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar name={p.full_name} src={p.avatar_url} size="lg" />
          <div>
            <h1 className="text-xl font-bold tracking-tight text-cream">
              Welcome back, {p.full_name.split(' ')[0]}
            </h1>
            <p className="text-[13px] text-muted">
              Member since {formatDate(p.created_at)}
              {isBusiness ? ' · Business (hospital admin) account' : isDoctor ? ' · Doctor account' : ''}
            </p>
          </div>
        </div>
        <Link to="/requests/new" className="btn-primary">
          <Droplet className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          New request
        </Link>
      </div>

      {/* Stats — v6.3: the four numbers condensed into ONE card with
          internal dividers (2x2 on mobile, one row on desktop) */}
      <section className="card p-1.5" aria-label="My request statistics">
        <div className="grid grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'My requests', value: myRequests?.length ?? '—', hint: 'All time' },
            { label: 'Pending', value: myRequests ? pendingCount : '—', tone: 'amber', hint: 'Awaiting action' },
            { label: 'Accepted', value: myRequests ? activeCount : '—', tone: 'sky', hint: 'In progress' },
            { label: 'Completed', value: myRequests ? completedCount : '—', tone: 'green', hint: 'Closed by admin' }
          ].map((s, i) => (
            <StatTile key={s.label} {...s} first={i === 0} />
          ))}
        </div>
      </section>

      {/* v4: doctor / business context cards */}
      {isDoctor && (
        <section className="card flex flex-wrap items-center justify-between gap-3 p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-blood text-gold">
              <Stethoscope className="h-5 w-5" strokeWidth={1.9} aria-hidden="true" />
            </span>
            <div>
              <p className="font-semibold text-cream">Witnessed transactions</p>
              <p className="mt-0.5 text-sm text-muted">
                {myAssignments
                  ? `You are the assigned doctor (witness) on ${myAssignments.length} transaction${myAssignments.length === 1 ? '' : 's'}.`
                  : 'Loading your assignments…'}
              </p>
            </div>
          </div>
          <Link to="/my-assignments" className="btn-secondary">
            My assignments
          </Link>
        </section>
      )}
      {isBusiness && (
        <section className="card flex flex-wrap items-center justify-between gap-3 p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-blood text-gold">
              <Building2 className="h-5 w-5" strokeWidth={1.9} aria-hidden="true" />
            </span>
            <div>
              <p className="font-semibold text-cream">Your hospital</p>
              <p className="mt-0.5 text-sm text-muted">
                Track records, review doctor applications and manage your hospital&apos;s public profile.
              </p>
            </div>
          </div>
          <Link to="/my-hospital" className="btn-primary">
            Open hospital panel
          </Link>
        </section>
      )}

      {/* Quick actions — v6.3: icon + label SIDE BY SIDE on mobile
          (horizontal pill, one per row); desktop keeps the roomy
          icon-over-text cards in a 6-column grid. */}
      <section aria-label="Quick actions">
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-6 lg:gap-4">
          {QUICK_ACTIONS.map((a) => (
            <Link
              key={a.to}
              to={a.to}
              className="card group flex items-center gap-3 p-3.5 transition-colors hover:border-gold/40 lg:flex-col lg:items-start lg:p-5 lg:text-left"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-blood text-gold">
                <a.icon className="h-[18px] w-[18px]" strokeWidth={1.9} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-cream">{a.title}</span>
                {/* one-line description only on desktop */}
                <span className="mt-0.5 hidden text-sm leading-snug text-muted lg:block">{a.body}</span>
              </span>
              {/* subtle arrow on mobile hints it's tappable */}
              <ArrowRight
                className="h-4 w-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 lg:hidden"
                strokeWidth={2}
                aria-hidden="true"
              />
            </Link>
          ))}
        </div>
      </section>

      {/* My requests */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold tracking-tight text-cream">My donation requests</h2>
            <p className="text-[13px] text-muted">Everything you have requested, newest first.</p>
          </div>
          <Link to="/requests/new" className="text-sm font-medium text-gold hover:underline">
            + New request
          </Link>
        </div>

        {loading && <InlineLoader label="Loading your requests…" />}
        {error && <EmptyState title="Could not load requests" message={error} />}

        {!loading && !error && myRequests?.length === 0 && (
          <EmptyState
            title="No requests yet"
            message="When you create a blood donation request it will appear here with its current status."
            action={
              <Link to="/requests/new" className="btn-primary">
                Create your first request
              </Link>
            }
          />
        )}

        {!loading && !error && myRequests?.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2">
            {myRequests.slice(0, 4).map((r) => (
              <RequestCard key={r.id} request={r} />
            ))}
          </div>
        )}

        {!loading && !error && myRequests?.length > 4 && (
          <Link
            to="/requests"
            className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-gold hover:underline"
          >
            View all {myRequests.length} requests
            <ArrowRight className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          </Link>
        )}
      </section>

      {/* Status legend */}
      <section className="card p-5">
        <p className="text-[13px] font-semibold text-cream">Request statuses</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <StatusBadge status="pending" label="Pending — submitted, awaiting action" />
          <StatusBadge status="accepted" label="Accepted — a participant agreed to proceed" />
          <StatusBadge status="completed" label="Completed — closed by an administrator" />
          <StatusBadge status="cancelled" label="Cancelled" />
        </div>
      </section>
    </div>
  );
}

// Dashboard stat cell — v6.3: one cell inside the single stats card.
// Dividers via border logic (right edge except last column per row,
// bottom edge on the mobile 2x2 top row).
function StatTile({ label, value, hint, tone = 'default', first = false }) {
  const tones = {
    default: 'text-cream',
    amber: 'text-amber-700',
    green: 'text-emerald-700',
    sky: 'text-sky-700',
    red: 'text-gold-light'
  };
  return (
    <div
      className={classNames(
        'p-4',
        // left hairline between columns
        !first && 'lg:border-l lg:border-line',
        // mobile 2x2: vertical divider between the two columns (cells
        // 2 and 4 are the even children), horizontal divider under the
        // first row (mobile only — desktop is a single row)
        'even:border-l even:border-line',
        'max-lg:[&:nth-child(-n+2)]:border-b max-lg:[&:nth-child(-n+2)]:border-line',
        // first cell: no left divider, the card edge owns it
        'first:!border-l-0'
      )}
    >
      <p className="text-[13px] font-medium text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-bold tracking-tight ${tones[tone] || tones.default}`}>{value}</p>
      {hint && <p className="mt-1 text-[11px] text-muted">{hint}</p>}
    </div>
  );
}

import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import useAsync from '../hooks/useAsync';
import dataService from '../lib/dataService';
import { Avatar, BloodTypeBadge, EmptyState, InlineLoader, StatusBadge } from '../components/ui';
import RequestCard from '../components/RequestCard';
import { formatDate } from '../lib/utils';

export default function Dashboard() {
  const { user } = useAuth();
  const { data: myRequests, loading, error } = useAsync(() => dataService.getMyRequests());

  const p = user.profile;

  return (
    <div className="flex flex-col gap-8">
      {/* Welcome */}
      <div className="flex items-center gap-4">
        <Avatar name={p.full_name} size="lg" />
        <div>
          <h1 className="text-2xl font-bold text-cream">Welcome, {p.full_name.split(' ')[0]}!</h1>
          <p className="text-sm text-cream/65">Member since {formatDate(p.created_at)}</p>
        </div>
      </div>

      {/* Donor profile card */}
      <section className="card p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {p.blood_type ? (
              <BloodTypeBadge type={p.blood_type} size="lg" />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-ink text-xs font-bold text-cream/45">
                N/A
              </div>
            )}
            <div>
              <p className="font-semibold text-cream">My donor profile</p>
              {p.blood_type ? (
                <p className="text-sm text-cream/65">
                  {p.region || 'Region not set'}
                  {p.city ? ` · ${p.city}` : ''} ·{' '}
                  <span className={p.is_available ? 'font-medium text-emerald-400' : 'font-medium text-cream/65'}>
                    {p.is_available ? 'Available to donate' : 'Not available'}
                  </span>
                </p>
              ) : (
                <p className="text-sm text-cream/65">
                  Add your blood type and location so you appear in matching results.
                </p>
              )}
            </div>
          </div>
          <Link to="/profile" className="btn-secondary">
            {p.blood_type ? 'Edit profile' : 'Complete profile'}
          </Link>
        </div>
      </section>

      {/* Quick actions — big tappable cards, icon + one-line purpose */}
      <section className="grid gap-4 sm:grid-cols-3">
        <Link to="/requests/new" className="card p-5 transition-colors hover:border-gold/40">
          <span className="flex items-center gap-2 font-semibold text-cream">
            <svg className="h-5 w-5 text-gold" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2C12 2 5 10.3 5 15a7 7 0 0 0 14 0C19 10.3 12 2 12 2Z" />
            </svg>
            Request blood
          </span>
          <p className="mt-1 text-sm text-cream/65">Create a donation request for a patient in need.</p>
        </Link>
        <Link to="/requests" className="card p-5 transition-colors hover:border-gold/40">
          <span className="flex items-center gap-2 font-semibold text-cream">
            <svg className="h-5 w-5 text-gold" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 5.25h10.5a2 2 0 012 2v11.5a2 2 0 01-2 2H8a2 2 0 01-2-2V7.25a2 2 0 012-2zM3.5 9.5v6m11-7.25v9" />
            </svg>
            Browse requests
          </span>
          <p className="mt-1 text-sm text-cream/65">See who needs blood near you and offer help.</p>
        </Link>
        <Link to="/messages" className="card p-5 transition-colors hover:border-gold/40">
          <span className="flex items-center gap-2 font-semibold text-cream">
            <svg className="h-5 w-5 text-gold" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a8.4 8.4 0 01-8.4 8.4c-1.3 0-2.6-.3-3.7-.9L3 21l1.6-4.6A8.4 8.4 0 1121 12z" />
            </svg>
            Messages
          </span>
          <p className="mt-1 text-sm text-cream/65">Chat privately with requesters and donors.</p>
        </Link>
      </section>

      {/* My requests */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-cream">My donation requests</h2>
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
            {myRequests.map((r) => (
              <RequestCard key={r.id} request={r} />
            ))}
          </div>
        )}
      </section>

      {/* Status legend */}
      <section className="card p-5">
        <p className="text-sm font-semibold text-cream">Request statuses</p>
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

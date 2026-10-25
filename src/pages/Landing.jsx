import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import useAsync from '../hooks/useAsync';
import dataService from '../lib/dataService';
import { Alert } from '../components/ui';
import { APP_NAME, MATCHING_DISCLAIMER } from '../lib/constants';

const STEPS = [
  {
    title: '1. Register & build your donor profile',
    body: 'Create an account, then add your blood type, region and availability. Only directory-safe information is shared — never your email address.'
  },
  {
    title: '2. Post or browse requests',
    body: 'Anyone can request blood. Requests are visible to all signed-in users with their current status: Pending, Accepted, Completed or Cancelled.'
  },
  {
    title: '3. Match, chat & coordinate',
    body: 'Requesters see potential donors filtered by blood-type compatibility, region and availability, then coordinate safely through private messages.'
  }
];

export default function Landing() {
  const { user } = useAuth();
  const { data: stats } = useAsync(() => dataService.getPublicStats());

  return (
    <div className="flex flex-col gap-12 md:gap-16">
      {/* Hero — mobile-first: headline, pitch, then stacked CTAs */}
      <section className="grid items-center gap-8 pt-4 md:grid-cols-2 md:gap-10">
        <div>
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-3.5 py-1.5 text-xs font-semibold text-gold-light">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2C12 2 5 10.3 5 15a7 7 0 0 0 14 0C19 10.3 12 2 12 2Z" />
            </svg>
            Blood Donation &amp; Matching Platform
          </p>
          <h1 className="text-4xl font-extrabold leading-tight text-cream md:text-5xl">
            Connecting blood donors with those who{' '}
            <span className="text-gold">need them</span>.
          </h1>
          <p className="mt-4 max-w-lg text-base leading-relaxed text-cream/75">
            {APP_NAME} helps patients and families find volunteer donors nearby, coordinate
            donations through private messaging, and track every request from Pending to
            Completed — with hospital and administrator oversight.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            {user ? (
              <>
                <Link to="/dashboard" className="btn-primary w-full sm:w-auto">
                  Go to my dashboard
                </Link>
                <Link to="/requests" className="btn-secondary w-full sm:w-auto">
                  Browse requests
                </Link>
              </>
            ) : (
              <>
                <Link to="/register" className="btn-primary w-full sm:w-auto">
                  Become a donor — it&apos;s free
                </Link>
                <Link to="/login" className="btn-secondary w-full sm:w-auto">
                  Sign in
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Decorative sample card (static, illustrative only) */}
        <div className="relative hidden md:block">
          <div className="card mx-auto max-w-sm p-6">
            <div className="flex items-center justify-between">
              <span className="rounded-lg border border-red-400/40 bg-red-700 px-4 py-1.5 text-lg font-bold text-cream">
                O+
              </span>
              <span className="rounded-full border border-amber-400/30 bg-amber-400/15 px-2.5 py-0.5 text-xs font-semibold text-amber-300">
                Pending
              </span>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-cream/85">
              &quot;Patient scheduled for major surgery at St. Mary General Hospital needs O+ blood.
              Donors matched here will still go through standard screening at the hospital.&quot;
            </p>
            <div className="mt-4 flex items-center justify-between border-t border-cream/10 pt-4 text-xs text-cream/60">
              <span>3 units needed</span>
              <span>NCR · Urgent</span>
            </div>
          </div>
          <div
            className="absolute -bottom-4 -right-4 -z-10 h-full w-full rounded-2xl border border-gold/25 bg-gold/10"
            aria-hidden="true"
          />
        </div>
      </section>

      {/* Stats strip — computed live, never hardcoded. Horizontally scrollable on phones */}
      <section className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <div className="grid min-w-max grid-cols-2 gap-3 md:min-w-0 md:grid-cols-4 md:gap-4">
          {[
            { label: 'Available donors', value: stats?.donors ?? '—' },
            { label: 'Open requests', value: stats?.open_requests ?? '—' },
            { label: 'Completed donations', value: stats?.completed ?? '—' },
            { label: 'Verified hospitals', value: stats?.hospitals ?? '—' }
          ].map((s) => (
            <div key={s.label} className="card p-5 text-center">
              <p className="text-3xl font-bold text-gold-light">{s.value}</p>
              <p className="mt-1 text-sm text-cream/65">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section>
        <h2 className="text-2xl font-bold text-cream">How {APP_NAME} works</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.title} className="card p-6">
              <p className="font-semibold text-cream">{s.title}</p>
              <p className="mt-2 text-sm leading-relaxed text-cream/75">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Medical disclaimer — required, always visible before signup */}
      <section>
        <Alert tone="warning" title="Important medical disclaimer">
          {MATCHING_DISCLAIMER}
        </Alert>
      </section>

      {/* Roles */}
      <section className="grid gap-4 md:grid-cols-3">
        <div className="card p-6">
          <p className="font-semibold text-cream">Users &amp; donors</p>
          <p className="mt-2 text-sm leading-relaxed text-cream/75">
            Register, build a donor profile, post requests, view preliminary matches and chat
            privately. Users never see each other&apos;s email addresses.
          </p>
        </div>
        <div className="card p-6">
          <p className="font-semibold text-cream">Administrators</p>
          <p className="mt-2 text-sm leading-relaxed text-cream/75">
            Review requests, record donation outcomes with reasons, verify hospitals, manage
            accounts — with every important change written to an activity log.
          </p>
        </div>
        <div className="card p-6">
          <p className="font-semibold text-cream">Hospitals (light scope)</p>
          <p className="mt-2 text-sm leading-relaxed text-cream/75">
            An admin-managed directory of verified hospitals. Only hospitals an administrator has
            verified can be attached to requests — unverified ones are never shown as verified.
          </p>
        </div>
      </section>
    </div>
  );
}

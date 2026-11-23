import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import useAsync from '../hooks/useAsync';
import dataService from '../lib/dataService';
import { Alert } from '../components/ui';
import { APP_NAME, MATCHING_DISCLAIMER, BLOOD_TYPES } from '../lib/constants';

const STEPS = [
  {
    title: 'Register & build your profile',
    body: 'Create an account, then add your blood type, region, photo and availability. Only directory-safe information is shared — never your email address.'
  },
  {
    title: 'Request — or offer to donate',
    body: 'Anyone can request blood. You can also list yourself as a volunteer donor so requesters nearby can find you directly. Donation is always voluntary, never for sale.'
  },
  {
    title: 'Match, chat & coordinate',
    body: 'Requesters see potential donors filtered by blood-type compatibility, region and availability, then coordinate safely through private messages.'
  }
];

export default function Landing() {
  const { user } = useAuth();
  const { data: stats } = useAsync(() => dataService.getPublicStats());

  return (
    <div className="flex flex-col gap-14 md:gap-20">
      {/* Hero — DentaBook pattern: eyebrow, tight display heading with a
          highlighted word, one-line pitch, quiet CTAs, floating card. */}
      <section className="grid items-center gap-10 pt-6 md:grid-cols-2 md:gap-12 md:pt-10">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gold">
            Blood donation &amp; matching platform
          </p>
          <h1 className="mt-3 text-[2.6rem] font-bold leading-[1.08] tracking-tight text-cream md:text-6xl">
            A little blood.
            <br />A whole{' '}
            <span className="text-gold">life saved.</span>
          </h1>
          <p className="mt-5 max-w-md text-base leading-relaxed text-muted">
            {APP_NAME} connects patients and families with volunteer donors nearby —
            requests matched by blood type and region, coordinated through private
            messaging, with hospital oversight.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            {user ? (
              <>
                <Link to="/dashboard" className="btn-primary w-full sm:w-auto">
                  Go to my dashboard
                </Link>
                <Link to="/donate" className="btn-secondary w-full sm:w-auto">
                  Donate blood
                </Link>
                <Link to="/requests" className="btn-ghost w-full sm:w-auto">
                  Browse requests →
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

        {/* Floating request card (static, illustrative) on a pale backdrop */}
        <div className="relative hidden md:block">
          <div className="card mx-auto max-w-sm p-6 shadow-[0_8px_32px_rgba(22,50,62,0.09)]">
            <div className="flex items-center justify-between">
              <span className="rounded-lg border border-red-200 bg-blood px-4 py-1.5 text-lg font-bold text-gold">
                O+
              </span>
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                Pending
              </span>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-cream/80">
              &quot;Patient scheduled for major surgery at St. Mary General Hospital needs O+ blood.
              Donors matched here will still go through standard screening at the hospital.&quot;
            </p>
            <div className="mt-4 flex items-center justify-between border-t border-line pt-4 text-xs text-muted">
              <span>3 units needed</span>
              <span>NCR · Urgent</span>
            </div>
          </div>
          <div
            className="absolute -bottom-4 -right-4 -z-10 h-full w-full rounded-xl border border-line bg-pale"
            aria-hidden="true"
          />
        </div>
      </section>

      {/* Stats strip — computed live, never hardcoded */}
      <section className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <div className="grid min-w-max grid-cols-2 gap-3 md:min-w-0 md:grid-cols-4 md:gap-4">
          {[
            { label: 'Available donors', value: stats?.donors ?? '—' },
            { label: 'Open requests', value: stats?.open_requests ?? '—' },
            { label: 'Completed donations', value: stats?.completed ?? '—' },
            { label: 'Verified hospitals', value: stats?.hospitals ?? '—' }
          ].map((s) => (
            <div key={s.label} className="card p-5 text-center">
              <p className="text-3xl font-bold tracking-tight text-cream">{s.value}</p>
              <p className="mt-1 text-sm text-muted">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Quick actions — DentaBook's link-card pattern */}
      <section aria-label="Quick actions">
        <h2 className="text-2xl font-bold tracking-tight text-cream md:text-[29px]">
          Where do you want to start?
        </h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {[
            {
              to: '/requests',
              title: 'Find a request to help',
              body: 'Browse open blood requests near you, filtered by blood type and region.'
            },
            {
              to: '/donate',
              title: 'List yourself as a donor',
              body: 'Open or pause your volunteer donor listing anytime — donation is always voluntary.'
            },
            {
              to: '/hospitals',
              title: 'Find a hospital',
              body: 'Search the verified hospital directory, view doctor rosters and message them directly.'
            }
          ].map((a) => (
            <Link key={a.to} to={a.to} className="card group p-6 transition-colors hover:border-gold/40">
              <p className="font-bold text-cream">{a.title}</p>
              <p className="mt-2 text-sm leading-relaxed text-muted">{a.body}</p>
              <p className="mt-4 text-sm font-semibold text-gold">
                Explore
                <span className="ml-1 inline-block transition-transform group-hover:translate-x-0.5">→</span>
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section>
        <h2 className="text-2xl font-bold tracking-tight text-cream md:text-[29px]">
          How {APP_NAME} works
        </h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <div key={s.title} className="card p-6">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blood text-sm font-bold text-gold">
                {i + 1}
              </span>
              <p className="mt-3 font-bold text-cream">{s.title}</p>
              <p className="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Blood type strip — quiet nod to the matching engine */}
      <section className="card-well px-6 py-8">
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div className="max-w-md">
            <h2 className="text-xl font-bold tracking-tight text-cream">
              Matching built on the ABO/Rh chart.
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Every match starts from the standard compatibility chart — preliminary
              filtering only. Actual eligibility is always decided by healthcare
              professionals during donor screening.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5" aria-hidden="true">
            {BLOOD_TYPES.map((t) => (
              <span
                key={t}
                className="rounded-lg border border-red-200 bg-white px-2.5 py-1 text-xs font-bold text-gold"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Medical disclaimer — required, always visible before signup */}
      <section>
        <Alert tone="warning" title="Important medical disclaimer">
          {MATCHING_DISCLAIMER}
        </Alert>
      </section>
    </div>
  );
}

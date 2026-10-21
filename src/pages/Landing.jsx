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
    <div className="flex flex-col gap-16">
      {/* Hero */}
      <section className="grid items-center gap-10 pt-4 md:grid-cols-2">
        <div>
          <p className="mb-3 inline-flex items-center rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
            Blood Donation &amp; Matching Platform
          </p>
          <h1 className="text-4xl font-extrabold leading-tight text-gray-900 md:text-5xl">
            Connecting blood donors with those who <span className="text-red-600">need them</span>.
          </h1>
          <p className="mt-4 max-w-lg text-base leading-relaxed text-gray-600">
            {APP_NAME} helps patients and families find volunteer donors nearby, coordinate
            donations through private messaging, and track every request from Pending to
            Completed — with hospital and administrator oversight.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            {user ? (
              <>
                <Link to="/dashboard" className="btn-primary">
                  Go to my dashboard
                </Link>
                <Link to="/requests" className="btn-secondary">
                  Browse requests
                </Link>
              </>
            ) : (
              <>
                <Link to="/register" className="btn-primary">
                  Become a donor — it&apos;s free
                </Link>
                <Link to="/login" className="btn-secondary">
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
              <span className="rounded-lg bg-red-600 px-4 py-1.5 text-lg font-bold text-white">O+</span>
              <span className="rounded-full border border-amber-200 bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                Pending
              </span>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-gray-700">
              &quot;Patient scheduled for major surgery at St. Mary General Hospital needs O+ blood.
              Donors matched here will still go through standard screening at the hospital.&quot;
            </p>
            <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4 text-xs text-gray-500">
              <span>3 units needed</span>
              <span>NCR · Urgent</span>
            </div>
          </div>
          <div className="absolute -bottom-4 -right-4 -z-10 h-full w-full rounded-xl bg-red-100" aria-hidden="true" />
        </div>
      </section>

      {/* Stats strip — computed live, never hardcoded */}
      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { label: 'Available donors', value: stats?.donors ?? '—' },
          { label: 'Open requests', value: stats?.open_requests ?? '—' },
          { label: 'Completed donations', value: stats?.completed ?? '—' },
          { label: 'Verified hospitals', value: stats?.hospitals ?? '—' }
        ].map((s) => (
          <div key={s.label} className="card p-5 text-center">
            <p className="text-3xl font-bold text-red-600">{s.value}</p>
            <p className="mt-1 text-sm text-gray-500">{s.label}</p>
          </div>
        ))}
      </section>

      {/* How it works */}
      <section>
        <h2 className="text-2xl font-bold text-gray-900">How {APP_NAME} works</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.title} className="card p-6">
              <p className="font-semibold text-gray-900">{s.title}</p>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">{s.body}</p>
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
          <p className="font-semibold text-gray-900">Users &amp; donors</p>
          <p className="mt-2 text-sm leading-relaxed text-gray-600">
            Register, build a donor profile, post requests, view preliminary matches and chat
            privately. Users never see each other&apos;s email addresses.
          </p>
        </div>
        <div className="card p-6">
          <p className="font-semibold text-gray-900">Administrators</p>
          <p className="mt-2 text-sm leading-relaxed text-gray-600">
            Review requests, record donation outcomes with reasons, verify hospitals, manage
            accounts — with every important change written to an activity log.
          </p>
        </div>
        <div className="card p-6">
          <p className="font-semibold text-gray-900">Hospitals (light scope)</p>
          <p className="mt-2 text-sm leading-relaxed text-gray-600">
            An admin-managed directory of verified hospitals. Only hospitals an administrator has
            verified can be attached to requests — unverified ones are never shown as verified.
          </p>
        </div>
      </section>
    </div>
  );
}

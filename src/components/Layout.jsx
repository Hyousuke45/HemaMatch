import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { APP_NAME, APP_DISCLAIMER } from '../lib/constants';
import { classNames } from '../lib/utils';
import { Droplet } from 'lucide-react';

/* Public marketing shell (v6): landing, login, register, password reset,
   404. Signed-in pages render inside SidebarLayout (sidebar + topbar),
   so this shell no longer carries account navigation. */

// ---------- Brand ----------
export function Brand() {
  return (
    <NavLink to="/" className="flex items-center gap-2.5" aria-label={`${APP_NAME} home`}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-gold text-white">
        <Droplet className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
      </span>
      <span className="leading-none">
        <span className="block text-lg font-bold tracking-tight text-cream">
          Hema<span className="text-gold">Match</span>
        </span>
        <span className="mt-0.5 block text-[9px] font-semibold uppercase tracking-[0.14em] text-muted">
          Give blood. Save lives.
        </span>
      </span>
    </NavLink>
  );
}

const PUBLIC_LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/hospitals', label: 'Hospitals' }
];

export default function Layout() {
  const { user } = useAuth();

  return (
    <div className="flex min-h-screen flex-col bg-ink">
      {/* ---------- Header ---------- */}
      <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
          <Brand />

          {/* Quiet public links (only useful while signed out) */}
          {!user && (
            <div className="hidden items-center gap-1 md:flex">
              {PUBLIC_LINKS.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  end={l.end}
                  className={({ isActive }) =>
                    classNames(
                      'rounded-[10px] px-3 py-2.5 text-sm font-medium transition-colors',
                      isActive ? 'text-gold' : 'text-muted hover:text-cream'
                    )
                  }
                >
                  {l.label}
                </NavLink>
              ))}
            </div>
          )}

          {/* Signed out: sign in / register. Signed in: back into the app. */}
          <div className="flex items-center gap-2">
            {user ? (
              <NavLink to="/dashboard" className="btn-primary !min-h-9 !px-3.5 !py-1.5 !text-sm">
                Go to dashboard
              </NavLink>
            ) : (
              <>
                <NavLink to="/login" className="btn-ghost !min-h-9 !px-3 !text-sm">
                  Sign in
                </NavLink>
                <NavLink to="/register" className="btn-primary !min-h-9 !px-3.5 !py-1.5 !text-sm">
                  Register
                </NavLink>
              </>
            )}
          </div>
        </nav>
      </header>

      {/* ---------- Main ---------- */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:py-8">
        <Outlet />
      </main>

      {/* ---------- Footer ---------- */}
      <footer className="mt-auto border-t border-line bg-white">
        <div className="mx-auto max-w-6xl px-4 py-6">
          <div className="flex flex-col items-start justify-between gap-3 md:flex-row md:items-center">
            <p className="text-sm font-semibold text-cream">
              {APP_NAME} — Academic Project · 2026
            </p>
            <p className="text-xs text-muted">
              Built with React + Vite · Supabase (Phase 2) · PostgreSQL
            </p>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted">{APP_DISCLAIMER}</p>
        </div>
      </footer>
    </div>
  );
}

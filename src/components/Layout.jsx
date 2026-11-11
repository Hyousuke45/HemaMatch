import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { APP_NAME, APP_DISCLAIMER } from '../lib/constants';
import { Avatar, StatusBadge } from './ui';
import { classNames } from '../lib/utils';

/* Mobile-first shell.
   - Phones: sticky header + bottom tab bar (thumb-reachable, 6 items),
     avatar taps straight into Profile. No hamburger menus to get lost in.
   - Desktop: top navigation + avatar dropdown, as before. */

// ---------- Brand ----------
export function Brand() {
  return (
    <NavLink to="/" className="flex items-center gap-2" aria-label={`${APP_NAME} home`}>
      {/* <svg className="h-7 w-7" viewBox="0 0 24 24" fill="#c1912f" aria-hidden="true">
        <path d="M12 2C12 2 5 10.3 5 15a7 7 0 0 0 14 0C19 10.3 12 2 12 2Z" />
      </svg> */}

      <img src="/favicon.ico" alt="" className="auth-logo mx-auto" style={{ margin: "0 auto" }} />
        

      <span className="text-lg font-bold text-cream">
        Hema<span className="text-gold">Match</span>
      </span>
    </NavLink>
  );
}

// ---------- Bottom tab bar icons (stroke, 24px grid) ----------
const icon = (d) => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
);

export const TabIcon = {
  home: icon('M2.25 12l8.95-7.15a1.5 1.5 0 011.8 0L21.75 12M4.5 9.75v9.75h15V9.75'),
  request: icon('M12 2.7C12 2.7 5.2 10.6 5.2 15.1a6.8 6.8 0 0013.6 0C18.8 10.6 12 2.7 12 2.7zM9.5 15.5a2.8 2.8 0 002.5 2.8'),
  donate: icon('M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z'),
  chat: icon('M21 12a8.4 8.4 0 01-8.4 8.4c-1.3 0-2.6-.3-3.7-.9L3 21l1.6-4.6A8.4 8.4 0 1121 12zM8.8 11.5h6.4M8.8 14.7h4'),
  hospital: icon('M4.5 21V6.2A2.2 2.2 0 016.7 4h10.6a2.2 2.2 0 012.2 2.2V21M4.5 21h15M9.4 4V2.6M14.6 4V2.6M12 8.2v6m-3-3h6'),
  user: icon('M15.8 8.6a3.8 3.8 0 11-7.6 0 3.8 3.8 0 017.6 0zM4.8 20.4c.9-3.6 3.8-5.7 7.2-5.7s6.3 2.1 7.2 5.7'),
  admin: icon('M12 2.8l7.5 3v6.1c0 4.6-3.1 7.9-7.5 9.3-4.4-1.4-7.5-4.7-7.5-9.3V5.8l7.5-3zM9.2 12.2l2 2 3.6-3.8'),
  doctor: icon('M12 3v3m0 3.5V21m-6-8h12M9 6h6M6.8 6.5h2.4m5.6 0h2.4m-2.4 0a1.2 1.2 0 100 2.4 1.2 1.2 0 000-2.4zm-8 0a1.2 1.2 0 100 2.4 1.2 1.2 0 000-2.4z')
};

// Bottom navigation for phones (< md). Role-aware: admins see Admin,
// business admins see their Hospital panel, doctors see Assignments.
function BottomTabBar({ user, isAdmin, isBusiness, isDoctor }) {
  const tabs = [
    { to: '/dashboard', label: 'Home', icon: TabIcon.home },
    { to: '/requests', label: 'Requests', icon: TabIcon.request },
    { to: '/donate', label: 'Donate', icon: TabIcon.donate },
    { to: '/messages', label: 'Messages', icon: TabIcon.chat },
    isAdmin
      ? { to: '/admin', label: 'Admin', icon: TabIcon.admin }
      : isBusiness
        ? { to: '/my-hospital', label: 'Hospital', icon: TabIcon.hospital }
        : { to: '/hospitals', label: 'Hospitals', icon: TabIcon.hospital },
    { to: '/profile', label: 'Profile', icon: TabIcon.user }
  ];
  // Doctors get a 7th slot for their assignment list only when they are
  // not a business (business admins manage everything from the hospital panel).
  if (isDoctor && !isBusiness && !isAdmin) {
    tabs.splice(4, 0, { to: '/my-assignments', label: 'Witness', icon: TabIcon.doctor });
  }

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-cream/10 bg-ink/95 backdrop-blur md:hidden pb-safe"
      aria-label="Primary navigation"
    >
      <div className={classNames('grid', tabs.length === 7 ? 'grid-cols-7' : 'grid-cols-6')}>
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.to === '/admin'}
            className={({ isActive }) =>
              classNames(
                'flex min-h-[56px] flex-col items-center justify-center gap-0.5 px-0.5 py-2 text-[10px] font-semibold transition-colors',
                isActive ? 'text-gold' : 'text-cream/55'
              )
            }
          >
            {t.icon}
            {t.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

const NAV_LINKS = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/requests', label: 'Requests' },
  { to: '/donate', label: 'Donate' },
  { to: '/messages', label: 'Messages' },
  { to: '/hospitals', label: 'Hospitals' }
];

export default function Layout() {
  const { user, isAdmin, isDoctor, isBusiness, logout } = useAuth();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    setUserMenuOpen(false);
  }, [user]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  let links = [...NAV_LINKS];
  if (isAdmin) links = [...links, { to: '/admin', label: 'Admin' }];
  else {
    if (isBusiness) links = [...links, { to: '/my-hospital', label: 'My hospital' }];
    if (isDoctor) links = [...links, { to: '/my-assignments', label: 'My assignments' }];
  }

  return (
    <div className="flex min-h-screen flex-col bg-ink">
      {/* ---------- Header ---------- */}
      <header className="sticky top-0 z-40 border-b border-cream/10 bg-ink/95 backdrop-blur">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
          <Brand />

          {/* Desktop navigation (>= md) */}
          {user && (
            <div className="hidden items-center gap-1 md:flex">
              {links.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  end={l.to === '/admin'}
                  className={({ isActive }) =>
                    classNames(
                      'rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                      isActive ? 'bg-gold/15 text-gold' : 'text-cream/70 hover:bg-cream/5 hover:text-cream'
                    )
                  }
                >
                  {l.label}
                </NavLink>
              ))}
            </div>
          )}

          {/* Signed out (public pages) */}
          {!user && (
            <div className="flex items-center gap-2">
              <NavLink to="/login" className="btn-ghost !min-h-9 !px-3 !text-sm">
                Sign in
              </NavLink>
              <NavLink
                to="/register"
                className="btn-primary !min-h-9 !px-3.5 !py-1.5 !text-sm"
              >
                Register
              </NavLink>
            </div>
          )}

          {/* Signed in — desktop avatar menu / mobile avatar -> profile */}
          {user && (
            <div className="relative hidden md:block">
              <button
                type="button"
                className="flex items-center gap-2 rounded-xl border border-cream/15 py-1.5 pl-1.5 pr-2 transition-colors hover:bg-cream/5"
                onClick={() => setUserMenuOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={userMenuOpen}
              >
                <Avatar name={user.profile.full_name} src={user.profile.avatar_url} size="sm" />
                <span className="max-w-[140px] truncate text-sm font-medium text-cream/85">
                  {user.profile.full_name}
                </span>
                {isAdmin && <StatusBadge status="verified" label="Admin" />}
              </button>
              {userMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setUserMenuOpen(false)} />
                  <div
                    className="card absolute right-0 z-20 mt-2 w-44 py-1"
                    role="menu"
                  >
                    <button
                      type="button"
                      className="block w-full px-4 py-2.5 text-left text-sm text-cream/85 transition-colors hover:bg-cream/5"
                      onClick={() => {
                        setUserMenuOpen(false);
                        navigate('/profile');
                      }}
                    >
                      My profile
                    </button>
                    <button
                      type="button"
                      className="block w-full border-t border-cream/10 px-4 py-2.5 text-left text-sm font-medium text-red-300 transition-colors hover:bg-red-400/10"
                      onClick={handleLogout}
                    >
                      Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Mobile: signed-in avatar goes straight to Profile (bottom bar has the rest) */}
          {user && (
            <NavLink
              to="/profile"
              className="md:hidden"
              aria-label="My profile"
            >
              <Avatar name={user.profile.full_name} src={user.profile.avatar_url} size="md" />
            </NavLink>
          )}
        </nav>
      </header>

      {/* ---------- Main ---------- */}
      {/* pb-24 clears the fixed bottom tab bar on phones */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 pb-24 md:py-8 md:pb-8">
        <Outlet />
      </main>

      {/* ---------- Footer ---------- */}
      <footer className="mt-auto border-t border-cream/10 bg-ink">
        <div className="mx-auto max-w-6xl px-4 py-6 pb-safe">
          <div className="flex flex-col items-start justify-between gap-3 md:flex-row md:items-center">
            <p className="text-sm font-semibold text-cream/80">
              {APP_NAME} — Academic Project · 2026
            </p>
            <p className="text-xs text-cream/40">
              Built with React + Vite · Supabase (Phase 2) · PostgreSQL
            </p>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-cream/50">{APP_DISCLAIMER}</p>
        </div>
      </footer>

      {/* ---------- Mobile bottom tab bar ---------- */}
      {user && (
        <BottomTabBar user={user} isAdmin={isAdmin} isBusiness={isBusiness} isDoctor={isDoctor} />
      )}
    </div>
  );
}

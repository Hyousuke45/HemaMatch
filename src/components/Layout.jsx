import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { APP_NAME, APP_DISCLAIMER } from '../lib/constants';
import { Avatar, StatusBadge } from './ui';
import { classNames } from '../lib/utils';

function Brand() {
  return (
    <NavLink to="/" className="flex items-center gap-2">
      <svg className="h-7 w-7" viewBox="0 0 24 24" fill="#dc2626" aria-hidden="true">
        <path d="M12 2C12 2 5 10.3 5 15a7 7 0 0 0 14 0C19 10.3 12 2 12 2Z" />
      </svg>
      <span className="text-lg font-bold text-gray-900">
        Hema<span className="text-red-600">Match</span>
      </span>
    </NavLink>
  );
}

const NAV_LINKS = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/requests', label: 'Requests' },
  { to: '/messages', label: 'Messages' },
  { to: '/hospitals', label: 'Hospitals' }
];

export default function Layout() {
  const { user, isAdmin, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    setUserMenuOpen(false);
  }, [user]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const links = isAdmin ? [...NAV_LINKS, { to: '/admin', label: 'Admin' }] : NAV_LINKS;

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-8">
            <Brand />
            <div className="hidden items-center gap-1 md:flex">
              {user &&
                links.map((l) => (
                  <NavLink
                    key={l.to}
                    to={l.to}
                    className={({ isActive }) =>
                      classNames(
                        'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                        isActive ? 'bg-red-50 text-red-700' : 'text-gray-600 hover:bg-gray-100'
                      )
                    }
                  >
                    {l.label}
                  </NavLink>
                ))}
            </div>
          </div>

          {/* Signed out (public pages) */}
          {!user && (
            <div className="hidden items-center gap-2 md:flex">
              <NavLink to="/login" className="btn-ghost">
                Sign in
              </NavLink>
              <NavLink to="/register" className="btn-primary">
                Create account
              </NavLink>
            </div>
          )}

          {/* Signed in: avatar menu */}
          {user && (
            <div className="relative hidden md:block">
              <button
                type="button"
                className="flex items-center gap-2 rounded-lg border border-gray-200 px-2 py-1.5 hover:bg-gray-50"
                onClick={() => setUserMenuOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={userMenuOpen}
              >
                <Avatar name={user.profile.full_name} size="sm" />
                <span className="max-w-[140px] truncate text-sm font-medium text-gray-800">
                  {user.profile.full_name}
                </span>
                {isAdmin && <StatusBadge status="verified" label="Admin" />}
              </button>
              {userMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setUserMenuOpen(false)} />
                  <div className="card absolute right-0 z-20 mt-2 w-44 py-1" role="menu">
                    <button
                      type="button"
                      className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                      onClick={() => {
                        setUserMenuOpen(false);
                        navigate('/profile');
                      }}
                    >
                      My profile
                    </button>
                    <button
                      type="button"
                      className="block w-full border-t border-gray-100 px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                      onClick={handleLogout}
                    >
                      Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Mobile hamburger */}
          <button
            type="button"
            className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 md:hidden"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Toggle navigation"
          >
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d={menuOpen ? 'M6 18L18 6M6 6l12 12' : 'M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5'}
              />
            </svg>
          </button>
        </nav>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="border-t border-gray-200 bg-white px-4 py-3 md:hidden">
            {user ? (
              <div className="flex flex-col gap-1">
                {links.map((l) => (
                  <NavLink
                    key={l.to}
                    to={l.to}
                    className={({ isActive }) =>
                      classNames(
                        'rounded-lg px-3 py-2.5 text-sm font-medium',
                        isActive ? 'bg-red-50 text-red-700' : 'text-gray-700 hover:bg-gray-100'
                      )
                    }
                    onClick={() => setMenuOpen(false)}
                  >
                    {l.label}
                  </NavLink>
                ))}
                <button
                  type="button"
                  className="rounded-lg px-3 py-2.5 text-left text-sm font-medium text-gray-700 hover:bg-gray-100"
                  onClick={() => {
                    setMenuOpen(false);
                    navigate('/profile');
                  }}
                >
                  My profile
                </button>
                <button
                  type="button"
                  className="rounded-lg px-3 py-2.5 text-left text-sm font-medium text-red-600 hover:bg-red-50"
                  onClick={handleLogout}
                >
                  Sign out
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <NavLink to="/login" className="btn-secondary" onClick={() => setMenuOpen(false)}>
                  Sign in
                </NavLink>
                <NavLink to="/register" className="btn-primary" onClick={() => setMenuOpen(false)}>
                  Create account
                </NavLink>
              </div>
            )}
          </div>
        )}
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <Outlet />
      </main>

      <footer className="mt-auto border-t border-gray-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-6">
          <div className="flex flex-col items-start justify-between gap-3 md:flex-row md:items-center">
            <p className="text-sm font-semibold text-gray-700">
              {APP_NAME} — Academic Project · 2026
            </p>
            <p className="text-xs text-gray-400">Built with React + Vite · Supabase (Phase 2) · PostgreSQL</p>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-gray-500">{APP_DISCLAIMER}</p>
        </div>
      </footer>
    </div>
  );
}

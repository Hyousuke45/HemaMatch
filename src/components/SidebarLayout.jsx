import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import useAsync from '../hooks/useAsync';
import dataService from '../lib/dataService';
import { APP_NAME, APP_DISCLAIMER } from '../lib/constants';
import { Avatar, StatusBadge } from './ui';
import { classNames } from '../lib/utils';
import {
  Home,
  Droplet,
  Droplets,
  HeartHandshake,
  MessageCircle,
  Building2,
  User,
  LayoutDashboard,
  ClipboardList,
  Users,
  Building,
  ScrollText,
  Stethoscope,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
  Bell
} from 'lucide-react';

/* SidebarLayout — the v6 application shell for signed-in pages.
   Mobile-first (< md): sticky topbar + thumb-reachable BOTTOM TAB BAR
   (role-aware: Admin / Hospital / Witness slots) — no drawer needed on
   phones. Tablet (md): icon-rail sidebar. Desktop (>= lg): full sidebar
   with labels, collapsible to icon-rails. Structure mirrors the spec:
   recognizable icons + labels, active page clearly highlighted, related
   items grouped, no nested menus. */

const NAV_SECTIONS = [
  {
    label: 'General',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: Home },
      { to: '/requests', label: 'Requests', icon: ClipboardList },
      { to: '/donate', label: 'Donate', icon: HeartHandshake },
      { to: '/donors', label: 'Donors', icon: Droplets }
    ]
  },
  {
    label: 'Communicate',
    items: [
      { to: '/messages', label: 'Messages', icon: MessageCircle },
      { to: '/notifications', label: 'Notifications', icon: Bell }, // v6.10: all roles
      { to: '/hospitals', label: 'Hospitals', icon: Building2 }
    ]
  }
];

// Role-specific sections appended after the general ones.
function roleSections({ isAdmin, isBusiness, isDoctor }) {
  const sections = [];
  if (isBusiness) {
    sections.push({
      label: 'Hospital',
      items: [
        { to: '/my-hospital', label: 'My hospital', icon: Building }
      ]
    });
  }
  if (isDoctor && !isBusiness) {
    sections.push({
      label: 'Witness',
      items: [{ to: '/my-assignments', label: 'Assignments', icon: Stethoscope }]
    });
  }
  if (isAdmin) {
    sections.push({
      label: 'Administration',
      items: [
        { to: '/admin', label: 'Admin overview', icon: LayoutDashboard, end: true },
        { to: '/admin/users', label: 'Users', icon: Users },
        { to: '/admin/hospitals', label: 'Hospitals', icon: Building },
        { to: '/admin/logs', label: 'Activity log', icon: ScrollText }
      ]
    });
  }
  return sections;
}

// ---------- Brand ----------
// v6.11: the real generated app icon (public/icons/logo-128.png, derived
// from the supplied App Icon.png) replaces the inline lucide Droplet SVG.
import brandLogo from '../assets/logo-128.png';

function BrandMark({ compact = false }) {
  return (
    <NavLink to="/" className="flex items-center gap-2.5" aria-label={`${APP_NAME} home`}>
      <img
        src={brandLogo}
        alt=""
        width="36"
        height="36"
        className="h-9 w-9 shrink-0 rounded-[10px] object-cover"
      />
      {!compact && (
        <span className="leading-none">
          <span className="block text-[17px] font-bold tracking-tight text-cream">
            Hema<span className="text-gold">Match</span>
          </span>
          <span className="mt-0.5 block text-[9px] font-semibold uppercase tracking-[0.14em] text-muted">
            Give blood. Save lives.
          </span>
        </span>
      )}
    </NavLink>
  );
}

// ---------- Sidebar body (shared by desktop rail and mobile drawer) ----------
function SidebarContent({ sections, collapsed }) {
  return (
    <>
      <div className={classNames('flex h-16 items-center border-b border-line px-4', collapsed && 'justify-center px-0')}>
        {collapsed ? <BrandMark compact /> : <BrandMark />}
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4" aria-label="Primary">
        {sections.map((section) => (
          <div key={section.label}>
            {!collapsed && (
              <p className="mb-1.5 px-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted/80">
                {section.label}
              </p>
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    title={collapsed ? item.label : undefined}
                    className={({ isActive }) =>
                      classNames(
                        'group flex items-center gap-3 rounded-[10px] px-2.5 py-2.5 text-sm font-medium transition-colors',
                        collapsed && 'justify-center px-0',
                        isActive
                          ? 'bg-blood text-gold'
                          : 'text-muted hover:bg-pale hover:text-cream'
                      )
                    }
                  >
                    <item.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.9} aria-hidden="true" />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {!collapsed && (
        <div className="border-t border-line px-4 py-3">
          <p className="text-[10px] leading-relaxed text-muted/70">{APP_DISCLAIMER}</p>
        </div>
      )}
    </>
  );
}

// ---------- Bottom tab bar (phones, < md) ----------
// Restored v5 mobile-first navigation (client request): five primary
// destinations + a role slot (Admin / Hospital / Witness), plus Profile.
// Lucide icons, active tab in crimson, thumb-reachable 56px targets.
function BottomTabBar({ isAdmin, isBusiness, isDoctor }) {
  const tabs = [
    { to: '/dashboard', label: 'Home', icon: Home },
    { to: '/requests', label: 'Requests', icon: ClipboardList },
    { to: '/donate', label: 'Donate', icon: HeartHandshake },
    { to: '/messages', label: 'Messages', icon: MessageCircle },
    isAdmin
      ? { to: '/admin', label: 'Admin', icon: LayoutDashboard, end: true }
      : isBusiness
        ? { to: '/my-hospital', label: 'Hospital', icon: Building }
        : isDoctor && !isBusiness
          ? { to: '/my-assignments', label: 'Witness', icon: Stethoscope }
          : { to: '/hospitals', label: 'Hospitals', icon: Building2 },
    { to: '/profile', label: 'Profile', icon: User }
  ];

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 pb-safe backdrop-blur md:hidden"
      aria-label="Primary navigation"
    >
      <div className={classNames('grid grid-cols-6', tabs.length === 7 && 'grid-cols-7')}>
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              classNames(
                'flex min-h-[56px] flex-col items-center justify-center gap-0.5 px-0.5 py-2 text-[10px] font-semibold transition-colors',
                isActive ? 'text-gold' : 'text-muted'
              )
            }
          >
            <t.icon className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
            {t.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

export default function SidebarLayout({ children }) {
  const { user, isAdmin, isDoctor, isBusiness, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // v6.10: unread USER notifications power the topbar bell badge for
  // every role; business accounts also count their hospital inbox.
  // Fails soft — the badge just stays hidden.
  const { data: userNotifs } = useAsync(
    async () => {
      try {
        return await dataService.listUserNotifications();
      } catch {
        return null;
      }
    },
    []
  );
  const { data: hospNotifs } = useAsync(
    async () => {
      if (!isBusiness) return null;
      try {
        return await dataService.listHospitalNotifications();
      } catch {
        return null;
      }
    },
    [isBusiness]
  );
  const unreadNotifs =
    (userNotifs || []).filter((n) => !n.read).length +
    (isBusiness ? (hospNotifs || []).filter((n) => !n.read).length : 0);
  const menuRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Auth can briefly restore without a profile while ProtectedRoute is
  // still deciding; render nothing rather than crash (same contract the
  // old Layout had).
  const profile = user?.profile || { full_name: '', avatar_url: null };
  const ready = Boolean(user?.profile);

  const sections = [...NAV_SECTIONS, ...roleSections({ isAdmin, isBusiness, isDoctor })];

  // Close the avatar menu on navigation
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  // Close the avatar dropdown on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [menuOpen]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  if (!ready) return null;

  return (
    <div className="min-h-screen bg-pale">
      {/* ---------- Desktop sidebar (>= lg) ---------- */}
      <aside
        className={classNames(
          'fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-line bg-white transition-[width] duration-200 md:flex',
          collapsed ? 'w-[72px]' : 'w-64'
        )}
      >
        <SidebarContent sections={sections} collapsed={collapsed} />
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="absolute -right-3 top-20 z-10 hidden h-6 w-6 items-center justify-center rounded-full border border-line bg-white text-muted shadow-sm transition-colors hover:text-cream lg:flex"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
          ) : (
            <PanelLeftClose className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
          )}
        </button>
      </aside>

      {/* ---------- Content column ---------- */}
      <div className={classNames('flex min-h-screen flex-col transition-[padding] duration-200',
        collapsed ? 'md:pl-[72px]' : 'md:pl-64')}>
        {/* Topbar */}
        <header className="sticky top-0 z-20 border-b border-line bg-white/95 backdrop-blur">
          <div className="flex h-16 items-center gap-3 px-4 md:px-6">
            {/* Mobile: compact brand (navigation lives in the bottom tab bar) */}
            <span className="md:hidden">
              <BrandMark />
            </span>

            {/* Desktop context title */}
            <p className="hidden truncate text-sm font-medium text-muted md:block">
              {APP_NAME} — blood donation &amp; matching
            </p>

            <div className="ml-auto flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => navigate('/notifications')}
                className="relative rounded-[10px] p-2 text-muted transition-colors hover:bg-pale hover:text-cream"
                aria-label="Notifications"
              >
                <Bell className="h-5 w-5" strokeWidth={1.9} aria-hidden="true" />
                {/* v6.10: unread count for every role (user + hospital inbox) */}
                {unreadNotifs > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold px-1 text-[10px] font-bold leading-none text-white">
                    {unreadNotifs > 9 ? '9+' : unreadNotifs}
                  </span>
                )}
              </button>

              {/* Profile dropdown */}
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-[10px] border border-line bg-white py-1.5 pl-1.5 pr-2 transition-colors hover:bg-pale"
                  onClick={() => setMenuOpen((v) => !v)}
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                >
                  <Avatar name={profile.full_name} src={profile.avatar_url} size="sm" />
                  <span className="hidden max-w-[140px] truncate text-sm font-medium text-cream sm:block">
                    {profile.full_name}
                  </span>
                  {isAdmin && <StatusBadge status="verified" label="Admin" />}
                </button>
                {menuOpen && (
                  <div className="card absolute right-0 z-30 mt-2 w-44 py-1" role="menu">
                    <button
                      type="button"
                      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-cream transition-colors hover:bg-pale"
                      onClick={() => navigate('/profile')}
                    >
                      <User className="h-4 w-4 text-muted" strokeWidth={1.9} aria-hidden="true" />
                      My profile
                    </button>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2.5 border-t border-line px-4 py-2.5 text-left text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
                      onClick={handleLogout}
                    >
                      <LogOut className="h-4 w-4" strokeWidth={1.9} aria-hidden="true" />
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Main — route children passed as props, or the matched
            child route's Outlet (nested admin routes use this). */}
        {/* pb-28 clears the fixed bottom tab bar on phones */}
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-6 md:px-6 md:py-8 md:pb-8">
          {children || <Outlet />}
        </main>

        {/* Footer */}
        <footer className="border-t border-line bg-white">
          <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-2 px-4 pb-20 pt-5 md:flex-row md:items-center md:px-6 md:pb-5">
            <p className="text-sm font-semibold text-cream">{APP_NAME} — Academic Project · 2026</p>
            <p className="text-xs text-muted">Built with React + Vite · Supabase (Phase 2) · PostgreSQL</p>
          </div>
        </footer>
      </div>

      {/* Mobile bottom navigation (< md) */}
      <BottomTabBar isAdmin={isAdmin} isBusiness={isBusiness} isDoctor={isDoctor} />
    </div>
  );
}

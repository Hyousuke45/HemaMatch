import { NavLink, Outlet } from 'react-router-dom';
import { classNames } from '../lib/utils';

// Admin sub-navigation. The primary navigation (sidebar) already shows
// the Administration section; these tabs switch between the admin
// sub-pages. Mounted inside AdminRoute + SidebarLayout, so only
// administrators ever render this component.
// Mobile: tabs scroll horizontally instead of wrapping (no confusion).
const TABS = [
  { to: '/admin', label: 'Overview', end: true },
  { to: '/admin/requests', label: 'Requests' },
  { to: '/admin/records', label: 'Outcome records' },
  { to: '/admin/users', label: 'Users' },
  { to: '/admin/hospitals', label: 'Hospitals' },
  { to: '/admin/logs', label: 'Activity log' }
];

export default function AdminLayout() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-cream">Administration</h1>
        <p className="mt-1 text-sm text-muted">
          Restricted area — actions here are recorded in the activity log.
        </p>
      </div>

      <nav className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0" aria-label="Admin sections">
        <div className="flex min-w-max gap-1 border-b border-line md:min-w-0 md:flex-wrap">
          {TABS.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                classNames(
                  '-mb-px whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition-colors',
                  isActive
                    ? 'border-gold text-gold'
                    : 'border-transparent text-muted hover:border-line hover:text-cream'
                )
              }
            >
              {t.label}
            </NavLink>
          ))}
        </div>
      </nav>

      <Outlet />
    </div>
  );
}

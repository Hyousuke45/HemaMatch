import { NavLink, Outlet } from 'react-router-dom';
import { classNames } from '../lib/utils';

// Shared admin shell with the sub-navigation. Mounted inside AdminRoute,
// so only administrators ever render this component.
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
        <h1 className="text-2xl font-bold text-cream">Administration</h1>
        <p className="mt-1 text-sm text-cream/65">
          Restricted area — actions here are recorded in the activity log.
        </p>
      </div>

      <nav className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0" aria-label="Admin sections">
        <div className="flex min-w-max gap-1 border-b border-cream/15 md:min-w-0 md:flex-wrap">
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
                    : 'border-transparent text-cream/55 hover:border-cream/30 hover:text-cream'
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

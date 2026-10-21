import { NavLink, Outlet } from 'react-router-dom';
import { classNames } from '../lib/utils';

// Shared admin shell with the sub-navigation. Mounted inside AdminRoute,
// so only administrators ever render this component.
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
        <h1 className="text-2xl font-bold text-gray-900">Administration</h1>
        <p className="mt-1 text-sm text-gray-500">
          Restricted area — actions here are recorded in the activity log.
        </p>
      </div>

      <nav className="flex flex-wrap gap-1 border-b border-gray-200" aria-label="Admin sections">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) =>
              classNames(
                '-mb-px border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'border-red-600 text-red-700'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-800'
              )
            }
          >
            {t.label}
          </NavLink>
        ))}
      </nav>

      <Outlet />
    </div>
  );
}

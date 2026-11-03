import { NavLink } from 'react-router-dom';
import { classNames } from '../lib/utils';

// Segmented control linking the two browse views:
//   /requests — blood requests (people who NEED blood)
//   /donors   — available donors (people who OFFER to donate)
// Kept as one component so both pages stay perfectly in sync.
export default function BrowseTabs() {
  const tabClass = ({ isActive }) =>
    classNames(
      'inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors sm:flex-none',
      isActive ? 'bg-gold text-night' : 'border border-cream/15 text-cream/70 hover:bg-cream/10 hover:text-cream'
    );

  return (
    <div className="flex gap-2 sm:inline-flex" role="tablist" aria-label="Browse">
      <NavLink to="/requests" className={tabClass} role="tab">
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 2C12 2 5 10.3 5 15a7 7 0 0 0 14 0C19 10.3 12 2 12 2Z" />
        </svg>
        Blood requests
      </NavLink>
      <NavLink to="/donors" className={tabClass} role="tab">
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 21s-7-4.5-7-10a4 4 0 017-2.6A4 4 0 0119 11c0 5.5-7 10-7 10zM12 8v6m-3-3h6"
          />
        </svg>
        Available donors
      </NavLink>
    </div>
  );
}

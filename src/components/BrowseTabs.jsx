import { NavLink } from 'react-router-dom';
import { classNames } from '../lib/utils';
import { Droplet, HeartHandshake } from 'lucide-react';

// Segmented control linking the two browse views:
//   /requests — blood requests (people who NEED blood)
//   /donors   — available donors (people who OFFER to donate)
// Kept as one component so both pages stay perfectly in sync.
export default function BrowseTabs() {
  const tabClass = ({ isActive }) =>
    classNames(
      'inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors sm:flex-none',
      isActive ? 'bg-gold text-night' : 'border border-line text-cream/70 hover:bg-pale hover:text-cream'
    );

  return (
    <div className="flex gap-2 sm:inline-flex" role="tablist" aria-label="Browse">
      <NavLink to="/requests" className={tabClass} role="tab">
        <Droplet className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
        Blood requests
      </NavLink>
      <NavLink to="/donors" className={tabClass} role="tab">
        <HeartHandshake className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
        Available donors
      </NavLink>
    </div>
  );
}

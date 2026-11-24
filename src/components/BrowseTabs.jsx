import { NavLink } from 'react-router-dom';
import { classNames } from '../lib/utils';
import { Droplet, HeartHandshake } from 'lucide-react';

// Segmented control linking the two browse views:
//   /requests — blood requests (people who NEED blood)
//   /donors   — available donors (people who OFFER to donate)
// Kept as one component so both pages stay perfectly in sync.
//
// v6.4: the two buttons are equal-size cells of one grid (never flex with
// intrinsic widths) and take a fixed min height — so the button size is
// IDENTICAL on both pages and in both states (active/inactive), no matter
// how long the label or which tab is selected. Equal widths matter
// especially on mobile where the labels wrap inside the pill.
export default function BrowseTabs() {
  const tabClass = ({ isActive }) =>
    classNames(
      'flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold leading-snug transition-colors',
      isActive ? 'bg-gold text-night' : 'border border-line text-cream/70 hover:bg-pale hover:text-cream'
    );

  return (
    <div className="grid grid-cols-2 gap-2 sm:max-w-md" role="tablist" aria-label="Browse">
      <NavLink to="/requests" className={tabClass} role="tab">
        <Droplet className="h-4 w-4 shrink-0" strokeWidth={2.2} aria-hidden="true" />
        Blood requests
      </NavLink>
      <NavLink to="/donors" className={tabClass} role="tab">
        <HeartHandshake className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />
        Available donors
      </NavLink>
    </div>
  );
}

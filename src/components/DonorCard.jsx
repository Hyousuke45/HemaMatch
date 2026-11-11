import { Avatar, BloodTypeBadge } from './ui';
import { formatDate } from '../lib/utils';

// A potential donor card — used in TWO places:
//   1. Matching results on the request detail page (has onViewProfile:
//      the v3 public profile sheet opens from there — client scope).
//   2. The "Available donors" directory (no onViewProfile, per the
//      client's rule that profile views exist only on request pages).
// Only directory-safe information is displayed: name, blood type,
// general location, availability, optional listing note. Never email
// or contact details — communication happens only through messaging.
export default function DonorCard({ donor, onMessage, onViewProfile, messageLabel = 'Message donor' }) {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-3">
        <Avatar name={donor.full_name} src={donor.avatar_url} size="lg" />
        <div className="min-w-0">
          <p className="truncate font-semibold text-cream">{donor.full_name}</p>
          <p className="text-xs text-cream/65">
            {donor.city ? `${donor.city} · ` : ''}
            {donor.region || 'Region not set'}
          </p>
          {donor.member_since && (
            <p className="mt-0.5 text-[11px] text-cream/40">Member since {formatDate(donor.member_since)}</p>
          )}
        </div>
        <div className="ml-auto">
          <BloodTypeBadge type={donor.blood_type} />
        </div>
      </div>

      {donor.note && (
        <p className="mt-3 rounded-xl border border-cream/10 bg-ink p-3 text-sm leading-relaxed text-cream/80">
          {donor.note}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-cream/10 pt-3">
        <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-300">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          Available to donate
        </span>
        {donor.same_region && (
          <span className="rounded-full bg-gold/10 px-2 py-0.5 text-xs font-semibold text-gold-light">
            Same region
          </span>
        )}
        {donor.preferred_type && (
          <span className="rounded-full bg-gold/15 px-2 py-0.5 text-xs font-semibold text-gold-light">
            Preferred type
          </span>
        )}
      </div>

      {(onMessage || onViewProfile) && (
        <div className={`mt-3 flex gap-2 ${onViewProfile ? '' : ''}`}>
          {onViewProfile && (
            <button type="button" className="btn-secondary flex-1" onClick={() => onViewProfile(donor)}>
              View profile
            </button>
          )}
          {onMessage && (
            <button
              type="button"
              className={onViewProfile ? 'btn-primary flex-1' : 'btn-primary w-full'}
              onClick={() => onMessage(donor)}
            >
              {messageLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

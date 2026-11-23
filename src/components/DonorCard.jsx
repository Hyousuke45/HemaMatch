import { Avatar, BloodTypeBadge } from './ui';
import { formatDate } from '../lib/utils';
import { MapPin, Calendar, Check, MessageCircle, User as UserIcon, BadgeCheck } from 'lucide-react';

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
          <p className="flex items-center gap-1 text-xs text-muted">
            <MapPin className="h-3.5 w-3.5 shrink-0" strokeWidth={1.9} aria-hidden="true" />
            {donor.city ? `${donor.city} · ` : ''}
            {donor.region || 'Region not set'}
          </p>
          {donor.member_since && (
            <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted">
              <Calendar className="h-3 w-3 shrink-0" strokeWidth={1.9} aria-hidden="true" />
              Member since {formatDate(donor.member_since)}
            </p>
          )}
        </div>
        <div className="ml-auto">
          <BloodTypeBadge type={donor.blood_type} />
        </div>
      </div>

      {donor.note && (
        <p className="mt-3 rounded-[10px] border border-line bg-pale p-3 text-sm leading-relaxed text-cream/80">
          {donor.note}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
        <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
          <Check className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden="true" />
          Available to donate
        </span>
        {donor.same_region && (
          <span className="inline-flex items-center gap-1 rounded-full bg-gold/10 px-2 py-0.5 text-xs font-semibold text-gold">
            <MapPin className="h-3 w-3" strokeWidth={2.2} aria-hidden="true" />
            Same region
          </span>
        )}
        {donor.preferred_type && (
          <span className="inline-flex items-center gap-1 rounded-full bg-blood px-2 py-0.5 text-xs font-semibold text-gold">
            <BadgeCheck className="h-3 w-3" strokeWidth={2.2} aria-hidden="true" />
            Compatible type
          </span>
        )}
      </div>

      {(onMessage || onViewProfile) && (
        <div className="mt-3 flex gap-2">
          {onViewProfile && (
            <button type="button" className="btn-secondary flex-1" onClick={() => onViewProfile(donor)}>
              <UserIcon className="h-4 w-4" strokeWidth={1.9} aria-hidden="true" />
              View profile
            </button>
          )}
          {onMessage && (
            <button
              type="button"
              className={onViewProfile ? 'btn-primary flex-1' : 'btn-primary w-full'}
              onClick={() => onMessage(donor)}
            >
              <MessageCircle className="h-4 w-4" strokeWidth={1.9} aria-hidden="true" />
              {messageLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

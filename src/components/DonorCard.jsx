import { Avatar, BloodTypeBadge } from './ui';

// A potential donor shown in the matching results.
// Only directory-safe information is displayed: name, blood type,
// general location, availability. Never email or contact details —
// communication happens only through the in-app messaging.
export default function DonorCard({ donor, sameRegionFirst, onMessage }) {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-3">
        <Avatar name={donor.full_name} size="lg" />
        <div className="min-w-0">
          <p className="truncate font-semibold text-gray-900">{donor.full_name}</p>
          <p className="text-xs text-gray-500">
            {donor.city ? `${donor.city} · ` : ''}
            {donor.region || 'Region not set'}
          </p>
        </div>
        <div className="ml-auto">
          <BloodTypeBadge type={donor.blood_type} />
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 border-t border-gray-100 pt-3">
        <span className="flex items-center gap-1.5 text-xs font-medium text-green-700">
          <span className="h-2 w-2 rounded-full bg-green-500" />
          Available to donate
        </span>
        {donor.same_region && (
          <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">
            Same region
          </span>
        )}
      </div>

      <button type="button" className="btn-primary mt-3 w-full" onClick={() => onMessage(donor)}>
        Message donor
      </button>
    </div>
  );
}

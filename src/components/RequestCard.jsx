import { Link } from 'react-router-dom';
import { BloodTypeBadge, StatusBadge } from './ui';
import { formatDate } from '../lib/utils';
import { URGENCY } from '../lib/constants';
import { MapPin, Building2 } from 'lucide-react';

// Compact card for a donation request, used on the browse page and dashboard.
export default function RequestCard({ request }) {
  return (
    <Link
      to={`/requests/${request.id}`}
      className="card block p-5 transition-colors hover:border-gold/40 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <BloodTypeBadge type={request.blood_type} size="lg" />
          <div>
            <p className="text-sm font-semibold text-cream">
              {request.units_needed} {request.units_needed === 1 ? 'unit' : 'units'} needed
            </p>
            <p className="flex items-center gap-1 text-xs text-muted">
              <MapPin className="h-3.5 w-3.5 shrink-0" strokeWidth={1.9} aria-hidden="true" />
              {request.region}
            </p>
          </div>
        </div>
        <StatusBadge status={request.status} />
      </div>

      <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-muted">
        {request.description || 'No additional details provided.'}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3">
        <StatusBadge status={request.urgency} label={URGENCY[request.urgency]} />
        {request.hospital_name && (
          <span className="flex min-w-0 items-center gap-1 text-xs text-muted">
            <Building2 className="h-3.5 w-3.5 shrink-0" strokeWidth={1.9} aria-hidden="true" />
            <span className="truncate">{request.hospital_name}</span>
          </span>
        )}
        <span className="ml-auto text-xs text-muted">
          by {request.requester_name} · {formatDate(request.created_at)}
        </span>
      </div>
    </Link>
  );
}

import useAsync from '../hooks/useAsync';
import dataService from '../lib/dataService';
import { Avatar, BloodTypeBadge, ErrorState, InlineLoader, StatusBadge } from './ui';
import { formatDate } from '../lib/utils';
import { X } from 'lucide-react';

// ============================================================
// PUBLIC PROFILE SHEET — v3 client requirement.
// A directory-safe profile of another user, reachable ONLY from the
// blood-donation-request detail page (the requester, or one of the
// matched donors). It is deliberately NOT a standalone public page.
//
// Privacy: the backend (get_public_profile RPC / mock equivalent)
// returns only directory-safe fields — name, blood type, general
// location, availability, photo, member-since and the count of
// successful donations. Email, role and contact details are never
// included; communication happens only through in-app messaging.
//
// Mobile: docks to the bottom (thumb-friendly bottom sheet);
// desktop: centered dialog — same pattern as ConfirmDialog.
// ============================================================
export default function PublicProfileSheet({ userId, onClose, onMessage, messageLabel = 'Message' }) {
  const { data: profile, loading, error } = useAsync(
    () => dataService.getPublicProfile(userId),
    [userId]
  );

  if (!userId) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-cream/40 backdrop-blur-[2px] sm:items-center sm:px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Profile"
    >
      {/* tapping the backdrop closes the sheet */}
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close" onClick={onClose} />

      <div className="card relative max-h-[85vh] w-full max-w-md overflow-y-auto rounded-b-none p-6 pb-safe sm:rounded-b-2xl">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-pale sm:hidden" aria-hidden="true" />
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-xl text-muted transition-colors hover:bg-pale hover:text-cream"
          aria-label="Close profile"
        >
          <X className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
        </button>

        {loading && <InlineLoader label="Loading profile…" />}
        {!loading && error && <ErrorState message={error} />}

        {!loading && !error && profile && (
          <div className="flex flex-col gap-5">
            {/* Identity */}
            <div className="flex items-center gap-4">
              <Avatar name={profile.full_name} src={profile.avatar_url} size="xl" />
              <div className="min-w-0">
                <p className="truncate text-lg font-bold text-cream">{profile.full_name}</p>
                <p className="mt-0.5 text-sm text-muted">
                  Member since {formatDate(profile.created_at)}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {profile.blood_type ? (
                    <BloodTypeBadge type={profile.blood_type} />
                  ) : (
                    <span className="text-xs text-muted">Blood type not set</span>
                  )}
                  {profile.is_available ? (
                    <StatusBadge status="accepted" label="Available to donate" />
                  ) : (
                    <StatusBadge status="cancelled" label="Currently unavailable" />
                  )}
                </div>
                {/* v4: doctor context — a doctor's hospital affiliation is
                    public directory information */}
                {profile.is_doctor && (
                  <p className="mt-2 text-sm font-medium text-sky-700">
                    Doctor{profile.specialization ? ` · ${profile.specialization}` : ''}
                    {profile.doctor_hospital_name ? ` · ${profile.doctor_hospital_name}` : ''}
                  </p>
                )}
              </div>
            </div>

            {/* Directory-safe details */}
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-line pt-4 text-sm">
              <div>
                <dt className="text-muted">Region</dt>
                <dd className="mt-0.5 font-medium text-cream">{profile.region || 'Not set'}</dd>
              </div>
              <div>
                <dt className="text-muted">City / municipality</dt>
                <dd className="mt-0.5 font-medium text-cream">{profile.city || 'Not set'}</dd>
              </div>
              <div>
                <dt className="text-muted">Successful donations</dt>
                <dd className="mt-0.5 font-medium text-cream">
                  {profile.successful_donations}
                  {profile.successful_donations === 1 ? ' recorded donation' : ' recorded donations'}
                </dd>
              </div>
            </dl>

            {/* Open listing note (if the person is a listed donor) */}
            {profile.offer_note && (
              <div className="card-well p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Donor listing note
                </p>
                <p className="mt-1 text-sm leading-relaxed text-cream/85">{profile.offer_note}</p>
              </div>
            )}

            {onMessage && (
              <button type="button" className="btn-primary w-full" onClick={() => onMessage(profile)}>
                {messageLabel}
              </button>
            )}

            <p className="text-xs leading-relaxed text-muted">
              For privacy, only directory-safe information is shown — never an email address.
              All coordination happens through HemaMatch private messaging, and every donation
              still requires standard screening by qualified healthcare professionals.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

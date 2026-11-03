import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import useAsync from '../hooks/useAsync';
import dataService from '../lib/dataService';
import { Alert, BloodTypeBadge, InlineLoader, StatusBadge } from '../components/ui';
import { formatDate } from '../lib/utils';
import { DONATION_LAW_NOTE, OFFER_NOTE_MAX, OFFER_STATUS } from '../lib/constants';

// ============================================================
// DONATE BLOOD (v3 — the "donate" side of HemaMatch)
// Anyone can volunteer to donate — not just request. A donor listing
// is one voluntary entry per user:
//   OPEN   -> shown in the "Available donors" directory AND included
//             in request matching (preliminary ABO filter)
//   PAUSED -> hidden from both until reopened
// The backend keeps profiles.is_available in sync with the listing
// (mock logic here / SQL trigger + RPC in Phase 2), so "listed" has
// exactly one meaning everywhere in the app.
//
// LEGAL COMPLIANCE (important for the defense): donation on
// HemaMatch is strictly voluntary and non-remunerated. RA 7719
// (National Blood Services Act of 1994) prohibits the commercial
// sale of blood in the Philippines, so this page — and the app —
// deliberately contains no selling or pricing of any kind.
// ============================================================
export default function Donate() {
  const { user, refreshUser } = useAuth();
  const p = user.profile;

  const { data: offer, loading, error, reload } = useAsync(() => dataService.getMyOffer(), []);

  const [note, setNote] = useState('');
  const [status, setStatus] = useState('open');
  const [feedback, setFeedback] = useState(null); // { tone, message }
  const [busy, setBusy] = useState(false);

  // Load my existing listing into the form once
  useEffect(() => {
    if (offer) {
      setNote(offer.note || '');
      setStatus(offer.status || 'open');
    }
  }, [offer]);

  const profileReady = Boolean(p.blood_type && p.region);

  const handleSave = async (nextStatus) => {
    setFeedback(null);
    setBusy(true);
    try {
      await dataService.upsertMyOffer({ note: note.trim(), status: nextStatus });
      setStatus(nextStatus);
      await refreshUser(); // availability may have changed with the listing
      await reload();
      setFeedback({
        tone: 'success',
        message:
          nextStatus === 'open'
            ? 'You are now listed as an available donor. Requesters can find you in the donor directory and in their matching results.'
            : 'Your donor listing is paused. You are hidden from the directory and matching results until you reopen it.'
      });
    } catch (err) {
      setFeedback({ tone: 'error', message: err?.message || 'Could not save your donor listing.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-cream">Donate blood</h1>
        <p className="mt-1 text-sm leading-relaxed text-cream/65">
          Volunteer as a blood donor so requesters nearby can find and message you. Listing
          yourself is not a commitment — you decide per request, and every donation still goes
          through standard screening by qualified healthcare professionals.
        </p>
      </div>

      {/* Voluntary, non-remunerated — RA 7719 */}
      <Alert tone="warning" title="Voluntary donation only — never for sale">
        {DONATION_LAW_NOTE}
      </Alert>

      {/* My donor profile readiness */}
      <section className="card p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {p.blood_type ? (
              <BloodTypeBadge type={p.blood_type} size="lg" />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-ink text-xs font-bold text-cream/45">
                N/A
              </div>
            )}
            <div>
              <p className="font-semibold text-cream">My donor profile</p>
              <p className="text-sm text-cream/65">
                {p.region || 'Region not set'}
                {p.city ? ` · ${p.city}` : ''}
              </p>
            </div>
          </div>
          <Link to="/profile" className="btn-secondary">
            {profileReady ? 'Edit profile' : 'Complete profile'}
          </Link>
        </div>
        {!profileReady && (
          <p className="mt-3 text-sm text-amber-300">
            Add your blood type and region to your profile first — they are required so the
            ABO/Rh preliminary filter and region ranking can place you correctly.
          </p>
        )}
      </section>

      {/* Listing editor */}
      <section className="card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold text-cream">My donor listing</h2>
          {offer && (
            <StatusBadge
              status={offer.status === 'open' ? 'accepted' : 'routine'}
              label={offer.status === 'open' ? OFFER_STATUS.open : OFFER_STATUS.paused}
            />
          )}
        </div>
        {offer && (
          <p className="mt-1 text-xs text-cream/45">
            Created {formatDate(offer.created_at)} · last updated {formatDate(offer.updated_at)}
          </p>
        )}

        {loading ? (
          <InlineLoader label="Loading your listing…" />
        ) : error ? (
          <Alert tone="error">{error}</Alert>
        ) : (
          <>
            <div className="mt-4">
              <label className="label" htmlFor="offer-note">
                Listing note (optional)
              </label>
              <textarea
                id="offer-note"
                className="input min-h-[88px]"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. I usually donate on weekends in Quezon City. Message me anytime."
                maxLength={OFFER_NOTE_MAX}
              />
              <p className="mt-1 text-xs text-cream/45">
                {note.length}/{OFFER_NOTE_MAX} characters · shown on your donor listing
              </p>
            </div>

            <div className="mt-4 card-well p-4 text-sm leading-relaxed text-cream/75">
              <p className="font-semibold text-cream">What listing yourself means</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>
                  <span className="font-medium text-cream">Open:</span> you appear in the
                  Available donors directory and in requesters&rsquo; preliminary matching
                  results (ABO/Rh compatible, same-region first).
                </li>
                <li>
                  <span className="font-medium text-cream">Paused:</span> you are hidden from
                  both until you reopen. Nothing is deleted.
                </li>
                <li>
                  Your availability toggle on the profile page and this listing always stay
                  in sync — pausing one pauses the other.
                </li>
              </ul>
            </div>

            {feedback && (
              <div className="mt-4">
                <Alert tone={feedback.tone}>{feedback.message}</Alert>
              </div>
            )}

            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
              {offer?.status === 'open' ? (
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={busy || !profileReady}
                  onClick={() => handleSave('paused')}
                >
                  {busy ? 'Saving…' : 'Pause listing'}
                </button>
              ) : null}
              <button
                type="button"
                className="btn-primary"
                disabled={busy || !profileReady}
                onClick={() => handleSave('open')}
              >
                {busy
                  ? 'Saving…'
                  : offer
                    ? offer.status === 'open'
                      ? 'Save listing'
                      : 'Reopen listing'
                    : 'List me as an available donor'}
              </button>
            </div>
            {!profileReady && (
              <p className="mt-2 text-right text-xs text-cream/45">
                Complete your profile to enable listing.
              </p>
            )}
          </>
        )}
      </section>

      <p className="text-xs leading-relaxed text-cream/45">
        Every listing change is written to the administrator activity log. Matching is a
        preliminary filter only — actual compatibility and donor screening are always decided
        by qualified healthcare professionals.
      </p>
    </div>
  );
}

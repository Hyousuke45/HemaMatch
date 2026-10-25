// Small reusable UI atoms — status badges, alerts, loaders, empty/error
// states, stat cards, avatar, and a confirm dialog for important actions.
// HemaMatch dark theme: translucent semantic badges tuned for #430102 cards.
import { useState } from 'react';
import { classNames, formatDate, formatDateTime } from '../lib/utils';

// ---------- Spinner / loaders ----------
export function Spinner({ className = 'h-5 w-5' }) {
  return (
    <svg className={classNames('animate-spin text-gold', className)} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-90"
        fill="currentColor"
        d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z"
      />
    </svg>
  );
}

export function InlineLoader({ label = 'Loading…' }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-cream/60">
      <Spinner className="h-4 w-4" /> {label}
    </div>
  );
}

export function PageLoader() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
      <Spinner className="h-8 w-8" />
      <p className="text-sm text-cream/60">Loading…</p>
    </div>
  );
}

// ---------- Alert (inline feedback: info / success / error / warning) ----------
const ALERT_TONES = {
  info: 'border-sky-400/30 bg-sky-400/10 text-sky-200',
  success: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200',
  error: 'border-red-400/30 bg-red-400/10 text-red-200',
  warning: 'border-amber-400/30 bg-amber-400/10 text-amber-200'
};

export function Alert({ tone = 'info', title, children }) {
  return (
    <div className={classNames('rounded-xl border px-4 py-3 text-sm', ALERT_TONES[tone])} role="alert">
      {title && <p className="mb-0.5 font-semibold">{title}</p>}
      <div className="leading-relaxed">{children}</div>
    </div>
  );
}

// ---------- Empty / error states ----------
export function EmptyState({ title, message, action }) {
  return (
    <div className="card flex flex-col items-center gap-2 px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-cream/10 bg-ink">
        <svg className="h-6 w-6 text-cream/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m-4.5-6.75v6.75M9 3.75h6a.75.75 0 01.75.75v3H8.25v-3A.75.75 0 019 3.75z"
          />
        </svg>
      </div>
      <p className="mt-1 font-semibold text-cream">{title}</p>
      {message && <p className="max-w-md text-sm text-cream/65">{message}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function ErrorState({ message = 'Something went wrong.', onRetry }) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-400/15">
        <svg className="h-6 w-6 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
          />
        </svg>
      </div>
      <p className="font-semibold text-cream">Error</p>
      <p className="max-w-md text-sm text-cream/65">{message}</p>
      {onRetry && (
        <button type="button" className="btn-secondary" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

// ---------- Status / type badges (translucent on dark surfaces) ----------
const BADGE_STYLES = {
  pending: 'bg-amber-400/15 text-amber-300 border-amber-400/30',
  accepted: 'bg-sky-400/15 text-sky-300 border-sky-400/30',
  completed: 'bg-emerald-400/15 text-emerald-300 border-emerald-400/30',
  cancelled: 'bg-cream/10 text-cream/60 border-cream/15',
  verified: 'bg-emerald-400/15 text-emerald-300 border-emerald-400/30',
  rejected: 'bg-red-400/15 text-red-300 border-red-400/30',
  successful: 'bg-emerald-400/15 text-emerald-300 border-emerald-400/30',
  failed: 'bg-red-400/15 text-red-300 border-red-400/30',
  critical: 'bg-red-400/15 text-red-300 border-red-400/30',
  urgent: 'bg-amber-400/15 text-amber-300 border-amber-400/30',
  routine: 'bg-cream/10 text-cream/60 border-cream/15'
};

const BADGE_LABELS = {
  pending: 'Pending',
  accepted: 'Accepted',
  completed: 'Completed',
  cancelled: 'Cancelled',
  verified: 'Verified',
  rejected: 'Rejected',
  successful: 'Successful',
  failed: 'Failed',
  critical: 'Critical',
  urgent: 'Urgent',
  routine: 'Routine'
};

export function StatusBadge({ status, label }) {
  const style = BADGE_STYLES[status] || BADGE_STYLES.routine;
  return (
    <span
      className={classNames(
        'inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold',
        style
      )}
    >
      {label || BADGE_LABELS[status] || status}
    </span>
  );
}

export function BloodTypeBadge({ type, size = 'sm' }) {
  const sizes = {
    sm: 'px-2.5 py-0.5 text-xs',
    lg: 'px-4 py-1.5 text-lg'
  };
  return (
    <span
      className={classNames(
        'inline-flex shrink-0 items-center rounded-lg border border-red-400/40 bg-red-700 font-bold text-cream shadow-sm shadow-red-950/60',
        sizes[size] || sizes.sm
      )}
    >
      {type}
    </span>
  );
}

// ---------- Admin dashboard stat card ----------
export function StatCard({ label, value, hint, tone = 'default' }) {
  const tones = {
    default: 'text-cream',
    red: 'text-gold-light',
    amber: 'text-amber-300',
    green: 'text-emerald-300',
    sky: 'text-sky-300',
    gray: 'text-cream/50'
  };
  return (
    <div className="card p-5">
      <p className="text-sm font-medium text-cream/55">{label}</p>
      <p className={classNames('mt-1 text-3xl font-bold', tones[tone])}>{value}</p>
      {hint && <p className="mt-1 text-xs text-cream/40">{hint}</p>}
    </div>
  );
}

// ---------- Avatar (initials) ----------
const AVATAR_COLORS = [
  { bg: 'bg-red-800', fg: 'text-cream' },
  { bg: 'bg-gold', fg: 'text-night' },
  { bg: 'bg-amber-700', fg: 'text-cream' },
  { bg: 'bg-emerald-800', fg: 'text-cream' },
  { bg: 'bg-teal-800', fg: 'text-cream' },
  { bg: 'bg-stone-700', fg: 'text-cream' }
];

export function Avatar({ name, size = 'md' }) {
  const initials = String(name || '?')
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
  let hash = 0;
  for (const ch of String(name || '')) hash = (hash * 31 + ch.charCodeAt(0)) % 997;
  const color = AVATAR_COLORS[hash % AVATAR_COLORS.length];
  const sizes = { sm: 'h-7 w-7 text-[10px]', md: 'h-9 w-9 text-xs', lg: 'h-12 w-12 text-sm' };
  return (
    <span
      className={classNames(
        'inline-flex shrink-0 items-center justify-center rounded-full font-bold',
        color.bg,
        color.fg,
        sizes[size] || sizes.md
      )}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}

// ---------- Confirm dialog (for destructive / important actions) ----------
// Pass requireReason=true when the action must be justified (e.g. rejecting
// a hospital, admin status corrections). The reason travels into the audit log.
// On phones the dialog docks to the bottom (thumb-friendly bottom sheet).
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  danger = false,
  requireReason = false,
  reasonPlaceholder = 'Reason (recorded in the activity log)',
  onConfirm,
  onClose
}) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  if (!open) return null;

  const handleConfirm = async () => {
    if (requireReason && !reason.trim()) {
      setErr('Please provide a reason.');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await onConfirm(reason.trim());
      setReason('');
      onClose();
    } catch (e) {
      setErr(e?.message || 'Action failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center sm:px-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="card max-h-[85vh] w-full max-w-md overflow-y-auto rounded-b-none p-6 pb-safe sm:rounded-b-2xl">
        <h3 className="text-lg font-semibold text-cream">{title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-cream/75">{message}</p>
        {requireReason && (
          <div className="mt-4">
            <label className="label" htmlFor="confirm-reason">
              Reason <span className="text-gold">*</span>
            </label>
            <textarea
              id="confirm-reason"
              className="input min-h-[72px]"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={reasonPlaceholder}
              maxLength={300}
            />
          </div>
        )}
        {err && (
          <p className="mt-3 text-sm font-medium text-red-400" role="alert">
            {err}
          </p>
        )}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className={danger ? 'btn-danger' : 'btn-primary'}
            onClick={handleConfirm}
            disabled={busy}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export { formatDate, formatDateTime };

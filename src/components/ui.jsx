// Small reusable UI atoms — status badges, alerts, loaders, empty/error
// states, stat cards, avatar, and a confirm dialog for important actions.
import { useState } from 'react';
import { classNames, formatDate, formatDateTime } from '../lib/utils';

// ---------- Spinner / loaders ----------
export function Spinner({ className = 'h-5 w-5' }) {
  return (
    <svg className={classNames('animate-spin text-red-600', className)} viewBox="0 0 24 24" fill="none">
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
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-500">
      <Spinner className="h-4 w-4" /> {label}
    </div>
  );
}

export function PageLoader() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
      <Spinner className="h-8 w-8" />
      <p className="text-sm text-gray-500">Loading…</p>
    </div>
  );
}

// ---------- Alert (inline feedback: info / success / error / warning) ----------
const ALERT_TONES = {
  info: 'border-blue-200 bg-blue-50 text-blue-900',
  success: 'border-green-200 bg-green-50 text-green-900',
  error: 'border-red-200 bg-red-50 text-red-900',
  warning: 'border-amber-200 bg-amber-50 text-amber-900'
};

export function Alert({ tone = 'info', title, children }) {
  return (
    <div className={classNames('rounded-lg border px-4 py-3 text-sm', ALERT_TONES[tone])} role="alert">
      {title && <p className="mb-0.5 font-semibold">{title}</p>}
      <div className="leading-relaxed">{children}</div>
    </div>
  );
}

// ---------- Empty / error states ----------
export function EmptyState({ title, message, action }) {
  return (
    <div className="card flex flex-col items-center gap-2 px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
        <svg className="h-6 w-6 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m-4.5-6.75v6.75M9 3.75h6a.75.75 0 01.75.75v3H8.25v-3A.75.75 0 019 3.75z"
          />
        </svg>
      </div>
      <p className="mt-1 font-semibold text-gray-900">{title}</p>
      {message && <p className="max-w-md text-sm text-gray-500">{message}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function ErrorState({ message = 'Something went wrong.', onRetry }) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
        <svg className="h-6 w-6 text-red-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
          />
        </svg>
      </div>
      <p className="font-semibold text-gray-900">Error</p>
      <p className="max-w-md text-sm text-gray-500">{message}</p>
      {onRetry && (
        <button type="button" className="btn-secondary" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

// ---------- Status / type badges ----------
const BADGE_STYLES = {
  pending: 'bg-amber-100 text-amber-800 border-amber-200',
  accepted: 'bg-sky-100 text-sky-800 border-sky-200',
  completed: 'bg-green-100 text-green-800 border-green-200',
  cancelled: 'bg-gray-100 text-gray-600 border-gray-200',
  verified: 'bg-green-100 text-green-800 border-green-200',
  rejected: 'bg-red-100 text-red-700 border-red-200',
  successful: 'bg-green-100 text-green-800 border-green-200',
  failed: 'bg-red-100 text-red-700 border-red-200',
  critical: 'bg-red-100 text-red-700 border-red-200',
  urgent: 'bg-amber-100 text-amber-800 border-amber-200',
  routine: 'bg-gray-100 text-gray-600 border-gray-200'
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
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold',
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
        'inline-flex items-center rounded-lg bg-red-600 font-bold text-white',
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
    default: 'text-gray-900',
    red: 'text-red-600',
    amber: 'text-amber-600',
    green: 'text-green-600',
    sky: 'text-sky-700',
    gray: 'text-gray-500'
  };
  return (
    <div className="card p-5">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className={classNames('mt-1 text-3xl font-bold', tones[tone])}>{value}</p>
      {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

// ---------- Avatar (initials) ----------
const AVATAR_COLORS = ['bg-red-600', 'bg-rose-500', 'bg-amber-600', 'bg-emerald-600', 'bg-teal-600', 'bg-gray-600'];

export function Avatar({ name, size = 'md' }) {
  const initials = String(name || '?')
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
  let hash = 0;
  for (const ch of String(name || '')) hash = (hash * 31 + ch.charCodeAt(0)) % 997;
  const sizes = { sm: 'h-7 w-7 text-[10px]', md: 'h-9 w-9 text-xs', lg: 'h-12 w-12 text-sm' };
  return (
    <span
      className={classNames(
        'inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white',
        AVATAR_COLORS[hash % AVATAR_COLORS.length],
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" role="dialog" aria-modal="true">
      <div className="card w-full max-w-md p-6">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-gray-600">{message}</p>
        {requireReason && (
          <div className="mt-4">
            <label className="label" htmlFor="confirm-reason">
              Reason <span className="text-red-600">*</span>
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
          <p className="mt-3 text-sm font-medium text-red-600" role="alert">
            {err}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className={danger ? 'btn-primary' : 'btn-primary'}
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

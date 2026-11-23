// Small reusable UI atoms — status badges, alerts, loaders, empty/error
// states, stat cards, avatar, and a confirm dialog for important actions.
// HemaMatch light theme (v5, DentaBook-inspired): soft tinted badges on
// white cards, hairline borders, red accent.
import { useState } from 'react';
import { classNames, formatDate, formatDateTime } from '../lib/utils';
import { ArchiveX, CircleAlert, LoaderCircle } from 'lucide-react';

// ---------- Spinner / loaders ----------
export function Spinner({ className = 'h-5 w-5' }) {
  return (
    <LoaderCircle className={classNames('animate-spin text-gold', className)} strokeWidth={2.4} aria-hidden="true" />
  );
}

export function InlineLoader({ label = 'Loading…' }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted">
      <Spinner className="h-4 w-4" /> {label}
    </div>
  );
}

export function PageLoader() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
      <Spinner className="h-8 w-8" />
      <p className="text-sm text-muted">Loading…</p>
    </div>
  );
}

// ---------- Alert (inline feedback: info / success / error / warning) ----------
const ALERT_TONES = {
  info: 'border-sky-200 bg-sky-50 text-sky-900',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  error: 'border-red-200 bg-red-50 text-red-900',
  warning: 'border-amber-200 bg-amber-50 text-amber-900'
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
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-line bg-pale">
        <ArchiveX className="h-6 w-6 text-muted" strokeWidth={1.5} aria-hidden="true" />
      </div>
      <p className="mt-1 font-bold text-cream">{title}</p>
      {message && <p className="max-w-md text-sm text-muted">{message}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function ErrorState({ message = 'Something went wrong.', onRetry }) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
        <CircleAlert className="h-6 w-6 text-red-600" strokeWidth={1.5} aria-hidden="true" />
      </div>
      <p className="font-bold text-cream">Error</p>
      <p className="max-w-md text-sm text-muted">{message}</p>
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
  pending: 'bg-amber-50 text-amber-800 border-amber-200',
  accepted: 'bg-sky-50 text-sky-800 border-sky-200',
  completed: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  cancelled: 'bg-slate-50 text-slate-600 border-slate-200',
  verified: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  rejected: 'bg-red-50 text-red-800 border-red-200',
  successful: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  failed: 'bg-red-50 text-red-800 border-red-200',
  critical: 'bg-red-50 text-red-800 border-red-200',
  urgent: 'bg-amber-50 text-amber-800 border-amber-200',
  routine: 'bg-slate-50 text-slate-600 border-slate-200'
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
  // Blood types are the domain's most important signal — solid crimson
  // with white text makes them pop anywhere (spec §6), versus the quiet
  // soft-rose chips used for non-critical tints.
  const sizes = {
    sm: 'px-2.5 py-0.5 text-xs',
    lg: 'px-4 py-1.5 text-lg'
  };
  return (
    <span
      className={classNames(
        'inline-flex shrink-0 items-center rounded-lg bg-gold font-bold tracking-tight text-white shadow-sm',
        sizes[size] || sizes.sm
      )}
    >
      {type}
    </span>
  );
}

// ---------- Dashboard stat card (icon chip + prominent number) ----------
export function StatCard({ label, value, hint, tone = 'default', icon: Icon }) {
  const tones = {
    default: 'text-cream',
    red: 'text-gold-light',
    amber: 'text-amber-700',
    green: 'text-emerald-700',
    sky: 'text-sky-700',
    gray: 'text-muted'
  };
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted">{label}</p>
        {Icon && (
          <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-blood text-gold">
            <Icon className="h-4 w-4" strokeWidth={1.9} aria-hidden="true" />
          </span>
        )}
      </div>
      <p className={classNames('mt-1 text-3xl font-bold tracking-tight', tones[tone])}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

// ---------- Avatar (profile photo with initials fallback) ----------
// If `src` is missing or fails to load (offline / deleted image),
// the initials version renders instead — the UI never breaks.
const AVATAR_COLORS = [
  { bg: 'bg-red-100', fg: 'text-red-700' },
  { bg: 'bg-amber-100', fg: 'text-amber-800' },
  { bg: 'bg-emerald-100', fg: 'text-emerald-700' },
  { bg: 'bg-sky-100', fg: 'text-sky-700' },
  { bg: 'bg-rose-100', fg: 'text-rose-700' },
  { bg: 'bg-slate-200', fg: 'text-slate-700' }
];

export function Avatar({ name, src, size = 'md' }) {
  const [broken, setBroken] = useState(false);
  const initials = String(name || '?')
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
  let hash = 0;
  for (const ch of String(name || '')) hash = (hash * 31 + ch.charCodeAt(0)) % 997;
  const color = AVATAR_COLORS[hash % AVATAR_COLORS.length];
  const sizes = {
    sm: 'h-7 w-7 text-[10px]',
    md: 'h-9 w-9 text-xs',
    lg: 'h-12 w-12 text-sm',
    xl: 'h-20 w-20 text-xl'
  };
  return (
    <span
      className={classNames(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold ring-1 ring-line',
        color.bg,
        color.fg,
        sizes[size] || sizes.md
      )}
      aria-hidden="true"
    >
      {src && !broken ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover"
          onError={() => setBroken(true)}
        />
      ) : (
        initials
      )}
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
      className="fixed inset-0 z-50 flex items-end justify-center bg-cream/40 backdrop-blur-[2px] sm:items-center sm:px-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="card max-h-[85vh] w-full max-w-md overflow-y-auto rounded-b-none p-6 pb-safe sm:rounded-b-2xl">
        <h3 className="text-lg font-bold text-cream">{title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted">{message}</p>
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
          <p className="mt-3 text-sm font-medium text-red-600" role="alert">
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

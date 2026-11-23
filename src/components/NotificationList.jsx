import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Check, ChevronDown } from 'lucide-react';
import dataService from '../lib/dataService';
import { EmptyState, InlineLoader } from './ui';
import { classNames, formatDateTime } from '../lib/utils';

/* NotificationList — v6.2 redesign of the hospital notifications inbox.
   Client rules implemented:
   * Collapsed rows are CONCISE: title + time only (no body, no actor,
     no buttons). The full body appears only when the row is clicked.
   * "View details" and "Mark as read" only exist when a row is expanded.
   * The My-hospital panel shows at most 5 rows; a "View more" link at
     the bottom navigates to /notifications for full controls/filters.
   * "View details" navigates to the related request AND carries
     navigation state so the request page's back link returns the user
     to where they came from (hospital panel / notifications tab),
     never blindly to /requests.

   Variants:
   * variant="panel"  — the compact My-hospital card (5 rows + View more)
   * variant="full"   — the /notifications page (renders every row it is
     given; filtering/sorting is the page's job)
   Both share the same expandable row component. */

// Human labels for the four notification types the backend emits.
export const NOTIF_TYPES = {
  new_request: 'New request',
  donor_accepted: 'Donor accepted',
  doctor_application: 'Doctor application',
  outcome: 'Outcome record'
};

// ---------- One expandable row ----------
function NotificationRow({ n, onMarkedRead, expandedDefault = false }) {
  const [open, setOpen] = useState(expandedDefault);
  const [busy, setBusy] = useState(false);
  // Where "View details" should return to: the page the list lives on.
  const { pathname } = useLocation();
  const fromLabel = pathname === '/notifications' ? 'notifications' : 'My hospital';

  const markRead = async () => {
    setBusy(true);
    try {
      await dataService.markHospitalNotificationRead(n.id);
      onMarkedRead?.(n.id);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={classNames(
        'rounded-xl border transition-colors',
        n.read ? 'border-line bg-ink/60' : 'border-gold/40 bg-gold/10'
      )}
    >
      {/* Collapsed: concise — unread dot, title, type + time only */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 p-3.5 text-left"
      >
        <span
          className={classNames('h-2 w-2 shrink-0 rounded-full', n.read ? 'bg-pale' : 'bg-gold')}
          aria-hidden="true"
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-cream">{n.title}</span>
          <span className="mt-0.5 block truncate text-xs text-muted">
            {NOTIF_TYPES[n.type] || 'Notification'} · {formatDateTime(n.created_at)}
          </span>
        </span>
        <ChevronDown
          className={classNames(
            'h-4 w-4 shrink-0 text-muted transition-transform',
            open && 'rotate-180'
          )}
          strokeWidth={2}
          aria-hidden="true"
        />
      </button>

      {/* Expanded: full body + the two actions (only when expanded) */}
      {open && (
        <div className="border-t border-line/70 px-3.5 pb-3.5 pl-[42px] pt-3">
          <p className="text-sm leading-relaxed text-cream/80">{n.body}</p>
          {n.actor_name && (
            <p className="mt-1.5 text-xs text-muted">From {n.actor_name}</p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {n.request_id && (
              <Link
                to={`/requests/${n.request_id}`}
                state={{ from: { path: pathname, label: fromLabel } }}
                className="btn-secondary !min-h-8 !px-2.5 !py-1 !text-[11px]"
              >
                View details
              </Link>
            )}
            {!n.read && (
              <button
                type="button"
                className="btn-ghost !min-h-8 !px-2.5 !py-1 !text-[11px] hover:text-emerald-700"
                onClick={markRead}
                disabled={busy}
              >
                <Check className="h-3.5 w-3.5" strokeWidth={2.2} aria-hidden="true" />
                Mark as read
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- The list (panel or full variant) ----------
export default function NotificationList({
  notifications,
  variant = 'panel',
  onMarkedRead,
  expandedId = null
}) {
  if (!notifications) return <InlineLoader label="Loading notifications…" />;

  if (notifications.length === 0) {
    return (
      <EmptyState
        title="No notifications"
        message="You will be notified when a requester attaches your hospital to a request, a donor accepts one, or a doctor applies to join you."
      />
    );
  }

  // The My-hospital panel caps at 5 rows.
  const visible = variant === 'panel' ? notifications.slice(0, 5) : notifications;

  return (
    <div className="space-y-2">
      {visible.map((n) => (
        <NotificationRow
          key={n.id}
          n={n}
          onMarkedRead={onMarkedRead}
          expandedDefault={expandedId === n.id}
        />
      ))}
      {variant === 'panel' && notifications.length > 5 && (
        <Link
          to="/notifications"
          className="mt-1 block rounded-xl border border-dashed border-line px-3.5 py-2.5 text-center text-xs font-semibold text-gold transition-colors hover:border-gold/40 hover:bg-pale"
        >
          View more ({notifications.length - 5} more)
        </Link>
      )}
    </div>
  );
}

// Small helper reused by both the panel and the /notifications page:
// the unread badge count for the topbar bell.
export function unreadCount(notifications) {
  return (notifications || []).filter((n) => !n.read).length;
}

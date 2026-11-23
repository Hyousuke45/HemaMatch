import { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import useAsync from '../hooks/useAsync';
import dataService from '../lib/dataService';
import NotificationList, { NOTIF_TYPES } from '../components/NotificationList';
import { ErrorState, InlineLoader } from '../components/ui';
import { BellRing, CheckCheck, ChevronDown, Search } from 'lucide-react';

/* NOTIFICATIONS — the full notifications tab (v6.2).
   Reached from "View more" in the My-hospital panel or the topbar bell.
   Everything the compact panel cannot fit lives here:
     * status filter: all / unread / read
     * type filter: request events, donor acceptances, doctor applications
     * free-text search over title and body
     * newest / oldest sort
     * expandable rows with "View details" + "Mark as read"
     * mark-all-as-read, live unread badge
   Business accounts only (the backend enforces it too). */

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'read', label: 'Read' }
];

export default function Notifications() {
  const { state } = useLocation();
  const { data: notifications, loading, error, reload } = useAsync(
    () => dataService.listHospitalNotifications(),
    []
  );
  const [status, setStatus] = useState('all');
  const [type, setType] = useState('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('newest');
  const [busy, setBusy] = useState(false);

  const unread = (notifications || []).filter((n) => !n.read).length;

  const filtered = useMemo(() => {
    let list = [...(notifications || [])];
    if (status === 'unread') list = list.filter((n) => !n.read);
    if (status === 'read') list = list.filter((n) => n.read);
    if (type !== 'all') list = list.filter((n) => n.type === type);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          (n.body || '').toLowerCase().includes(q) ||
          (n.actor_name || '').toLowerCase().includes(q)
      );
    }
    list.sort((a, b) =>
      sort === 'newest'
        ? new Date(b.created_at) - new Date(a.created_at)
        : new Date(a.created_at) - new Date(b.created_at)
    );
    return list;
  }, [notifications, status, type, query, sort]);

  const markAll = async () => {
    setBusy(true);
    try {
      await dataService.markAllHospitalNotificationsRead();
      await reload();
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <InlineLoader label="Loading notifications…" />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <div className="mx-auto max-w-3xl">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-blood text-gold">
            <BellRing className="h-5 w-5" strokeWidth={1.9} aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-cream">Notifications</h1>
            <p className="text-[13px] text-muted">
              {notifications.length} total
              {unread > 0 ? ` · ${unread} unread` : ' · all caught up'}
            </p>
          </div>
        </div>
        {unread > 0 && (
          <button
            type="button"
            className="btn-secondary !min-h-9 !px-3 !py-1.5 !text-xs"
            onClick={markAll}
            disabled={busy}
          >
            <CheckCheck className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            Mark all as read
          </button>
        )}
      </div>

      {/* Controls: status + type + search + sort */}
      <div className="card mt-5 flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          {/* Status segmented control */}
          <div className="flex rounded-[10px] border border-line bg-pale p-0.5" role="group" aria-label="Filter by status">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setStatus(f.value)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  status === f.value ? 'bg-gold text-white' : 'text-muted hover:text-cream'
                }`}
                aria-pressed={status === f.value}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Type dropdown */}
          <label className="relative">
            <span className="sr-only">Filter by type</span>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="appearance-none rounded-[10px] border border-line bg-white py-1.5 pl-3 pr-8 text-xs font-semibold text-cream focus:outline-gold"
            >
              <option value="all">All types</option>
              {Object.entries(NOTIF_TYPES).map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted"
              strokeWidth={2}
              aria-hidden="true"
            />
          </label>

          {/* Sort dropdown */}
          <label className="relative">
            <span className="sr-only">Sort</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="appearance-none rounded-[10px] border border-line bg-white py-1.5 pl-3 pr-8 text-xs font-semibold text-cream focus:outline-gold"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
            <ChevronDown
              className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted"
              strokeWidth={2}
              aria-hidden="true"
            />
          </label>

          <span className="ml-auto text-xs text-muted">
            {filtered.length} of {notifications.length} shown
          </span>
        </div>

        {/* Search */}
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
            strokeWidth={2}
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title, body or sender…"
            className="input !py-2 pl-9 text-sm"
            aria-label="Search notifications"
          />
        </div>
      </div>

      {/* Rows */}
      <div className="mt-5">
        {filtered.length === 0 ? (
          <div className="card px-6 py-12 text-center">
            <p className="font-semibold text-cream">No matching notifications</p>
            <p className="mt-1 text-sm text-muted">
              Try clearing the search or switching filters.
            </p>
          </div>
        ) : (
          <NotificationList
            notifications={filtered}
            variant="full"
            onMarkedRead={reload}
            expandedId={state?.expandId ?? null}
          />
        )}
      </div>
    </div>
  );
}

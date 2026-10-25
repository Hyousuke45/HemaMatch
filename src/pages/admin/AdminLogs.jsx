import { useState } from 'react';
import useAsync from '../../hooks/useAsync';
import dataService from '../../lib/dataService';
import { EmptyState, InlineLoader, ErrorState } from '../../components/ui';
import { formatDateTime } from '../../lib/utils';

// Activity log: the audit trail of important changes.
// Phase 1: written by the mock backend at each guarded action.
// Phase 2: written exclusively by PostgreSQL triggers — client code has
// no INSERT/UPDATE/DELETE permission on activity_logs at all.
export default function AdminLogs() {
  const [search, setSearch] = useState('');
  const { data: logs, loading, error, reload } = useAsync(() => dataService.listLogs(), []);

  const filtered = (logs || []).filter((l) => {
    const q = search.toLowerCase();
    return (
      l.action.toLowerCase().includes(q) ||
      l.actor_name.toLowerCase().includes(q) ||
      (l.details || '').toLowerCase().includes(q) ||
      (l.entity || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="card p-4">
        <input
          className="input"
          placeholder="Search action, actor, entity…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search activity log"
        />
      </div>

      {loading && <InlineLoader label="Loading activity log…" />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && filtered.length === 0 && (
        <EmptyState title="No activity found" message="No log entries match your search." />
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-cream/15 text-left text-xs uppercase tracking-wide text-cream/45">
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Entity</th>
                <th className="px-4 py-3">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream/10">
              {filtered.map((l) => (
                <tr key={l.id} className="hover:bg-cream/5">
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-cream/65">
                    {formatDateTime(l.created_at)}
                  </td>
                  <td className="px-4 py-3 font-medium text-cream">{l.actor_name}</td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-gold/10 px-2 py-0.5 font-mono text-xs font-semibold text-gold-light">
                      {l.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-cream/65">
                    {l.entity}
                    {l.entity_id && <span className="text-cream/45"> · {l.entity_id}</span>}
                  </td>
                  <td className="max-w-[320px] px-4 py-3 text-cream/75">{l.details || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-cream/10 px-4 py-3 text-xs text-cream/45">
            Showing the {filtered.length} most recent matching entries (the log keeps the latest 200).
          </p>
        </div>
      )}
    </div>
  );
}

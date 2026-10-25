import { useState } from 'react';
import useAsync from '../../hooks/useAsync';
import dataService from '../../lib/dataService';
import { Avatar, BloodTypeBadge, ConfirmDialog, EmptyState, InlineLoader, ErrorState, StatusBadge } from '../../components/ui';
import { formatDate } from '../../lib/utils';

// User management. Role changes are the ONLY permission action here, and
// they are deliberately limited: an admin can grant/revoke admin, can
// never change their own role (lockout protection), and every change is
// logged. Users can never change roles themselves — enforced in the
// backend and later by the protect_role_column trigger in PostgreSQL.
export default function AdminUsers() {
  const [search, setSearch] = useState('');
  const [confirm, setConfirm] = useState(null);

  const { data: users, loading, error, reload } = useAsync(() => dataService.listUsers(), []);

  const filtered = (users || []).filter((u) => {
    const q = search.toLowerCase();
    return (
      u.profile.full_name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.profile.blood_type || '').toLowerCase().includes(q)
    );
  });

  const handleConfirm = async () => {
    await dataService.toggleUserRole(confirm.id);
    await reload();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="card p-4">
        <input
          className="input"
          placeholder="Search by name, email or blood type…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search users"
        />
      </div>

      {loading && <InlineLoader label="Loading users…" />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && filtered.length === 0 && (
        <EmptyState title="No users found" message="No accounts match your search." />
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-cream/15 text-left text-xs uppercase tracking-wide text-cream/45">
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Blood type</th>
                <th className="px-4 py-3">Region</th>
                <th className="px-4 py-3">Available</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream/10">
              {filtered.map((u) => (
                <tr key={u.id} className="hover:bg-cream/5">
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2.5">
                      <Avatar name={u.profile.full_name} size="sm" />
                      <span className="font-medium text-cream">{u.profile.full_name}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-cream/65">{u.email}</td>
                  <td className="px-4 py-3">
                    {u.profile.blood_type ? <BloodTypeBadge type={u.profile.blood_type} /> : <span className="text-cream/45">—</span>}
                  </td>
                  <td className="px-4 py-3 text-cream/75">{u.profile.region || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={u.profile.is_available ? 'font-medium text-emerald-400' : 'text-cream/65'}>
                      {u.profile.is_available ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {u.profile.role === 'admin' ? (
                      <StatusBadge status="verified" label="Admin" />
                    ) : (
                      <StatusBadge status="routine" label="User" />
                    )}
                    <span className="ml-2 text-xs text-cream/45">joined {formatDate(u.profile.created_at)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      className="btn-secondary !px-2.5 !py-1 !text-xs"
                      onClick={() =>
                        setConfirm({
                          id: u.id,
                          name: u.profile.full_name,
                          next: u.profile.role === 'admin' ? 'user' : 'admin',
                          title:
                            u.profile.role === 'admin'
                              ? `Revoke admin — ${u.profile.full_name}?`
                              : `Grant admin — ${u.profile.full_name}?`,
                          message:
                            u.profile.role === 'admin'
                              ? 'This removes full administrative access. The change is written to the activity log.'
                              : 'This grants full administrative access (request management, outcome records, hospital verification, user management). The change is written to the activity log.'
                        })
                      }
                    >
                      {u.profile.role === 'admin' ? 'Revoke admin' : 'Make admin'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.title}
        message={confirm?.message}
        confirmLabel={confirm?.next === 'admin' ? 'Grant admin' : 'Revoke admin'}
        danger={confirm?.next === 'admin'}
        onClose={() => setConfirm(null)}
        onConfirm={handleConfirm}
      />
    </div>
  );
}

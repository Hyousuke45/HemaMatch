import { useState } from 'react';
import useAsync from '../../hooks/useAsync';
import dataService from '../../lib/dataService';
import { Avatar, BloodTypeBadge, ConfirmDialog, EmptyState, InlineLoader, ErrorState, StatusBadge } from '../../components/ui';
import { formatDate } from '../../lib/utils';
import { ACCOUNT_TYPES } from '../../lib/constants';

// User management. Role changes are the ONLY permission action here, and
// they are deliberately limited: an admin can grant/revoke admin, can
// never change their own role (lockout protection), and every change is
// logged. v4: doctor and business ACCOUNT TYPES are created at
// registration (they carry hospital links), so the toggle only applies
// to plain user/admin accounts.
export default function AdminUsers() {
  const [search, setSearch] = useState('');
  const [confirm, setConfirm] = useState(null);

  const { data: users, loading, error, reload } = useAsync(() => dataService.listUsers(), []);

  const filtered = (users || []).filter((u) => {
    const q = search.toLowerCase();
    return (
      u.profile.full_name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.profile.blood_type || '').toLowerCase().includes(q) ||
      (u.profile.role || '').toLowerCase().includes(q)
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
          placeholder="Search by name, email, blood type or account type…"
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
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-cream/15 text-left text-xs uppercase tracking-wide text-cream/45">
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Blood type</th>
                <th className="px-4 py-3">Region</th>
                <th className="px-4 py-3">Account type</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream/10">
              {filtered.map((u) => {
                const type = u.profile.role;
                const toggleable = type === 'user' || type === 'admin';
                return (
                  <tr key={u.id} className="hover:bg-cream/5">
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-2.5">
                        <Avatar name={u.profile.full_name} src={u.profile.avatar_url} size="sm" />
                        <span>
                          <span className="block font-medium text-cream">{u.profile.full_name}</span>
                          <span className="block text-xs text-cream/45">joined {formatDate(u.profile.created_at)}</span>
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-cream/65">{u.email}</td>
                    <td className="px-4 py-3">
                      {u.profile.blood_type ? <BloodTypeBadge type={u.profile.blood_type} /> : <span className="text-cream/45">—</span>}
                    </td>
                    <td className="px-4 py-3 text-cream/75">{u.profile.region || '—'}</td>
                    <td className="px-4 py-3">
                      {type === 'admin' ? (
                        <StatusBadge status="verified" label="Administrator" />
                      ) : (
                        <span className="flex flex-col gap-1">
                          <StatusBadge status="routine" label={ACCOUNT_TYPES[type] || type} />
                          {type === 'doctor' && (
                            <span className="text-xs text-cream/55">
                              {u.profile.doctor_license_id || 'no license ID'}
                              {u.profile.specialization ? ` · ${u.profile.specialization}` : ''}
                            </span>
                          )}
                          {type === 'business' && (
                            <span className="text-xs text-cream/55">
                              {u.profile.is_doctor ? 'also a licensed doctor' : 'hospital admin'}
                              {u.profile.is_doctor && u.profile.doctor_license_id
                                ? ` · ${u.profile.doctor_license_id}`
                                : ''}
                            </span>
                          )}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {toggleable ? (
                        <button
                          type="button"
                          className="btn-secondary !px-2.5 !py-1 !text-xs"
                          onClick={() =>
                            setConfirm({
                              id: u.id,
                              name: u.profile.full_name,
                              next: type === 'admin' ? 'user' : 'admin',
                              title:
                                type === 'admin'
                                  ? `Revoke admin — ${u.profile.full_name}?`
                                  : `Grant admin — ${u.profile.full_name}?`,
                              message:
                                type === 'admin'
                                  ? 'This removes full administrative access. The change is written to the activity log.'
                                  : 'This grants full administrative access (request management, outcome records, hospital verification, user management). The change is written to the activity log.'
                            })
                          }
                        >
                          {type === 'admin' ? 'Revoke admin' : 'Make admin'}
                        </button>
                      ) : (
                        <span className="text-xs text-cream/40" title="Account types are fixed at registration">
                          —
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs leading-relaxed text-cream/45">
        Doctor and Business accounts cannot be toggled here — their type is tied to their hospital
        links (rosters, applications, admin records). A doctor becomes an admin only by registering
        the account that way; platform admins still oversee all of their activity.
      </p>

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

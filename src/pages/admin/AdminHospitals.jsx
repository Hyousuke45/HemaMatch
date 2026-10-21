import { useState } from 'react';
import useAsync from '../../hooks/useAsync';
import dataService from '../../lib/dataService';
import { REGIONS, HOSPITAL_STATUS } from '../../lib/constants';
import { Alert, ConfirmDialog, EmptyState, InlineLoader, ErrorState, StatusBadge } from '../../components/ui';
import { formatDate } from '../../lib/utils';

// Hospital verification (Light scope): admin-managed records.
// New hospitals always start Pending; only administrators can set
// Verified/Rejected, and rejections require a reason.
export default function AdminHospitals() {
  const [form, setForm] = useState({ name: '', region: '', city: '', address: '', contact_number: '' });
  const [formError, setFormError] = useState(null);
  const [formSuccess, setFormSuccess] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null);

  const { data: hospitals, loading, error, reload } = useAsync(() => dataService.listHospitals(), []);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleAdd = async (e) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);
    setBusy(true);
    try {
      await dataService.adminCreateHospital(form);
      setForm({ name: '', region: '', city: '', address: '', contact_number: '' });
      setFormSuccess('Hospital added as Pending. Verify it below once its license is confirmed.');
      await reload();
    } catch (err) {
      setFormError(err?.message || 'Could not add the hospital.');
    } finally {
      setBusy(false);
    }
  };

  const openStatusConfirm = (h, next) =>
    setConfirm({
      h,
      next,
      requireReason: next === 'rejected',
      title: `Set “${h.name}” to ${HOSPITAL_STATUS[next]}?`,
      message:
        next === 'verified'
          ? 'Verified hospitals become selectable on blood requests and visible in the public directory. The change is logged.'
          : next === 'rejected'
            ? 'A rejected hospital is removed from the public directory and can never be attached to requests. A reason is required and will be logged.'
            : 'Returns the hospital to pending review. The change is logged.'
    });

  const handleConfirm = async (reason) => {
    await dataService.adminSetHospitalStatus(confirm.h.id, confirm.next, reason);
    await reload();
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Add hospital */}
      <form onSubmit={handleAdd} className="card space-y-4 p-6">
        <p className="font-semibold text-gray-900">Add a hospital record</p>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label" htmlFor="h-name">
              Name <span className="text-red-600">*</span>
            </label>
            <input id="h-name" className="input" value={form.name} onChange={set('name')} placeholder="e.g. Quezon City General Hospital" required maxLength={120} />
          </div>
          <div>
            <label className="label" htmlFor="h-region">
              Region <span className="text-red-600">*</span>
            </label>
            <select id="h-region" className="input" value={form.region} onChange={set('region')} required>
              <option value="">Choose…</option>
              {REGIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="h-city">
              City / municipality
            </label>
            <input id="h-city" className="input" value={form.city} onChange={set('city')} maxLength={60} />
          </div>
          <div>
            <label className="label" htmlFor="h-contact">
              Contact number
            </label>
            <input id="h-contact" className="input" value={form.contact_number} onChange={set('contact_number')} placeholder="(02) 1234-5678" maxLength={40} />
          </div>
          <div className="md:col-span-2">
            <label className="label" htmlFor="h-address">
              Address
            </label>
            <input id="h-address" className="input" value={form.address} onChange={set('address')} maxLength={200} />
          </div>
        </div>

        {formError && <Alert tone="error">{formError}</Alert>}
        {formSuccess && <Alert tone="success">{formSuccess}</Alert>}

        <div className="flex justify-end">
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? 'Adding…' : 'Add hospital'}
          </button>
        </div>
      </form>

      {/* Hospital list */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">
          All hospital records
        </h2>
        {loading && <InlineLoader label="Loading hospitals…" />}
        {error && <ErrorState message={error} onRetry={reload} />}
        {!loading && !error && hospitals?.length === 0 && (
          <EmptyState title="No hospitals yet" message="Add the first hospital record above." />
        )}

        {!loading && !error && hospitals?.length > 0 && (
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-400">
                  <th className="px-4 py-3">Hospital</th>
                  <th className="px-4 py-3">Region</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Notes</th>
                  <th className="px-4 py-3">Added</th>
                  <th className="px-4 py-3">Verification actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {hospitals.map((h) => (
                  <tr key={h.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{h.name}</p>
                      <p className="text-xs text-gray-400">{h.city || '—'}{h.contact_number ? ` · ${h.contact_number}` : ''}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{h.region}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={h.status} />
                    </td>
                    <td className="max-w-[220px] px-4 py-3 text-xs text-gray-500">{h.notes || '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(h.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {h.status !== 'verified' && (
                          <button type="button" className="btn-secondary !px-2.5 !py-1 !text-xs" onClick={() => openStatusConfirm(h, 'verified')}>
                            Verify
                          </button>
                        )}
                        {h.status !== 'rejected' && (
                          <button type="button" className="btn-secondary !px-2.5 !py-1 !text-xs" onClick={() => openStatusConfirm(h, 'rejected')}>
                            Reject
                          </button>
                        )}
                        {h.status !== 'pending' && (
                          <button type="button" className="btn-secondary !px-2.5 !py-1 !text-xs" onClick={() => openStatusConfirm(h, 'pending')}>
                            Reset to pending
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.title}
        message={confirm?.message}
        confirmLabel={confirm?.next === 'verified' ? 'Verify hospital' : confirm?.next === 'rejected' ? 'Reject hospital' : 'Reset status'}
        danger={confirm?.next === 'rejected'}
        requireReason={confirm?.requireReason}
        onClose={() => setConfirm(null)}
        onConfirm={handleConfirm}
      />
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import useAsync from '../hooks/useAsync';
import dataService from '../lib/dataService';
import { Alert, InlineLoader } from '../components/ui';
import { BLOOD_TYPES, REGIONS, URGENCY } from '../lib/constants';

// Create (route /requests/new) and edit (route /requests/:id/edit).
// Only the requester can edit, and only while the request is Pending —
// enforced by the backend, mirrored by RLS in Phase 2.
export default function RequestForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const { data: hospitals } = useAsync(() => dataService.listHospitals());
  const { data: existing, loading: loadingExisting, error: loadError } = useAsync(
    async () => (isEdit ? dataService.getRequest(id) : null),
    [id]
  );

  const [form, setForm] = useState({
    blood_type: '',
    units_needed: 1,
    region: '',
    hospital_id: '',
    urgency: 'routine',
    needed_by: '',
    description: ''
  });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (existing) {
      setForm({
        blood_type: existing.blood_type,
        units_needed: existing.units_needed,
        region: existing.region,
        hospital_id: existing.hospital_id || '',
        urgency: existing.urgency,
        needed_by: existing.needed_by || '',
        description: existing.description || ''
      });
    }
  }, [existing]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!form.blood_type) return setError('Please choose the blood type needed.');
    if (!form.region) return setError('Please choose a region.');

    setBusy(true);
    try {
      const payload = { ...form, hospital_id: form.hospital_id || null, needed_by: form.needed_by || null };
      const saved = isEdit
        ? await dataService.updateRequest(id, payload)
        : await dataService.createRequest(payload);
      navigate(`/requests/${saved.id}`);
    } catch (err) {
      setError(err?.message || 'Could not save the request.');
    } finally {
      setBusy(false);
    }
  };

  if (isEdit && loadingExisting) return <InlineLoader label="Loading request…" />;
  if (isEdit && loadError)
    return (
      <Alert tone="error" title="Cannot edit this request">
        {loadError}
      </Alert>
    );

  // Verified hospitals only (Light hospital scope).
  const verifiedHospitals = (hospitals || []).filter((h) => h.status === 'verified');

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold text-cream">
        {isEdit ? 'Edit blood request' : 'Create a blood request'}
      </h1>
      <p className="mt-1 text-sm text-cream/65">
        Describe what is needed. The request starts as <span className="font-semibold">Pending</span>{' '}
        and all signed-in users can see it.
      </p>

      <form onSubmit={handleSubmit} className="card mt-6 space-y-5 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="blood_type">
              Blood type needed <span className="text-gold">*</span>
            </label>
            <select id="blood_type" className="input" value={form.blood_type} onChange={set('blood_type')} required>
              <option value="">Choose…</option>
              {BLOOD_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="units_needed">
              Units needed <span className="text-gold">*</span>
            </label>
            <input
              id="units_needed"
              type="number"
              min="1"
              max="10"
              className="input"
              value={form.units_needed}
              onChange={(e) => setForm((f) => ({ ...f, units_needed: Number(e.target.value) }))}
              required
            />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="region">
            Region <span className="text-gold">*</span>
          </label>
          <select id="region" className="input" value={form.region} onChange={set('region')} required>
            <option value="">Choose…</option>
            {REGIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-cream/45">Matching prioritizes donors from the same region.</p>
        </div>

        <div>
          <label className="label" htmlFor="hospital_id">
            Hospital (optional)
          </label>
          <select id="hospital_id" className="input" value={form.hospital_id} onChange={set('hospital_id')}>
            <option value="">Not specified</option>
            {verifiedHospitals.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name} — {h.city || h.region}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-cream/45">Only administrator-verified hospitals can be selected.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="urgency">
              Urgency
            </label>
            <select id="urgency" className="input" value={form.urgency} onChange={set('urgency')}>
              {Object.entries(URGENCY).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="needed_by">
              Needed by (optional)
            </label>
            <input id="needed_by" type="date" className="input" value={form.needed_by} onChange={set('needed_by')} />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="description">
            Additional information
          </label>
          <textarea
            id="description"
            className="input min-h-[110px]"
            value={form.description}
            onChange={set('description')}
            placeholder="Patient context, hospital coordination notes… (max 600 characters)"
            maxLength={600}
          />
          <p className="mt-1 text-xs text-cream/45">
            Do not include sensitive personal data beyond what is needed for coordination.
          </p>
        </div>

        {error && (
          <Alert tone="error" title="Please review the form">
            {error}
          </Alert>
        )}

        {/* Mobile: actions stay pinned above the tab bar while scrolling
            the form; desktop keeps the normal in-card footer. */}
        <div className="sticky bottom-20 z-30 -mx-6 flex flex-col gap-2 border-t border-cream/10 bg-blood/95 px-6 pb-4 pt-3 backdrop-blur md:static md:mx-0 md:flex-row md:justify-end md:border-0 md:bg-transparent md:p-0 md:pt-0">
          <button type="button" className="btn-secondary w-full md:w-auto" onClick={() => navigate(-1)} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn-primary w-full md:w-auto" disabled={busy}>
            {busy ? 'Saving…' : isEdit ? 'Save changes' : 'Create request'}
          </button>
        </div>
      </form>

      <p className="mt-4 text-xs leading-relaxed text-cream/45">
        Note: creating a request is not a medical validation. Donors found through HemaMatch still
        go through the hospital&apos;s standard screening process.
      </p>
    </div>
  );
}

// Small shared utilities

export function classNames(...parts) {
  return parts.filter(Boolean).join(' ');
}

// '2026-10-18T09:30:00' -> 'Oct 18, 2026'
export function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

// '2026-10-18T09:30:00' -> 'Oct 18, 2026 · 9:30 AM'
export function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return (
    d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' · ' +
    d.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })
  );
}

// ---- Validation (client-side; mirrored by mock backend + future DB checks) ----

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

// Password policy: at least 8 characters, one letter and one number.
export function validatePassword(pw) {
  if (!pw || pw.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw))
    return 'Password must contain at least one letter and one number.';
  return null; // no error
}

// Mock-only id generator. Phase 2: PostgreSQL generates UUIDs itself.
export function newId(prefix) {
  const raw =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return `${prefix}-${raw.slice(0, 8)}`;
}

export function nowIso() {
  return new Date().toISOString();
}

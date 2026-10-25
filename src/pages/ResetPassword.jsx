import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Alert } from '../components/ui';
import { validatePassword } from '../lib/utils';
import dataService, { isMock } from '../lib/dataService';

// Set a new password after a recovery email (Supabase mode).
// The emailed reset link lands here WITH a recovery session; the new
// password is applied through Supabase Auth (never stored by this app).
// In mock mode this page is never needed (recovery is simulated inline).
export default function ResetPassword() {
  const { user, logout, loading } = useAuth();
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (isMock) navigate('/forgot-password', { replace: true });
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    const pwError = validatePassword(password);
    if (pwError) return setError(pwError);
    if (password !== confirm) return setError('Passwords do not match.');
    setBusy(true);
    try {
      await dataService.resetPassword({ password });
      setDone(true);
      setTimeout(async () => {
        await logout();
        navigate('/login', { replace: true });
      }, 1500);
    } catch (err) {
      setError(err?.message || 'Could not set the new password.');
    } finally {
      setBusy(false);
    }
  };

  if (isMock) return null;

  if (loading) {
    return (
      <div className="mx-auto max-w-md py-6">
        <p className="text-center text-sm text-cream/60">Checking your reset link…</p>
      </div>
    );
  }

  // No recovery session: the link was already used or has expired.
  if (!user) {
    return (
      <div className="mx-auto max-w-md py-6">
        <div className="card p-6 text-center">
          <h1 className="text-xl font-bold text-cream">Reset link no longer valid</h1>
          <p className="mt-2 text-sm leading-relaxed text-cream/70">
            This link has already been used or has expired. Request a fresh one — it only takes a
            moment.
          </p>
          <Link to="/forgot-password" className="btn-primary mt-5 w-full">
            Request a new reset link
          </Link>
          <Link to="/login" className="btn-ghost mt-2 w-full">
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md py-6">
      <h1 className="text-2xl font-bold text-cream">Set a new password</h1>
      <p className="mt-1 text-sm text-cream/65">
        Signed in as <span className="font-semibold">{user.email}</span> via your reset link.
        Choose a new password below.
      </p>

      <form onSubmit={handleSubmit} className="card mt-6 space-y-4 p-6">
        <div>
          <label className="label" htmlFor="new-password">
            New password
          </label>
          <input
            id="new-password"
            type="password"
            required
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            autoComplete="new-password"
          />
        </div>
        <div>
          <label className="label" htmlFor="confirm-password">
            Confirm new password
          </label>
          <input
            id="confirm-password"
            type="password"
            required
            className="input"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
          />
        </div>

        {error && <Alert tone="error">{error}</Alert>}
        {done && (
          <Alert tone="success" title="Password updated">
            Redirecting you to sign in…
          </Alert>
        )}

        <button type="submit" className="btn-primary w-full" disabled={busy || done}>
          {busy ? 'Saving…' : 'Set new password'}
        </button>
      </form>
    </div>
  );
}

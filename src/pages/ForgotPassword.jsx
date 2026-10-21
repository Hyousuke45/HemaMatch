import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Alert } from '../components/ui';
import { isValidEmail, validatePassword } from '../lib/utils';

// Password recovery. Phase 1: simulated reset link (mock mode).
// Phase 2: Supabase Auth sends a real reset email — this page only keeps
// step 1 (ask for email) and delegates the rest to Supabase.
export default function ForgotPassword() {
  const { requestPasswordReset, resetPassword } = useAuth();
  const navigate = useNavigate();

  const [stage, setStage] = useState('email'); // email -> reset -> done
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const handleEmail = async (e) => {
    e.preventDefault();
    setError(null);
    if (!isValidEmail(email)) return setError('Please enter a valid email address.');
    setBusy(true);
    try {
      await requestPasswordReset(email);
      setStage('reset');
    } catch (err) {
      setError(err?.message || 'Failed to send reset email.');
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    setError(null);
    const pwError = validatePassword(password);
    if (pwError) return setError(pwError);
    if (password !== confirm) return setError('Passwords do not match.');
    setBusy(true);
    try {
      await resetPassword({ email, password });
      setStage('done');
    } catch (err) {
      setError(err?.message || 'Failed to reset password.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-md py-6">
      <h1 className="text-2xl font-bold text-gray-900">Password recovery</h1>
      <p className="mt-1 text-sm text-gray-500">
        {stage === 'email' && 'Enter your account email and we will send a reset link.'}
        {stage === 'reset' && 'Set a new password for your account.'}
        {stage === 'done' && 'Your password has been updated.'}
      </p>

      <div className="card mt-6 p-6">
        {stage === 'email' && (
          <form onSubmit={handleEmail} className="space-y-4">
            <div>
              <label className="label" htmlFor="email">
                Account email
              </label>
              <input
                id="email"
                type="email"
                required
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            {error && <Alert tone="error">{error}</Alert>}
            <button type="submit" className="btn-primary w-full" disabled={busy}>
              {busy ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
        )}

        {stage === 'reset' && (
          <form onSubmit={handleReset} className="space-y-4">
            {/* Phase 1 simulation notice */}
            <Alert tone="info" title="Simulated reset link">
              Mock mode does not send real email. In Phase 2, Supabase emails a secure link that
              opens this step. Continue below to simulate it.
            </Alert>
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
            <button type="submit" className="btn-primary w-full" disabled={busy}>
              {busy ? 'Saving…' : 'Set new password'}
            </button>
          </form>
        )}

        {stage === 'done' && (
          <div className="space-y-4 text-center">
            <Alert tone="success" title="Password updated">
              You can now sign in with your new password.
            </Alert>
            <Link to="/login" className="btn-primary w-full">
              Go to sign in
            </Link>
          </div>
        )}

        <p className="mt-4 text-center text-sm text-gray-500">
          <Link to="/login" className="font-medium text-red-600 hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

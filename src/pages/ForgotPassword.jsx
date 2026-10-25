import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Alert } from '../components/ui';
import { isValidEmail, validatePassword } from '../lib/utils';
import { isMock } from '../lib/dataService';

// Password recovery.
//   mock mode    : simulated reset link -> set a new password inline.
//   Supabase mode: a REAL reset email is sent; clicking its link opens the
//                  dedicated /reset-password page with a recovery session.
export default function ForgotPassword() {
  const { requestPasswordReset, resetPassword } = useAuth();
  const navigate = useNavigate();

  const [stage, setStage] = useState('email'); // email -> reset (mock only) -> done
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
      // In Supabase mode there is no second step HERE — the emailed link
      // opens /reset-password instead.
      setStage(isMock ? 'reset' : 'done');
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

  const subtitle =
    stage === 'email'
      ? 'Enter your account email and we will send a reset link.'
      : stage === 'reset'
        ? 'Set a new password for your account.'
        : isMock
          ? 'Your password has been updated.'
          : 'Check your inbox — if an account exists for that email, a reset link is on its way.';

  return (
    <div className="mx-auto max-w-md py-6">
      <h1 className="text-2xl font-bold text-cream">Password recovery</h1>
      <p className="mt-1 text-sm text-cream/65">{subtitle}</p>

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
            {/* Mock-mode simulation notice */}
            <Alert tone="info" title="Simulated reset link">
              Mock mode does not send real email. In Supabase mode, the emailed link opens the
              dedicated &quot;Set a new password&quot; page. Continue below to simulate it.
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
            <Alert tone="success" title={isMock ? 'Password updated' : 'Reset link sent'}>
              {isMock
                ? 'You can now sign in with your new password.'
                : 'Click the link in the email to choose a new password. The link opens the secure “Set a new password” page.'}
            </Alert>
            <Link to="/login" className="btn-primary w-full">
              Go to sign in
            </Link>
          </div>
        )}

        <p className="mt-4 text-center text-sm text-cream/65">
          <Link to="/login" className="font-medium text-gold hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

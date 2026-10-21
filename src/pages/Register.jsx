import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Alert } from '../components/ui';
import { isValidEmail, validatePassword } from '../lib/utils';

// Registration + simulated email verification.
// Email verification is ENABLED in this project: in Phase 1 the "email link"
// is simulated with a button; in Phase 2 Supabase sends the real email.
export default function Register() {
  const { register, verifyEmail, login } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ full_name: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState('form'); // form -> check_email -> done
  const [verifyError, setVerifyError] = useState(null);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (form.full_name.trim().length < 2) return setError('Please enter your full name.');
    if (!isValidEmail(form.email)) return setError('Please enter a valid email address.');
    const pwError = validatePassword(form.password);
    if (pwError) return setError(pwError);
    if (form.password !== form.confirm) return setError('Passwords do not match.');

    setBusy(true);
    try {
      await register(form);
      setStage('check_email');
    } catch (err) {
      setError(err?.message || 'Registration failed.');
    } finally {
      setBusy(false);
    }
  };

  // Simulates clicking the link in the verification email, then signs in.
  const handleSimulateVerify = async () => {
    setVerifyError(null);
    setBusy(true);
    try {
      await verifyEmail(form.email);
      await login(form.email, form.password);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setVerifyError(err?.message || 'Verification failed.');
    } finally {
      setBusy(false);
    }
  };

  if (stage === 'check_email') {
    return (
      <div className="mx-auto max-w-md py-6">
        <div className="card p-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
            <svg className="h-6 w-6 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
          </div>
          <h1 className="mt-4 text-xl font-bold text-gray-900">Verify your email</h1>
          <p className="mt-2 text-sm leading-relaxed text-gray-600">
            We sent a verification link to <span className="font-semibold">{form.email}</span>.
            Please check your inbox and click the link to activate your account.
          </p>

          <div className="mt-5 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Phase 1 simulation (no real email is sent in mock mode)
            </p>
            <button
              type="button"
              className="btn-primary mt-3 w-full"
              onClick={handleSimulateVerify}
              disabled={busy}
            >
              {busy ? 'Verifying…' : 'Simulate clicking the verification link'}
            </button>
            {verifyError && (
              <p className="mt-2 text-sm font-medium text-red-600">{verifyError}</p>
            )}
          </div>

          <p className="mt-4 text-sm text-gray-500">
            Already verified?{' '}
            <Link to="/login" className="font-medium text-red-600 hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md py-6">
      <h1 className="text-2xl font-bold text-gray-900">Create your account</h1>
      <p className="mt-1 text-sm text-gray-500">
        Every account can both donate blood and request blood.
      </p>

      <form onSubmit={handleSubmit} className="card mt-6 space-y-4 p-6">
        <div>
          <label className="label" htmlFor="full_name">
            Full name
          </label>
          <input
            id="full_name"
            required
            className="input"
            value={form.full_name}
            onChange={set('full_name')}
            placeholder="Juan Dela Cruz"
            autoComplete="name"
          />
        </div>
        <div>
          <label className="label" htmlFor="email">
            Email address
          </label>
          <input
            id="email"
            type="email"
            required
            className="input"
            value={form.email}
            onChange={set('email')}
            placeholder="you@example.com"
            autoComplete="email"
          />
        </div>
        <div>
          <label className="label" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            className="input"
            value={form.password}
            onChange={set('password')}
            placeholder="At least 8 characters"
            autoComplete="new-password"
          />
          <p className="mt-1 text-xs text-gray-400">
            Minimum 8 characters, with at least one letter and one number.
          </p>
        </div>
        <div>
          <label className="label" htmlFor="confirm">
            Confirm password
          </label>
          <input
            id="confirm"
            type="password"
            required
            className="input"
            value={form.confirm}
            onChange={set('confirm')}
            autoComplete="new-password"
          />
        </div>

        {error && (
          <Alert tone="error" title="Registration failed">
            {error}
          </Alert>
        )}

        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy ? 'Creating account…' : 'Create account'}
        </button>

        <p className="text-center text-sm text-gray-500">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-red-600 hover:underline">
            Sign in
          </Link>
        </p>
      </form>

      <p className="mt-4 text-center text-xs leading-relaxed text-gray-400">
        By creating an account you understand that HemaMatch is an academic platform and that all
        blood-type matching is preliminary — actual eligibility is decided by healthcare
        professionals.
      </p>
    </div>
  );
}

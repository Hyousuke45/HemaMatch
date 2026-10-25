import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Alert } from '../components/ui';
import { isMock } from '../lib/dataService';

// Quick-fill chips make the live defense demo fast. The same accounts exist
// in mock mode (seeded localStorage) and in Supabase mode (supabase/seed.sql).
const DEMO_ACCOUNTS = [
  { label: 'Admin', email: 'admin@demo.com', password: 'admin123' },
  { label: 'Donor (Maria, O-)', email: 'maria@demo.com', password: 'maria123' },
  { label: 'Requester (Grace, AB+)', email: 'grace@demo.com', password: 'grace123' }
];

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const from = location.state?.from || '/dashboard';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err?.message || 'Unable to sign in.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-md py-6">
      <h1 className="text-2xl font-bold text-cream">Welcome back</h1>
      <p className="mt-1 text-sm text-cream/65">Sign in to your HemaMatch account.</p>

      <form onSubmit={handleSubmit} className="card mt-6 space-y-4 p-6">
        <div>
          <label className="label" htmlFor="email">
            Email address
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
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
            autoComplete="current-password"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Your password"
          />
        </div>

        {error && (
          <Alert tone="error" title="Sign-in failed">
            {error}
          </Alert>
        )}

        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>

        <div className="flex items-center justify-between text-sm">
          <Link to="/forgot-password" className="font-medium text-gold hover:underline">
            Forgot password?
          </Link>
          <Link to="/register" className="font-medium text-gold hover:underline">
            Create an account
          </Link>
        </div>
      </form>

      {/* Demo helper — works in mock mode and in Supabase mode after seed.sql */}
      <div className="card mt-4 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-cream/45">
          Demo accounts {isMock ? '(mock mode — click to quick-fill)' : '(seeded by supabase/seed.sql)'}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {DEMO_ACCOUNTS.map((acc) => (
            <button
              key={acc.email}
              type="button"
              className="btn-secondary !px-3 !py-1.5 !text-xs"
              onClick={() => {
                setEmail(acc.email);
                setPassword(acc.password);
              }}
            >
              {acc.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

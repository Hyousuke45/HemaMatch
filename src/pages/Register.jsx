import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Alert } from '../components/ui';
import { isValidEmail, validatePassword, classNames } from '../lib/utils';
import dataService, { isMock } from '../lib/dataService';
import { ACCOUNT_TYPES, ACCOUNT_TYPE_DESCRIPTIONS, REGIONS } from '../lib/constants';

// Registration + email verification.
// v4: after the basics, the user picks WHAT they are:
//   Donor/Recipient — the base account (donate + request blood)
//   Doctor          — + license ID, specialization, contact number;
//                     they apply to a hospital separately
//   Business        — + the hospital record they will administer
// Email verification:
//   - mock mode    : the "email link" is simulated with a button.
//   - Supabase mode: Supabase sends the REAL confirmation email.
const ACCOUNT_OPTIONS = ['user', 'doctor', 'business'];

export default function Register() {
  const { register, verifyEmail, login } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ full_name: '', email: '', password: '', confirm: '' });
  const [accountType, setAccountType] = useState('user');
  const [doctor, setDoctor] = useState({ license_id: '', specialization: '', contact_number: '' });
  const [hospital, setHospital] = useState({
    name: '',
    region: '',
    city: '',
    address: '',
    contact_number: '',
    description: ''
  });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState('form'); // form -> check_email
  const [verifyError, setVerifyError] = useState(null);
  const [resent, setResent] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setDoctorField = (k) => (e) => setDoctor((d) => ({ ...d, [k]: e.target.value }));
  const setHospitalField = (k) => (e) => setHospital((h) => ({ ...h, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (form.full_name.trim().length < 2) return setError('Please enter your full name.');
    if (!isValidEmail(form.email)) return setError('Please enter a valid email address.');
    const pwError = validatePassword(form.password);
    if (pwError) return setError(pwError);
    if (form.password !== form.confirm) return setError('Passwords do not match.');

    if (accountType === 'doctor') {
      if (!doctor.license_id.trim()) return setError('Please enter your doctor license / PRC ID number.');
      if (!doctor.contact_number.trim()) return setError('Please enter your contact number.');
    }
    if (accountType === 'business') {
      if (hospital.name.trim().length < 3)
        return setError('Please enter your hospital\u2019s name (at least 3 characters).');
      if (!hospital.region) return setError('Please choose the region where your hospital is located.');
    }

    setBusy(true);
    try {
      await register({
        ...form,
        account_type: accountType,
        doctor: accountType === 'doctor' ? doctor : {},
        hospital: accountType === 'business' ? hospital : {}
      });
      setStage('check_email');
    } catch (err) {
      setError(err?.message || 'Registration failed.');
    } finally {
      setBusy(false);
    }
  };

  // Mock mode only: simulates clicking the link in the verification email.
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

  // Supabase mode: re-send the real confirmation email.
  const handleResend = async () => {
    setVerifyError(null);
    setBusy(true);
    try {
      await verifyEmail(form.email);
      setResent(true);
    } catch (err) {
      setVerifyError(err?.message || 'Could not resend the email.');
    } finally {
      setBusy(false);
    }
  };

  if (stage === 'check_email') {
    return (
      <div className="mx-auto max-w-md py-6">
        <div className="card p-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-400/15">
            <svg className="h-6 w-6 text-emerald-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
          </div>
          <h1 className="mt-4 text-xl font-bold text-cream">Verify your email</h1>
          <p className="mt-2 text-sm leading-relaxed text-cream/75">
            We sent a confirmation link to <span className="font-semibold">{form.email}</span>.
            Please check your inbox and click the link to activate your account.
          </p>

          {isMock ? (
            <div className="card-well mt-5 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-cream/45">
                Mock mode simulation (no real email is sent)
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
                <p className="mt-2 text-sm font-medium text-red-400">{verifyError}</p>
              )}
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {resent && (
                <Alert tone="success" title="Confirmation email sent">
                  Check your inbox (and spam folder) for the new link. Supabase limits how many
                  emails can be sent per hour — if it does not arrive, wait a few minutes.
                </Alert>
              )}
              <button
                type="button"
                className="btn-secondary w-full"
                onClick={handleResend}
                disabled={busy || resent}
              >
                {busy ? 'Sending…' : resent ? 'Email sent' : 'Resend confirmation email'}
              </button>
              {verifyError && (
                <p className="text-sm font-medium text-red-400">{verifyError}</p>
              )}
            </div>
          )}

          <p className="mt-4 text-sm text-cream/65">
            Already confirmed?{' '}
            <Link to="/login" className="font-medium text-gold hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md py-6">
      <h1 className="text-2xl font-bold text-cream">Create your account</h1>
      <p className="mt-1 text-sm text-cream/65">
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
          <p className="mt-1 text-xs text-cream/45">
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

        {/* v4 — account type picker */}
        <div className="border-t border-cream/10 pt-4">
          <span className="label">I am registering as…</span>
          <div className="grid gap-2">
            {ACCOUNT_OPTIONS.map((type) => (
              <label
                key={type}
                className={classNames(
                  'flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors',
                  accountType === type
                    ? 'border-gold/60 bg-gold/10'
                    : 'border-cream/15 hover:border-cream/30 hover:bg-cream/5'
                )}
              >
                <input
                  type="radio"
                  name="account_type"
                  value={type}
                  checked={accountType === type}
                  onChange={() => setAccountType(type)}
                  className="mt-0.5 h-4 w-4 accent-gold"
                />
                <span>
                  <span className="block text-sm font-semibold text-cream">
                    {ACCOUNT_TYPES[type]}
                  </span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-cream/65">
                    {ACCOUNT_TYPE_DESCRIPTIONS[type]}
                  </span>
                </span>
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs text-cream/45">
            Doctors and businesses still donate and request blood — those abilities are inherited.
          </p>
        </div>

        {/* Doctor-specific fields */}
        {accountType === 'doctor' && (
          <div className="space-y-4 border-t border-cream/10 pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gold">
              Doctor details (verified by the hospital you apply to)
            </p>
            <div>
              <label className="label" htmlFor="license_id">
                Doctor license / PRC ID <span className="text-gold">*</span>
              </label>
              <input
                id="license_id"
                className="input"
                value={doctor.license_id}
                onChange={setDoctorField('license_id')}
                placeholder="e.g. PRC-0123456"
                maxLength={40}
              />
            </div>
            <div>
              <label className="label" htmlFor="specialization">
                Specialization
              </label>
              <input
                id="specialization"
                className="input"
                value={doctor.specialization}
                onChange={setDoctorField('specialization')}
                placeholder="e.g. Internal Medicine, Hematology"
                maxLength={80}
              />
            </div>
            <div>
              <label className="label" htmlFor="doctor_contact">
                Contact number <span className="text-gold">*</span>
              </label>
              <input
                id="doctor_contact"
                className="input"
                value={doctor.contact_number}
                onChange={setDoctorField('contact_number')}
                placeholder="0917-123-4567"
                maxLength={40}
              />
              <p className="mt-1 text-xs text-cream/45">
                Shown on your hospital&apos;s doctor directory entry. After registering, apply to a
                hospital from its page — the hospital admin verifies your application.
              </p>
            </div>
          </div>
        )}

        {/* Business-specific fields */}
        {accountType === 'business' && (
          <div className="space-y-4 border-t border-cream/10 pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gold">
              Hospital details (you become its admin)
            </p>
            <div>
              <label className="label" htmlFor="hospital_name">
                Hospital name <span className="text-gold">*</span>
              </label>
              <input
                id="hospital_name"
                className="input"
                value={hospital.name}
                onChange={setHospitalField('name')}
                placeholder="e.g. Quezon City General Hospital"
                maxLength={120}
              />
            </div>
            <div>
              <label className="label" htmlFor="hospital_region">
                Region <span className="text-gold">*</span>
              </label>
              <select
                id="hospital_region"
                className="input"
                value={hospital.region}
                onChange={setHospitalField('region')}
              >
                <option value="">Choose…</option>
                {REGIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="hospital_city">
                  City / municipality
                </label>
                <input
                  id="hospital_city"
                  className="input"
                  value={hospital.city}
                  onChange={setHospitalField('city')}
                  maxLength={60}
                />
              </div>
              <div>
                <label className="label" htmlFor="hospital_contact">
                  Contact number
                </label>
                <input
                  id="hospital_contact"
                  className="input"
                  value={hospital.contact_number}
                  onChange={setHospitalField('contact_number')}
                  placeholder="(02) 1234-5678"
                  maxLength={40}
                />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="hospital_address">
                Address
              </label>
              <input
                id="hospital_address"
                className="input"
                value={hospital.address}
                onChange={setHospitalField('address')}
                maxLength={200}
              />
            </div>
            <div>
              <label className="label" htmlFor="hospital_description">
                Short description
              </label>
              <textarea
                id="hospital_description"
                className="input min-h-[90px]"
                value={hospital.description}
                onChange={setHospitalField('description')}
                placeholder="What your hospital offers — blood bank hours, specialties, transfusion services…"
                maxLength={1200}
              />
              <p className="mt-1 text-xs text-cream/45">
                Your hospital starts as <span className="font-semibold">Pending</span> until a
                platform administrator verifies it. You can edit the description and add a photo
                from your hospital panel anytime.
              </p>
            </div>
          </div>
        )}

        {error && (
          <Alert tone="error" title="Registration failed">
            {error}
          </Alert>
        )}

        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy ? 'Creating account…' : 'Create account'}
        </button>

        <p className="text-center text-sm text-cream/65">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-gold hover:underline">
            Sign in
          </Link>
        </p>
      </form>

      <p className="mt-4 text-center text-xs leading-relaxed text-cream/45">
        By creating an account you understand that HemaMatch is an academic platform and that all
        blood-type matching is preliminary — actual eligibility is decided by healthcare
        professionals.
      </p>
    </div>
  );
}

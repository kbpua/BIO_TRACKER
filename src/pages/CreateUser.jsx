import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Eye,
  EyeOff,
  ShieldCheck,
  FlaskConical,
  GraduationCap,
  CircleCheck,
  CircleX,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getPasswordStrength(password) {
  let score = 0;
  if ((password || '').length >= 8) score += 1;
  if (/[A-Z]/.test(password || '')) score += 1;
  if (/[a-z]/.test(password || '')) score += 1;
  if (/[0-9]/.test(password || '')) score += 1;
  if (/[^A-Za-z0-9]/.test(password || '')) score += 1;
  if ((password || '').length >= 12) score += 1;

  if (score <= 2) return { label: 'Weak', color: 'bg-red-500', width: 'w-1/3' };
  if (score <= 4) return { label: 'Medium', color: 'bg-amber-400', width: 'w-2/3' };
  return { label: 'Strong', color: 'bg-mint-500', width: 'w-full' };
}

function generateSecurePassword(length = 14) {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const numbers = '23456789';
  const symbols = '!@#$%^&*()-_=+[]{}?';
  const all = upper + lower + numbers + symbols;

  const pick = (set) => set[Math.floor(Math.random() * set.length)];
  const chars = [pick(upper), pick(lower), pick(numbers), pick(symbols)];
  while (chars.length < length) chars.push(pick(all));
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

const ROLE_CARDS = [
  {
    id: 'Admin',
    title: 'Admin',
    Icon: ShieldCheck,
    description:
      'Full system control. Can manage users, projects, organisms, and all samples. Can approve accounts and export all data.',
  },
  {
    id: 'Researcher',
    title: 'Researcher',
    Icon: FlaskConical,
    description:
      'Can add samples, manage their own data, lead projects, and collaborate as a Co-Researcher on other projects. Can export CSV.',
  },
  {
    id: 'Student',
    title: 'Student',
    Icon: GraduationCap,
    description:
      'View-only access to published projects, samples, and organisms. Can browse educational content for learning and research reference.',
  },
];

export default function CreateUser() {
  const { user: currentUser, isAdmin, isSupabaseAuth } = useAuth();
  const navigate = useNavigate();
  const { addUser, users } = useData();

  useEffect(() => {
    if (!isAdmin) navigate('/dashboard', { replace: true });
  }, [isAdmin, navigate]);

  if (!isAdmin) return null;

  const [message, setMessage] = useState({ type: '', text: '' });
  const [submitting, setSubmitting] = useState(false);
  const [submitMode, setSubmitMode] = useState('create');
  const [showPasswords, setShowPasswords] = useState(false);
  const [touched, setTouched] = useState({});
  const [form, setForm] = useState({
    fullName: '',
    username: '',
    institution: '',
    contactNumber: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'Researcher',
    specialization: '',
    status: 'Active',
    createdBy: currentUser?.fullName ?? 'Admin',
  });

  const passwordStrength = useMemo(() => getPasswordStrength(form.password), [form.password]);
  const emailTaken = useMemo(
    () => (users || []).some((u) => u.email?.toLowerCase() === form.email.toLowerCase()),
    [users, form.email]
  );

  const validators = {
    fullName: (v) => String(v || '').trim().length > 0,
    email: (v) => EMAIL_RE.test(String(v || '').trim()) && !emailTaken,
    password: (v) =>
      String(v || '').length >= 8 &&
      /[A-Z]/.test(v || '') &&
      /[0-9]/.test(v || '') &&
      /[^A-Za-z0-9]/.test(v || ''),
    confirmPassword: (v) => String(v || '') === String(form.password || '') && String(v || '').length > 0,
    role: (v) => ['Admin', 'Researcher', 'Student'].includes(v),
  };

  const fieldValid = (name) => {
    const fn = validators[name];
    return fn ? fn(form[name]) : true;
  };

  const allRequiredValid = () =>
    ['fullName', 'email', 'password', 'confirmPassword', 'role'].every((k) => fieldValid(k));

  const setField = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const createUserPayload = () => {
    const payload = {
      fullName: form.fullName.trim(),
      displayName: form.username.trim(),
      institution: form.institution.trim(),
      contactNumber: form.contactNumber.trim(),
      email: form.email.trim(),
      password: form.password,
      role: form.role,
      status: form.status,
      specialization: form.role === 'Researcher' ? form.specialization.trim() : '',
      dateCreated: new Date().toISOString().split('T')[0],
      createdBy: currentUser?.fullName ?? 'Admin',
    };
    return payload;
  };

  const resetForm = () => {
    setForm({
      fullName: '',
      username: '',
      institution: '',
      contactNumber: '',
      email: '',
      password: '',
      confirmPassword: '',
      role: 'Researcher',
      specialization: '',
      status: 'Active',
      createdBy: currentUser?.fullName ?? 'Admin',
    });
    setTouched({});
  };

  const notify = (text, variant = 'success') => {
    try {
      window.dispatchEvent(new CustomEvent('biosample_flash', { detail: { message: text, variant } }));
    } catch {}
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });
    setTouched((t) => ({
      ...t,
      fullName: true,
      email: true,
      password: true,
      confirmPassword: true,
      role: true,
    }));
    if (!allRequiredValid()) {
      setMessage({ type: 'error', text: 'Unable to create user. Please check the form and try again.' });
      notify('Unable to create user. Please check the form and try again.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await new Promise((r) => setTimeout(r, 260));
      const payload = createUserPayload();
      addUser(payload);
      const successText = `User account created successfully. ${payload.fullName} has been added as a ${payload.role}.`;
      notify(successText, 'success');

      if (submitMode === 'create') {
        navigate('/users');
        return;
      }

      resetForm();
      setMessage({ type: 'success', text: 'User created. Form reset for next entry.' });
      notify('User created. Form reset for next entry.', 'success');
    } catch {
      setMessage({ type: 'error', text: 'Unable to create user. Please check the form and try again.' });
      notify('Unable to create user. Please check the form and try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const emailState = touched.email ? (fieldValid('email') ? 'valid' : 'invalid') : 'idle';
  const fullNameState = touched.fullName ? (fieldValid('fullName') ? 'valid' : 'invalid') : 'idle';
  const pwdState = touched.password ? (fieldValid('password') ? 'valid' : 'invalid') : 'idle';
  const confirmState = touched.confirmPassword ? (fieldValid('confirmPassword') ? 'valid' : 'invalid') : 'idle';

  const inputClass = (state = 'idle') =>
    `w-full px-3 py-2.5 border rounded-xl text-sm bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-mint-500/30 ${
      state === 'invalid'
        ? 'border-red-300 focus:border-red-400'
        : state === 'valid'
          ? 'border-mint-300 focus:border-mint-400'
          : 'border-gray-200 focus:border-mint-500'
    }`;

  return (
    <div className="max-w-5xl">
      <header className="pb-6 mb-8">
        <div className="min-h-11 flex items-center">
          <h1 className="text-3xl font-bold text-gray-800">Create User Account</h1>
        </div>
        <p className="text-sm text-gray-500 mt-1.5">Set up user details, credentials, and access in one place.</p>
      </header>

      {message.text && (
        <div
          className={`mb-4 p-3 rounded-lg text-sm ${
            message.type === 'success'
              ? 'bg-mint-50 text-mint-800 border border-mint-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}
      {isSupabaseAuth && (
        <div className="mb-4 p-3 rounded-lg text-sm bg-amber-50 text-amber-950 border border-amber-200">
          In Supabase mode, create users through the Register screen so Auth credentials are created correctly.
        </div>
      )}
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-mint-100 shadow-sm p-6 md:p-8 space-y-8">
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600">Personal Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Full Name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={form.fullName}
                  onBlur={() => setTouched((t) => ({ ...t, fullName: true }))}
                  onChange={(e) => setField('fullName', e.target.value)}
                  className={`${inputClass(fullNameState)} pr-9`}
                  placeholder="e.g. Dr. Maria Santos"
                />
                {fullNameState === 'valid' && <CircleCheck className="h-4 w-4 text-mint-600 absolute right-3 top-1/2 -translate-y-1/2" />}
                {fullNameState === 'invalid' && <CircleX className="h-4 w-4 text-red-500 absolute right-3 top-1/2 -translate-y-1/2" />}
              </div>
              {fullNameState === 'invalid' && <p className="text-xs text-red-600 mt-1">Full name is required.</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Username / Display Name <span className="text-gray-400">(Optional)</span></label>
              <input
                type="text"
                value={form.username}
                onChange={(e) => setField('username', e.target.value)}
                className={inputClass()}
                placeholder="e.g. maria.santos"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Institution / Department <span className="text-gray-400">(Optional)</span></label>
              <input
                type="text"
                value={form.institution}
                onChange={(e) => setField('institution', e.target.value)}
                className={inputClass()}
                placeholder="e.g. Molecular Biology Department"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Contact Number <span className="text-gray-400">(Optional)</span></label>
              <input
                type="tel"
                value={form.contactNumber}
                onChange={(e) => setField('contactNumber', e.target.value)}
                className={inputClass()}
                placeholder="+63..."
              />
            </div>
          </div>
        </section>

        <section className="space-y-4 border-t border-gray-100 pt-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600">Account Credentials</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Email <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={form.email}
                  onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                  onChange={(e) => setField('email', e.target.value)}
                  className={`${inputClass(emailState)} pr-9`}
                  placeholder="user@biosample.com"
                />
                {emailState === 'valid' && <CircleCheck className="h-4 w-4 text-mint-600 absolute right-3 top-1/2 -translate-y-1/2" />}
                {emailState === 'invalid' && <CircleX className="h-4 w-4 text-red-500 absolute right-3 top-1/2 -translate-y-1/2" />}
              </div>
              {touched.email && !EMAIL_RE.test(form.email) && (
                <p className="text-xs text-red-600 mt-1">Please enter a valid email format.</p>
              )}
              {touched.email && EMAIL_RE.test(form.email) && emailTaken && (
                <p className="text-xs text-red-600 mt-1">An account with this email already exists.</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPasswords ? 'text' : 'password'}
                  value={form.password}
                  onBlur={() => setTouched((t) => ({ ...t, password: true }))}
                  onChange={(e) => setField('password', e.target.value)}
                  className={`${inputClass(pwdState)} pr-9`}
                  placeholder="Enter secure password"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  aria-label={showPasswords ? 'Hide password' : 'Show password'}
                >
                  {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  const generated = generateSecurePassword(14);
                  setField('password', generated);
                  setField('confirmPassword', generated);
                  setTouched((t) => ({ ...t, password: true, confirmPassword: true }));
                }}
                className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-mint-200 bg-mint-50 text-mint-700 hover:bg-mint-100"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Generate Secure Password
              </button>
              <div className="mt-2">
                <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div className={`h-full ${passwordStrength.color} ${passwordStrength.width} transition-all`} />
                </div>
                <p className="text-xs text-gray-600 mt-1">Strength: {passwordStrength.label}</p>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Minimum 8 characters, at least one uppercase letter, one number, and one special character.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Confirm Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPasswords ? 'text' : 'password'}
                  value={form.confirmPassword}
                  onBlur={() => setTouched((t) => ({ ...t, confirmPassword: true }))}
                  onChange={(e) => setField('confirmPassword', e.target.value)}
                  className={`${inputClass(confirmState)} pr-9`}
                  placeholder="Re-enter password"
                />
                {confirmState === 'valid' && <CircleCheck className="h-4 w-4 text-mint-600 absolute right-3 top-1/2 -translate-y-1/2" />}
                {confirmState === 'invalid' && <CircleX className="h-4 w-4 text-red-500 absolute right-3 top-1/2 -translate-y-1/2" />}
              </div>
              {touched.confirmPassword && form.confirmPassword.length > 0 && (
                <p className={`text-xs mt-1 ${confirmState === 'valid' ? 'text-mint-600' : 'text-red-600'}`}>
                  {confirmState === 'valid' ? 'Passwords match.' : 'Passwords do not match.'}
                </p>
              )}
            </div>
          </div>
        </section>

        <section className="space-y-4 border-t border-gray-100 pt-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600">Role & Access</h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {ROLE_CARDS.map(({ id, title, description, Icon }) => {
              const selected = form.role === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setField('role', id);
                    setTouched((t) => ({ ...t, role: true }));
                  }}
                  className={`text-left rounded-xl border p-4 transition ${
                    selected
                      ? 'border-mint-500 bg-mint-50 shadow-sm'
                      : 'border-gray-200 bg-white hover:border-mint-300 hover:bg-mint-50/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <Icon className={`h-5 w-5 ${selected ? 'text-mint-700' : 'text-gray-500'}`} />
                    {selected && <CircleCheck className="h-4 w-4 text-mint-700" />}
                  </div>
                  <p className={`mt-2 font-semibold ${selected ? 'text-mint-900' : 'text-gray-800'}`}>{title}</p>
                  <p className={`mt-1 text-xs leading-relaxed ${selected ? 'text-mint-800' : 'text-gray-500'}`}>{description}</p>
                </button>
              );
            })}
          </div>

          {form.role === 'Admin' && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Admin accounts have unrestricted access to the entire system. Grant with caution.
            </p>
          )}

          {form.role === 'Researcher' && (
            <div className="max-w-xl">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Specialization / Research Area <span className="text-gray-400">(Optional)</span>
              </label>
              <input
                type="text"
                value={form.specialization}
                onChange={(e) => setField('specialization', e.target.value)}
                className={inputClass()}
                placeholder="e.g. Genomics, Bioinformatics"
              />
            </div>
          )}

          <div className="max-w-sm">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Account Status <span className="text-red-500">*</span>
            </label>
            <select
              value={form.status}
              onChange={(e) => setField('status', e.target.value)}
              className={inputClass()}
            >
              <option value="Active">Active</option>
              <option value="Pending">Pending</option>
              <option value="Deactivated">Deactivated</option>
            </select>
          </div>
        </section>

        <div className="border-t border-gray-100 pt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            disabled={submitting}
            onClick={() => navigate('/users')}
            className="px-4 py-2 rounded-xl border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={submitting || isSupabaseAuth}
            onClick={() => setSubmitMode('add-another')}
            className="px-4 py-2 rounded-xl border border-mint-300 text-sm font-medium text-mint-700 hover:bg-mint-50 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting && submitMode === 'add-another' ? 'Saving...' : 'Save & Add Another'}
          </button>

          <button
            type="submit"
            disabled={submitting || isSupabaseAuth}
            onClick={() => setSubmitMode('create')}
            className="px-4 py-2 rounded-xl bg-mint-800 bg-gradient-to-r from-[#0F766E] to-[#115E59] text-sm font-medium text-white hover:opacity-95 disabled:opacity-60 disabled:cursor-not-allowed shadow-sm shadow-mint-900/20 transition-opacity"
          >
            {submitting && submitMode === 'create' ? 'Creating...' : 'Create User'}
          </button>
        </div>
      </form>
    </div>
  );
}

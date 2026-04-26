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
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import {
  GeneratePasswordButton,
  PasswordMatchIndicator,
  PasswordRequirementsHint,
  PasswordStrengthIndicator,
  generateSecurePassword,
} from '../components/password/PasswordEnhancements';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  const canSubmit = allRequiredValid() && !submitting;

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

      if (isSupabaseAuth && isSupabaseConfigured() && supabase) {
        // Use an isolated auth client so the Admin browser session is not replaced by signUp.
        const signupClient = createClient(
          import.meta.env.VITE_SUPABASE_URL,
          import.meta.env.VITE_SUPABASE_ANON_KEY,
          {
            auth: {
              persistSession: false,
              autoRefreshToken: false,
              detectSessionInUrl: false,
            },
          }
        );

        const { data: authData, error: authError } = await signupClient.auth.signUp({
          email: payload.email,
          password: payload.password,
          options: {
            data: {
              full_name: payload.fullName,
              role: payload.role,
              status: payload.status,
              created_by: payload.createdBy,
            },
          },
        });
        if (authError) {
          const msg = String(authError.message || 'Registration failed.');
          if (/already registered|already exists|duplicate/i.test(msg)) {
            setMessage({ type: 'error', text: 'An account with this email already exists.' });
            notify('An account with this email already exists.', 'error');
            return;
          }
          setMessage({ type: 'error', text: msg });
          notify(msg, 'error');
          return;
        }

        const authUserId = authData?.user?.id;
        if (!authUserId) {
          setMessage({ type: 'error', text: 'Could not create the authentication user.' });
          notify('Could not create the authentication user.', 'error');
          return;
        }

        const { data: legacyId, error: legacyErr } = await supabase.rpc('generate_profile_legacy_id', {
          p_role: payload.role,
          p_full_name: payload.fullName,
        });
        if (legacyErr || !legacyId) {
          const msg = legacyErr?.message || 'Could not generate user ID.';
          setMessage({ type: 'error', text: msg });
          notify(msg, 'error');
          return;
        }

        const profileRow = {
          id: authUserId,
          legacy_id: legacyId,
          email: payload.email,
          full_name: payload.fullName,
          role: payload.role,
          status: payload.status,
          created_by: payload.createdBy,
          pending_days_remaining: payload.status === 'Pending' ? 3 : null,
        };

        const { data: existingProfile, error: checkErr } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', authUserId)
          .maybeSingle();
        if (checkErr) {
          const msg = checkErr.message || 'Unable to verify profile state.';
          setMessage({ type: 'error', text: msg });
          notify(msg, 'error');
          return;
        }

        let profileError = null;
        if (existingProfile?.id) {
          const { error } = await supabase
            .from('profiles')
            .update({
              legacy_id: profileRow.legacy_id,
              email: profileRow.email,
              full_name: profileRow.full_name,
              role: profileRow.role,
              status: profileRow.status,
              created_by: profileRow.created_by,
              pending_days_remaining: profileRow.pending_days_remaining,
            })
            .eq('id', authUserId);
          profileError = error;
        } else {
          const { error } = await supabase.from('profiles').insert(profileRow);
          profileError = error;
        }
        if (profileError) {
          const msg = profileError.message || 'Failed to create profile.';
          setMessage({ type: 'error', text: msg });
          notify(msg, 'error');
          return;
        }
      } else {
        addUser(payload);
      }

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
              <GeneratePasswordButton
                onGenerate={() => {
                  const generated = generateSecurePassword(14);
                  setField('password', generated);
                  setField('confirmPassword', generated);
                  setTouched((t) => ({ ...t, password: true, confirmPassword: true }));
                }}
              />
              <PasswordStrengthIndicator password={form.password} />
              <PasswordRequirementsHint />
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
              {touched.confirmPassword && (
                <PasswordMatchIndicator password={form.password} confirmPassword={form.confirmPassword} />
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
            disabled={!canSubmit}
            onClick={() => setSubmitMode('add-another')}
            className="px-4 py-2 rounded-xl border border-mint-300 text-sm font-medium text-mint-700 hover:bg-mint-50 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting && submitMode === 'add-another' ? 'Saving...' : 'Save & Add Another'}
          </button>

          <button
            type="submit"
            disabled={!canSubmit}
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

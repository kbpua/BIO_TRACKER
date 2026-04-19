import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FlaskConical, GraduationCap } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { isSupabaseConfigured } from '../lib/supabaseClient';

const ROLE_CARDS = [
  {
    id: 'Researcher',
    title: 'Researcher',
    Icon: FlaskConical,
    description:
      'Add samples, manage your data, lead projects, and collaborate as a Co-Researcher. Can export CSV.',
  },
  {
    id: 'Student',
    title: 'Student',
    Icon: GraduationCap,
    description:
      'View-only access to published projects, samples, and organisms. Browse educational content for learning and research.',
  },
];

export default function CompleteGoogleProfile() {
  const navigate = useNavigate();
  const {
    user,
    googleRegistrationUi,
    isHydratingSession,
    completeGoogleProfileRegistration,
    cancelGoogleRegistration,
    isSupabaseAuth,
  } = useAuth();

  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('Researcher');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [studentSuccess, setStudentSuccess] = useState(false);

  useEffect(() => {
    if (!isSupabaseAuth || !isSupabaseConfigured()) {
      navigate('/login', { replace: true });
      return;
    }
    if (user) {
      navigate('/dashboard', { replace: true });
      return;
    }
    if (isHydratingSession) return;
    if (googleRegistrationUi?.step !== 'needs_role') {
      navigate('/login', { replace: true });
      return;
    }
    setFullName(
      googleRegistrationUi.defaultFullName ||
        googleRegistrationUi.email?.split('@')[0] ||
        ''
    );
  }, [googleRegistrationUi, isHydratingSession, isSupabaseAuth, navigate, user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!fullName.trim()) {
      setError('Please enter your full name.');
      return;
    }
    setSubmitting(true);
    try {
      const result = await completeGoogleProfileRegistration({ fullName: fullName.trim(), role });
      if (!result.success) {
        if (result.error === 'duplicate_email') {
          setError('An account with this email already exists. Please contact your administrator.');
          await cancelGoogleRegistration();
          navigate('/login', { replace: true });
          return;
        }
        setError(result.error || 'Registration failed.');
        return;
      }
      if (result.outcome === 'researcher_pending') {
        navigate('/login', { replace: true, state: { googleResearcherSubmitted: true } });
        return;
      }
      if (result.outcome === 'student_active') {
        setStudentSuccess(true);
        setTimeout(() => navigate('/dashboard', { replace: true }), 1600);
      }
    } catch (err) {
      console.error(err);
      setError(err?.message || 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    await cancelGoogleRegistration();
    navigate('/login', { replace: true });
  };

  if (!isSupabaseAuth || isHydratingSession || googleRegistrationUi?.step !== 'needs_role') {
    return (
      <div className="min-h-screen bg-mint-50 flex items-center justify-center p-6">
        <p className="text-sm text-gray-600">Loading…</p>
      </div>
    );
  }

  const readOnlyEmail = googleRegistrationUi.email || '';

  return (
    <div className="min-h-screen bg-mint-50 flex items-center justify-center p-6 font-sans">
      <div className="w-full max-w-lg">
        <div className="bg-white rounded-2xl shadow-lg border border-mint-100 p-8">
          <h1 className="text-2xl font-bold text-mint-800 text-center mb-1">Complete your registration</h1>
          <p className="text-gray-500 text-center text-sm mb-6">
            Choose your role to finish setting up your BioSample Tracker account.
          </p>

          {studentSuccess && (
            <div className="mb-4 rounded-lg bg-mint-50 border border-mint-200 text-mint-900 text-sm px-4 py-3 text-center">
              Account created successfully! Redirecting to your dashboard…
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="cg-full-name" className="block text-sm font-medium text-gray-700 mb-1">
                Full name
              </label>
              <input
                id="cg-full-name"
                type="text"
                value={fullName}
                onChange={(ev) => setFullName(ev.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:ring-2 focus:ring-mint-500 focus:border-mint-500 outline-none"
                autoComplete="name"
                disabled={studentSuccess}
              />
            </div>

            <div>
              <span className="block text-sm font-medium text-gray-700 mb-1">Email</span>
              <div className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-gray-600 text-sm">
                {readOnlyEmail}
              </div>
            </div>

            <div>
              <span className="block text-sm font-medium text-gray-700 mb-2">Role</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {ROLE_CARDS.map(({ id, title, Icon, description }) => (
                  <label
                    key={id}
                    className={`cursor-pointer rounded-xl border-2 p-4 flex flex-col gap-2 transition-colors ${
                      role === id
                        ? 'border-mint-600 bg-mint-50/80 ring-1 ring-mint-600'
                        : 'border-gray-200 hover:border-mint-300'
                    } ${studentSuccess ? 'opacity-60 pointer-events-none' : ''}`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="google-role"
                        value={id}
                        checked={role === id}
                        onChange={() => setRole(id)}
                        className="text-mint-600 focus:ring-mint-500"
                        disabled={studentSuccess}
                      />
                      <Icon className="h-5 w-5 text-mint-700 shrink-0" aria-hidden />
                      <span className="font-semibold text-gray-900">{title}</span>
                    </div>
                    <p className="text-xs text-gray-600 leading-snug pl-6">{description}</p>
                  </label>
                ))}
              </div>
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || studentSuccess}
              className="w-full py-2.5 bg-mint-600 text-white font-medium rounded-lg hover:bg-mint-700 transition-colors disabled:opacity-60"
            >
              {submitting ? 'Saving…' : 'Complete Registration'}
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={handleCancel}
                className="text-sm text-mint-700 hover:underline disabled:opacity-50"
                disabled={submitting}
              >
                Cancel — sign out and return to login
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

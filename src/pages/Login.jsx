import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, Moon, Sun } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { useTheme } from '../contexts/ThemeContext';
import {
  GeneratePasswordButton,
  PasswordMatchIndicator,
  PasswordRequirementsHint,
  PasswordStrengthIndicator,
  generateSecurePassword,
} from '../components/password/PasswordEnhancements';

const REGISTER_ROLES = ['Researcher', 'Student'];

function FieldErrorPopup({ message, onClose }) {
  if (!message) return null;
  return (
    <div className="absolute left-0 top-full z-20 mt-1 w-full">
      <div className="relative rounded-lg bg-red-600 text-white text-xs pl-3 pr-8 py-2 border border-red-500 shadow-md">
        <span className="absolute -top-1 left-4 h-2 w-2 rotate-45 bg-red-600 border-l border-t border-red-500" />
        <button
          type="button"
          onClick={onClose}
          className="absolute top-1 right-2 text-white/90 hover:text-white"
          aria-label="Close error message"
        >
          ×
        </button>
        {message}
      </div>
    </div>
  );
}

function GoogleLogo() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.55-.2-2.27H12v4.29h6.45a5.5 5.5 0 0 1-2.39 3.61v3h3.87c2.26-2.09 3.56-5.16 3.56-8.63z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.87-3a7.2 7.2 0 0 1-10.72-3.78H1.36v3.09A12 12 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.36 14.31A7.2 7.2 0 0 1 4.96 12c0-.8.14-1.57.4-2.31V6.6H1.36A12 12 0 0 0 0 12c0 1.93.46 3.75 1.36 5.4l4-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.34.61 4.58 1.8l3.44-3.44C17.96 1.19 15.24 0 12 0A12 12 0 0 0 1.36 6.6l4 3.09A7.2 7.2 0 0 1 12 4.77z"
      />
    </svg>
  );
}

export default function Login() {
  const { isDark, toggleTheme } = useTheme();
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [registerEmailError, setRegisterEmailError] = useState('');
  const [registerPasswordError, setRegisterPasswordError] = useState('');
  const [registerConfirmError, setRegisterConfirmError] = useState('');
  const [registerGeneralError, setRegisterGeneralError] = useState('');
  const [dismissedPasswordError, setDismissedPasswordError] = useState(false);
  const [dismissedConfirmError, setDismissedConfirmError] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [registerForm, setRegisterForm] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'Researcher',
  });
  const {
    login,
    loginWithGoogle,
    register,
    isSupabaseAuth,
    isHydratingSession,
    authBlockedMessage,
    clearAuthBlockedMessage,
    googleRegistrationUi,
  } = useAuth();
  const { users, addUser } = useData();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/dashboard';

  const [processingOAuth, setProcessingOAuth] = useState(() => {
    const hash = window.location.hash || '';
    const search = window.location.search || '';
    return (
      hash.includes('access_token') ||
      hash.includes('refresh_token') ||
      search.includes('code=')
    );
  });

  useEffect(() => {
    if (!processingOAuth) return;
    const timeout = setTimeout(() => setProcessingOAuth(false), 6000);
    return () => clearTimeout(timeout);
  }, [processingOAuth]);

  useEffect(() => {
    if (!isHydratingSession && processingOAuth) {
      setProcessingOAuth(false);
    }
  }, [isHydratingSession, processingOAuth]);

  useEffect(() => {
    if (isHydratingSession) return;
    if (!isSupabaseAuth) return;
    if (googleRegistrationUi?.step === 'needs_role') {
      navigate('/auth/complete-google-profile', { replace: true });
    } else if (googleRegistrationUi?.step === 'pending_researcher') {
      navigate('/auth/google-pending', { replace: true });
    }
  }, [googleRegistrationUi, isHydratingSession, isSupabaseAuth, navigate]);

  useEffect(() => {
    if (!location.state?.googleResearcherSubmitted) return;
    setSuccessMessage(
      'Your account has been submitted for admin approval. You will be able to access the system once an administrator approves your account.'
    );
    navigate('/login', { replace: true, state: {} });
  }, [location.state?.googleResearcherSubmitted, navigate]);

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailLooksValid) {
      setError('Please enter a valid email address.');
      return;
    }
    setSubmitting(true);
    try {
      const result = await login(email, password, users);
      if (result.success) {
        navigate(from, { replace: true });
      } else {
        setError(result.error || 'Login failed.');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError(err?.message || 'An unexpected error occurred during login.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setRegisterEmailError('');
    setRegisterPasswordError('');
    setRegisterConfirmError('');
    setRegisterGeneralError('');
    setDismissedPasswordError(false);
    setDismissedConfirmError(false);
    setSuccessMessage('');
    if (!registerForm.fullName.trim() || !registerForm.email.trim() || !registerForm.password || !registerForm.confirmPassword) {
      setRegisterGeneralError('Please fill out all required fields.');
      return;
    }
    const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(registerForm.email);
    if (!emailLooksValid) {
      setRegisterEmailError('Please enter a valid email address.');
      return;
    }
    if (registerForm.password !== registerForm.confirmPassword) {
      setRegisterConfirmError('Passwords do not match.');
      setDismissedConfirmError(false);
      return;
    }
    const pwd = registerForm.password || '';
    const hasMinLen = pwd.length >= 8;
    const hasLower = /[a-z]/.test(pwd);
    const hasUpper = /[A-Z]/.test(pwd);
    const hasNumber = /[0-9]/.test(pwd);
    const hasSpecial = /[^A-Za-z0-9]/.test(pwd);
    if (!(hasMinLen && hasLower && hasUpper && hasNumber && hasSpecial)) {
      setRegisterPasswordError('Password must be at least 8 characters and include at least 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character.');
      setDismissedPasswordError(false);
      return;
    }
    const existing = users.some((u) => u.email?.toLowerCase() === registerForm.email.toLowerCase());
    if (!isSupabaseAuth && existing) {
      setRegisterEmailError('An account with this email already exists.');
      return;
    }
    const isResearcher = registerForm.role === 'Researcher';
    if (isSupabaseAuth) {
      const result = await register({
        fullName: registerForm.fullName,
        email: registerForm.email,
        password: registerForm.password,
        role: registerForm.role,
      });
      if (!result.success) {
        setRegisterGeneralError(result.error || 'Registration failed.');
        return;
      }
    } else {
      addUser({
        fullName: registerForm.fullName,
        email: registerForm.email,
        password: registerForm.password,
        role: registerForm.role,
        status: isResearcher ? 'Pending' : 'Active',
        createdBy: 'Self',
        pendingDaysRemaining: isResearcher ? 2 : undefined,
      });
    }
    setRegisterForm({ fullName: '', email: '', password: '', confirmPassword: '', role: 'Researcher' });
    // Keep researcher registration silent on this screen to avoid showing a persistent notice banner.
    setSuccessMessage(isResearcher ? '' : 'Account created successfully! You can now log in.');
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setSuccessMessage('');
    setSubmitting(true);
    try {
      const result = await loginWithGoogle();
      if (!result.success) {
        setError(result.error || 'Google sign-in failed.');
      }
    } catch (err) {
      console.error('Google sign-in error:', err);
      setError(err?.message || 'An unexpected error occurred during Google sign-in.');
    } finally {
      setSubmitting(false);
    }
  };

  if (processingOAuth || isHydratingSession) {
    return (
      <div className="min-h-screen bg-mint-50 dark:bg-slate-900 flex items-center justify-center p-6 font-sans transition-colors duration-300">
        <div className="fixed top-4 right-4 z-20 md:right-6">
          <button
            type="button"
            onClick={toggleTheme}
            className="h-11 w-11 rounded-full border border-teal-200 bg-white text-teal-700 shadow-sm hover:bg-teal-50 dark:border-slate-600 dark:bg-slate-800 dark:text-teal-200 dark:hover:bg-teal-400/45 dark:hover:border-teal-300 transition-colors duration-300 inline-flex items-center justify-center"
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
        </div>
        <div className="w-full max-w-md">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-mint-100 dark:border-slate-700 p-8 text-center transition-colors duration-300">
            <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-white dark:bg-slate-700 ring-1 ring-mint-200 dark:ring-slate-600 overflow-hidden">
              <img
                src={isDark ? '/logo-dark.png' : '/logo.png'}
                alt="BioSample Tracker logo"
                className={`h-9 w-9 object-contain ${isDark ? 'scale-125' : ''}`}
              />
            </div>
            <h1 className="text-2xl font-bold text-mint-800 dark:text-mint-300 mb-2">BioSample Tracker</h1>
            <p className="text-gray-500 text-sm">Signing you in with Google...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-mint-50 dark:bg-slate-900 flex items-center justify-center p-6 font-sans transition-colors duration-300">
      <div className="fixed top-4 right-4 z-20 md:right-6">
        <button
          type="button"
          onClick={toggleTheme}
          className="h-11 w-11 rounded-full border border-teal-200 bg-white text-teal-700 shadow-sm hover:bg-teal-50 dark:border-slate-600 dark:bg-slate-800 dark:text-teal-200 dark:hover:bg-teal-400/45 dark:hover:border-teal-300 transition-colors duration-300 inline-flex items-center justify-center"
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>
      </div>
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-mint-100 dark:border-slate-700 p-8 transition-colors duration-300">
          <div className="mb-3 flex justify-center">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white dark:bg-slate-700 ring-1 ring-mint-200 dark:ring-slate-600 overflow-hidden">
              <img
                src={isDark ? '/logo-dark.png' : '/logo.png'}
                alt="BioSample Tracker logo"
                className={`h-9 w-9 object-contain ${isDark ? 'scale-125' : ''}`}
              />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-mint-800 dark:text-mint-300 text-center mb-2">
            BioSample Tracker
          </h1>
          <p className="text-gray-500 text-center text-sm mb-4">
            {mode === 'login' ? 'Sign in to your account' : 'Create a new account'}
          </p>

          {authBlockedMessage && (
            <div className="mb-4 p-3 rounded-lg bg-amber-50 text-amber-800 text-sm border border-amber-200 flex items-start gap-2">
              <svg className="h-5 w-5 shrink-0 mt-0.5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1">
                <p className="font-medium">Account pending approval</p>
                <p className="mt-0.5">{authBlockedMessage}</p>
              </div>
              <button type="button" onClick={clearAuthBlockedMessage} className="shrink-0 text-amber-400 hover:text-amber-600" aria-label="Dismiss">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          <div className="flex rounded-lg border border-mint-200 p-0.5 mb-6 bg-mint-50">
            <button
              type="button"
              onClick={() => { setMode('login'); setError(''); setSuccessMessage(''); clearAuthBlockedMessage(); }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${mode === 'login' ? 'bg-white text-mint-800 dark:text-mint-300 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => { setMode('register'); setError(''); setSuccessMessage(''); clearAuthBlockedMessage(); }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${mode === 'register' ? 'bg-white text-mint-800 dark:text-mint-300 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}
            >
              Register
            </button>
          </div>

          {mode === 'login' ? (
            <form onSubmit={handleLoginSubmit} className="space-y-4" noValidate>
              {error && (
                <div className="p-3 rounded-lg bg-red-700 text-white text-sm border border-red-600 shadow-sm">
                  {error}
                </div>
              )}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-mint-500 focus:border-mint-500"
                  placeholder="you@biosample.com"
                  required
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showLoginPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-mint-500 focus:border-mint-500"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword((v) => !v)}
                    className="absolute inset-y-0 right-0 px-3 text-gray-500 hover:text-gray-700"
                    aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                  >
                    {showLoginPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={isHydratingSession || submitting}
                className="w-full py-2.5 bg-mint-800 bg-gradient-to-r from-[#0F766E] to-[#115E59] text-white font-medium rounded-lg hover:opacity-95 transition-opacity disabled:opacity-70"
              >
                {isHydratingSession ? 'Loading session...' : submitting ? 'Signing in...' : 'Sign in'}
              </button>
              {isSupabaseAuth && (
                <>
                  <div className="flex items-center gap-3">
                    <div className="h-px flex-1 bg-gray-200" />
                    <span className="text-xs text-gray-400">OR</span>
                    <div className="h-px flex-1 bg-gray-200" />
                  </div>
                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={isHydratingSession || submitting}
                    className="w-full py-2.5 bg-white text-gray-700 border border-gray-300 font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-70 flex items-center justify-center gap-2"
                  >
                    <GoogleLogo />
                    Sign in with Google
                  </button>
                </>
              )}
            </form>
          ) : (
            <form onSubmit={handleRegisterSubmit} className="space-y-4" noValidate>
              {registerGeneralError && (
                <div className="p-3 rounded-lg bg-red-600 text-white text-sm border border-red-500 shadow-sm">
                  {registerGeneralError}
                </div>
              )}
              {successMessage && (
                <div className="p-3 rounded-lg bg-mint-50 text-mint-800 dark:text-mint-300 text-sm border border-mint-200">
                  {successMessage}
                </div>
              )}
              <div>
                <label htmlFor="reg-fullName" className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name
                </label>
                <input
                  id="reg-fullName"
                  type="text"
                  value={registerForm.fullName}
                  onChange={(e) => setRegisterForm((f) => ({ ...f, fullName: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-mint-500 focus:border-mint-500"
                  placeholder="Your full name"
                  required
                />
              </div>
              <div>
                <label htmlFor="reg-email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  id="reg-email"
                  type="email"
                  value={registerForm.email}
                  onChange={(e) => {
                    setRegisterForm((f) => ({ ...f, email: e.target.value }));
                    setRegisterEmailError('');
                    setRegisterGeneralError('');
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-mint-500 focus:border-mint-500"
                  placeholder="you@biosample.com"
                  required
                />
                {registerEmailError && (
                  <div className="mt-2 rounded-lg bg-red-600 text-white text-xs px-3 py-2 border border-red-500 shadow-sm">
                    {registerEmailError}
                  </div>
                )}
              </div>
              <div>
                <label htmlFor="reg-password" className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="reg-password"
                    type={showRegisterPassword ? 'text' : 'password'}
                    value={registerForm.password}
                    onChange={(e) => {
                      setRegisterForm((f) => ({ ...f, password: e.target.value }));
                      setRegisterPasswordError('');
                      setRegisterGeneralError('');
                      setDismissedPasswordError(false);
                    }}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-mint-500 focus:border-mint-500"
                    placeholder="At least 8 characters (Aa1!...)"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegisterPassword((v) => !v)}
                    className="absolute inset-y-0 right-0 px-3 text-gray-500 hover:text-gray-700"
                    aria-label={showRegisterPassword ? 'Hide password' : 'Show password'}
                  >
                    {showRegisterPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                  <FieldErrorPopup
                    message={dismissedPasswordError ? '' : registerPasswordError}
                    onClose={() => setDismissedPasswordError(true)}
                  />
                </div>
                <GeneratePasswordButton
                  onGenerate={() => {
                    const generated = generateSecurePassword(14);
                    setRegisterForm((f) => ({ ...f, password: generated, confirmPassword: generated }));
                    setShowRegisterPassword(true);
                    setShowConfirmPassword(true);
                    setRegisterPasswordError('');
                    setRegisterConfirmError('');
                    setRegisterGeneralError('');
                    setDismissedPasswordError(false);
                    setDismissedConfirmError(false);
                  }}
                />
                <PasswordStrengthIndicator password={registerForm.password} />
                <PasswordRequirementsHint />
              </div>
              <div className="relative">
                <label htmlFor="reg-confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    id="reg-confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={registerForm.confirmPassword}
                    onChange={(e) => {
                      setRegisterForm((f) => ({ ...f, confirmPassword: e.target.value }));
                      setRegisterConfirmError('');
                      setRegisterGeneralError('');
                      setDismissedConfirmError(false);
                    }}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-mint-500 focus:border-mint-500"
                    placeholder="Confirm password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    className="absolute inset-y-0 right-0 px-3 text-gray-500 hover:text-gray-700"
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                <FieldErrorPopup
                  message={dismissedConfirmError ? '' : registerConfirmError}
                  onClose={() => setDismissedConfirmError(true)}
                />
                <PasswordMatchIndicator
                  password={registerForm.password}
                  confirmPassword={registerForm.confirmPassword}
                  className="mt-2"
                />
              </div>
              <div>
                <label htmlFor="reg-role" className="block text-sm font-medium text-gray-700 mb-1">
                  Role
                </label>
                <select
                  id="reg-role"
                  value={registerForm.role}
                  onChange={(e) => setRegisterForm((f) => ({ ...f, role: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-mint-500 focus:border-mint-500"
                >
                  {REGISTER_ROLES.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                disabled={isHydratingSession}
                className="w-full py-2.5 bg-mint-800 bg-gradient-to-r from-[#0F766E] to-[#115E59] text-white font-medium rounded-lg hover:opacity-95 transition-opacity"
              >
                Register
              </button>
              {isSupabaseAuth && (
                <>
                  <div className="flex items-center gap-3">
                    <div className="h-px flex-1 bg-gray-200" />
                    <span className="text-xs text-gray-400">OR</span>
                    <div className="h-px flex-1 bg-gray-200" />
                  </div>
                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={isHydratingSession || submitting}
                    className="w-full py-2.5 bg-white text-gray-700 border border-gray-300 font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-70 flex items-center justify-center gap-2"
                  >
                    <GoogleLogo />
                    Sign up with Google
                  </button>
                </>
              )}
            </form>
          )}

          {mode === 'login' && !isSupabaseAuth && (
            <p className="mt-4 text-xs text-gray-400 text-center">
              Test: admin@biosample.com / admin123 · researcher@biosample.com / research123 · maria.co@biosample.com / research123 (Dr. Maria Santos — Researcher) · student@biosample.com / student123 · pending@biosample.com / pending123 (pending)
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

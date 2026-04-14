import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';

const REGISTER_ROLES = ['Researcher', 'Student'];

export default function Login() {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [registerForm, setRegisterForm] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'Researcher',
  });
  const { login } = useAuth();
  const { users, addUser } = useData();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/dashboard';

  const handleLoginSubmit = (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    const result = login(email, password, users);
    if (result.success) {
      navigate(from, { replace: true });
    } else {
      setError(result.error || 'Login failed.');
    }
  };

  const handleRegisterSubmit = (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    if (registerForm.password !== registerForm.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    const pwd = registerForm.password || '';
    const hasMinLen = pwd.length >= 8;
    const hasLower = /[a-z]/.test(pwd);
    const hasUpper = /[A-Z]/.test(pwd);
    const hasNumber = /[0-9]/.test(pwd);
    const hasSpecial = /[^A-Za-z0-9]/.test(pwd);
    if (!(hasMinLen && hasLower && hasUpper && hasNumber && hasSpecial)) {
      setError('Password must be at least 8 characters and include at least 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character.');
      return;
    }
    const existing = users.some((u) => u.email?.toLowerCase() === registerForm.email.toLowerCase());
    if (existing) {
      setError('An account with this email already exists.');
      return;
    }
    const isResearcher = registerForm.role === 'Researcher';
    addUser({
      fullName: registerForm.fullName,
      email: registerForm.email,
      password: registerForm.password,
      role: registerForm.role,
      status: isResearcher ? 'Pending' : 'Active',
      createdBy: 'Self',
      pendingDaysRemaining: isResearcher ? 2 : undefined,
    });
    setRegisterForm({ fullName: '', email: '', password: '', confirmPassword: '', role: 'Researcher' });
    setSuccessMessage(
      isResearcher
        ? 'Your account has been submitted for admin approval. You will be able to log in once an administrator approves your account.'
        : 'Account created successfully! You can now log in.'
    );
  };

  return (
    <div className="min-h-screen bg-mint-50 flex items-center justify-center p-6 font-sans">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-lg border border-mint-100 p-8">
          <h1 className="text-2xl font-bold text-mint-800 text-center mb-2">
            BioSample Tracker
          </h1>
          <p className="text-gray-500 text-center text-sm mb-4">
            {mode === 'login' ? 'Sign in to your account' : 'Create a new account'}
          </p>

          <div className="flex rounded-lg border border-mint-200 p-0.5 mb-6 bg-mint-50">
            <button
              type="button"
              onClick={() => { setMode('login'); setError(''); setSuccessMessage(''); }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${mode === 'login' ? 'bg-white text-mint-800 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => { setMode('register'); setError(''); setSuccessMessage(''); }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${mode === 'register' ? 'bg-white text-mint-800 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}
            >
              Register
            </button>
          </div>

          {mode === 'login' ? (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              {error && (
                <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">
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
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-mint-500 focus:border-mint-500"
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 bg-mint-800 bg-gradient-to-r from-[#0F766E] to-[#115E59] text-white font-medium rounded-lg hover:opacity-95 transition-opacity"
              >
                Sign in
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              {error && (
                <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">
                  {error}
                </div>
              )}
              {successMessage && (
                <div className="p-3 rounded-lg bg-mint-50 text-mint-800 text-sm border border-mint-200">
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
                  onChange={(e) => setRegisterForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-mint-500 focus:border-mint-500"
                  placeholder="you@biosample.com"
                  required
                />
              </div>
              <div>
                <label htmlFor="reg-password" className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <input
                  id="reg-password"
                  type="password"
                  value={registerForm.password}
                  onChange={(e) => setRegisterForm((f) => ({ ...f, password: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-mint-500 focus:border-mint-500"
                  placeholder="At least 8 characters (Aa1!...)"
                  required
                  minLength={8}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Must include at least 1 uppercase, 1 lowercase, 1 number, 1 special character, and be 8+ characters.
                </p>
              </div>
              <div>
                <label htmlFor="reg-confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm Password
                </label>
                <input
                  id="reg-confirmPassword"
                  type="password"
                  value={registerForm.confirmPassword}
                  onChange={(e) => setRegisterForm((f) => ({ ...f, confirmPassword: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-mint-500 focus:border-mint-500"
                  placeholder="Confirm password"
                  required
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
                className="w-full py-2.5 bg-mint-800 bg-gradient-to-r from-[#0F766E] to-[#115E59] text-white font-medium rounded-lg hover:opacity-95 transition-opacity"
              >
                Register
              </button>
            </form>
          )}

          {mode === 'login' && (
            <p className="mt-4 text-xs text-gray-400 text-center">
              Test: admin@biosample.com / admin123 · researcher@biosample.com / research123 · maria.co@biosample.com / research123 (Dr. Maria Santos — Researcher) · student@biosample.com / student123 · pending@biosample.com / pending123 (pending)
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

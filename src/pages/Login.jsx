import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/dashboard';

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    const result = login(email, password);
    if (result.success) {
      navigate(from, { replace: true });
    } else {
      setError(result.error || 'Login failed.');
    }
  };

  return (
    <div className="min-h-screen bg-mint-50 flex items-center justify-center p-6 font-sans">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-lg border border-mint-100 p-8">
          <h1 className="text-2xl font-bold text-mint-800 text-center mb-2">
            BioSample Tracker
          </h1>
          <p className="text-gray-500 text-center text-sm mb-6">
            Sign in to your account
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
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
              className="w-full py-2.5 bg-mint-600 text-white font-medium rounded-lg hover:bg-mint-700 transition-colors"
            >
              Sign in
            </button>
          </form>
          <p className="mt-4 text-xs text-gray-400 text-center">
            Test: admin@biosample.com / admin123 · researcher@biosample.com / research123 · student@biosample.com / student123
          </p>
        </div>
      </div>
    </div>
  );
}

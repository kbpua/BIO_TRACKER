import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { isSupabaseConfigured } from '../lib/supabaseClient';

export default function GoogleAccountPending() {
  const navigate = useNavigate();
  const {
    user,
    googleRegistrationUi,
    isHydratingSession,
    refreshGooglePendingProfile,
    logout,
    isSupabaseAuth,
  } = useAuth();
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState('');

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
    if (googleRegistrationUi?.step !== 'pending_researcher') {
      navigate('/login', { replace: true });
    }
  }, [googleRegistrationUi, isHydratingSession, isSupabaseAuth, navigate, user]);

  const handleCheckStatus = async () => {
    setCheckError('');
    setChecking(true);
    try {
      const { nowActive, error } = await refreshGooglePendingProfile();
      if (error) setCheckError(error);
      if (nowActive) {
        navigate('/dashboard', { replace: true });
      }
    } catch (e) {
      setCheckError(e?.message || 'Could not refresh status.');
    } finally {
      setChecking(false);
    }
  };

  if (!isSupabaseAuth || isHydratingSession || googleRegistrationUi?.step !== 'pending_researcher') {
    return (
      <div className="min-h-screen bg-mint-50 flex items-center justify-center p-6">
        <p className="text-sm text-gray-600">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-mint-50 flex items-center justify-center p-6 font-sans">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-lg border border-amber-100 p-8 text-center">
          <h1 className="text-xl font-bold text-gray-900 mb-3">Account pending approval</h1>
          <p className="text-gray-600 text-sm mb-6">
            Your account is pending admin approval. Please contact your administrator.
          </p>
          {checkError && (
            <p className="text-red-600 text-sm mb-4" role="alert">
              {checkError}
            </p>
          )}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              type="button"
              onClick={handleCheckStatus}
              disabled={checking}
              className="py-2.5 px-4 bg-mint-600 text-white font-medium rounded-lg hover:bg-mint-700 transition-colors disabled:opacity-60"
            >
              {checking ? 'Checking…' : 'Check status'}
            </button>
            <button
              type="button"
              onClick={() => {
                void logout();
                navigate('/login', { replace: true });
              }}
              className="py-2.5 px-4 border border-gray-300 text-gray-800 font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

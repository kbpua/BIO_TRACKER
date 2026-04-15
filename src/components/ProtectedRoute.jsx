import { Navigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function ProtectedRoute({ children, adminOnly = false }) {
  const { user, isAdmin, isHydratingSession } = useAuth();
  const location = useLocation();

  if (isHydratingSession) {
    return (
      <div className="min-h-screen bg-mint-50 flex items-center justify-center p-6">
        <p className="text-sm text-gray-600">Checking session...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (adminOnly && !isAdmin) {
    return (
      <div className="min-h-screen bg-mint-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
          <h1 className="text-xl font-semibold text-gray-800 mb-2">Access Denied</h1>
          <p className="text-gray-600 mb-4">You do not have permission to view this page.</p>
          <Link to="/dashboard" className="text-mint-700 font-medium hover:underline">
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return children;
}

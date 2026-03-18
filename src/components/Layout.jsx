import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';

const navItem = (to, label, icon) => ({ to, label, icon });

export function Layout({ children }) {
  const { user, logout, isAdmin, canExportData } = useAuth();
  const { pendingCount } = useData();
  const navigate = useNavigate();

  const allNavItems = [
    navItem('/dashboard', 'Dashboard', '📊'),
    navItem('/samples', 'Samples', '🧪'),
    navItem('/projects', 'Projects', '📁'),
    navItem('/organisms', 'Organisms', '🦠'),
    ...(isAdmin ? [navItem('/users', 'User Management', '👥')] : []),
    ...(isAdmin ? [navItem('/create-user', 'Create User', '➕')] : []),
    ...(canExportData ? [navItem('/export', 'Export Data', '📤')] : []),
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-mint-50/80 flex font-sans">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-mint-200 flex flex-col shrink-0">
        <div className="p-4 border-b border-mint-100">
          <h2 className="font-semibold text-mint-800 text-lg">BioSample Tracker</h2>
        </div>
        <nav className="p-2 flex-1">
          {allNavItems.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-mint-100 text-mint-800'
                    : 'text-gray-600 hover:bg-mint-50 hover:text-mint-700'
                }`
              }
            >
              <span>{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top navbar */}
        <header className="h-14 bg-white border-b border-mint-200 flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-4">
            <span className="font-medium text-gray-800">{user?.fullName}</span>
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-mint-100 text-mint-800">
              {user?.role}
            </span>
            {isAdmin && pendingCount > 0 && (
              <span className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                🔔 {pendingCount} pending
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Logout
          </button>
        </header>

        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}

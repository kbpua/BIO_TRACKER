import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import {
  LayoutDashboard,
  FlaskConical,
  FolderKanban,
  Dna,
  Users,
  UserPlus,
  Bell,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';

const navItem = (to, label, Icon) => ({ to, label, Icon });

export function Layout({ children }) {
  const { user, logout, isAdmin } = useAuth();
  const { pendingCount } = useData();
  const navigate = useNavigate();
  const location = useLocation();
  const [toasts, setToasts] = useState([]);

  const toastQueueKey = user?.fullName ? `biosample_toast_queue:${user.fullName}` : null;

  const pushToast = (payload) => {
    const toast = {
      id: `t-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      message: String(payload?.message || ''),
      variant: payload?.variant === 'error' ? 'error' : 'success',
      durationMs: Number(payload?.durationMs) > 0 ? Number(payload.durationMs) : 4500,
      createdAt: Date.now(),
    };
    setToasts((prev) => [toast, ...prev].slice(0, 3));
  };

  useEffect(() => {
    // Per-user queued toasts: drain once per navigation for the currently logged-in user.
    if (!toastQueueKey) return;
    try {
      const raw = sessionStorage.getItem(toastQueueKey);
      if (!raw) return;
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length > 0) {
        // Show oldest-first.
        arr.forEach((p) => pushToast(p));
      }
      sessionStorage.removeItem(toastQueueKey);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, toastQueueKey]);

  useEffect(() => {
    // Allow same-route actions (approve/reject/etc.) to trigger toasts immediately.
    const handler = (e) => {
      const detail = e?.detail;
      if (!detail) return;
      pushToast(detail);
    };
    window.addEventListener('biosample_flash', handler);
    return () => window.removeEventListener('biosample_flash', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (toasts.length === 0) return undefined;
    const interval = setInterval(() => {
      const now = Date.now();
      setToasts((prev) =>
        prev.filter((t) => now - t.createdAt < t.durationMs)
      );
    }, 200);
    return () => clearInterval(interval);
  }, [toasts.length]);

  const toastStyles = useMemo(() => ({
    success: {
      container: 'bg-mint-800 text-white border-mint-900/20',
      bar: 'bg-mint-200/90',
    },
    error: {
      container: 'bg-red-700 text-white border-red-900/20',
      bar: 'bg-red-300/90',
    },
  }), []);

  const allNavItems = useMemo(
    () => [
      navItem('/dashboard', 'Dashboard', LayoutDashboard),
      navItem('/samples', 'Samples', FlaskConical),
      navItem('/projects', 'Projects', FolderKanban),
      navItem('/organisms', 'Organisms', Dna),
      ...(isAdmin ? [navItem('/users', 'User Management', Users)] : []),
      ...(isAdmin ? [navItem('/create-user', 'Create User', UserPlus)] : []),
    ],
    [isAdmin]
  );

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
          {allNavItems.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-mint-100 text-mint-800'
                    : 'text-gray-600 hover:bg-mint-50 hover:text-mint-700'
                }`
              }
            >
              <Icon className="h-[18px] w-[18px] shrink-0 opacity-90" strokeWidth={2} aria-hidden />
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
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                <Bell className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
                {pendingCount} pending
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

        <main className="flex-1 p-6 overflow-auto relative">
          {/* Toast notifications (upper-right) */}
          <div className="fixed top-4 right-4 z-50 w-[360px] max-w-[calc(100vw-2rem)] space-y-3">
            {toasts.map((t) => {
              const style = toastStyles[t.variant] || toastStyles.success;
              const elapsed = Date.now() - t.createdAt;
              const pct = Math.max(0, Math.min(100, (elapsed / t.durationMs) * 100));
              return (
                <div
                  key={t.id}
                  className={`border rounded-2xl shadow-2xl overflow-hidden ${style.container} border-opacity-30`}
                >
                  <div className="p-4 flex items-start justify-between gap-3">
                    <p className="text-sm leading-snug">{t.message}</p>
                    <button
                      type="button"
                      onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
                      className="text-sm font-medium opacity-90 hover:opacity-100"
                      aria-label="Dismiss notification"
                      title="Dismiss"
                    >
                      ×
                    </button>
                  </div>
                  <div className="h-1 bg-white/15">
                    <div
                      className={`h-full ${style.bar}`}
                      style={{ width: `${100 - pct}%`, transition: 'width 200ms linear' }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}

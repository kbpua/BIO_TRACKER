import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  LayoutDashboard,
  FlaskConical,
  FolderKanban,
  Dna,
  Users,
  UserPlus,
  Pin,
  PinOff,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const navItem = (to, label, description, Icon) => ({ to, label, description, Icon });

function getUserInitials(fullName) {
  const tokens = String(fullName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length === 0) return 'U';
  return tokens.slice(0, 2).map((t) => t[0]).join('').toUpperCase();
}

export function Layout({ children }) {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [toasts, setToasts] = useState([]);
  const [isHovered, setIsHovered] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const sidebarRef = useRef(null);

  const toastQueueKey = user?.fullName ? `biosample_toast_queue:${user.fullName}` : null;
  const isExpanded = isPinned || isHovered;
  const roleLabel = user?.role === 'Admin' ? 'System Administrator' : user?.role || 'User';
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

  useEffect(() => {
    if (!isPinned) return undefined;
    const onMouseDown = (e) => {
      const el = sidebarRef.current;
      if (!el) return;
      if (!el.contains(e.target)) {
        setIsPinned(false);
      }
    };
    window.addEventListener('mousedown', onMouseDown);
    return () => window.removeEventListener('mousedown', onMouseDown);
  }, [isPinned]);

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
      navItem('/dashboard', 'Dashboard', 'Overview & monitoring', LayoutDashboard),
      navItem('/samples', 'Samples', user?.role === 'Student' ? 'Browse records' : 'Manage records', FlaskConical),
      navItem('/projects', 'Projects', 'Research catalog', FolderKanban),
      navItem('/organisms', 'Organisms', 'Species directory', Dna),
      ...(isAdmin ? [navItem('/users', 'User Management', 'Accounts & roles', Users)] : []),
      ...(isAdmin ? [navItem('/create-user', 'Create User', 'Add new account', UserPlus)] : []),
    ],
    [isAdmin, user?.role]
  );

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="h-screen bg-mint-50/80 flex font-sans overflow-hidden">
      {/* Sidebar */}
      <aside
        ref={sidebarRef}
        onClick={(e) => {
          if (isPinned || !isExpanded) return;
          const target = e.target;
          if (target instanceof Element && target.closest('[data-sidebar-nav]')) return;
          setIsPinned(true);
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onFocusCapture={() => setIsHovered(true)}
        onBlurCapture={(e) => {
          if (!isPinned && !e.currentTarget.contains(e.relatedTarget)) {
            setIsHovered(false);
          }
        }}
        className={`fixed z-40 left-3 top-3 bottom-3 md:left-4 md:top-4 md:bottom-4 rounded-3xl overflow-hidden bg-mint-800 bg-gradient-to-b from-[#0F766E] to-[#115E59] border border-white/10 shadow-[0_10px_28px_rgba(15,118,110,0.22)] flex flex-col shrink-0 transition-[width] duration-300 ease-out ${
          isExpanded ? 'w-[272px]' : 'w-[78px]'
        }`}
      >
        <div className={`${isExpanded ? 'p-3' : 'p-2'} border-b border-white/10 transition-all duration-300`}>
          <div className={`rounded-xl border border-white/15 bg-white/[0.08] backdrop-blur-sm ${isExpanded ? 'p-3' : 'p-2.5'} transition-all duration-300`}>
            <div className="flex items-center justify-between">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm ring-2 ring-white/35 overflow-hidden">
                <img src="/logo.png" alt="BioSample Tracker logo" className="h-7 w-7 object-contain" />
              </div>
              {isExpanded && (
                <button
                  data-sidebar-nav
                  type="button"
                  onClick={() => setIsPinned((v) => !v)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/15 bg-white/5 text-white/80 hover:text-white hover:bg-white/[0.08] transition-colors"
                  aria-label={isPinned ? 'Unpin sidebar' : 'Pin sidebar'}
                  title={isPinned ? 'Unpin sidebar' : 'Pin sidebar'}
                >
                  {isPinned ? <PinOff className="h-4 w-4" strokeWidth={2} /> : <Pin className="h-4 w-4" strokeWidth={2} />}
                </button>
              )}
            </div>
            <div
              className={`overflow-hidden transition-all duration-300 ${
                isExpanded ? 'max-h-16 opacity-100 mt-2' : 'max-h-0 opacity-0'
              }`}
            >
              <h2 className="font-semibold text-white text-base leading-tight">BioSample Tracker</h2>
              <p className="text-xs text-white/[0.65]">Biological Sample Database</p>
            </div>
          </div>
        </div>
        <nav className={`px-2 py-4 flex-1 overflow-hidden ${isExpanded ? 'space-y-1.5' : 'flex flex-col items-center gap-2'}`}>
          {allNavItems.map(({ to, label, description, Icon }) => (
            <NavLink
              key={to}
              to={to}
              data-sidebar-nav
              className={({ isActive }) =>
                `relative group flex items-center text-sm transition-all duration-200 ${
                  isExpanded ? 'w-full rounded-xl' : 'h-12 w-12 justify-center rounded-2xl'
                } ${
                  isActive
                    ? 'bg-white/95 text-[#115E59] shadow-[0_6px_16px_rgba(15,118,110,0.18)]'
                    : 'text-white/85 hover:bg-white/[0.08] hover:text-white'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isExpanded && (
                    <span className={`absolute left-0 top-1/2 -translate-y-1/2 h-8 w-1 rounded-r-full transition-opacity ${isActive ? 'bg-[#14B8A6] opacity-100' : 'opacity-0 group-hover:opacity-40'}`} />
                  )}
                  <div className={`flex w-full items-center ${isExpanded ? 'px-3 py-2.5 gap-3' : 'justify-center'}`}>
                    <Icon className={`${isExpanded ? 'h-5 w-5' : 'h-5.5 w-5.5'} shrink-0 ${isActive ? 'text-[#0D9488]' : 'text-white/55 group-hover:text-white/90'}`} strokeWidth={2} aria-hidden />
                    <div
                      className={`overflow-hidden transition-all duration-200 ${
                        isExpanded ? 'max-w-[170px] opacity-100' : 'max-w-0 opacity-0'
                      }`}
                    >
                      <p className={`text-sm leading-tight ${isActive ? 'font-semibold' : 'font-medium'}`}>{label}</p>
                      <p className={`text-[11px] leading-tight mt-0.5 ${isActive ? 'text-[#14B8A6]' : 'text-white/55 group-hover:text-white/75'}`}>{description}</p>
                    </div>
                  </div>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="px-2 pb-3 pt-2 border-t border-white/10">
          <div className={`rounded-xl border border-white/15 bg-white/[0.08] backdrop-blur-sm p-2.5 transition-all duration-300`}>
            <div className={`flex items-center ${isExpanded ? 'gap-2.5' : 'justify-center'}`}>
              <div className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-mint-800 text-xs font-semibold">
                {getUserInitials(user?.fullName)}
              </div>
              <div
                className={`overflow-hidden transition-all duration-200 ${
                  isExpanded ? 'max-w-[170px] opacity-100' : 'max-w-0 opacity-0'
                }`}
              >
                <p className="text-sm font-semibold text-white truncate">{user?.fullName}</p>
                <p className="text-xs text-white/[0.65] truncate">{roleLabel}</p>
              </div>
            </div>

            <button
              data-sidebar-nav
              type="button"
              onClick={handleLogout}
              className={`mt-2 w-full inline-flex items-center rounded-lg border border-white/15 bg-white/8 text-white/90 hover:bg-red-500/25 hover:text-white hover:border-red-300/40 transition-colors ${
                isExpanded ? 'justify-start gap-2 px-2.5 py-2 text-sm font-medium' : 'justify-center py-2'
              }`}
              aria-label="Logout"
              title="Logout"
            >
              <LogOut className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
              <span className={`overflow-hidden transition-all duration-200 ${isExpanded ? 'max-w-[120px] opacity-100' : 'max-w-0 opacity-0'}`}>
                Logout
              </span>
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 pl-[98px] md:pl-[114px]">
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

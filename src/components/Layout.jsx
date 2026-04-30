import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  LayoutDashboard,
  FlaskConical,
  FolderKanban,
  Dna,
  Users,
  UserPlus,
  Pin,
  PinOff,
  LogOut,
  Trash2,
  X,
  Moon,
  Sun,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { useTheme } from '../contexts/ThemeContext';
import { formatRelativeTime, getNotificationMeta } from '../utils/notifications';

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
  const { isDark, toggleTheme } = useTheme();
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    newArrivalPulse,
    beginSoftDelete,
    undoSoftDelete,
    clearAllNotifications,
  } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();
  const [toasts, setToasts] = useState([]);
  const [showNotificationPanel, setShowNotificationPanel] = useState(false);
  const [notificationFilter, setNotificationFilter] = useState('All');
  const [undoToasts, setUndoToasts] = useState([]);
  const [clearAllOpen, setClearAllOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const sidebarRef = useRef(null);
  const bellButtonRef = useRef(null);
  const notificationDropdownRef = useRef(null);
  const undoToastRef = useRef(null);

  const toastQueueKey = user?.fullName ? `biosample_toast_queue:${user.fullName}` : null;
  const isExpanded = isPinned || isHovered;
  const roleLabel = user?.role === 'Admin' ? 'System Administrator' : user?.role || 'User';
  const visibleNotifications = useMemo(
    () => (notificationFilter === 'Unread'
      ? notifications.filter((n) => !n.isRead)
      : notifications).slice(0, 50),
    [notificationFilter, notifications]
  );
  const unreadBadgeLabel = unreadCount > 99 ? '99+' : String(unreadCount);
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
    if (undoToasts.length === 0) return undefined;
    const interval = setInterval(() => {
      const now = Date.now();
      setUndoToasts((prev) =>
        prev.filter((t) => now - t.createdAt < t.durationMs)
      );
    }, 200);
    return () => clearInterval(interval);
  }, [undoToasts.length]);

  const pushUndoToast = (notificationId) => {
    const tid = `undo-${notificationId}-${Date.now()}`;
    setUndoToasts((prev) =>
      [...prev, { tid, notificationId, createdAt: Date.now(), durationMs: 5000 }].slice(-3)
    );
  };

  const handleDropdownSoftDelete = (e, n) => {
    e.preventDefault();
    e.stopPropagation();
    beginSoftDelete(n);
    pushUndoToast(n.notificationId);
  };

  const handleConfirmClearAll = async () => {
    await clearAllNotifications();
    setClearAllOpen(false);
    setUndoToasts([]);
  };

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

  useEffect(() => {
    if (!showNotificationPanel) return undefined;
    const onMouseDown = (e) => {
      const bell = bellButtonRef.current;
      const panel = notificationDropdownRef.current;
      const undoPanel = undoToastRef.current;
      if (!panel && !bell) return;
      if (
        (!bell || !bell.contains(e.target))
        && (!panel || !panel.contains(e.target))
        && (!undoPanel || !undoPanel.contains(e.target))
      ) {
        setShowNotificationPanel(false);
      }
    };
    window.addEventListener('mousedown', onMouseDown);
    return () => window.removeEventListener('mousedown', onMouseDown);
  }, [showNotificationPanel]);

  useEffect(() => {
    // When account context changes (e.g. admin -> researcher), clear any
    // transient notification overlays so no stale fixed layer remains.
    setShowNotificationPanel(false);
    setClearAllOpen(false);
    setUndoToasts([]);
    setNotificationFilter('All');
  }, [user?.authId]);

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

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="h-screen bg-mint-50/80 dark:bg-slate-900 flex font-sans overflow-hidden transition-colors duration-300">
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
        className={`fixed z-40 left-3 top-3 bottom-3 md:left-4 md:top-4 md:bottom-4 rounded-3xl overflow-hidden bg-mint-800 bg-gradient-to-b from-[#0F766E] to-[#115E59] border border-white/10 shadow-[0_10px_28px_rgba(0,0,0,0.4)] flex flex-col shrink-0 transition-[width] duration-300 ease-out ${
          isExpanded ? 'w-[272px]' : 'w-[78px]'
        }`}
      >
        <div className={`${isExpanded ? 'p-3' : 'p-2'} border-b border-white/10 transition-all duration-300`}>
          <div className={`rounded-xl border border-white/15 bg-white/[0.08] backdrop-blur-sm ${isExpanded ? 'p-3' : 'p-2.5'} transition-all duration-300`}>
            <div className="flex items-center justify-between">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm ring-2 ring-white/35 overflow-hidden">
                <img
                  src={isDark ? '/logo-dark.png' : '/logo.png'}
                  alt="BioSample Tracker logo"
                  className={`h-7 w-7 object-contain ${isDark ? 'scale-125' : ''}`}
                />
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
        <main className="flex-1 overflow-auto relative px-6 pt-4 pb-6 pr-24 md:pr-28 transition-colors duration-300">
          {/* Toast notifications (upper-right) */}
          {toasts.length > 0 && (
            <div className="fixed top-20 right-4 z-[1100] w-[360px] max-w-[calc(100vw-2rem)] space-y-3 pointer-events-none">
              {toasts.map((t) => {
                const style = toastStyles[t.variant] || toastStyles.success;
                const elapsed = Date.now() - t.createdAt;
                const pct = Math.max(0, Math.min(100, (elapsed / t.durationMs) * 100));
                return (
                  <div
                    key={t.id}
                    className={`pointer-events-auto border rounded-2xl shadow-2xl overflow-hidden ${style.container} border-opacity-30`}
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
          )}
          {children}
        </main>

        {/* Top-right notification controls */}
            {!showNotificationPanel && (
              <div
                ref={bellButtonRef}
                className="fixed top-4 right-4 z-[1000] w-11 h-11 pointer-events-auto md:right-6"
              >
                <button
                  type="button"
                  onClick={() => setShowNotificationPanel(true)}
                  className={`relative h-11 w-11 rounded-full border border-teal-200 bg-white text-teal-700 shadow-sm hover:bg-teal-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-teal-400/45 dark:hover:border-teal-300 transition-colors duration-300 ${
                    newArrivalPulse ? 'animate-pulse' : ''
                  }`}
                  aria-label="Notifications"
                  title="Notifications"
                >
                  <Bell className="h-5 w-5 mx-auto" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-rose-500 text-white text-[10px] font-semibold flex items-center justify-center">
                      {unreadBadgeLabel}
                    </span>
                  )}
                </button>
              </div>
            )}
            <div className="fixed top-[4.5rem] right-4 z-[999] pointer-events-auto md:right-6">
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

            {showNotificationPanel && (
              <div
                ref={notificationDropdownRef}
                className="fixed top-16 right-4 z-[1000] pointer-events-auto md:right-6"
              >
                <div className="w-[400px] max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200 flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-slate-900 shrink-0 pt-0.5">Notifications</h3>
                  <div className="flex items-center gap-1.5 flex-wrap justify-end min-w-0">
                    <button
                      type="button"
                      onClick={() => setNotificationFilter((f) => (f === 'All' ? 'Unread' : 'All'))}
                      className="text-xs text-slate-500 hover:text-teal-700"
                    >
                      {notificationFilter}
                    </button>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={markAllAsRead}
                        className="text-xs font-medium text-teal-700 hover:text-teal-800"
                      >
                        Mark all as read
                      </button>
                    )}
                    {notifications.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setClearAllOpen(true)}
                        className="text-xs font-medium text-slate-500 hover:text-rose-600"
                      >
                        Clear all
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowNotificationPanel(false)}
                      className="ml-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                      aria-label="Close notifications"
                      title="Close"
                    >
                      <X className="h-4 w-4" strokeWidth={2} />
                    </button>
                  </div>
                </div>
                <div className="max-h-[500px] overflow-auto">
                  {visibleNotifications.length === 0 ? (
                    <div className="px-6 py-12 text-center">
                      <Bell className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-sm text-slate-600">You&apos;re all caught up! No notifications to show.</p>
                    </div>
                  ) : (
                    visibleNotifications.map((n) => {
                      const meta = getNotificationMeta(n.type, n.title);
                      const Icon = meta.icon;
                      return (
                        <div
                          key={n.notificationId}
                          className={`group relative flex items-stretch border-b border-slate-100 last:border-b-0 transition-colors ${
                            n.isRead
                              ? 'bg-white hover:bg-slate-50 border-l-2 border-l-transparent'
                              : 'bg-teal-100/35 hover:bg-teal-100/55 border-l-2 border-l-teal-400 dark:bg-teal-300/10 dark:hover:bg-teal-300/15 dark:border-l-teal-300'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={async () => {
                              if (!n.isRead) await markAsRead(n.notificationId);
                              setShowNotificationPanel(false);
                              navigate(n.linkTo || '/dashboard');
                            }}
                            className="flex-1 text-left px-4 py-3 min-w-0"
                          >
                            <div className="flex gap-3 pr-8">
                              <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${meta.accent}`}>
                                <Icon className="h-4 w-4" />
                              </div>
                              <div className="grow min-w-0">
                                <div className="flex justify-between gap-2">
                                  <p className="font-semibold text-sm text-slate-900 truncate">{n.title}</p>
                                  <span className="text-xs text-slate-400 shrink-0">{formatRelativeTime(n.createdAt)}</span>
                                </div>
                                <p className="text-sm text-slate-600 mt-0.5 line-clamp-2">{n.description}</p>
                              </div>
                              {!n.isRead && <span className="h-2.5 w-2.5 rounded-full bg-teal-500 mt-2 shrink-0" />}
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDropdownSoftDelete(e, n)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg text-slate-400 opacity-0 group-hover:opacity-100 hover:bg-slate-100 hover:text-rose-600 transition-opacity"
                            aria-label="Delete notification"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowNotificationPanel(false);
                    navigate('/notifications');
                  }}
                  className="w-full py-3 text-sm font-medium text-teal-700 hover:bg-teal-50 border-t border-slate-200"
                >
                  View all notifications
                </button>
                </div>
              </div>
            )}

            {/* Undo toasts: same shell layer as bell */}
            {undoToasts.length > 0 && (
              <div
                ref={undoToastRef}
                className="fixed top-[4.5rem] right-4 z-[1010] w-[360px] max-w-[calc(100vw-2rem)] space-y-2 pointer-events-none md:right-6"
              >
                {undoToasts.map((u) => {
                  const elapsed = Date.now() - u.createdAt;
                  const pct = Math.max(0, Math.min(100, (elapsed / u.durationMs) * 100));
                  return (
                    <div
                      key={u.tid}
                      className="pointer-events-auto border border-slate-200 rounded-2xl shadow-xl overflow-hidden bg-white text-slate-900"
                    >
                      <div className="p-3 flex items-center justify-between gap-3">
                        <p className="text-sm">Notification removed</p>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              undoSoftDelete(u.notificationId);
                              setUndoToasts((prev) => prev.filter((x) => x.tid !== u.tid));
                            }}
                            className="text-sm font-semibold text-teal-700 hover:text-teal-800"
                          >
                            Undo
                          </button>
                          <button
                            type="button"
                            onClick={() => setUndoToasts((prev) => prev.filter((x) => x.tid !== u.tid))}
                            className="text-slate-400 hover:text-slate-600 text-lg leading-none px-1"
                            aria-label="Dismiss"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                      <div className="h-1 bg-slate-100">
                        <div
                          className="h-full bg-teal-500/90"
                          style={{ width: `${100 - pct}%`, transition: 'width 200ms linear' }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
      </div>

      {clearAllOpen && (
        <div
          className="fixed inset-0 z-[220] flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="clear-all-notifications-title"
        >
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200">
            <h2 id="clear-all-notifications-title" className="text-lg font-semibold text-slate-900">
              Clear all notifications?
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Are you sure you want to delete all notifications? This action cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setClearAllOpen(false)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmClearAll}
                className="px-4 py-2 rounded-lg bg-rose-600 text-white text-sm font-medium hover:bg-rose-700"
              >
                Delete all
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

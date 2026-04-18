import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bell,
  Search,
  Trash2,
  MailOpen,
  Mail,
  X,
} from 'lucide-react';
import { useNotifications } from '../contexts/NotificationContext';
import { formatRelativeTime, getNotificationMeta, groupNotificationsByDate } from '../utils/notifications';

const READ_FILTERS = ['All', 'Unread', 'Read'];

export default function Notifications() {
  const navigate = useNavigate();
  const {
    notifications,
    unreadCount,
    totalCount,
    markAsRead,
    markManyAsRead,
    markManyAsUnread,
    markAllAsRead,
    deleteNotifications,
    clearAllNotifications,
  } = useNotifications();

  const [search, setSearch] = useState('');
  const [readFilter, setReadFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [selected, setSelected] = useState([]);
  const [removingIds, setRemovingIds] = useState(() => new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [clearAllOpen, setClearAllOpen] = useState(false);
  const masterCheckboxRef = useRef(null);
  const lastClickedIndexRef = useRef(null);

  const typeOptions = useMemo(() => {
    const labels = new Set(notifications.map((n) => getNotificationMeta(n.type, n.title).label));
    return ['All', ...Array.from(labels)];
  }, [notifications]);

  const filtered = useMemo(() => notifications.filter((n) => {
    if (readFilter === 'Unread' && n.isRead) return false;
    if (readFilter === 'Read' && !n.isRead) return false;
    if (typeFilter !== 'All' && getNotificationMeta(n.type, n.title).label !== typeFilter) return false;
    if (!search.trim()) return true;
    const haystack = `${n.title} ${n.description}`.toLowerCase();
    return haystack.includes(search.toLowerCase());
  }), [notifications, readFilter, typeFilter, search]);

  const filteredIds = useMemo(() => filtered.map((n) => n.notificationId), [filtered]);

  const selectRangeFromAnchor = useCallback((index) => {
    if (index < 0 || index >= filtered.length) return [];
    const anchor = lastClickedIndexRef.current;
    if (anchor === null || anchor === undefined) {
      lastClickedIndexRef.current = index;
      const id = filtered[index]?.notificationId;
      return id ? [id] : [];
    }
    const from = Math.min(anchor, index);
    const to = Math.max(anchor, index);
    return filtered.slice(from, to + 1).map((n) => n.notificationId);
  }, [filtered]);

  const grouped = useMemo(() => groupNotificationsByDate(filtered), [filtered]);
  const groupedKeys = ['Today', 'Yesterday', 'This Week', 'Earlier'];

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const allFilteredSelected = filtered.length > 0 && filtered.every((n) => selectedSet.has(n.notificationId));
  const someFilteredSelected = filtered.some((n) => selectedSet.has(n.notificationId));

  useEffect(() => {
    const el = masterCheckboxRef.current;
    if (!el) return;
    el.indeterminate = someFilteredSelected && !allFilteredSelected;
  }, [someFilteredSelected, allFilteredSelected]);

  const toggleSelectAll = () => {
    if (filteredIds.length === 0) return;
    if (allFilteredSelected) {
      setSelected((prev) => prev.filter((id) => !filteredIds.includes(id)));
    } else {
      setSelected((prev) => Array.from(new Set([...prev, ...filteredIds])));
    }
  };

  const deselectAll = () => setSelected([]);

  const handleOpen = async (notification) => {
    if (!notification.isRead) await markAsRead(notification.notificationId);
    navigate(notification.linkTo || '/dashboard');
  };

  const runWithRemovalAnimation = async (ids, fn) => {
    const idList = [...ids];
    if (idList.length === 0) return;
    setRemovingIds((prev) => {
      const next = new Set(prev);
      idList.forEach((id) => next.add(id));
      return next;
    });
    try {
      await new Promise((r) => setTimeout(r, 280));
      await fn(idList);
    } finally {
      setRemovingIds((prev) => {
        const next = new Set(prev);
        idList.forEach((id) => next.delete(id));
        return next;
      });
      setSelected((prev) => prev.filter((id) => !idList.includes(id)));
    }
  };

  const handleDeleteOne = (notificationId) => {
    runWithRemovalAnimation([notificationId], async (ids) => {
      await deleteNotifications(ids);
    });
  };

  const confirmBulkDelete = async () => {
    const ids = [...selected];
    setBulkDeleteOpen(false);
    await runWithRemovalAnimation(ids, async (toDelete) => {
      await deleteNotifications(toDelete);
    });
    window.dispatchEvent(
      new CustomEvent('biosample_flash', {
        detail: { message: `${ids.length} notifications deleted.`, durationMs: 4000 },
      })
    );
  };

  const handleConfirmClearAll = async () => {
    setClearAllOpen(false);
    await clearAllNotifications();
    deselectAll();
  };

  const handleRowClick = async (e, notification, index) => {
    if (e.shiftKey) {
      e.preventDefault();
      const rangeIds = selectRangeFromAnchor(index);
      setSelected((prev) => Array.from(new Set([...prev, ...rangeIds])));
      return;
    }
    lastClickedIndexRef.current = index;
    await handleOpen(notification);
  };

  const onDocKeyDown = useCallback((e) => {
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target?.isContentEditable) {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A')) return;
      return;
    }

    if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A')) {
      e.preventDefault();
      setSelected(filteredIds);
      return;
    }

    if (e.key === 'Escape') {
      deselectAll();
      return;
    }

    if (e.key === 'Delete') {
      if (selected.length > 0) {
        e.preventDefault();
        setBulkDeleteOpen(true);
      }
    }
  }, [filteredIds, selected.length]);

  useEffect(() => {
    window.addEventListener('keydown', onDocKeyDown);
    return () => window.removeEventListener('keydown', onDocKeyDown);
  }, [onDocKeyDown]);

  return (
    <div className="max-w-6xl mx-auto py-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Notifications</h1>
          <p className="text-sm text-slate-500 mt-1">
            {totalCount} total
            {' • '}
            {unreadCount} unread
          </p>
        </div>
        {selected.length === 0 ? (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={markAllAsRead}
              className="text-sm font-medium px-3 py-2 rounded-lg border border-teal-200 text-teal-700 hover:bg-teal-50"
            >
              Mark all as read
            </button>
            {totalCount > 0 && (
              <button
                type="button"
                onClick={() => setClearAllOpen(true)}
                className="text-sm font-medium px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200"
              >
                Clear all
              </button>
            )}
          </div>
        ) : null}
      </div>

      <div
        className={`rounded-xl shadow-sm overflow-hidden transition-all duration-300 ease-out ${
          selected.length > 0
            ? 'max-h-40 opacity-100 translate-y-0 mb-4 border border-teal-200 bg-teal-50/90 px-4 py-3'
            : 'max-h-0 opacity-0 -translate-y-2 mb-0 border-0 bg-transparent px-4 py-0 pointer-events-none'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-teal-900">
            {selected.length} selected
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => markManyAsRead(selected)}
              className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg border border-teal-300 text-teal-800 hover:bg-white/80"
            >
              <MailOpen className="h-4 w-4" />
              Mark as read
            </button>
            <button
              type="button"
              onClick={() => markManyAsUnread(selected)}
              className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg border border-teal-300 text-teal-800 hover:bg-white/80"
            >
              <Mail className="h-4 w-4" />
              Mark as unread
            </button>
            <button
              type="button"
              onClick={() => setBulkDeleteOpen(true)}
              className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg border border-rose-200 text-rose-700 hover:bg-white"
            >
              <Trash2 className="h-4 w-4" />
              Delete selected
            </button>
            <button
              type="button"
              onClick={deselectAll}
              className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-white"
            >
              <X className="h-4 w-4" />
              Deselect all
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative grow min-w-[230px]">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
              placeholder="Search notifications"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {READ_FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setReadFilter(f)}
                className={`px-3 py-2 rounded-lg text-sm border ${
                  readFilter === f
                    ? 'bg-teal-700 text-white border-teal-700'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
          >
            {typeOptions.map((label) => (
              <option key={label} value={label}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">
          <Bell className="mx-auto h-10 w-10 text-slate-300 mb-3" />
          <p className="text-slate-700 font-medium">You&apos;re all caught up! No notifications to show.</p>
          <Link to="/dashboard" className="text-teal-700 text-sm font-medium inline-block mt-3">Back to dashboard</Link>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-4 py-2 mb-3 flex items-center gap-3">
            <input
              ref={masterCheckboxRef}
              type="checkbox"
              checked={allFilteredSelected}
              onChange={toggleSelectAll}
              className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
            />
            <span className="text-sm text-slate-600">Select all visible ({filtered.length})</span>
          </div>
          {groupedKeys.map((group) => {
            const items = grouped[group] || [];
            if (items.length === 0) return null;
            return (
              <section key={group} className="mb-6">
                <h2 className="text-sm font-semibold text-slate-500 mb-2 uppercase tracking-wide">{group}</h2>
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  {items.map((notification) => {
                    const meta = getNotificationMeta(notification.type, notification.title);
                    const Icon = meta.icon;
                    const indexInFiltered = filtered.findIndex((n) => n.notificationId === notification.notificationId);
                    const isSelected = selectedSet.has(notification.notificationId);
                    const isRemoving = removingIds.has(notification.notificationId);
                    return (
                      <div
                        key={notification.notificationId}
                        className={`group relative flex items-stretch border-b border-slate-100 last:border-b-0 transition-all duration-200 ease-out ${
                          isRemoving ? 'opacity-0 -translate-x-1 scale-[0.98] pointer-events-none' : ''
                        } ${
                          isSelected ? 'bg-teal-50/80 hover:bg-teal-50' : notification.isRead ? 'bg-white hover:bg-slate-50' : 'bg-teal-50/30 hover:bg-teal-50/50'
                        }`}
                      >
                        <label
                          className="flex items-start gap-0 px-3 py-3 shrink-0 cursor-pointer"
                          onMouseDown={(e) => {
                            if (!e.shiftKey) return;
                            e.preventDefault();
                            const rangeIds = selectRangeFromAnchor(indexInFiltered);
                            setSelected((prev) => Array.from(new Set([...prev, ...rangeIds])));
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              e.stopPropagation();
                              setSelected((prev) => (
                                e.target.checked
                                  ? [...prev, notification.notificationId]
                                  : prev.filter((id) => id !== notification.notificationId)
                              ));
                              lastClickedIndexRef.current = indexInFiltered;
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="mt-1 h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={(e) => handleRowClick(e, notification, indexInFiltered)}
                          className="text-left grow min-w-0 px-2 py-3 flex gap-3"
                        >
                          <span className={`mt-0.5 h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${meta.accent}`}>
                            <Icon className="h-4 w-4" />
                          </span>
                          <span className="min-w-0">
                            <span className="font-semibold text-sm text-slate-900 block">{notification.title}</span>
                            <span className="text-sm text-slate-600 block mt-0.5">{notification.description}</span>
                          </span>
                        </button>
                        <div className="shrink-0 flex items-center gap-2 pr-3 py-3">
                          {!notification.isRead && <span className="h-2.5 w-2.5 rounded-full bg-teal-500" />}
                          <span className="text-xs text-slate-400 whitespace-nowrap">{formatRelativeTime(notification.createdAt)}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteOne(notification.notificationId);
                            }}
                            className="p-2 rounded-lg text-slate-400 opacity-0 group-hover:opacity-100 hover:bg-slate-100 hover:text-rose-600 transition-opacity"
                            aria-label="Delete notification"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </>
      )}

      {bulkDeleteOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="bulk-delete-notifications-title"
        >
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200">
            <h2 id="bulk-delete-notifications-title" className="text-lg font-semibold text-slate-900">
              Delete notifications?
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Delete {selected.length} notifications? This action cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setBulkDeleteOpen(false)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmBulkDelete}
                className="px-4 py-2 rounded-lg bg-rose-600 text-white text-sm font-medium hover:bg-rose-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {clearAllOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="clear-all-page-title"
        >
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200">
            <h2 id="clear-all-page-title" className="text-lg font-semibold text-slate-900">
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

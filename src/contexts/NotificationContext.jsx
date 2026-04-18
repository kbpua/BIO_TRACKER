import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { useAuth } from './AuthContext';

const NotificationContext = createContext(null);

const MAX_NOTIFICATION_FETCH = 300;
const SOFT_DELETE_MS = 5000;

function normalizeNotification(row) {
  return {
    notificationId: row.notification_id,
    userId: row.user_id,
    type: row.type,
    title: row.title || 'Notification',
    description: row.description || '',
    linkTo: row.link_to || '/dashboard',
    targetEntity: row.target_entity || null,
    targetId: row.target_id || null,
    isRead: Boolean(row.is_read),
    createdAt: row.created_at,
    readAt: row.read_at || null,
  };
}

function sortByCreatedDesc(a, b) {
  return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
}

export function NotificationProvider({ children }) {
  const { user, isSupabaseAuth } = useAuth();
  const supabaseEnabled = isSupabaseConfigured() && isSupabaseAuth;
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const previousUnreadRef = useRef(0);
  const [newArrivalPulse, setNewArrivalPulse] = useState(false);
  /** @type {React.MutableRefObject<Map<string, { timer: ReturnType<typeof setTimeout>, snapshot: ReturnType<typeof normalizeNotification> }>>} */
  const pendingSoftDeletesRef = useRef(new Map());

  const refreshNotifications = useCallback(async () => {
    if (!supabaseEnabled || !supabase || !user?.authId) {
      setNotifications([]);
      return;
    }
    setIsLoading(true);
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(MAX_NOTIFICATION_FETCH);

    if (error) {
      console.error('Failed to fetch notifications:', error.message);
      setIsLoading(false);
      return;
    }
    const pendingIds = pendingSoftDeletesRef.current;
    const merged = (data || [])
      .map(normalizeNotification)
      .filter((n) => !pendingIds.has(n.notificationId))
      .sort(sortByCreatedDesc);
    setNotifications(merged);
    setIsLoading(false);
  }, [supabaseEnabled, user?.authId]);

  useEffect(() => {
    refreshNotifications();
  }, [refreshNotifications]);

  useEffect(() => {
    const unread = notifications.reduce((acc, n) => acc + (n.isRead ? 0 : 1), 0);
    if (unread > previousUnreadRef.current) {
      setNewArrivalPulse(true);
      const timer = setTimeout(() => setNewArrivalPulse(false), 1300);
      previousUnreadRef.current = unread;
      return () => clearTimeout(timer);
    }
    previousUnreadRef.current = unread;
    return undefined;
  }, [notifications]);

  useEffect(() => {
    if (!supabaseEnabled || !supabase || !user?.authId) return undefined;
    const channel = supabase
      .channel(`notifications:${user.authId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.authId}` },
        () => refreshNotifications()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refreshNotifications, supabaseEnabled, user?.authId]);

  const unreadCount = useMemo(
    () => notifications.reduce((acc, n) => acc + (n.isRead ? 0 : 1), 0),
    [notifications]
  );

  const totalCount = notifications.length;

  const markAsRead = useCallback(async (notificationId) => {
    if (!notificationId) return false;
    setNotifications((prev) =>
      prev.map((n) => (n.notificationId === notificationId ? { ...n, isRead: true, readAt: n.readAt || new Date().toISOString() } : n))
    );
    if (!supabaseEnabled || !supabase) return true;
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('notification_id', notificationId);
    if (error) {
      console.error('Failed to mark notification as read:', error.message);
      return false;
    }
    return true;
  }, [supabaseEnabled]);

  const markAsUnread = useCallback(async (notificationId) => {
    if (!notificationId) return false;
    setNotifications((prev) =>
      prev.map((n) => (n.notificationId === notificationId ? { ...n, isRead: false, readAt: null } : n))
    );
    if (!supabaseEnabled || !supabase) return true;
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: false, read_at: null })
      .eq('notification_id', notificationId);
    if (error) {
      console.error('Failed to mark notification as unread:', error.message);
      return false;
    }
    return true;
  }, [supabaseEnabled]);

  const markManyAsRead = useCallback(async (notificationIds = []) => {
    const ids = [...new Set(notificationIds)].filter(Boolean);
    if (ids.length === 0) return true;
    const now = new Date().toISOString();
    setNotifications((prev) =>
      prev.map((n) => (ids.includes(n.notificationId) ? { ...n, isRead: true, readAt: n.readAt || now } : n))
    );
    if (!supabaseEnabled || !supabase) return true;
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: now })
      .in('notification_id', ids);
    if (error) {
      console.error('Failed to mark notifications as read:', error.message);
      return false;
    }
    return true;
  }, [supabaseEnabled]);

  const markManyAsUnread = useCallback(async (notificationIds = []) => {
    const ids = [...new Set(notificationIds)].filter(Boolean);
    if (ids.length === 0) return true;
    setNotifications((prev) =>
      prev.map((n) => (ids.includes(n.notificationId) ? { ...n, isRead: false, readAt: null } : n))
    );
    if (!supabaseEnabled || !supabase) return true;
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: false, read_at: null })
      .in('notification_id', ids);
    if (error) {
      console.error('Failed to mark notifications as unread:', error.message);
      return false;
    }
    return true;
  }, [supabaseEnabled]);

  const markAllAsRead = useCallback(async () => {
    const unreadIds = notifications.filter((n) => !n.isRead).map((n) => n.notificationId);
    if (unreadIds.length === 0) return true;
    return markManyAsRead(unreadIds);
  }, [markManyAsRead, notifications]);

  /**
   * Dropdown: hide immediately; DB delete after SOFT_DELETE_MS. Call undoSoftDelete to cancel.
   */
  const beginSoftDelete = useCallback((notification) => {
    const id = notification?.notificationId;
    if (!id || pendingSoftDeletesRef.current.has(id)) return;
    const snapshot = { ...notification };
    const timer = setTimeout(async () => {
      if (!pendingSoftDeletesRef.current.has(id)) return;
      pendingSoftDeletesRef.current.delete(id);
      if (!supabaseEnabled || !supabase) return;
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('notification_id', id);
      if (error) {
        console.error('Failed to delete notification:', error.message);
      }
    }, SOFT_DELETE_MS);
    pendingSoftDeletesRef.current.set(id, { timer, snapshot });
    setNotifications((prev) => prev.filter((n) => n.notificationId !== id));
  }, [supabaseEnabled]);

  const undoSoftDelete = useCallback((notificationId) => {
    const entry = pendingSoftDeletesRef.current.get(notificationId);
    if (!entry) return;
    clearTimeout(entry.timer);
    pendingSoftDeletesRef.current.delete(notificationId);
    setNotifications((prev) => [...prev, entry.snapshot].sort(sortByCreatedDesc));
  }, []);

  /** Immediate hard delete (full page, bulk confirm). */
  const deleteNotifications = useCallback(async (notificationIds = []) => {
    const ids = [...new Set(notificationIds)].filter(Boolean);
    if (ids.length === 0) return true;
    ids.forEach((id) => {
      const pending = pendingSoftDeletesRef.current.get(id);
      if (pending) {
        clearTimeout(pending.timer);
        pendingSoftDeletesRef.current.delete(id);
      }
    });
    setNotifications((prev) => prev.filter((n) => !ids.includes(n.notificationId)));
    if (!supabaseEnabled || !supabase) return true;
    const { error } = await supabase
      .from('notifications')
      .delete()
      .in('notification_id', ids);
    if (error) {
      console.error('Failed to delete notifications:', error.message);
      return false;
    }
    return true;
  }, [supabaseEnabled]);

  const clearAllNotifications = useCallback(async () => {
    pendingSoftDeletesRef.current.forEach((entry) => clearTimeout(entry.timer));
    pendingSoftDeletesRef.current.clear();
    setNotifications([]);
    if (!supabaseEnabled || !supabase || !user?.authId) return true;
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('user_id', user.authId);
    if (error) {
      console.error('Failed to clear all notifications:', error.message);
      return false;
    }
    return true;
  }, [supabaseEnabled, user?.authId]);

  const createNotification = useCallback(async ({
    userId,
    type = 'INFO',
    title,
    description = '',
    linkTo = '/dashboard',
    targetEntity = null,
    targetId = null,
  }) => {
    if (!supabaseEnabled || !supabase || !userId || !title) return false;
    const { error } = await supabase.rpc('create_notification', {
      p_user_id: userId,
      p_type: type,
      p_title: title,
      p_description: description,
      p_link_to: linkTo,
      p_target_entity: targetEntity,
      p_target_id: targetId,
    });
    if (error) {
      console.error('Failed to create notification:', error.message);
      return false;
    }
    return true;
  }, [supabaseEnabled]);

  const createRoleNotification = useCallback(async ({
    role,
    type = 'INFO',
    title,
    description = '',
    linkTo = '/dashboard',
    targetEntity = null,
    targetId = null,
  }) => {
    if (!supabaseEnabled || !supabase || !role || !title) return false;
    const { error } = await supabase.rpc('create_notifications_for_role', {
      p_role: role,
      p_type: type,
      p_title: title,
      p_description: description,
      p_link_to: linkTo,
      p_target_entity: targetEntity,
      p_target_id: targetId,
    });
    if (error) {
      console.error('Failed to create role notifications:', error.message);
      return false;
    }
    return true;
  }, [supabaseEnabled]);

  const value = {
    notifications,
    unreadCount,
    totalCount,
    isLoading,
    newArrivalPulse,
    refreshNotifications,
    markAsRead,
    markAsUnread,
    markManyAsRead,
    markManyAsUnread,
    markAllAsRead,
    deleteNotifications,
    clearAllNotifications,
    beginSoftDelete,
    undoSoftDelete,
    createNotification,
    createRoleNotification,
  };

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
}

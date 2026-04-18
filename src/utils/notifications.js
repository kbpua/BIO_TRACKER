import {
  Bell,
  CircleCheckBig,
  ClipboardCheck,
  FlaskConical,
  FolderKanban,
  Info,
  TriangleAlert,
  UserCircle2,
  UserPlus,
  XCircle,
} from 'lucide-react';

export const NOTIFICATION_TYPE_META = {
  INVITE: {
    icon: UserPlus,
    accent: 'text-teal-700 bg-teal-50',
    label: 'Invites',
  },
  APPROVAL_REQUEST: {
    icon: ClipboardCheck,
    accent: 'text-amber-700 bg-amber-50',
    label: 'Requests',
  },
  APPROVAL_RESULT: {
    icon: CircleCheckBig,
    accent: 'text-emerald-700 bg-emerald-50',
    label: 'Approvals',
  },
  SAMPLE_EVENT: {
    icon: FlaskConical,
    accent: 'text-teal-700 bg-teal-50',
    label: 'Samples',
  },
  PROJECT_EVENT: {
    icon: FolderKanban,
    accent: 'text-cyan-700 bg-cyan-50',
    label: 'Projects',
  },
  SYSTEM_ALERT: {
    icon: TriangleAlert,
    accent: 'text-orange-700 bg-orange-50',
    label: 'Alerts',
  },
  ACCOUNT: {
    icon: UserCircle2,
    accent: 'text-blue-700 bg-blue-50',
    label: 'Account',
  },
  INFO: {
    icon: Info,
    accent: 'text-slate-700 bg-slate-100',
    label: 'Info',
  },
  REJECTED: {
    icon: XCircle,
    accent: 'text-rose-700 bg-rose-50',
    label: 'Rejected',
  },
  DEFAULT: {
    icon: Bell,
    accent: 'text-slate-700 bg-slate-100',
    label: 'General',
  },
};

export function getNotificationMeta(type, title = '') {
  if (type === 'APPROVAL_RESULT' && /rejected/i.test(title)) {
    return NOTIFICATION_TYPE_META.REJECTED;
  }
  return NOTIFICATION_TYPE_META[type] || NOTIFICATION_TYPE_META.DEFAULT;
}

export function formatRelativeTime(isoDate) {
  if (!isoDate) return '';
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diffMs = Math.max(0, now - then);
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return '1 day ago';
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
  return new Date(isoDate).toLocaleDateString();
}

export function groupNotificationsByDate(notifications = []) {
  const groups = {
    Today: [],
    Yesterday: [],
    'This Week': [],
    Earlier: [],
  };
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - 7);

  notifications.forEach((notification) => {
    const ts = new Date(notification.createdAt);
    if (ts >= startOfToday) {
      groups.Today.push(notification);
    } else if (ts >= startOfYesterday) {
      groups.Yesterday.push(notification);
    } else if (ts >= startOfWeek) {
      groups['This Week'].push(notification);
    } else {
      groups.Earlier.push(notification);
    }
  });
  return groups;
}

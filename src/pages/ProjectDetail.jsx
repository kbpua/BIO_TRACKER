import { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParams, Link, useLocation, useNavigate } from 'react-router-dom';
import { Check, ChevronDown, Trash2, UserPlus, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { canUserChangeProjectPublication, canUserViewProject, getProjectPublicationStatus } from '../utils/visibility';
import { displayNamesEqual, isPendingCoResearcherInviteForUser } from '../utils/personName';
import { exportSamplesCSV } from '../utils/export';
import RemoveCoResearcherModal from '../components/RemoveCoResearcherModal';
import {
  ViewIconLink,
  EditIconLink,
  RequestEditIconLink,
  DeleteIconButton,
  RequestDeleteIconButton,
} from '../components/TableActionButtons';

function sampleCreatedOrCollectedBy(sampleRow, fullName) {
  if (!fullName) return false;
  return sampleRow.collectedBy === fullName || sampleRow.createdBy === fullName;
}

export default function ProjectDetail() {
  const { id } = useParams();
  const { user, isAdmin, isResearcher } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const {
    projects,
    samples,
    organisms,
    users,
    deleteSample,
    addActivity,
    updateProject,
    pendingRequests,
    approvePendingRequest,
    rejectPendingRequest,
    submitDeleteRequest,
    submitExportRequest,
    coResearcherInvites,
    respondToCoResearcherInvite,
    sendCoResearcherInvites,
    cancelCoResearcherInvite,
    refreshInvitesAndRequests,
    removeCoResearcherFromProject,
  } = useData();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [confirmPublication, setConfirmPublication] = useState('');
  const [confirmRequestDelete, setConfirmRequestDelete] = useState(null);
  const [coInviteModalOpen, setCoInviteModalOpen] = useState(false);
  const [coInviteSelection, setCoInviteSelection] = useState(() => new Set());
  const [coInviteSearch, setCoInviteSearch] = useState('');
  const [coInviteDropdownOpen, setCoInviteDropdownOpen] = useState(false);
  const coInviteDropdownRef = useRef(null);
  const [sbInviteProfiles, setSbInviteProfiles] = useState([]);
  const [pendingRequestsExpanded, setPendingRequestsExpanded] = useState(true);
  const [removeCoResearcherTarget, setRemoveCoResearcherTarget] = useState(null);

  useEffect(() => {
    if (!coInviteModalOpen || !isSupabaseConfigured() || !supabase) return;
    let cancelled = false;
    supabase
      .from('profiles')
      .select('full_name, role, status, email')
      .in('role', ['Researcher', 'Admin'])
      .eq('status', 'Active')
      .then(({ data }) => {
        if (!cancelled && data) setSbInviteProfiles(data);
      });
    return () => { cancelled = true; };
  }, [coInviteModalOpen]);

  const project = projects.find((p) => p.id === id);
  const getOrgName = (oid) => organisms.find((o) => o.id === oid)?.scientificName ?? '';
  const getProjName = (pid) => projects.find((p) => p.id === pid)?.name ?? '';

  const isLeadResearcher = isResearcher && displayNamesEqual(project?.leadResearcher, user?.fullName);
  const canRemoveCoResearchers = isAdmin || isLeadResearcher;
  const isCoResearcher = isResearcher && Array.isArray(project?.coResearchers)
    && project.coResearchers.some((n) => displayNamesEqual(n, user?.fullName));
  const canAddSample = isAdmin || isLeadResearcher || isCoResearcher;

  const canExportFromProjectPage = isAdmin || (isResearcher && (isLeadResearcher || isCoResearcher));
  const hasCoResearcherExportApproval =
    isCoResearcher &&
    Array.isArray(project?.approvedExporters) &&
    project.approvedExporters.some((name) => displayNamesEqual(name, user?.fullName));
  const showExportCsvButton =
    canExportFromProjectPage && (isAdmin || isLeadResearcher || (isCoResearcher && hasCoResearcherExportApproval));
  const showRequestExportButton =
    canExportFromProjectPage && isCoResearcher && !isAdmin && !isLeadResearcher && !hasCoResearcherExportApproval;

  const canEditSampleDirect = () => isAdmin || isLeadResearcher;
  const canDeleteSampleDirect = () => isAdmin || isLeadResearcher;
  const canRequestEdit = (r) => !isAdmin && isCoResearcher && r.collectedBy === user?.fullName;
  const canRequestDelete = (r) => !isAdmin && isCoResearcher && r.collectedBy === user?.fullName;

  useEffect(() => {
    // Clear any legacy location.state flash payloads without showing them here.
    const stateMsg = location.state?.flash;
    if (stateMsg) {
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, navigate]);

  const relatedSamples = useMemo(() => {
    if (!project) return [];
    // Newest-first: later in array = more recent.
    return samples
      .map((s, idx) => ({ s, idx }))
      .filter(({ s }) => s.projectId === project.id)
      .sort((a, b) => b.idx - a.idx)
      .map(({ s }) => ({
        ...s,
        organismName: getOrgName(s.organismId),
        projectName: getProjName(s.projectId),
      }));
  }, [project, samples, organisms, projects]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return relatedSamples.filter((r) => {
      if (search && ![r.sampleId, r.disease, r.organismName, r.projectName, r.tissueSource, r.studyPurpose].some((v) => String(v ?? '').toLowerCase().includes(q))) return false;
      if (filterType && r.sampleType !== filterType) return false;
      if (filterStatus && r.status !== filterStatus) return false;
      return true;
    });
  }, [relatedSamples, search, filterType, filterStatus]);

  const uniqueTypes = useMemo(() => [...new Set(relatedSamples.map((s) => s.sampleType))].sort(), [relatedSamples]);
  const uniqueStatuses = useMemo(() => [...new Set(relatedSamples.map((s) => s.status))].sort(), [relatedSamples]);

  const clearFilters = () => {
    setSearch('');
    setFilterType('');
    setFilterStatus('');
  };

  const handleExportProjectCsv = () => {
    if (!project) return;
    const name = user?.fullName;
    const rowsForExport =
      isAdmin || isLeadResearcher
        ? relatedSamples
        : relatedSamples.filter((r) => sampleCreatedOrCollectedBy(r, name));
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `${project.id}_samples_${dateStr}.csv`;
    exportSamplesCSV(rowsForExport, organisms, projects, filename);
    addActivity(`${user?.fullName} exported CSV for project ${project.name}`);

    // Co-researcher export approval is single-use. After one successful download,
    // remove their temporary approval so they need to request again next time.
    if (isCoResearcher && !isAdmin && hasCoResearcherExportApproval && user?.fullName) {
      const currentApproved = Array.isArray(project.approvedExporters) ? project.approvedExporters : [];
      const nextApproved = currentApproved.filter((entry) => !displayNamesEqual(entry, user.fullName));
      updateProject(project.id, { approvedExporters: nextApproved });
      try {
        window.dispatchEvent(
          new CustomEvent('biosample_flash', {
            detail: {
              message: 'CSV downloaded. Export access has been used and you will need to request approval again for another download.',
              variant: 'success',
            },
          })
        );
      } catch {}
    }
  };

  const handleRequestExport = () => {
    if (!project) return;
    const created = submitExportRequest({
      projectId: project.id,
      requestedBy: user?.fullName || 'Unknown',
    });
    if (!created) {
      try {
        window.dispatchEvent(
          new CustomEvent('biosample_flash', {
            detail: { message: 'You already have a pending export request for this project.', variant: 'error' },
          })
        );
      } catch {}
      return;
    }
    try {
      window.dispatchEvent(
        new CustomEvent('biosample_flash', {
          detail: {
            message: 'Your export request has been submitted for approval by the Lead Researcher.',
            variant: 'success',
          },
        })
      );
    } catch {}
  };

  const handleDeleteSample = async (sampleId) => {
    const ok = await deleteSample(sampleId);
    if (!ok) {
      // eslint-disable-next-line no-alert
      alert('Failed to delete sample in Supabase. Please check your permissions and try again.');
      return;
    }
    setConfirmDeleteId(null);
    addActivity(`${user?.fullName} deleted a sample from project ${project?.name}`);
  };

  const canSeePendingQueue = isAdmin || isLeadResearcher;
  const pendingForProject = useMemo(() => {
    if (!project) return [];
    return (pendingRequests || []).filter((r) => r.projectId === project.id);
  }, [pendingRequests, project]);

  const pendingForProjectQueue = useMemo(
    // Co-researcher invitations are no longer reviewed in the pending queue;
    // they are managed in the dedicated invitations panel instead.
    () => pendingForProject.filter((r) => r.type !== 'coResearcherInvite'),
    [pendingForProject]
  );

  const pendingCoResearcherInvitesForProject = useMemo(() => {
    if (!project) return [];
    return (coResearcherInvites || []).filter(
      (inv) => inv.projectId === project.id && String(inv.status).toLowerCase() === 'pending'
    );
  }, [coResearcherInvites, project]);

  const canInviteCoResearchers = isAdmin || isLeadResearcher;

  const inviteableCoResearcherNames = useMemo(() => {
    if (!project) return [];
    const lead = project.leadResearcher;
    const team = Array.isArray(project.coResearchers) ? project.coResearchers : [];
    const fromContext = (users || [])
      .filter((u) => u.status === 'Active' && (u.role === 'Researcher' || u.role === 'Admin'))
      .map((u) => u.fullName)
      .filter(Boolean);
    const fromSb = (sbInviteProfiles || []).map((p) => p.full_name).filter(Boolean);
    const merged = [...new Set([...fromContext, ...fromSb])];
    return merged.filter((name) => {
      if (!name || displayNamesEqual(name, lead)) return false;
      if (team.some((t) => displayNamesEqual(t, name))) return false;
      if (pendingCoResearcherInvitesForProject.some((inv) => displayNamesEqual(inv.invitedTo, name))) return false;
      return true;
    }).sort((a, b) => a.localeCompare(b));
  }, [project, users, sbInviteProfiles, pendingCoResearcherInvitesForProject]);

  const inviteableResearchersWithMeta = useMemo(() => {
    const resolveEmail = (name) => {
      const u = (users || []).find((x) => x.fullName && displayNamesEqual(x.fullName, name));
      if (u?.email) return u.email;
      const p = (sbInviteProfiles || []).find((x) => x.full_name && displayNamesEqual(x.full_name, name));
      return p?.email || '';
    };
    return inviteableCoResearcherNames
      .map((name) => ({ name, email: resolveEmail(name) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [inviteableCoResearcherNames, users, sbInviteProfiles]);

  const filteredInviteResearchers = useMemo(() => {
    const q = coInviteSearch.trim().toLowerCase();
    if (!q) return inviteableResearchersWithMeta;
    return inviteableResearchersWithMeta.filter(
      (r) =>
        r.name.toLowerCase().includes(q)
        || (r.email || '').toLowerCase().includes(q)
    );
  }, [inviteableResearchersWithMeta, coInviteSearch]);

  useEffect(() => {
    if (!coInviteModalOpen) return;
    setCoInviteSelection(new Set());
    setCoInviteSearch('');
    setCoInviteDropdownOpen(false);
  }, [coInviteModalOpen]);

  useEffect(() => {
    if (!coInviteDropdownOpen) return;
    const onMouseDown = (event) => {
      if (coInviteDropdownRef.current && !coInviteDropdownRef.current.contains(event.target)) {
        setCoInviteDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [coInviteDropdownOpen]);

  const toggleInviteResearcherPick = (name) => {
    setCoInviteSelection((prev) => {
      const next = new Set(prev);
      const existing = [...next].find((n) => displayNamesEqual(n, name));
      if (existing) next.delete(existing);
      else next.add(name);
      return next;
    });
  };

  const removeInvitePick = (name) => {
    setCoInviteSelection((prev) => {
      const next = new Set(prev);
      const existing = [...next].find((n) => displayNamesEqual(n, name));
      if (existing) next.delete(existing);
      return next;
    });
  };

  const isInviteResearcherSelected = (name) =>
    [...coInviteSelection].some((n) => displayNamesEqual(n, name));

  const handleSubmitCoResearcherInvites = async () => {
    if (!project) return;
    const chosen = [...coInviteSelection].filter(Boolean);
    if (chosen.length === 0) {
      try {
        window.dispatchEvent(new CustomEvent('biosample_flash', {
          detail: { message: 'Select at least one person to invite.', variant: 'error' },
        }));
      } catch {}
      return;
    }

    const adminSelf = isAdmin && user?.fullName ? user.fullName : null;
    const selfAdded = adminSelf ? chosen.some((n) => displayNamesEqual(n, adminSelf)) : false;
    const inviteAdded = selfAdded ? chosen.filter((n) => !displayNamesEqual(n, adminSelf)) : chosen;

    if (inviteAdded.length === 0 && !(selfAdded && adminSelf)) {
      try {
        window.dispatchEvent(new CustomEvent('biosample_flash', {
          detail: { message: 'Select at least one person to invite.', variant: 'error' },
        }));
      } catch {}
      return;
    }

    let shouldCloseModal = true;

    if (inviteAdded.length > 0) {
      try {
        const created = await sendCoResearcherInvites({
          projectId: project.id,
          invitedBy: user?.fullName || 'Unknown',
          invitedToList: inviteAdded,
        });
        const createdNames = Array.isArray(created)
          ? created.map((c) => c.invitedTo).filter(Boolean)
          : [];
        if (createdNames.length > 0) {
          const msg = `Co-Researcher invitation${createdNames.length > 1 ? 's' : ''} sent for ${project.name}: ${createdNames.join(', ')}.`;
          try { window.dispatchEvent(new CustomEvent('biosample_flash', { detail: { message: msg, variant: 'success' } })); } catch {}
          addActivity(`${user?.fullName} sent co-researcher invite(s) for ${project.name}: ${createdNames.join(', ')}`);
        } else {
          shouldCloseModal = false;
          try {
            window.dispatchEvent(new CustomEvent('biosample_flash', {
              detail: {
                message: 'Those researchers already have pending invitations on this project.',
                variant: 'error',
              },
            }));
          } catch {}
        }
      } catch (e) {
        shouldCloseModal = false;
        console.error('Failed to send co-researcher invites:', e);
        try {
          window.dispatchEvent(new CustomEvent('biosample_flash', {
            detail: {
              message: 'Could not send one or more invitations. Please try again.',
              variant: 'error',
            },
          }));
        } catch {}
      }
    }

    if (selfAdded && adminSelf) {
      const prevCo = Array.isArray(project.coResearchers) ? project.coResearchers : [];
      if (!prevCo.some((n) => displayNamesEqual(n, adminSelf))) {
        updateProject(project.id, { coResearchers: [...prevCo, adminSelf] });
        if (inviteAdded.length === 0) {
          addActivity(`${user?.fullName} added themselves as a co-researcher on ${project.name}`);
          try {
            window.dispatchEvent(new CustomEvent('biosample_flash', {
              detail: { message: `You were added as a co-researcher on ${project.name}.`, variant: 'success' },
            }));
          } catch {}
        }
      }
    }

    if (shouldCloseModal) setCoInviteModalOpen(false);
    void refreshInvitesAndRequests();
  };

  const myPendingCoResearcherInvite = useMemo(() => {
    if (!project || !user) return null;
    return (coResearcherInvites || []).find(
      (inv) =>
        inv.projectId === project.id
        && String(inv.status ?? '').toLowerCase() === 'pending'
        && isPendingCoResearcherInviteForUser(inv, user)
    ) || null;
  }, [coResearcherInvites, project, user]);

  const canApproveOrRejectRequest = (req) => {
    // Co-researcher invitations no longer go through an approval flow; only
    // sample add/edit/delete/export requests can still be approved here.
    if (req.type === 'coResearcherInvite') return false;
    return canSeePendingQueue;
  };

  const canSeeOutgoingCoResearcherInvites =
    isAdmin
    || isLeadResearcher
    || (isResearcher && pendingCoResearcherInvitesForProject.some((inv) =>
      displayNamesEqual(inv.invitedBy, user?.fullName)));

  const adminPendingItems = useMemo(() => {
    if (!isAdmin) return [];
    return pendingForProjectQueue
      .map((req) => ({
        kind: 'request',
        id: req.id,
        submittedAt: req.submittedAt,
        request: req,
      }))
      .sort((a, b) => new Date(b.submittedAt || 0).getTime() - new Date(a.submittedAt || 0).getTime());
  }, [isAdmin, pendingForProjectQueue]);

  const unifiedPendingItems = useMemo(() => {
    const rows = [];
    if (canSeeOutgoingCoResearcherInvites) {
      for (const inv of pendingCoResearcherInvitesForProject) {
        rows.push({
          kind: 'coInvite',
          id: `co-inv-${inv.id}`,
          sortAt: inv.createdAt,
          invite: inv,
        });
      }
    }
    if (canSeePendingQueue) {
      if (isAdmin) {
        for (const item of adminPendingItems) {
          rows.push({
            kind: 'sampleRequest',
            id: `req-${item.request.id}`,
            sortAt: item.request.submittedAt,
            request: item.request,
          });
        }
      } else {
        for (const req of pendingForProjectQueue) {
          rows.push({
            kind: 'sampleRequest',
            id: `req-${req.id}`,
            sortAt: req.submittedAt,
            request: req,
          });
        }
      }
    }
    rows.sort(
      (a, b) => new Date(b.sortAt || 0).getTime() - new Date(a.sortAt || 0).getTime()
    );
    return rows;
  }, [
    canSeeOutgoingCoResearcherInvites,
    canSeePendingQueue,
    pendingCoResearcherInvitesForProject,
    isAdmin,
    adminPendingItems,
    pendingForProjectQueue,
  ]);

  useEffect(() => {
    if (!id) return;
    void refreshInvitesAndRequests();
    const intervalMs = 8000;
    const intervalId = window.setInterval(() => {
      void refreshInvitesAndRequests();
    }, intervalMs);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refreshInvitesAndRequests();
    };
    const onFocus = () => {
      void refreshInvitesAndRequests();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onFocus);
    };
  }, [id, refreshInvitesAndRequests]);

  const enqueueToastForUser = (fullName, payload) => {
    if (!fullName) return;
    const key = `biosample_toast_queue:${fullName}`;
    try {
      const raw = sessionStorage.getItem(key);
      const prev = raw ? JSON.parse(raw) : [];
      const arr = Array.isArray(prev) ? prev : [];
      sessionStorage.setItem(key, JSON.stringify([...arr, payload]));
    } catch {}
  };

  const formatChangesSummary = (changes) => {
    if (!Array.isArray(changes) || changes.length === 0) return '';
    return changes
      .slice(0, 3)
      .map((c) => `${c.field}: ${String(c.from)} → ${String(c.to)}`)
      .join('; ') + (changes.length > 3 ? ` (+${changes.length - 3} more)` : '');
  };

  const approve = (reqId) => {
    const approved = approvePendingRequest(reqId);
    if (!approved) return;
    if (approved.type === 'edit') {
      const summary = formatChangesSummary(approved.changes);
      const msg = summary
        ? `Edit request approved for ${approved.sampleId}. ${summary}`
        : `Edit request approved. Sample ${approved.sampleId} has been updated.`;
      try { window.dispatchEvent(new CustomEvent('biosample_flash', { detail: { message: msg, variant: 'success' } })); } catch {}
      enqueueToastForUser(approved.requestedBy, { message: msg, variant: 'success' });
      addActivity(`${user?.fullName} approved edit request for sample ${approved.sampleId} (requested by ${approved.requestedBy})`);
    } else if (approved.type === 'delete') {
      const reason = approved.reason ? ` Reason: ${approved.reason}` : '';
      const msg = `Delete request approved. Sample ${approved.sampleId} has been removed.${reason}`;
      try { window.dispatchEvent(new CustomEvent('biosample_flash', { detail: { message: msg, variant: 'success' } })); } catch {}
      enqueueToastForUser(approved.requestedBy, { message: msg, variant: 'success' });
      addActivity(`${user?.fullName} approved delete request for sample ${approved.sampleId} (requested by ${approved.requestedBy})`);
    } else if (approved.type === 'export') {
      const msg = `Export request approved. ${approved.requestedBy} can now export their samples from this project.`;
      try { window.dispatchEvent(new CustomEvent('biosample_flash', { detail: { message: msg, variant: 'success' } })); } catch {}
      enqueueToastForUser(approved.requestedBy, { message: msg, variant: 'success' });
      addActivity(`${user?.fullName} approved export request for project ${project?.name || approved.projectId} (requested by ${approved.requestedBy})`);
    } else {
      const type = approved.proposedSample?.sampleType ? ` (${approved.proposedSample.sampleType})` : '';
      const msg = `Add request approved. Sample ${approved.sampleId}${type} has been added.`;
      try { window.dispatchEvent(new CustomEvent('biosample_flash', { detail: { message: msg, variant: 'success' } })); } catch {}
      enqueueToastForUser(approved.requestedBy, { message: msg, variant: 'success' });
      addActivity(`${user?.fullName} approved add request for sample ${approved.sampleId} (requested by ${approved.requestedBy})`);
    }
  };

  const reject = (reqId) => {
    const rejected = rejectPendingRequest(reqId);
    if (!rejected) return;
    if (rejected.type === 'export') {
      try { window.dispatchEvent(new CustomEvent('biosample_flash', { detail: { message: 'Export request rejected.', variant: 'error' } })); } catch {}
      enqueueToastForUser(rejected.requestedBy, { message: 'Export request rejected.', variant: 'error' });
      addActivity(`${user?.fullName} rejected export request for project ${project?.name || rejected.projectId} (requested by ${rejected.requestedBy})`);
      return;
    }
    const kind = rejected.type === 'edit' ? 'Edit' : rejected.type === 'delete' ? 'Delete' : 'Add';
    const extra = rejected.type === 'edit'
      ? formatChangesSummary(rejected.changes)
      : rejected.type === 'delete' && rejected.reason
        ? `Reason: ${rejected.reason}`
        : '';
    const msg = extra
      ? `${kind} request rejected for ${rejected.sampleId}. ${extra}`
      : `${kind} request rejected for ${rejected.sampleId}. No changes have been made.`;
    try { window.dispatchEvent(new CustomEvent('biosample_flash', { detail: { message: msg, variant: 'error' } })); } catch {}
    enqueueToastForUser(rejected.requestedBy, { message: msg, variant: 'error' });
    addActivity(`${user?.fullName} rejected ${kind.toLowerCase()} request for sample ${rejected.sampleId} (requested by ${rejected.requestedBy})`);
  };

  const handleRequestDelete = (sampleRow) => {
    if (!project) return;
    submitDeleteRequest({
      projectId: project.id,
      requestedBy: user?.fullName || 'Unknown',
      sampleRecordId: sampleRow.id,
      sampleId: sampleRow.sampleId,
      reason: sampleRow.status === 'Contaminated' ? 'Sample is contaminated' : '',
    });
    setConfirmRequestDelete(null);
    const msg = `Your delete request for ${sampleRow.sampleId} has been submitted for approval by the Lead Researcher.`;
    // This is a co-researcher action; show immediately to the current user only.
    try { window.dispatchEvent(new CustomEvent('biosample_flash', { detail: { message: msg, variant: 'success' } })); } catch {}
  };

  if (!project) {
    return (
      <div className="space-y-4">
        <p className="text-gray-500">Project not found.</p>
        <Link to="/projects" className="text-mint-600 dark:text-mint-300 hover:underline dark:hover:text-mint-400">Back to Projects</Link>
      </div>
    );
  }

  if (!canUserViewProject(user, project, coResearcherInvites)) {
    return (
      <div className="max-w-xl mx-auto mt-12 text-center space-y-3">
        <h1 className="text-xl font-semibold text-gray-800">Access Denied</h1>
        <p className="text-gray-600">This project is not available for your role.</p>
        <Link to="/projects" className="text-mint-600 dark:text-mint-300 font-medium hover:underline dark:hover:text-mint-400">Back to Projects</Link>
      </div>
    );
  }

  const pubStatus = getProjectPublicationStatus(project);
  const canChangePublication = canUserChangeProjectPublication(user, project);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/projects" className="px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:hover:bg-slate-200 dark:hover:text-slate-950">
          Back
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-mint-100 shadow-sm p-6">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <h1 className="text-xl font-bold text-gray-800">Project Details</h1>
          <div className="flex flex-wrap items-center gap-2">
            {canInviteCoResearchers && (
              <button
                type="button"
                onClick={() => setCoInviteModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 border border-mint-300 bg-mint-100/90 text-mint-700 text-sm font-medium rounded-lg hover:bg-mint-200/90 dark:border-mint-400/70 dark:bg-mint-400/20 dark:text-mint-200 dark:hover:bg-mint-400/30 transition-colors"
              >
                <UserPlus className="h-4 w-4 shrink-0" aria-hidden />
                Invite co-researchers
              </button>
            )}
            {canChangePublication && (
              <>
                {pubStatus !== 'Published (public)' && (
                  <button
                    type="button"
                    onClick={() => setConfirmPublication('Published (public)')}
                    className="px-4 py-2 bg-mint-800 bg-gradient-to-r from-[#0F766E] to-[#115E59] text-white text-sm font-medium rounded-lg hover:opacity-95 transition-opacity"
                  >
                    Publish Publicly
                  </button>
                )}
                {pubStatus !== 'Published (limited)' && (
                  <button
                    type="button"
                    onClick={() => setConfirmPublication('Published (limited)')}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
                  >
                    Publish Limited
                  </button>
                )}
                {pubStatus !== 'Draft' && (
                  <button
                    type="button"
                    onClick={() => setConfirmPublication('Draft')}
                    className="px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700"
                  >
                    Move to Draft
                  </button>
                )}
              </>
            )}
          </div>
        </div>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div><dt className="text-gray-500">Project ID</dt><dd className="font-medium">{project.id}</dd></div>
          <div><dt className="text-gray-500">Project Name</dt><dd className="font-medium">{project.name}</dd></div>
          <div className="sm:col-span-2"><dt className="text-gray-500">Description</dt><dd>{project.description || '—'}</dd></div>
          <div><dt className="text-gray-500">Start Date</dt><dd>{project.startDate || '—'}</dd></div>
          <div><dt className="text-gray-500">End Date</dt><dd>{project.endDate || '—'}</dd></div>
          <div><dt className="text-gray-500">Lead Researcher</dt><dd>{project.leadResearcher || '—'}</dd></div>
          <div className="sm:col-span-2">
            <dt className="text-gray-500">Co-Researchers</dt>
            <dd>
              {Array.isArray(project.coResearchers) && project.coResearchers.length > 0 ? (
                <ul className="flex flex-wrap gap-2 mt-1">
                  {project.coResearchers.map((name) => (
                    <li
                      key={name}
                      className="inline-flex items-center gap-1.5 rounded-full border border-teal-200 bg-teal-100 px-2.5 py-1 text-xs text-teal-900 dark:border-teal-500/60 dark:bg-teal-900/50 dark:text-teal-300"
                    >
                      <span>{name}</span>
                      {canRemoveCoResearchers && (
                        <button
                          type="button"
                          onClick={() => setRemoveCoResearcherTarget(name)}
                          className="inline-flex items-center justify-center rounded-full p-0.5 hover:bg-red-100 dark:hover:bg-red-900/40"
                          aria-label={`Remove co-researcher ${name}`}
                          title="Remove from project"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-red-600 dark:text-red-400" strokeWidth={2} aria-hidden />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                '—'
              )}
            </dd>
          </div>
          <div><dt className="text-gray-500">Status</dt><dd>{project.status}</dd></div>
          <div><dt className="text-gray-500">Publication Status</dt><dd>{pubStatus}</dd></div>
        </dl>
      </div>

      {myPendingCoResearcherInvite && (
        <div className="bg-mint-50 border border-mint-200 rounded-xl shadow-sm p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold text-mint-950">Co-researcher invitation</h2>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">Pending your response</span>
          </div>
          <p className="text-sm text-mint-900">
            <span className="font-medium">{myPendingCoResearcherInvite.invitedBy}</span> invited you to collaborate on this project as a co-researcher.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={async () => {
                const res = await respondToCoResearcherInvite(myPendingCoResearcherInvite.id, 'Accepted');
                if (!res) {
                  try {
                    window.dispatchEvent(new CustomEvent('biosample_flash', {
                      detail: { message: 'Could not accept the invitation. Please try again.', variant: 'error' },
                    }));
                  } catch {}
                  return;
                }
                const msg = `Invitation accepted. You are now a co-researcher on ${project.name}.`;
                try { window.dispatchEvent(new CustomEvent('biosample_flash', { detail: { message: msg, variant: 'success' } })); } catch {}
                addActivity(`${user?.fullName} accepted co-researcher invite for project ${project.name}`);
              }}
              className="px-4 py-2 bg-mint-800 bg-gradient-to-r from-[#0F766E] to-[#115E59] text-white text-sm font-medium rounded-lg hover:opacity-95 transition-opacity"
            >
              Accept
            </button>
            <button
              type="button"
              onClick={async () => {
                const res = await respondToCoResearcherInvite(myPendingCoResearcherInvite.id, 'Declined');
                if (!res) {
                  try {
                    window.dispatchEvent(new CustomEvent('biosample_flash', {
                      detail: { message: 'Could not decline the invitation. Please try again.', variant: 'error' },
                    }));
                  } catch {}
                  return;
                }
                const msg = `Invitation declined for ${project.name}.`;
                try { window.dispatchEvent(new CustomEvent('biosample_flash', { detail: { message: msg, variant: 'error' } })); } catch {}
                addActivity(`${user?.fullName} declined co-researcher invite for project ${project.name}`);
              }}
              className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg hover:bg-white bg-white/80"
            >
              Decline
            </button>
          </div>
        </div>
      )}

      {(canSeePendingQueue || canSeeOutgoingCoResearcherInvites) && (
        <div className="bg-white rounded-xl border border-mint-100 shadow-sm p-4">
          <button
            type="button"
            id="pending-requests-trigger"
            aria-expanded={pendingRequestsExpanded}
            aria-controls="pending-requests-panel"
            aria-label={
              unifiedPendingItems.length === 0
                ? 'Pending requests'
                : pendingRequestsExpanded
                  ? 'Collapse pending requests list'
                  : 'Expand pending requests list'
            }
            disabled={unifiedPendingItems.length === 0}
            onClick={() => {
              if (unifiedPendingItems.length === 0) return;
              setPendingRequestsExpanded((open) => !open);
            }}
            className={`flex w-full items-center justify-between gap-3 rounded-lg text-left min-h-[2.75rem] px-2 py-2 -mx-2 transition-colors ${
              unifiedPendingItems.length === 0
                ? 'cursor-default opacity-90'
                : 'hover:bg-gray-50 cursor-pointer'
            }`}
          >
            <span className="font-semibold text-gray-800 text-base">Pending Requests</span>
            <span className="flex items-center gap-2 shrink-0">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                {unifiedPendingItems.length} pending {unifiedPendingItems.length === 1 ? 'request' : 'requests'}
              </span>
              {unifiedPendingItems.length > 0 && (
                <ChevronDown
                  className={`h-5 w-5 text-gray-600 transition-transform duration-200 shrink-0 ${pendingRequestsExpanded ? 'rotate-180' : ''}`}
                  aria-hidden
                />
              )}
            </span>
          </button>

          {unifiedPendingItems.length > 0 && !pendingRequestsExpanded && (
            <p className="text-xs text-gray-500 mt-2 px-1">
              Expand this section to cancel a co-researcher invitation or review sample requests.
            </p>
          )}

          {unifiedPendingItems.length === 0 ? (
            <p className="text-sm text-gray-500 mt-2">No pending requests.</p>
          ) : (
            pendingRequestsExpanded && (
              <div id="pending-requests-panel" className="space-y-3 mt-3 pt-3 border-t border-mint-100">
                <div
                  className={
                    unifiedPendingItems.length > 3
                      ? 'space-y-2 max-h-[min(26rem,55vh)] min-h-0 overflow-y-auto overscroll-y-contain pr-1 -mr-0.5'
                      : 'space-y-2'
                  }
                >
                  {unifiedPendingItems.map((row) => {
                if (row.kind === 'coInvite') {
                  const inv = row.invite;
                  const canCancel = isAdmin
                    || isLeadResearcher
                    || displayNamesEqual(inv.invitedBy, user?.fullName);
                  return (
                    <div key={row.id} className="border border-gray-200 rounded-lg p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-sm min-w-0">
                          <p className="font-medium text-gray-800">Co-Researcher Invitation · {inv.invitedTo}</p>
                          <p className="text-xs text-gray-500">
                            Invited by <span className="font-medium">{inv.invitedBy}</span>
                            {' · '}
                            {inv.createdAt ? new Date(inv.createdAt).toLocaleString() : '—'}
                          </p>
                        </div>
                        {canCancel && (
                          <button
                            type="button"
                            onClick={async () => {
                              const ok = await cancelCoResearcherInvite(inv.id);
                              if (!ok) {
                                try {
                                  window.dispatchEvent(new CustomEvent('biosample_flash', {
                                    detail: { message: 'Could not cancel the invitation. Please try again.', variant: 'error' },
                                  }));
                                } catch {}
                                return;
                              }
                              try {
                                window.dispatchEvent(new CustomEvent('biosample_flash', {
                                  detail: { message: `Invitation to ${inv.invitedTo} was cancelled.`, variant: 'success' },
                                }));
                              } catch {}
                              addActivity(`${user?.fullName} cancelled co-researcher invite for ${inv.invitedTo} on project ${project.name}`);
                            }}
                            className="px-3 py-1.5 border border-gray-300 text-xs font-medium rounded-lg hover:bg-gray-50 text-gray-700 shrink-0"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  );
                }

                const req = row.request;
                return (
                  <div key={row.id} className="border border-gray-200 rounded-lg p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm">
                        <p className="font-medium text-gray-800">
                          {req.type === 'export'
                            ? 'Export Request'
                            : req.type === 'add'
                              ? 'Add Request'
                              : req.type === 'edit'
                                ? 'Edit Request'
                                : 'Delete Request'}
                          {req.type !== 'export' && (
                            <>
                              <span className="text-gray-400 font-normal"> · </span>
                              <span className="font-mono">{req.sampleId}</span>
                            </>
                          )}
                        </p>
                        <p className="text-xs text-gray-500">
                          Requested by <span className="font-medium">{req.requestedBy}</span> · {new Date(req.submittedAt).toLocaleString()}
                        </p>
                        {req.type === 'export' && (
                          <p className="text-xs text-gray-600 mt-1">
                            Requesting CSV export of their own samples in this project
                          </p>
                        )}
                      </div>
                      {canApproveOrRejectRequest(req) && (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => approve(req.id)}
                            className="px-3 py-1.5 bg-mint-800 bg-gradient-to-r from-[#0F766E] to-[#115E59] text-white text-xs font-medium rounded-lg hover:opacity-95 transition-opacity"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => reject(req.id)}
                            className="px-3 py-1.5 border border-gray-300 text-xs font-medium rounded-lg hover:bg-gray-50"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </div>

                    {req.type === 'edit' && Array.isArray(req.changes) && req.changes.length > 0 && (
                      <div className="mt-2 text-xs text-gray-700">
                        {req.changes.map((c) => (
                          <div key={c.field}>
                            <span className="font-medium">{c.field}</span>: {String(c.from)} → {String(c.to)}
                          </div>
                        ))}
                      </div>
                    )}

                    {req.type === 'delete' && req.reason && (
                      <p className="mt-2 text-xs text-gray-700">
                        <span className="font-medium">Reason</span>: {req.reason}
                      </p>
                    )}

                    {req.type === 'add' && req.proposedSample && (
                      <div className="mt-2 text-xs text-gray-700">
                        <div><span className="font-medium">Sample Type</span>: {req.proposedSample.sampleType || '—'}</div>
                        <div><span className="font-medium">Disease</span>: {req.proposedSample.disease || '—'}</div>
                        <div><span className="font-medium">Status</span>: {req.proposedSample.status || '—'}</div>
                      </div>
                    )}
                  </div>
                );
                  })}
                </div>
                {canSeeOutgoingCoResearcherInvites && (
                  <p className="text-xs text-gray-500">
                    Invited researchers accept or decline on this project page or under Co-Researcher Invitations on Projects.
                  </p>
                )}
              </div>
            )
          )}
        </div>
      )}

      <div className="bg-white rounded-xl border border-mint-100 shadow-sm p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h2 className="font-semibold text-gray-800">
            Related Samples
          </h2>
          <div className="flex flex-wrap gap-2">
            {(isAdmin || isResearcher) && (
              canAddSample ? (
                <Link
                  to="/samples/new"
                  state={{ projectId: project.id, lockProject: true, returnTo: `/projects/${project.id}` }}
                  className="px-3 py-2 bg-mint-800 bg-gradient-to-r from-[#0F766E] to-[#115E59] text-white text-sm font-medium rounded-lg hover:opacity-95 transition-opacity"
                >
                  {isCoResearcher && !isAdmin ? 'Request Add Sample' : 'Add Sample'}
                </Link>
              ) : (
                <button
                  type="button"
                  disabled
                  title="Only researchers involved in this project can add samples."
                  className="px-3 py-2 bg-gray-200 text-gray-500 text-sm font-medium rounded-lg cursor-not-allowed"
                >
                  Add Sample
                </button>
              )
            )}
            {showExportCsvButton && (
              <button
                type="button"
                onClick={handleExportProjectCsv}
                className="px-3 py-2 bg-white border border-mint-300 text-mint-700 text-sm font-medium rounded-lg hover:bg-mint-50 hover:text-mint-800 dark:bg-slate-900 dark:border-mint-400/70 dark:text-mint-300 dark:hover:bg-mint-400/15 dark:hover:text-mint-200"
              >
                {isCoResearcher && !isAdmin && !isLeadResearcher ? 'Download CSV' : 'Export CSV'}
              </button>
            )}
            {showRequestExportButton && (
              <button
                type="button"
                onClick={handleRequestExport}
                className="px-3 py-2 bg-white border border-mint-300 text-mint-700 text-sm font-medium rounded-lg hover:bg-mint-50"
              >
                Request Export
              </button>
            )}
          </div>
        </div>
        <p className="text-sm text-gray-500 mb-4">{filtered.length} samples found</p>

        <div className="space-y-3 mb-4">
          <div className="flex flex-wrap gap-3 items-center">
            <input
              type="text"
              placeholder="Search samples..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm flex-1 min-w-[180px]"
            />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="">All Types</option>
              {uniqueTypes.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="">All Statuses</option>
              {uniqueStatuses.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <button type="button" onClick={clearFilters} className="text-sm text-mint-700 hover:text-mint-800 dark:text-mint-300 dark:hover:text-mint-200 font-medium">
              Clear Filters
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-mint-50 border-b border-mint-100">
              <tr>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Sample ID</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Disease</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Organism</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Sample Type</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Tissue Source</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Project name</th>
                <th className="text-center py-3 px-3 font-semibold text-gray-700 whitespace-nowrap min-w-[9.5rem] w-[1%] align-middle">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b border-mint-50 hover:bg-mint-50/50">
                  <td className="py-2 px-4">{r.sampleId}</td>
                  <td className="py-2 px-4">{r.disease ?? '—'}</td>
                  <td className="py-2 px-4">{r.organismName}</td>
                  <td className="py-2 px-4">{r.sampleType}</td>
                  <td className="py-2 px-4">{r.tissueSource ?? '—'}</td>
                  <td className="py-2 px-4 align-middle">{r.projectName}</td>
                  <td className="py-2 px-3 whitespace-nowrap align-middle min-w-[9.5rem] w-[1%]">
                    <div className="flex w-full min-w-0 flex-nowrap items-center justify-center gap-1.5">
                      <ViewIconLink to={`/samples/${r.id}`} label="View sample" />
                      {canEditSampleDirect(r) && (
                        <EditIconLink to={`/samples/${r.id}/edit`} label="Edit sample" />
                      )}
                      {canRequestEdit(r) && (
                        <RequestEditIconLink
                          to={`/samples/${r.id}/edit`}
                          state={{ requestEdit: true, returnTo: `/projects/${project.id}` }}
                        />
                      )}
                      {canDeleteSampleDirect(r) && (
                        <DeleteIconButton onClick={() => setConfirmDeleteId(r.id)} label="Delete sample" />
                      )}
                      {canRequestDelete(r) && (
                        <RequestDeleteIconButton onClick={() => setConfirmRequestDelete(r)} />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <p className="py-6 text-center text-gray-500">No samples match your filters.</p>
        )}
      </div>

      {confirmDeleteId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-xl">
            <p className="font-medium text-gray-800 mb-2">Delete this sample?</p>
            <p className="text-sm text-gray-500 mb-4">This action cannot be undone.</p>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setConfirmDeleteId(null)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button type="button" onClick={() => handleDeleteSample(confirmDeleteId)} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">Delete</button>
            </div>
          </div>
        </div>
      )}

      {confirmRequestDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-xl">
            <p className="font-medium text-gray-800 mb-2">Request deletion of this sample?</p>
            <p className="text-sm text-gray-500 mb-4">
              Are you sure you want to request deletion of this sample? The Lead Researcher will need to approve this request.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setConfirmRequestDelete(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleRequestDelete(confirmRequestDelete)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
              >
                Submit Request
              </button>
            </div>
          </div>
        </div>
      )}

      {Boolean(confirmPublication) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl">
            <p className="font-medium text-gray-800 mb-2">
              Change publication status?
            </p>
            <p className="text-sm text-gray-500 mb-4">
              {confirmPublication === 'Published (public)'
                ? 'Set this project to Published (public)? Researchers, admins, and students will be able to view it.'
                : confirmPublication === 'Published (limited)'
                  ? 'Set this project to Published (limited)? Only researchers and admins will be able to view it; students will not.'
                  : 'Set this project back to Draft? It will be hidden from users who are not on the project team.'}
            </p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setConfirmPublication('')}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  updateProject(project.id, { publicationStatus: confirmPublication });
                  setConfirmPublication('');
                }}
                className={`px-4 py-2 text-white rounded-lg text-sm font-medium ${
                  confirmPublication === 'Published (public)'
                    ? 'bg-mint-800 bg-gradient-to-r from-[#0F766E] to-[#115E59] hover:opacity-95 transition-opacity'
                    : confirmPublication === 'Published (limited)'
                      ? 'bg-blue-600 hover:bg-blue-700'
                      : 'bg-orange-600 hover:bg-orange-700'
                }`}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {coInviteModalOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] overflow-y-auto overscroll-y-contain bg-black/50"
            role="dialog"
            aria-modal="true"
            aria-labelledby="co-invite-modal-title"
          >
            <div className="flex min-h-[100dvh] items-center justify-center p-4 sm:p-6">
              <div className="relative flex w-full max-w-lg max-h-[min(92dvh,52rem)] flex-col overflow-hidden rounded-2xl shadow-xl ring-1 ring-black/10">
                <div className="flex shrink-0 items-center justify-between gap-3 rounded-t-2xl bg-gradient-to-r from-[#0F766E] to-[#115E59] px-4 py-2.5 text-white">
                  <h2 id="co-invite-modal-title" className="text-base font-semibold text-white">
                    Invite co-researchers
                  </h2>
                  <button
                    type="button"
                    onClick={() => setCoInviteModalOpen(false)}
                    className="inline-flex h-8 min-w-[2rem] items-center justify-center rounded-lg text-xl leading-none text-white/90 hover:bg-white/15 hover:text-white"
                    aria-label="Close dialog"
                  >
                    ×
                  </button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-b-2xl bg-white dark:bg-slate-900 px-4 py-4 space-y-4">
                  <p className="text-sm text-gray-600 dark:text-slate-300">
                    <span className="font-medium text-gray-800 dark:text-slate-100">{project.name}</span>
                    {' — '}
                    Invitations are sent immediately. Each person can accept or decline from their Projects page or here on this project. You can cancel any pending invitation from the pending list on this page.
                  </p>

                  {inviteableResearchersWithMeta.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-slate-400 border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-4 bg-gray-50 dark:bg-slate-800/80">
                      No eligible people to invite right now (everyone listed may already be on the team, be the lead researcher, or have a pending invitation).
                    </p>
                  ) : (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">
                        Researchers to invite
                      </label>
                      <div className="relative" ref={coInviteDropdownRef}>
                        <input
                          type="text"
                          value={coInviteSearch}
                          onChange={(e) => {
                            setCoInviteSearch(e.target.value);
                            if (!coInviteDropdownOpen) setCoInviteDropdownOpen(true);
                          }}
                          onFocus={() => setCoInviteDropdownOpen(true)}
                          placeholder="Search researchers by name..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white dark:bg-slate-900 dark:border-slate-600 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-mint-500/30"
                        />

                        {coInviteDropdownOpen && (
                          <div className="absolute z-30 mt-2 w-full rounded-xl border border-gray-200 bg-white shadow-lg dark:border-slate-600 dark:bg-slate-900 overflow-hidden">
                            <div className="max-h-72 overflow-y-auto">
                              {filteredInviteResearchers.length === 0 ? (
                                <p className="px-3 py-3 text-sm text-gray-500 dark:text-slate-400">
                                  No researchers found.
                                </p>
                              ) : (
                                filteredInviteResearchers.map((researcher) => {
                                  const selected = isInviteResearcherSelected(researcher.name);
                                  return (
                                    <button
                                      key={researcher.name}
                                      type="button"
                                      onClick={() => toggleInviteResearcherPick(researcher.name)}
                                      className={`w-full text-left px-3 py-2.5 border-b border-gray-100 last:border-b-0 dark:border-slate-700 transition-colors ${
                                        selected
                                          ? 'bg-teal-100/80 text-teal-900 dark:bg-teal-900/45 dark:text-teal-100'
                                          : 'hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-800 dark:text-slate-100'
                                      }`}
                                    >
                                      <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                          <p className="text-sm font-medium truncate">{researcher.name}</p>
                                          <p className="text-xs text-gray-500 dark:text-slate-400 truncate">
                                            {researcher.email || 'No email available'}
                                          </p>
                                        </div>
                                        {selected && (
                                          <Check className="h-4 w-4 shrink-0 mt-0.5 text-teal-700 dark:text-teal-200" aria-hidden />
                                        )}
                                      </div>
                                    </button>
                                  );
                                })
                              )}
                            </div>
                            <div className="p-2 border-t border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-900">
                              <button
                                type="button"
                                onClick={() => setCoInviteDropdownOpen(false)}
                                className="w-full px-3 py-2 rounded-lg bg-mint-800 bg-gradient-to-r from-[#0F766E] to-[#115E59] text-white text-sm font-medium hover:opacity-95 transition-opacity"
                              >
                                Done
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {coInviteSelection.size > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {[...coInviteSelection].map((name) => (
                            <span
                              key={name}
                              className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-teal-400 bg-white px-2.5 py-1 text-xs text-teal-700 dark:border-teal-300 dark:bg-transparent dark:text-teal-200"
                            >
                              <span>{name}</span>
                              <button
                                type="button"
                                onClick={() => removeInvitePick(name)}
                                className="inline-flex items-center justify-center rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/10"
                                aria-label={`Remove ${name} from invite list`}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex flex-wrap justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setCoInviteModalOpen(false)}
                      className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg hover:bg-gray-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleSubmitCoResearcherInvites()}
                      disabled={inviteableResearchersWithMeta.length === 0 || coInviteSelection.size === 0}
                      className="px-4 py-2 bg-mint-800 bg-gradient-to-r from-[#0F766E] to-[#115E59] text-white text-sm font-medium rounded-lg hover:opacity-95 transition-opacity disabled:opacity-50 disabled:pointer-events-none"
                    >
                      Send invitations
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
      <RemoveCoResearcherModal
        open={Boolean(removeCoResearcherTarget)}
        onClose={() => setRemoveCoResearcherTarget(null)}
        coResearcherName={removeCoResearcherTarget || ''}
        projectName={project?.name || ''}
        onConfirm={async () => {
          if (!project?.id || !removeCoResearcherTarget) return { ok: false };
          const target = removeCoResearcherTarget;
          const res = await removeCoResearcherFromProject(project.id, target);
          if (res.ok) {
            try {
              window.dispatchEvent(
                new CustomEvent('biosample_flash', {
                  detail: {
                    message: `${target} has been removed from ${project.name}.`,
                    variant: 'success',
                  },
                })
              );
            } catch {}
          } else if (res.error) {
            try {
              window.dispatchEvent(
                new CustomEvent('biosample_flash', { detail: { message: res.error, variant: 'error' } })
              );
            } catch {}
          }
          return res;
        }}
      />
    </div>
  );
}

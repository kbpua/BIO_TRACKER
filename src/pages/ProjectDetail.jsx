import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useParams, Link, useLocation, useNavigate } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { canUserChangeProjectPublication, canUserViewProject, getProjectPublicationStatus } from '../utils/visibility';
import { displayNamesEqual, isPendingCoResearcherInviteForUser } from '../utils/personName';
import { exportSamplesCSV } from '../utils/export';
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
    submitCoResearcherInviteRequest,
    refreshInvitesAndRequests,
  } = useData();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [confirmPublication, setConfirmPublication] = useState(null);
  const [confirmRequestDelete, setConfirmRequestDelete] = useState(null);
  const [coInviteModalOpen, setCoInviteModalOpen] = useState(false);
  const [coInviteSelection, setCoInviteSelection] = useState(() => new Set());
  const [sbInviteProfiles, setSbInviteProfiles] = useState([]);

  useEffect(() => {
    if (!coInviteModalOpen || !isSupabaseConfigured() || !supabase) return;
    let cancelled = false;
    supabase
      .from('profiles')
      .select('full_name, role, status')
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
  const isCoResearcher = isResearcher && Array.isArray(project?.coResearchers)
    && project.coResearchers.some((n) => displayNamesEqual(n, user?.fullName));
  const canAddSample = isAdmin || isLeadResearcher || isCoResearcher;

  const canExportFromProjectPage = isAdmin || (isResearcher && (isLeadResearcher || isCoResearcher));
  const hasCoResearcherExportApproval =
    isCoResearcher &&
    Array.isArray(project?.approvedExporters) &&
    project.approvedExporters.includes(user?.fullName);
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
    () => pendingForProject.filter(
      (r) => !(r.type === 'coResearcherInvite' && r.resolution)
    ),
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

  useEffect(() => {
    if (coInviteModalOpen) setCoInviteSelection(new Set());
  }, [coInviteModalOpen]);

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
      if (isAdmin) {
        sendCoResearcherInvites({
          projectId: project.id,
          invitedBy: user?.fullName || 'Unknown',
          invitedToList: inviteAdded,
        });
        const msg = `Co-Researcher invite${inviteAdded.length > 1 ? 's' : ''} sent for ${project.name}: ${inviteAdded.join(', ')}`;
        try { window.dispatchEvent(new CustomEvent('biosample_flash', { detail: { message: msg, variant: 'success' } })); } catch {}
        addActivity(`${user?.fullName} set up co-researcher invite(s) for ${project.name}: ${inviteAdded.join(', ')}`);
      } else {
        const created = await submitCoResearcherInviteRequest({
          projectId: project.id,
          requestedBy: user?.fullName || 'Unknown',
          invitedToList: inviteAdded,
        });
        if (!created?.ok) {
          shouldCloseModal = false;
          try {
            window.dispatchEvent(new CustomEvent('biosample_flash', {
              detail: {
                message: created?.reason === 'duplicate'
                  ? 'A matching co-researcher invite request is already pending admin approval.'
                  : 'Could not submit one or more co-researcher requests. Please try again.',
                variant: 'error',
              },
            }));
          } catch {}
        } else {
          const msg = `Your request to add co-researcher${inviteAdded.length > 1 ? 's' : ''} (${inviteAdded.join(', ')}) was sent to Admin for approval.`;
          try { window.dispatchEvent(new CustomEvent('biosample_flash', { detail: { message: msg, variant: 'success' } })); } catch {}
          addActivity(`${user?.fullName} set up co-researcher invite(s) for ${project.name}: ${inviteAdded.join(', ')}`);
        }
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

  const myCoResearcherInviteAwaitingAdmin = useMemo(() => {
    if (!project) return null;
    return (pendingRequests || []).find(
      (r) =>
        r.projectId === project.id
        && r.type === 'coResearcherInvite'
        && !r.resolution
        && (
          (user?.authId && r.requestedByUserId && r.requestedByUserId === user.authId)
          || displayNamesEqual(r.requestedBy, user?.fullName)
        )
    ) || null;
  }, [pendingRequests, project, user?.authId, user?.fullName]);

  const myResolvedCoResearcherInviteRequest = useMemo(() => {
    if (!project) return null;
    return (pendingRequests || []).find(
      (r) =>
        r.projectId === project.id
        && r.type === 'coResearcherInvite'
        && r.resolution
        && (
          (user?.authId && r.requestedByUserId && r.requestedByUserId === user.authId)
          || displayNamesEqual(r.requestedBy, user?.fullName)
        )
    ) || null;
  }, [pendingRequests, project, user?.authId, user?.fullName]);

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
    if (req.type === 'coResearcherInvite') {
      if (!isAdmin) return false;
      const requestedByMe = (user?.authId && req.requestedByUserId && req.requestedByUserId === user.authId)
        || displayNamesEqual(req.requestedBy, user?.fullName);
      return !requestedByMe;
    }
    return canSeePendingQueue;
  };

  const canSeeOutgoingCoResearcherInvites =
    isAdmin
    || isLeadResearcher
    || (isResearcher && pendingCoResearcherInvitesForProject.some((inv) =>
      displayNamesEqual(inv.invitedBy, user?.fullName)));

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
    } else if (approved.type === 'coResearcherInvite') {
      const invitees = Array.isArray(approved.proposedUpdates?.invitedToList) ? approved.proposedUpdates.invitedToList : [];
      const requesterMsg = invitees.length > 0
        ? `Admin approved your co-researcher request for ${project?.name || approved.projectId}. Invites were sent to: ${invitees.join(', ')}.`
        : `Admin approved your co-researcher request for ${project?.name || approved.projectId}.`;
      const approverMsg = invitees.length > 0
        ? `Co-researcher invite request approved. Invites sent to: ${invitees.join(', ')}.`
        : 'Co-researcher invite request approved.';
      try { window.dispatchEvent(new CustomEvent('biosample_flash', { detail: { message: approverMsg, variant: 'success' } })); } catch {}
      enqueueToastForUser(approved.requestedBy, { message: requesterMsg, variant: 'success' });
      addActivity(`${user?.fullName} approved co-researcher invite request for project ${project?.name || approved.projectId} (invitees: ${invitees.join(', ')})`);
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
    if (rejected.type === 'coResearcherInvite') {
      const invitees = Array.isArray(rejected.proposedUpdates?.invitedToList) ? rejected.proposedUpdates.invitedToList : [];
      const requesterMsg = invitees.length > 0
        ? `Admin declined your co-researcher request for ${project?.name || rejected.projectId}. No invite was sent to: ${invitees.join(', ')}.`
        : `Admin declined your co-researcher request for ${project?.name || rejected.projectId}.`;
      const approverMsg = invitees.length > 0
        ? `Co-researcher invite request declined. No invite sent to: ${invitees.join(', ')}.`
        : 'Co-researcher invite request declined.';
      try { window.dispatchEvent(new CustomEvent('biosample_flash', { detail: { message: approverMsg, variant: 'error' } })); } catch {}
      enqueueToastForUser(rejected.requestedBy, { message: requesterMsg, variant: 'error' });
      addActivity(`${user?.fullName} rejected co-researcher invite request for project ${project?.name || rejected.projectId}`);
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
        <p className="text-gray-600">This project has not been published yet.</p>
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
                {pubStatus === 'Draft' ? (
                  <button
                    type="button"
                    onClick={() => setConfirmPublication('publish')}
                    className="px-4 py-2 bg-mint-800 bg-gradient-to-r from-[#0F766E] to-[#115E59] text-white text-sm font-medium rounded-lg hover:opacity-95 transition-opacity"
                  >
                    Publish Project
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmPublication('unpublish')}
                    className="px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700"
                  >
                    Unpublish Project
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
            <dd>{(Array.isArray(project.coResearchers) && project.coResearchers.length > 0) ? project.coResearchers.join(', ') : '—'}</dd>
          </div>
          <div><dt className="text-gray-500">Status</dt><dd>{project.status}</dd></div>
          <div><dt className="text-gray-500">Publication Status</dt><dd>{pubStatus}</dd></div>
        </dl>
      </div>

      {myCoResearcherInviteAwaitingAdmin && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl shadow-sm p-4 space-y-2">
          <h2 className="font-semibold text-amber-950">Awaiting admin approval</h2>
          <p className="text-sm text-amber-900">
            Your request to invite{' '}
            <span className="font-medium">
              {(Array.isArray(myCoResearcherInviteAwaitingAdmin.proposedUpdates?.invitedToList)
                ? myCoResearcherInviteAwaitingAdmin.proposedUpdates.invitedToList.join(', ')
                : 'co-researchers')}
            </span>{' '}
            is pending review by an administrator. You will get a notification when it is approved or declined.
          </p>
          <p className="text-xs text-amber-800/90">
            Submitted {myCoResearcherInviteAwaitingAdmin.submittedAt
              ? new Date(myCoResearcherInviteAwaitingAdmin.submittedAt).toLocaleString()
              : '—'}
          </p>
        </div>
      )}

      {myResolvedCoResearcherInviteRequest && (
        <div
          className={`rounded-xl shadow-sm p-4 space-y-2 border ${
            myResolvedCoResearcherInviteRequest.resolution === 'approved'
              ? 'bg-emerald-50 border-emerald-200'
              : 'bg-red-50 border-red-200'
          }`}
        >
          <h2
            className={`font-semibold ${
              myResolvedCoResearcherInviteRequest.resolution === 'approved' ? 'text-emerald-950' : 'text-red-950'
            }`}
          >
            {myResolvedCoResearcherInviteRequest.resolution === 'approved'
              ? 'Admin approved your co-researcher request'
              : 'Admin declined your co-researcher request'}
          </h2>
          <p
            className={`text-sm ${
              myResolvedCoResearcherInviteRequest.resolution === 'approved' ? 'text-emerald-900' : 'text-red-900'
            }`}
          >
            Invitees:{' '}
            <span className="font-medium">
              {(Array.isArray(myResolvedCoResearcherInviteRequest.proposedUpdates?.invitedToList)
                ? myResolvedCoResearcherInviteRequest.proposedUpdates.invitedToList.join(', ')
                : '—')}
            </span>
            {myResolvedCoResearcherInviteRequest.resolution === 'approved'
              ? '. Invitations were sent; each researcher can accept or decline here on the project or on their Projects page.'
              : '. No invitations were sent.'}
          </p>
          {myResolvedCoResearcherInviteRequest.resolvedAt && (
            <p
              className={`text-xs ${
                myResolvedCoResearcherInviteRequest.resolution === 'approved'
                  ? 'text-emerald-800/90'
                  : 'text-red-800/90'
              }`}
            >
              Resolved {new Date(myResolvedCoResearcherInviteRequest.resolvedAt).toLocaleString()}
            </p>
          )}
        </div>
      )}

      {canSeeOutgoingCoResearcherInvites && (
        <div className="bg-white rounded-xl border border-mint-100 shadow-sm p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold text-gray-800">Pending co-researcher invitations</h2>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
              {pendingCoResearcherInvitesForProject.length} pending
            </span>
          </div>
          {pendingCoResearcherInvitesForProject.length === 0 ? (
            <p className="text-sm text-gray-500">No outstanding invites for this project.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {pendingCoResearcherInvitesForProject.map((inv) => (
                <li
                  key={inv.id}
                  className="flex flex-wrap items-center justify-between gap-2 border border-gray-200 rounded-lg px-3 py-2"
                >
                  <span className="font-medium text-gray-800">{inv.invitedTo}</span>
                  <span className="text-xs text-gray-500">
                    Invited by {inv.invitedBy} · {inv.createdAt ? new Date(inv.createdAt).toLocaleString() : '—'}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-gray-500">
            Invited researchers accept or decline on this project page or under Co-Researcher Invitations on Projects.
          </p>
        </div>
      )}

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

      {canSeePendingQueue && (
        <div className="bg-white rounded-xl border border-mint-100 shadow-sm p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold text-gray-800">Pending Requests</h2>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
              {pendingForProjectQueue.length} pending requests
            </span>
          </div>
          {pendingForProjectQueue.length === 0 ? (
            <p className="text-sm text-gray-500">No pending requests.</p>
          ) : (
            <div className="space-y-2">
              {pendingForProjectQueue.map((req) => (
                <div key={req.id} className="border border-gray-200 rounded-lg p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm">
                      <p className="font-medium text-gray-800">
                        {req.type === 'export'
                          ? 'Export Request'
                          : req.type === 'coResearcherInvite'
                            ? 'Co-Researcher Invite Request'
                          : req.type === 'add'
                            ? 'Add Request'
                            : req.type === 'edit'
                              ? 'Edit Request'
                              : 'Delete Request'}
                        {!['export', 'coResearcherInvite'].includes(req.type) && (
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
                      {req.type === 'coResearcherInvite' && (
                        <p className="text-xs text-gray-600 mt-1">
                          Requested co-researcher invite approval for: {(req.proposedUpdates?.invitedToList || []).join(', ') || '—'}
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
              ))}
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-xl border border-mint-100 shadow-sm p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h2 className="font-semibold text-gray-800">
            Related Samples
          </h2>
          <div className="flex flex-wrap gap-2">
            {canAddSample && (
              <Link
                to="/samples/new"
                state={{ projectId: project.id, lockProject: true, returnTo: `/projects/${project.id}` }}
                className="px-3 py-2 bg-mint-800 bg-gradient-to-r from-[#0F766E] to-[#115E59] text-white text-sm font-medium rounded-lg hover:opacity-95 transition-opacity"
              >
                {isCoResearcher && !isAdmin ? 'Request Add Sample' : 'Add Sample'}
              </Link>
            )}
            {showExportCsvButton && (
              <button
                type="button"
                onClick={handleExportProjectCsv}
                className="px-3 py-2 bg-white border border-mint-300 text-mint-700 text-sm font-medium rounded-lg hover:bg-mint-50 hover:text-mint-800 dark:bg-slate-900 dark:border-mint-400/70 dark:text-mint-300 dark:hover:bg-mint-400/15 dark:hover:text-mint-200"
              >
                Export CSV
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
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Study Purpose</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Project name</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Actions</th>
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
                  <td className="py-2 px-4">{r.studyPurpose ?? '—'}</td>
                  <td className="py-2 px-4">{r.projectName}</td>
                  <td className="py-2 px-4">
                    <div className="flex flex-wrap items-center gap-1.5">
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

      {confirmPublication && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl">
            <p className="font-medium text-gray-800 mb-2">
              {confirmPublication === 'publish' ? 'Publish this project?' : 'Unpublish this project?'}
            </p>
            <p className="text-sm text-gray-500 mb-4">
              {confirmPublication === 'publish'
                ? 'Are you sure you want to publish this project? Once published, this project and all of its samples will become visible to all researchers and students in the system.'
                : 'Are you sure you want to unpublish this project? This project and all of its samples will be hidden from other researchers and students.'}
            </p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setConfirmPublication(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const next = confirmPublication === 'publish' ? 'Published' : 'Draft';
                  updateProject(project.id, { publicationStatus: next });
                  setConfirmPublication(null);
                }}
                className={`px-4 py-2 text-white rounded-lg text-sm font-medium ${
                  confirmPublication === 'publish' ? 'bg-mint-800 bg-gradient-to-r from-[#0F766E] to-[#115E59] hover:opacity-95 transition-opacity' : 'bg-orange-600 hover:bg-orange-700'
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
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-b-2xl bg-white px-4 py-4 space-y-4">
                  <p className="text-sm text-gray-600">
                    <span className="font-medium text-gray-800">{project.name}</span>
                    {' — '}
                    {isAdmin
                      ? 'Invitations are sent immediately. Each person can accept or decline from their Projects page or here on this project.'
                      : 'Your selections are sent to an administrator for approval. When approved, each person receives an invitation.'}
                  </p>
                  {inviteableCoResearcherNames.length === 0 ? (
                    <p className="text-sm text-gray-500 border border-gray-200 rounded-lg px-3 py-4 bg-gray-50">
                      No eligible people to invite right now (everyone listed may already be on the team, be the lead researcher, or have a pending invitation).
                    </p>
                  ) : (
                    <div className="border border-gray-200 rounded-lg p-3 max-h-60 overflow-auto space-y-2">
                      {inviteableCoResearcherNames.map((name) => {
                        const checked = coInviteSelection.has(name);
                        return (
                          <label
                            key={name}
                            className="flex items-center gap-2 text-sm text-gray-800 select-none cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                setCoInviteSelection((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(name)) next.delete(name);
                                  else next.add(name);
                                  return next;
                                });
                              }}
                              className="h-4 w-4 accent-mint-600 shrink-0"
                            />
                            <span>{name}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                  <div className="flex flex-wrap justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setCoInviteModalOpen(false)}
                      className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleSubmitCoResearcherInvites()}
                      disabled={inviteableCoResearcherNames.length === 0}
                      className="px-4 py-2 bg-mint-800 bg-gradient-to-r from-[#0F766E] to-[#115E59] text-white text-sm font-medium rounded-lg hover:opacity-95 transition-opacity disabled:opacity-50 disabled:pointer-events-none"
                    >
                      {isAdmin ? 'Send invitations' : 'Submit request'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

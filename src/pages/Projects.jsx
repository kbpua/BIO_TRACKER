import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { PROJECT_STATUSES } from '../data/mockData';
import { generateProjectId } from '../utils/projectId';
import { PUBLICATION_STATUSES, canUserViewProject, getVisibleSamples, getProjectPublicationStatus } from '../utils/visibility';
import { ViewIconLink, EditIconButton, DeleteIconButton } from '../components/TableActionButtons';
import {
  displayNamesEqual,
  isPendingCoResearcherInviteForUser,
  PENDING_CO_RESEARCHER_INVITES_HASH,
} from '../utils/personName';

function ProjectForm({ project, onSave, onCancel, canSetPublicationStatus, canEditLeadResearcher }) {
  const { users, projects } = useData();
  const [sbProfiles, setSbProfiles] = useState([]);

  useEffect(() => {
    if (!isSupabaseConfigured() || !supabase) return;
    let cancelled = false;
    supabase
      .from('profiles')
      .select('full_name, role, status')
      .in('role', ['Researcher', 'Admin'])
      .eq('status', 'Active')
      .then(({ data }) => {
        if (!cancelled && data) setSbProfiles(data);
      });
    return () => { cancelled = true; };
  }, []);

  const activeResearchers = (users || []).filter(
    (u) => u.role === 'Researcher' && u.status === 'Active'
  );
  const isEdit = Boolean(project?.id);
  const [form, setForm] = useState({
    name: project?.name ?? '',
    description: project?.description ?? '',
    startDate: project?.startDate ?? '',
    endDate: project?.endDate ?? '',
    leadResearcher: project?.leadResearcher ?? '',
    coResearchers: Array.isArray(project?.coResearchers) ? project.coResearchers : [],
    status: project?.status ?? 'Active',
    publicationStatus: getProjectPublicationStatus(project),
  });
  const previewId = !isEdit && form.name && form.startDate
    ? generateProjectId(form.name, form.startDate, projects)
    : '';

  useEffect(() => {
    if (isEdit) {
      setForm({
        name: project?.name ?? '',
        description: project?.description ?? '',
        startDate: project?.startDate ?? '',
        endDate: project?.endDate ?? '',
        leadResearcher: project?.leadResearcher ?? '',
        coResearchers: Array.isArray(project?.coResearchers) ? project.coResearchers : [],
        status: project?.status ?? 'Active',
        publicationStatus: getProjectPublicationStatus(project),
      });
      return;
    }
    setForm({
      name: '',
      description: '',
      startDate: '',
      endDate: '',
      leadResearcher: '',
      coResearchers: [],
      status: 'Active',
      publicationStatus: 'Draft',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id, isEdit]);

  const availableCoResearchers = useMemo(() => {
    const fromContext = (users || [])
      .filter((u) => u.status === 'Active' && (u.role === 'Researcher' || u.role === 'Admin'))
      .map((u) => u.fullName)
      .filter(Boolean);
    const fromSb = sbProfiles
      .map((p) => p.full_name)
      .filter(Boolean);
    const merged = [...new Set([...fromContext, ...fromSb])];
    return merged.filter((name) => name !== form.leadResearcher);
  }, [users, sbProfiles, form.leadResearcher]);

  useEffect(() => {
    setForm((f) => ({
      ...f,
      coResearchers: (Array.isArray(f.coResearchers) ? f.coResearchers : []).filter((n) => n && n !== f.leadResearcher),
    }));
  }, [form.leadResearcher]);

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const cleaned = {
          ...form,
          coResearchers: (Array.isArray(form.coResearchers) ? form.coResearchers : [])
            .filter((n) => n && n !== form.leadResearcher),
        };
        await onSave(cleaned);
      }}
      className="space-y-3"
    >
      {isEdit ? (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Project ID</label>
          <input
            type="text"
            value={project?.id ?? ''}
            readOnly
            className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed text-sm"
          />
          <p className="text-xs text-gray-500 mt-1">Project ID cannot be edited.</p>
        </div>
      ) : (
        form.name && form.startDate && (
          <div className="p-3 rounded-lg bg-mint-50 border border-mint-200">
            <label className="block text-sm font-medium text-mint-800 mb-1">Generated Project ID (preview)</label>
            <p className="font-mono font-semibold text-mint-800">{previewId}</p>
            <p className="text-xs text-gray-500 mt-1">This ID will be assigned when you submit.</p>
          </div>
        )
      )}
      <input
        type="text"
        placeholder="Project Name"
        value={form.name}
        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
        required
      />
      <textarea
        placeholder="Description"
        value={form.description}
        onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
        rows={2}
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          type="date"
          placeholder="Start Date"
          value={form.startDate}
          onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          required
        />
        <input
          type="date"
          placeholder="End Date"
          value={form.endDate}
          onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        />
      </div>
      <select
        value={form.leadResearcher}
        onChange={(e) => setForm((f) => ({ ...f, leadResearcher: e.target.value }))}
        className={`w-full px-3 py-2 border rounded-lg text-sm ${
          canEditLeadResearcher ? 'border-gray-300' : 'border-gray-200 bg-gray-50 text-gray-600 cursor-not-allowed'
        }`}
        required={activeResearchers.length > 0}
        disabled={!canEditLeadResearcher}
      >
        {activeResearchers.length === 0 ? (
          <option value="" disabled>No active researchers available.</option>
        ) : (
          <>
            <option value="">Select lead researcher</option>
            {activeResearchers.map((r) => (
              <option key={r.id} value={r.fullName}>{r.fullName}</option>
            ))}
          </>
        )}
      </select>
      {!canEditLeadResearcher && (
        <p className="text-xs text-gray-500">
          Lead Researcher can only be changed by an Admin.
        </p>
      )}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Co-Researchers</label>
        {availableCoResearchers.length === 0 ? (
          <div className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-500 bg-gray-50">
            No eligible co-researchers available.
          </div>
        ) : (
          <div className="border border-gray-300 rounded-lg p-3 max-h-44 overflow-auto space-y-2">
            {availableCoResearchers.map((name) => {
              const checked = Array.isArray(form.coResearchers) && form.coResearchers.includes(name);
              return (
                <label key={name} className="flex items-center gap-2 text-sm text-gray-800 select-none">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      const isChecked = e.target.checked;
                      setForm((f) => {
                        const prev = Array.isArray(f.coResearchers) ? f.coResearchers : [];
                        if (isChecked) return { ...f, coResearchers: [...new Set([...prev, name])] };
                        return { ...f, coResearchers: prev.filter((n) => n !== name) };
                      });
                    }}
                    className="h-4 w-4 accent-mint-600"
                  />
                  <span>{name}</span>
                </label>
              );
            })}
          </div>
        )}
        <p className="text-xs text-gray-500 mt-1">Click to select one or more co-researchers.</p>
      </div>
      <select
        value={form.status}
        onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
      >
        {PROJECT_STATUSES.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
      {canSetPublicationStatus && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Publication Status</label>
          <select
            value={form.publicationStatus}
            onChange={(e) => setForm((f) => ({ ...f, publicationStatus: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            {PUBLICATION_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      )}
      <div className="flex gap-2">
        <button type="submit" className="px-3 py-1.5 bg-mint-800 bg-gradient-to-r from-[#0F766E] to-[#115E59] text-white text-sm rounded-lg hover:opacity-95 transition-opacity">
          Save
        </button>
        <button type="button" onClick={onCancel} className="px-3 py-1.5 border border-gray-300 text-sm rounded-lg hover:bg-gray-50">
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function Projects() {
  const location = useLocation();
  const { user, canManageProjects, isResearcher, isAdmin } = useAuth();
  const {
    projects,
    samples,
    pendingRequests,
    addProject,
    updateProject,
    deleteProject,
    sendCoResearcherInvites,
    submitCoResearcherInviteRequest,
    approvePendingRequest,
    rejectPendingRequest,
    coResearcherInvites,
    respondToCoResearcherInvite,
    addActivity,
    refreshInvitesAndRequests,
  } = useData();

  const canEditProject = (p) =>
    canManageProjects || (isResearcher && displayNamesEqual(p.leadResearcher, user?.fullName));
  const [modal, setModal] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPublication, setFilterPublication] = useState('All');

  useEffect(() => {
    const incoming = location.state?.filterPublication;
    if (!incoming) return;
    setFilterPublication(incoming);
  }, [location.state]);

  useEffect(() => {
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
  }, [refreshInvitesAndRequests]);

  const myInvites = (coResearcherInvites || []).filter((i) => isPendingCoResearcherInviteForUser(i, user));

  useEffect(() => {
    if (location.pathname !== '/projects') return;
    const raw = (location.hash || '').replace(/^#/, '');
    if (raw !== PENDING_CO_RESEARCHER_INVITES_HASH) return;
    const t = window.setTimeout(() => {
      document.getElementById(PENDING_CO_RESEARCHER_INVITES_HASH)?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 120);
    return () => window.clearTimeout(t);
  }, [location.pathname, location.hash, coResearcherInvites, myInvites.length]);

  const visibleSamples = useMemo(
    () => getVisibleSamples(samples, projects, user, coResearcherInvites),
    [samples, projects, user, coResearcherInvites]
  );
  const countByProject = visibleSamples.reduce((acc, s) => {
    acc[s.projectId] = (acc[s.projectId] || 0) + 1;
    return acc;
  }, {});

  const visibleProjects = useMemo(
    () => projects.filter((p) => canUserViewProject(user, p, coResearcherInvites)),
    [projects, user, coResearcherInvites]
  );
  const projectOrder = useMemo(
    () => new Map(projects.map((p, idx) => [p.id, idx])),
    [projects]
  );

  const filteredProjects = visibleProjects.filter((p) => {
    const q = search.toLowerCase();
    const matchSearch = !search || [p.name, p.description, p.leadResearcher].some((v) => String(v ?? '').toLowerCase().includes(q));
    const matchStatus = !filterStatus || p.status === filterStatus;
    const pub = getProjectPublicationStatus(p);
    const matchPublication = filterPublication === 'All' || pub === filterPublication;
    return matchSearch && matchStatus && matchPublication;
  }).sort((a, b) => (projectOrder.get(a.id) ?? 0) - (projectOrder.get(b.id) ?? 0));

  const clearFilters = () => {
    setSearch('');
    setFilterStatus('');
    setFilterPublication('All');
  };

  const handleSave = async (data) => {
    if (modal === 'new') {
      const id = generateProjectId(data.name, data.startDate, projects);
      if (!id) {
        // Prevent creating a project with fallback "proj-..." id.
        // Start Date is required to compute the START YEAR part of the ID.
        // eslint-disable-next-line no-alert
        alert('Please provide a Project Name and Start Date to generate a Project ID (ABC-YYYY-###).');
        return;
      }
      const payload = canManageProjects ? data : { ...data, publicationStatus: 'Draft' };
      addProject({ ...payload, id });
    } else if (modal?.id) {
      const existing = projects.find((p) => p.id === modal.id);
      const payloadBase = canManageProjects
        ? data
        : { ...data, publicationStatus: existing?.publicationStatus };

      // Co-Researcher invitation workflow:
      // - additions become invites (not immediately added)
      // - removals apply immediately
      const prevCo = Array.isArray(existing?.coResearchers) ? existing.coResearchers : [];
      const nextCo = Array.isArray(payloadBase?.coResearchers) ? payloadBase.coResearchers : [];
      const added = nextCo.filter((n) => n && !prevCo.includes(n));
      const removed = prevCo.filter((n) => n && !nextCo.includes(n));

      // If an Admin adds themselves as a Co-Researcher, apply immediately (no invite needed).
      const adminSelf = isAdmin && user?.fullName ? user.fullName : null;
      const selfAdded = adminSelf ? added.includes(adminSelf) : false;
      const inviteAdded = selfAdded ? added.filter((n) => n !== adminSelf) : added;

      if (inviteAdded.length > 0) {
        if (isAdmin) {
          sendCoResearcherInvites({
            projectId: existing.id,
            invitedBy: user?.fullName || 'Unknown',
            invitedToList: inviteAdded,
          });
          const msg = `Co-Researcher invite${inviteAdded.length > 1 ? 's' : ''} sent for ${existing.name}: ${inviteAdded.join(', ')}`;
          try { window.dispatchEvent(new CustomEvent('biosample_flash', { detail: { message: msg, variant: 'success' } })); } catch {}
        } else {
          const created = await submitCoResearcherInviteRequest({
            projectId: existing.id,
            requestedBy: user?.fullName || 'Unknown',
            invitedToList: inviteAdded,
          });
          if (!created) {
            try {
              window.dispatchEvent(new CustomEvent('biosample_flash', {
                detail: {
                  message: 'A matching co-researcher invite request is already pending admin approval.',
                  variant: 'error',
                },
              }));
            } catch {}
          } else {
            const msg = `Your request to add co-researcher${inviteAdded.length > 1 ? 's' : ''} (${inviteAdded.join(', ')}) was sent to Admin for approval.`;
            try { window.dispatchEvent(new CustomEvent('biosample_flash', { detail: { message: msg, variant: 'success' } })); } catch {}
          }
        }
      }

      const payload = {
        ...payloadBase,
        coResearchers: (() => {
          const base = removed.length > 0 ? prevCo.filter((n) => !removed.includes(n)) : prevCo;
          if (selfAdded && adminSelf && !base.includes(adminSelf)) return [...base, adminSelf];
          return base;
        })(),
      };
      updateProject(modal.id, payload);
    }
    setModal(null);
  };

  const adminCoResearcherRequests = useMemo(
    () => (isAdmin
      ? (pendingRequests || []).filter((r) => r.type === 'coResearcherInvite' && !r.resolution)
      : []),
    [isAdmin, pendingRequests]
  );

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

  const handleApproveCoResearcherRequest = (req) => {
    const approved = approvePendingRequest(req.id);
    if (!approved) return;
    const invitees = Array.isArray(approved.proposedUpdates?.invitedToList) ? approved.proposedUpdates.invitedToList : [];
    const proj = projects.find((p) => p.id === approved.projectId);
    const approverMsg = invitees.length > 0
      ? `Co-researcher invite request approved. Invites sent to: ${invitees.join(', ')}.`
      : 'Co-researcher invite request approved.';
    const requesterMsg = invitees.length > 0
      ? `Admin approved your co-researcher request for ${proj?.name || approved.projectId}. Invites were sent to: ${invitees.join(', ')}.`
      : `Admin approved your co-researcher request for ${proj?.name || approved.projectId}.`;
    try { window.dispatchEvent(new CustomEvent('biosample_flash', { detail: { message: approverMsg, variant: 'success' } })); } catch {}
    enqueueToastForUser(approved.requestedBy, { message: requesterMsg, variant: 'success' });
    addActivity(`${user?.fullName} approved co-researcher invite request for ${proj?.name || approved.projectId} (invitees: ${invitees.join(', ')})`);
  };

  const handleRejectCoResearcherRequest = (req) => {
    const rejected = rejectPendingRequest(req.id);
    if (!rejected) return;
    const invitees = Array.isArray(rejected.proposedUpdates?.invitedToList) ? rejected.proposedUpdates.invitedToList : [];
    const proj = projects.find((p) => p.id === rejected.projectId);
    const approverMsg = invitees.length > 0
      ? `Co-researcher invite request declined. No invite sent to: ${invitees.join(', ')}.`
      : 'Co-researcher invite request declined.';
    const requesterMsg = invitees.length > 0
      ? `Admin declined your co-researcher request for ${proj?.name || rejected.projectId}. No invite was sent to: ${invitees.join(', ')}.`
      : `Admin declined your co-researcher request for ${proj?.name || rejected.projectId}.`;
    try { window.dispatchEvent(new CustomEvent('biosample_flash', { detail: { message: approverMsg, variant: 'error' } })); } catch {}
    enqueueToastForUser(rejected.requestedBy, { message: requesterMsg, variant: 'error' });
    addActivity(`${user?.fullName} rejected co-researcher invite request for ${proj?.name || rejected.projectId}`);
  };

  const handleDelete = async (id) => {
    const ok = await deleteProject(id);
    if (!ok) {
      // eslint-disable-next-line no-alert
      alert('Failed to delete project in Supabase. Please check your permissions and try again.');
      return;
    }
    setConfirmDelete(null);
  };

  return (
    <div>
      <header className="pb-6 mb-8">
        <div className="flex justify-between items-center min-h-11">
          <h1 className="text-2xl font-bold text-gray-800">Projects</h1>
          {canManageProjects && (
            <button
              type="button"
              onClick={() => setModal('new')}
              className="px-4 py-2 bg-mint-800 bg-gradient-to-r from-[#0F766E] to-[#115E59] text-white text-sm font-medium rounded-lg hover:opacity-95 transition-opacity"
            >
              Add Project
            </button>
          )}
        </div>
      </header>

      <div className="space-y-4">
      {myInvites.length > 0 && (
        <div
          id={PENDING_CO_RESEARCHER_INVITES_HASH}
          className="bg-white rounded-xl border border-mint-100 shadow-sm p-4 space-y-3 scroll-mt-20"
        >
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">Co-Researcher Invitations</h2>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
              {myInvites.length} pending
            </span>
          </div>
          <div className="space-y-2">
            {myInvites.map((inv) => {
              const proj = projects.find((p) => p.id === inv.projectId);
              return (
                <div key={inv.id} className="border border-gray-200 rounded-lg p-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm">
                    <p className="font-medium text-gray-800">{proj?.name || inv.projectId}</p>
                    <p className="text-xs text-gray-500">
                      Invited by <span className="font-medium">{inv.invitedBy}</span> · {new Date(inv.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        const res = await respondToCoResearcherInvite(inv.id, 'Accepted');
                        if (!res) {
                          try {
                            window.dispatchEvent(new CustomEvent('biosample_flash', {
                              detail: { message: 'Could not accept the invitation. Please try again.', variant: 'error' },
                            }));
                          } catch {}
                          return;
                        }
                        const msg = `Invitation accepted. You are now a Co-Researcher on ${proj?.name || inv.projectId}.`;
                        try { window.dispatchEvent(new CustomEvent('biosample_flash', { detail: { message: msg, variant: 'success' } })); } catch {}
                        addActivity(`${user?.fullName} accepted co-researcher invite for project ${proj?.name || inv.projectId}`);
                      }}
                      className="px-3 py-1.5 bg-mint-800 bg-gradient-to-r from-[#0F766E] to-[#115E59] text-white text-xs font-medium rounded-lg hover:opacity-95 transition-opacity"
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        const res = await respondToCoResearcherInvite(inv.id, 'Declined');
                        if (!res) {
                          try {
                            window.dispatchEvent(new CustomEvent('biosample_flash', {
                              detail: { message: 'Could not decline the invitation. Please try again.', variant: 'error' },
                            }));
                          } catch {}
                          return;
                        }
                        const msg = `Invitation declined for ${proj?.name || inv.projectId}.`;
                        try { window.dispatchEvent(new CustomEvent('biosample_flash', { detail: { message: msg, variant: 'error' } })); } catch {}
                        addActivity(`${user?.fullName} declined co-researcher invite for project ${proj?.name || inv.projectId}`);
                      }}
                      className="px-3 py-1.5 border border-gray-300 text-xs font-medium rounded-lg hover:bg-gray-50"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {isAdmin && adminCoResearcherRequests.length > 0 && (
        <div className="bg-white rounded-xl border border-mint-100 shadow-sm p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">Co-Researcher Requests</h2>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
              {adminCoResearcherRequests.length} pending
            </span>
          </div>
          <div className="space-y-2">
            {adminCoResearcherRequests.map((req) => {
              const proj = projects.find((p) => p.id === req.projectId);
              const invitees = Array.isArray(req.proposedUpdates?.invitedToList) ? req.proposedUpdates.invitedToList : [];
              return (
                <div key={req.id} className="border border-gray-200 rounded-lg p-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm">
                    <p className="font-medium text-gray-800">{proj?.name || req.projectId}</p>
                    <p className="text-xs text-gray-500">
                      Requested by <span className="font-medium">{req.requestedBy}</span> · {new Date(req.submittedAt).toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      Invite co-researcher{invitees.length > 1 ? 's' : ''}: {invitees.join(', ') || '—'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleApproveCoResearcherRequest(req)}
                      className="px-3 py-1.5 bg-mint-800 bg-gradient-to-r from-[#0F766E] to-[#115E59] text-white text-xs font-medium rounded-lg hover:opacity-95 transition-opacity"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRejectCoResearcherRequest(req)}
                      className="px-3 py-1.5 border border-gray-300 text-xs font-medium rounded-lg hover:bg-gray-50"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <div className="bg-white rounded-xl border border-mint-100 p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap gap-3 items-center">
          <input
            type="text"
            placeholder="Search by name, description, or lead researcher"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-mint-500 focus:border-mint-500 flex-1 min-w-[200px]"
          />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-mint-500"
          >
            <option value="">All Statuses</option>
            {PROJECT_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          {(isAdmin || isResearcher) && (
            <select
              value={filterPublication}
              onChange={(e) => setFilterPublication(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-mint-500"
            >
              <option value="All">All Publication</option>
              <option value="Published">Published</option>
              <option value="Draft">Draft</option>
            </select>
          )}
          <button type="button" onClick={clearFilters} className="text-sm text-mint-700 hover:text-mint-800 dark:text-mint-300 dark:hover:text-mint-200 font-medium">
            Clear Filters
          </button>
        </div>
      </div>
      <div className="bg-white rounded-xl border border-mint-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-mint-50 border-b border-mint-100">
            <tr>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Project ID</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Project Name</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Start Date</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">End Date</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Lead Researcher</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Co-Researchers</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700"># Samples</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredProjects.map((p) => (
              <tr key={p.id} className="border-b border-mint-50 hover:bg-mint-50/50">
                <td className="py-2 px-4">{p.id}</td>
                <td className="py-2 px-4 font-medium">{p.name}</td>
                <td className="py-2 px-4">{p.startDate || '—'}</td>
                <td className="py-2 px-4">{p.endDate || '—'}</td>
                <td className="py-2 px-4">{p.leadResearcher}</td>
                <td className="py-2 px-4 max-w-xs truncate">
                  {(Array.isArray(p.coResearchers) && p.coResearchers.length > 0) ? p.coResearchers.join(', ') : '—'}
                </td>
                <td className="py-2 px-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      p.status === 'Active'
                        ? 'bg-mint-200 text-[#0b3f3b] dark:bg-mint-200 dark:text-[#0b3f3b]'
                        : p.status === 'Completed'
                          ? 'bg-blue-200 text-[#0b3f3b] dark:bg-blue-200 dark:text-[#0b3f3b]'
                          : 'bg-amber-200 text-[#0b3f3b] dark:bg-amber-200 dark:text-[#0b3f3b]'
                    }`}>
                      {p.status}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      getProjectPublicationStatus(p) === 'Published'
                        ? 'bg-mint-200 text-[#0b3f3b] dark:bg-mint-200 dark:text-[#0b3f3b]'
                        : 'bg-orange-200 text-[#0b3f3b] dark:bg-orange-200 dark:text-[#0b3f3b]'
                    }`}>
                      {getProjectPublicationStatus(p)}
                    </span>
                  </div>
                </td>
                <td className="py-2 px-4">{countByProject[p.id] ?? 0}</td>
                <td className="py-2 px-4 whitespace-nowrap">
                  <div className="flex flex-nowrap items-center gap-1">
                    <ViewIconLink to={`/projects/${p.id}`} label="View project" compact />
                    {canEditProject(p) && (
                      <>
                        <EditIconButton
                          compact
                          label="Edit project"
                          onClick={() => setModal({ id: p.id, project: p })}
                        />
                        <DeleteIconButton
                          compact
                          label="Delete project"
                          onClick={() => setConfirmDelete(p.id)}
                        />
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredProjects.length === 0 && (
          <p className="py-8 text-center text-gray-500">No projects match your filters.</p>
        )}
      </div>

      {modal &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] overflow-y-auto overscroll-y-contain bg-black/50"
            role="dialog"
            aria-modal="true"
            aria-labelledby="project-modal-title"
          >
            <div className="flex min-h-[100dvh] items-center justify-center p-4 sm:p-6">
              <div className="relative flex w-full max-w-lg max-h-[min(92dvh,52rem)] flex-col overflow-hidden rounded-2xl shadow-xl ring-1 ring-black/10">
                <div className="flex shrink-0 items-center justify-between gap-3 rounded-t-2xl bg-gradient-to-r from-[#0F766E] to-[#115E59] px-4 py-2.5 text-white">
                  <h2 id="project-modal-title" className="text-base font-semibold text-white">
                    {modal === 'new' ? 'New Project' : 'Edit Project'}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setModal(null)}
                    className="inline-flex h-8 min-w-[2rem] items-center justify-center rounded-lg text-xl leading-none text-white/90 hover:bg-white/15 hover:text-white"
                    aria-label="Close dialog"
                  >
                    ×
                  </button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-b-2xl bg-white px-4 py-3">
                  <ProjectForm
                    project={modal === 'new' ? null : modal.project}
                    onSave={handleSave}
                    onCancel={() => setModal(null)}
                    canSetPublicationStatus={canManageProjects}
                    canEditLeadResearcher={isAdmin}
                  />
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {confirmDelete &&
        createPortal(
          <div className="fixed inset-0 z-[100] overflow-y-auto overscroll-y-contain bg-black/50" role="dialog" aria-modal="true">
            <div className="flex min-h-[100dvh] items-center justify-center p-4 sm:p-6">
              <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-gray-200/90 bg-white p-4 shadow-xl sm:p-5">
                <p className="font-medium text-gray-800">Delete this project?</p>
                <p className="mt-1 text-sm text-gray-500">This action cannot be undone.</p>
                <div className="mt-4 flex justify-end gap-2">
                  <button type="button" onClick={() => setConfirmDelete(null)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
                  <button type="button" onClick={() => handleDelete(confirmDelete)} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">Delete</button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
      </div>
    </div>
  );
}

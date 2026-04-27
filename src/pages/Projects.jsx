import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import { Check, X } from 'lucide-react';
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

function ProjectForm({
  project,
  onSave,
  onCancel,
  canSetPublicationStatus,
  canEditLeadResearcher,
  pendingRequests,
  coResearcherInvites,
}) {
  const { users, projects } = useData();
  const [sbProfiles, setSbProfiles] = useState([]);
  const [coSearch, setCoSearch] = useState('');
  const [coDropdownOpen, setCoDropdownOpen] = useState(false);
  const [coHighlightedNames, setCoHighlightedNames] = useState([]);
  const coDropdownRef = useRef(null);

  useEffect(() => {
    if (!isSupabaseConfigured() || !supabase) return;
    let cancelled = false;
    supabase
      .from('profiles')
      .select('full_name, role, status, email')
      .eq('role', 'Researcher')
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

  const pendingAdminInvitees = useMemo(() => {
    if (!project?.id) return [];
    const names = new Set();
    const isActivePendingRequest = (r) => {
      if (r.projectId !== project.id || r.type !== 'coResearcherInvite') return false;
      if (r.resolution) return false;
      const status = String(r.status ?? '').trim().toLowerCase();
      return status === '' || status === 'pending';
    };
    (pendingRequests || []).forEach((r) => {
      if (!isActivePendingRequest(r)) return;
      const list = Array.isArray(r.proposedUpdates?.invitedToList) ? r.proposedUpdates.invitedToList : [];
      list.filter(Boolean).forEach((n) => names.add(n));
    });
    return [...names];
  }, [pendingRequests, project?.id]);

  const pendingInvitees = useMemo(() => {
    if (!project?.id) return [];
    const names = new Set();
    (coResearcherInvites || [])
      .filter((inv) => inv.projectId === project.id && String(inv.status ?? '').toLowerCase() === 'pending')
      .forEach((inv) => {
        if (inv.invitedTo) names.add(inv.invitedTo);
      });
    return [...names];
  }, [coResearcherInvites, project?.id]);

  useEffect(() => {
    if (isEdit) {
      const confirmed = Array.isArray(project?.coResearchers) ? project.coResearchers : [];
      const merged = [...new Set([...confirmed, ...pendingAdminInvitees, ...pendingInvitees])];
      setCoSearch('');
      setCoHighlightedNames([]);
      setForm({
        name: project?.name ?? '',
        description: project?.description ?? '',
        startDate: project?.startDate ?? '',
        endDate: project?.endDate ?? '',
        leadResearcher: project?.leadResearcher ?? '',
        coResearchers: merged,
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
    setCoSearch('');
    setCoHighlightedNames([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id, isEdit, pendingAdminInvitees.join('|'), pendingInvitees.join('|')]);

  const availableCoResearchers = useMemo(() => {
    const byName = new Map();
    (users || [])
      .filter((u) => u.status === 'Active' && u.role === 'Researcher' && u.fullName)
      .forEach((u) => {
        const key = u.fullName.trim();
        if (!byName.has(key)) byName.set(key, { name: key, email: u.email || '' });
      });

    (sbProfiles || [])
      .filter((p) => p?.full_name)
      .forEach((p) => {
        const key = String(p.full_name).trim();
        if (!key) return;
        if (!byName.has(key)) byName.set(key, { name: key, email: p.email || '' });
      });

    return Array.from(byName.values())
      .filter((r) => r.name !== form.leadResearcher)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [users, sbProfiles, form.leadResearcher]);

  const availableCoResearcherNames = useMemo(
    () => availableCoResearchers.map((r) => r.name),
    [availableCoResearchers]
  );

  const filteredCoResearchers = useMemo(() => {
    const q = coSearch.trim().toLowerCase();
    if (!q) return availableCoResearchers;
    return availableCoResearchers.filter((r) =>
      r.name.toLowerCase().includes(q) || (r.email || '').toLowerCase().includes(q)
    );
  }, [availableCoResearchers, coSearch]);

  const confirmedSet = useMemo(() => {
    const set = new Set();
    const confirmed = Array.isArray(project?.coResearchers) ? project.coResearchers : [];
    confirmed.forEach((name) => set.add(name));
    return set;
  }, [project?.coResearchers]);

  const pendingAdminSet = useMemo(() => {
    const set = new Set();
    pendingAdminInvitees.forEach((name) => {
      if (![...confirmedSet].some((n) => displayNamesEqual(n, name))) set.add(name);
    });
    return set;
  }, [pendingAdminInvitees, confirmedSet]);

  const pendingInviteSet = useMemo(() => {
    const set = new Set();
    pendingInvitees.forEach((name) => {
      if ([...confirmedSet].some((n) => displayNamesEqual(n, name))) return;
      if ([...pendingAdminSet].some((n) => displayNamesEqual(n, name))) return;
      set.add(name);
    });
    return set;
  }, [pendingInvitees, confirmedSet, pendingAdminSet]);

  const getTagStatus = (name) => {
    if ([...confirmedSet].some((n) => displayNamesEqual(n, name))) return 'confirmed';
    if ([...pendingAdminSet].some((n) => displayNamesEqual(n, name))) return 'pendingAdmin';
    if ([...pendingInviteSet].some((n) => displayNamesEqual(n, name))) return 'invited';
    return 'new';
  };

  const newlySelectedSet = useMemo(() => {
    const set = new Set();
    (Array.isArray(form.coResearchers) ? form.coResearchers : []).forEach((name) => {
      if (getTagStatus(name) === 'new') set.add(name);
    });
    return set;
  }, [form.coResearchers, confirmedSet, pendingAdminSet, pendingInviteSet]);

  const dropdownResearchers = useMemo(() => {
    return availableCoResearchers.filter((researcher) => {
      if (displayNamesEqual(researcher.name, form.leadResearcher)) return false;
      if ([...confirmedSet].some((n) => displayNamesEqual(n, researcher.name))) return false;
      if ([...newlySelectedSet].some((n) => displayNamesEqual(n, researcher.name))) return false;
      return true;
    });
  }, [availableCoResearchers, form.leadResearcher, confirmedSet, newlySelectedSet]);

  useEffect(() => {
    setForm((f) => ({
      ...f,
      coResearchers: (Array.isArray(f.coResearchers) ? f.coResearchers : []).filter((n) => n && n !== f.leadResearcher),
    }));
  }, [form.leadResearcher]);

  useEffect(() => {
    const current = Array.isArray(form.coResearchers) ? form.coResearchers : [];
    const allowed = new Set(availableCoResearcherNames);
    const next = current.filter((name) => allowed.has(name));
    if (next.length !== current.length) {
      setForm((f) => ({ ...f, coResearchers: next }));
    }
  }, [availableCoResearcherNames, form.coResearchers]);

  useEffect(() => {
    if (!coDropdownOpen) return;
    const onMouseDown = (event) => {
      if (coDropdownRef.current && !coDropdownRef.current.contains(event.target)) {
        setCoDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [coDropdownOpen]);

  const toggleCoResearcher = (name) => {
    setCoHighlightedNames((prev) => (
      prev.some((n) => displayNamesEqual(n, name))
        ? prev.filter((n) => !displayNamesEqual(n, name))
        : [...prev, name]
    ));
  };

  const confirmHighlightedCoResearchers = () => {
    setForm((f) => {
      const prev = Array.isArray(f.coResearchers) ? f.coResearchers : [];
      const toAdd = coHighlightedNames.filter((name) => !prev.some((n) => displayNamesEqual(n, name)));
      if (toAdd.length === 0) return f;
      return { ...f, coResearchers: [...prev, ...toAdd] };
    });
    setCoHighlightedNames([]);
  };

  const removeCoResearcher = (name) => {
    if (getTagStatus(name) !== 'new') return;
    setForm((f) => ({
      ...f,
      coResearchers: (Array.isArray(f.coResearchers) ? f.coResearchers : []).filter((n) => n !== name),
    }));
  };

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
        <div className="relative" ref={coDropdownRef}>
          <input
            type="text"
            value={coSearch}
            onChange={(e) => {
              setCoSearch(e.target.value);
              if (!coDropdownOpen) setCoDropdownOpen(true);
            }}
            onFocus={() => setCoDropdownOpen(true)}
            placeholder="Search researchers by name..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm dark:bg-slate-900 dark:border-slate-600 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-mint-500/30"
          />

          {coDropdownOpen && (
            <div className="absolute z-30 mt-2 w-full rounded-xl border border-gray-200 bg-white shadow-lg dark:border-slate-600 dark:bg-slate-900 overflow-hidden">
              <div className="max-h-72 overflow-y-auto">
                {dropdownResearchers.length === 0 && availableCoResearchers.length === 0 ? (
                  <p className="px-3 py-3 text-sm text-gray-500 dark:text-slate-400">No researchers available.</p>
                ) : filteredCoResearchers.filter((researcher) =>
                  dropdownResearchers.some((r) => displayNamesEqual(r.name, researcher.name))
                ).length === 0 ? (
                  <p className="px-3 py-3 text-sm text-gray-500 dark:text-slate-400">No researchers found.</p>
                ) : (
                  filteredCoResearchers
                    .filter((researcher) => dropdownResearchers.some((r) => displayNamesEqual(r.name, researcher.name)))
                    .map((researcher) => {
                    const selected = coHighlightedNames.some((n) => displayNamesEqual(n, researcher.name));
                    const pendingAdmin = [...pendingAdminSet].some((n) => displayNamesEqual(n, researcher.name));
                    const pendingInvite = [...pendingInviteSet].some((n) => displayNamesEqual(n, researcher.name));
                    const disabled = pendingAdmin || pendingInvite;
                    return (
                      <button
                        key={researcher.name}
                        type="button"
                        onClick={() => {
                          if (disabled) return;
                          toggleCoResearcher(researcher.name);
                        }}
                        disabled={disabled}
                        className={`w-full text-left px-3 py-2.5 border-b border-gray-100 last:border-b-0 dark:border-slate-700 transition-colors ${
                          disabled
                            ? 'bg-gray-50 text-gray-400 dark:bg-slate-800/70 dark:text-slate-400 cursor-not-allowed'
                            : selected
                            ? 'bg-teal-100/80 text-teal-900 dark:bg-teal-900/45 dark:text-teal-100'
                            : 'hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-800 dark:text-slate-100'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{researcher.name}</p>
                            <p className="text-xs text-gray-500 dark:text-slate-400 truncate">
                              {researcher.email || 'No email available'}
                              {pendingAdmin ? ' · Pending Admin Approval' : pendingInvite ? ' · Invite Sent' : ''}
                            </p>
                          </div>
                          {selected && !disabled && <Check className="h-4 w-4 shrink-0 mt-0.5 text-teal-700 dark:text-teal-200" />}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
              <div className="p-2 border-t border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-900">
                <button
                  type="button"
                  onClick={() => {
                    confirmHighlightedCoResearchers();
                    setCoDropdownOpen(false);
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-mint-800 bg-gradient-to-r from-[#0F766E] to-[#115E59] text-white text-sm font-medium hover:opacity-95 transition-opacity"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>

        {Array.isArray(form.coResearchers) && form.coResearchers.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {[...form.coResearchers]
              .sort((a, b) => {
                const order = { confirmed: 0, pendingAdmin: 1, invited: 2, new: 3 };
                const d = order[getTagStatus(a)] - order[getTagStatus(b)];
                return d !== 0 ? d : a.localeCompare(b);
              })
              .map((name) => {
                const status = getTagStatus(name);
                const tagClass = status === 'confirmed'
                  ? 'border-teal-200 bg-teal-100 text-teal-800 dark:border-teal-500/60 dark:bg-teal-900/50 dark:text-teal-300'
                  : status === 'pendingAdmin'
                    ? 'border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-400/60 dark:bg-amber-500/20 dark:text-amber-300'
                    : status === 'invited'
                      ? 'border-orange-300 bg-orange-100 text-orange-900 dark:border-orange-400/60 dark:bg-orange-500/20 dark:text-orange-300'
                      : 'border-dashed border-teal-400 bg-white text-teal-700 dark:bg-transparent dark:border-teal-300 dark:text-teal-200';
                const statusLabel = status === 'pendingAdmin' ? 'Pending Admin' : status === 'invited' ? 'Invited' : '';
                return (
                  <span
                    key={name}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${tagClass}`}
                  >
                    <span>{name}</span>
                    {statusLabel && <span className="text-[10px] font-semibold opacity-80">{statusLabel}</span>}
                    {status === 'new' && (
                      <button
                        type="button"
                        onClick={() => removeCoResearcher(name)}
                        className="inline-flex items-center justify-center rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/10"
                        aria-label={`Remove ${name}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </span>
                );
              })}
          </div>
        )}
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
  const publicationFilterOptions = useMemo(
    () => ['All', ...PUBLICATION_STATUSES],
    []
  );

  useEffect(() => {
    const incoming = location.state?.filterPublication;
    if (!incoming) return;
    setFilterPublication(publicationFilterOptions.includes(incoming) ? incoming : 'All');
  }, [location.state, publicationFilterOptions]);

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
      setFilterPublication('All');
    } else if (modal?.id) {
      const existing = projects.find((p) => p.id === modal.id);
      const payloadBase = canManageProjects
        ? data
        : { ...data, publicationStatus: existing?.publicationStatus };

      const prevCo = Array.isArray(existing?.coResearchers) ? existing.coResearchers : [];
      const nextCo = Array.isArray(payloadBase?.coResearchers) ? payloadBase.coResearchers : [];
      const added = nextCo.filter((n) => n && !prevCo.some((p) => displayNamesEqual(p, n)));
      const removed = prevCo.filter((n) => n && !nextCo.some((p) => displayNamesEqual(p, n)));

      const pendingAdminNames = new Set();
      const isActivePendingRequest = (r) => {
        if (r.projectId !== existing.id || r.type !== 'coResearcherInvite') return false;
        if (r.resolution) return false;
        const status = String(r.status ?? '').trim().toLowerCase();
        return status === '' || status === 'pending';
      };
      const pendingAdminRowsForProject = (pendingRequests || []).filter(
        (r) => isActivePendingRequest(r)
      );
      pendingAdminRowsForProject.forEach((r) => {
        const names = Array.isArray(r.proposedUpdates?.invitedToList) ? r.proposedUpdates.invitedToList : [];
        names.filter(Boolean).forEach((name) => pendingAdminNames.add(name));
      });

      const pendingInviteRowsForProject = (coResearcherInvites || []).filter(
        (inv) => inv.projectId === existing.id && String(inv.status ?? '').toLowerCase() === 'pending'
      );
      const pendingInviteNames = new Set(pendingInviteRowsForProject.map((inv) => inv.invitedTo).filter(Boolean));

      const skippedPending = [];
      const submitted = [];
      const failed = [];

      // If an Admin adds themselves as a Co-Researcher, apply immediately (no invite needed).
      const adminSelf = isAdmin && user?.fullName ? user.fullName : null;
      const selfAdded = adminSelf ? added.some((n) => displayNamesEqual(n, adminSelf)) : false;
      const inviteAdded = selfAdded ? added.filter((n) => !displayNamesEqual(n, adminSelf)) : added;

      const newAdditions = inviteAdded.filter((name) => {
        const alreadyPendingAdmin = [...pendingAdminNames].some((n) => displayNamesEqual(n, name));
        const alreadyPendingInvite = [...pendingInviteNames].some((n) => displayNamesEqual(n, name));
        if (alreadyPendingAdmin || alreadyPendingInvite) {
          skippedPending.push(name);
          return false;
        }
        return true;
      });

      if (newAdditions.length === 0 && skippedPending.length === 0 && !selfAdded) {
        try {
          window.dispatchEvent(new CustomEvent('biosample_flash', {
            detail: { message: 'No new co-researchers to submit.', variant: 'success' },
          }));
        } catch {}
      }

      const submittedAfterRetry = [];
      if (newAdditions.length > 0) {
        if (isAdmin) {
          const adminResults = await Promise.allSettled(
            newAdditions.map(async (name) => {
              sendCoResearcherInvites({
                projectId: existing.id,
                invitedBy: user?.fullName || 'Unknown',
                invitedToList: [name],
              });
              return name;
            })
          );
          adminResults.forEach((result, idx) => {
            const name = newAdditions[idx];
            if (result.status === 'fulfilled') submitted.push(name);
            else failed.push(name);
          });
        } else {
          const processInviteResults = (results, names, onSuccess) => {
            const retryCandidates = [];
            results.forEach((result, idx) => {
              const name = names[idx];
              if (result.status === 'fulfilled') {
                const response = result.value;
                if (response?.ok) {
                  onSuccess(name);
                } else if (response?.reason === 'duplicate') {
                  skippedPending.push(name);
                } else {
                  retryCandidates.push(name);
                  console.error(`Co-researcher request failed for ${name}:`, response?.error || response?.reason || 'unknown');
                }
              } else {
                retryCandidates.push(name);
                console.error(`Co-researcher request promise rejected for ${name}:`, result.reason);
              }
            });
            return retryCandidates;
          };

          const submitOne = (name) => submitCoResearcherInviteRequest({
            projectId: existing.id,
            requestedBy: user?.fullName || 'Unknown',
            invitedToList: [name],
          });

          const firstResults = await Promise.allSettled(newAdditions.map((name) => submitOne(name)));
          const retryNames = processInviteResults(firstResults, newAdditions, (name) => submitted.push(name));

          if (retryNames.length > 0) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
            const retryResults = await Promise.allSettled(retryNames.map((name) => submitOne(name)));
            const finalFailed = processInviteResults(retryResults, retryNames, (name) => submittedAfterRetry.push(name));
            failed.push(...finalFailed);
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

      const summaryParts = [];
      if (submitted.length > 0) {
        summaryParts.push(
          isAdmin
            ? `Invites sent: ${submitted.join(', ')}.`
            : `Requests submitted for ${submitted.join(', ')}. Awaiting admin approval.`
        );
      }
      if (submittedAfterRetry.length > 0) {
        summaryParts.push(`Requests submitted for ${submittedAfterRetry.join(', ')} (after retry).`);
      }
      if (skippedPending.length > 0) {
        summaryParts.push(`Skipped ${skippedPending.join(', ')} (already pending).`);
      }
      if (failed.length > 0) {
        summaryParts.push(`Failed to submit for ${failed.join(', ')}. Please try again.`);
      }
      if (submitted.length === 0 && skippedPending.length > 0) {
        summaryParts.unshift('All selected co-researchers already have pending requests. No new requests submitted.');
      }
      if (summaryParts.length > 0) {
        try {
          window.dispatchEvent(new CustomEvent('biosample_flash', {
            detail: {
              message: summaryParts.join(' '),
              variant: submitted.length > 0 ? 'success' : failed.length > 0 ? 'error' : 'success',
            },
          }));
        } catch {}
      }
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
              <option value="Published (public)">Published (public)</option>
              <option value="Published (limited)">Published (limited)</option>
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
                      getProjectPublicationStatus(p) === 'Published (public)'
                        ? 'bg-mint-200 text-[#0b3f3b] dark:bg-mint-200 dark:text-[#0b3f3b]'
                        : getProjectPublicationStatus(p) === 'Published (limited)'
                          ? 'bg-blue-200 text-[#0b3f3b] dark:bg-blue-200 dark:text-[#0b3f3b]'
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
                    pendingRequests={pendingRequests}
                    coResearcherInvites={coResearcherInvites}
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

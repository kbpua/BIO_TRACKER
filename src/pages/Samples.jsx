import { useState, useMemo, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { exportSamplesCSV } from '../utils/export';
import {
  ViewIconLink,
  EditIconLink,
  RequestEditIconLink,
  DeleteIconButton,
  RequestDeleteIconButton,
} from '../components/TableActionButtons';
import { getVisibleProjects, getVisibleSamples } from '../utils/visibility';
import { displayNamesEqual } from '../utils/personName';
import { X } from 'lucide-react';

const AT_RISK_FILTER = '__at_risk__';
const isAtRiskStatus = (status) => status === 'Expired' || status === 'Contaminated';

export default function Samples() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, canManageSamples, canDeleteSamples, canExportCSV, isAdmin, isResearcher } = useAuth();
  const { samples, organisms, projects, coResearcherInvites, deleteSample, submitDeleteRequest, addActivity } = useData();
  const [search, setSearch] = useState('');
  const [filterOrganism, setFilterOrganism] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterProject, setFilterProject] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [confirmRequestDelete, setConfirmRequestDelete] = useState(null);
  const [atRiskEntryMode, setAtRiskEntryMode] = useState(false);
  const [showAtRiskBanner, setShowAtRiskBanner] = useState(false);
  const [emphasizeAtRisk, setEmphasizeAtRisk] = useState(false);

  const getOrgName = (id) => organisms.find((o) => o.id === id)?.scientificName ?? '';
  const getProjName = (id) => projects.find((p) => p.id === id)?.name ?? '';

  const visibleProjects = useMemo(
    () => getVisibleProjects(projects, user, coResearcherInvites),
    [projects, user, coResearcherInvites]
  );
  const visibleSamples = useMemo(
    () => getVisibleSamples(samples, projects, user, coResearcherInvites),
    [samples, projects, user, coResearcherInvites]
  );
  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  const rows = useMemo(() => {
    return visibleSamples.map((s) => ({
      ...s,
      organismName: getOrgName(s.organismId),
      projectName: getProjName(s.projectId),
    }));
  }, [visibleSamples, organisms, projects]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter((r) => {
      if (search && ![r.sampleId, r.sampleName, r.disease, r.organismName, r.projectName, r.tissueSource, r.studyPurpose, r.collectedBy].some((v) => String(v ?? '').toLowerCase().includes(q))) return false;
      if (filterOrganism && r.organismId !== filterOrganism) return false;
      if (filterType && r.sampleType !== filterType) return false;
      if (filterProject && r.projectId !== filterProject) return false;
      if (filterStatus === AT_RISK_FILTER && !isAtRiskStatus(r.status)) return false;
      if (filterStatus && filterStatus !== AT_RISK_FILTER && r.status !== filterStatus) return false;
      return true;
    });
  }, [rows, search, filterOrganism, filterType, filterProject, filterStatus]);

  const atRiskCounts = useMemo(() => {
    const counts = filtered.reduce(
      (acc, row) => {
        if (row.status === 'Expired') acc.expired += 1;
        if (row.status === 'Contaminated') acc.contaminated += 1;
        return acc;
      },
      { expired: 0, contaminated: 0 }
    );
    return {
      ...counts,
      total: counts.expired + counts.contaminated,
    };
  }, [filtered]);

  useEffect(() => {
    const stateHighlight = location.state?.highlight;
    const queryHighlight = new URLSearchParams(location.search).get('highlight');
    const shouldActivateAtRisk = stateHighlight === 'at-risk' || queryHighlight === 'at-risk';
    if (!shouldActivateAtRisk) return;

    setFilterStatus(AT_RISK_FILTER);
    setAtRiskEntryMode(true);
    setShowAtRiskBanner(true);
    setEmphasizeAtRisk(true);

    if (stateHighlight === 'at-risk') {
      const nextState = { ...(location.state || {}) };
      delete nextState.highlight;
      navigate(`${location.pathname}${location.search}`, { replace: true, state: nextState });
    }
  }, [location.pathname, location.search, location.state, navigate]);

  useEffect(() => {
    if (!(atRiskEntryMode && filterStatus === AT_RISK_FILTER)) {
      setEmphasizeAtRisk(false);
      return undefined;
    }

    setEmphasizeAtRisk(true);
    const timer = window.setTimeout(() => setEmphasizeAtRisk(false), 3000);
    return () => window.clearTimeout(timer);
  }, [atRiskEntryMode, filterStatus]);

  const clearFilters = () => {
    setSearch('');
    setFilterOrganism('');
    setFilterType('');
    setFilterProject('');
    setFilterStatus('');
    setAtRiskEntryMode(false);
    setShowAtRiskBanner(false);
    setEmphasizeAtRisk(false);
  };

  const handleDelete = async (id) => {
    const ok = await deleteSample(id);
    if (!ok) {
      // eslint-disable-next-line no-alert
      alert('Failed to delete sample in Supabase. Please check your permissions and try again.');
      return;
    }
    setConfirmDelete(null);
  };

  const isOwnSample = (sampleRow) =>
    displayNamesEqual(sampleRow?.collectedBy, user?.fullName)
    || displayNamesEqual(sampleRow?.createdBy, user?.fullName);

  const getSamplePermissions = (sampleRow) => {
    if (isAdmin) {
      return {
        canView: true,
        canEditDirect: canManageSamples,
        canRequestEdit: false,
        canDeleteDirect: canDeleteSamples,
        canRequestDelete: false,
      };
    }

    if (!isResearcher) {
      return {
        canView: true,
        canEditDirect: false,
        canRequestEdit: false,
        canDeleteDirect: false,
        canRequestDelete: false,
      };
    }

    const project = projectById.get(sampleRow.projectId);
    const isLead = displayNamesEqual(project?.leadResearcher, user?.fullName);
    const isCoOnProject = Array.isArray(project?.coResearchers)
      && project.coResearchers.some((name) => displayNamesEqual(name, user?.fullName));
    const ownsSample = isOwnSample(sampleRow);

    return {
      canView: true,
      canEditDirect: canManageSamples && isLead,
      canRequestEdit: canManageSamples && !isLead && isCoOnProject && ownsSample,
      canDeleteDirect: canDeleteSamples && isLead,
      canRequestDelete: canDeleteSamples && !isLead && isCoOnProject && ownsSample,
    };
  };

  const getExportableRowsForUser = (rowsToExport) => {
    if (isAdmin) return rowsToExport;
    if (!isResearcher) return [];

    return rowsToExport.filter((row) => {
      const project = projectById.get(row.projectId);
      if (!project) return false;
      if (displayNamesEqual(project.leadResearcher, user?.fullName)) return true;
      const isCoOnProject = Array.isArray(project.coResearchers)
        && project.coResearchers.some((name) => displayNamesEqual(name, user?.fullName));
      return isCoOnProject && isOwnSample(row);
    });
  };

  const handleExportCSV = () => {
    const exportableRows = getExportableRowsForUser(filtered);
    exportSamplesCSV(exportableRows, organisms, projects);
    addActivity(`${user?.fullName} exported CSV data`);
  };

  const handleRequestDelete = (sampleRow) => {
    submitDeleteRequest({
      projectId: sampleRow.projectId,
      requestedBy: user?.fullName || 'Unknown',
      sampleRecordId: sampleRow.id,
      sampleId: sampleRow.sampleId,
      reason: sampleRow.status === 'Contaminated' ? 'Sample is contaminated' : '',
    });
    setConfirmRequestDelete(null);
    try {
      window.dispatchEvent(
        new CustomEvent('biosample_flash', {
          detail: {
            message: `Your delete request for ${sampleRow.sampleId} has been submitted for approval.`,
            variant: 'success',
          },
        })
      );
    } catch {}
  };

  const uniqueTypes = useMemo(() => [...new Set(samples.map((s) => s.sampleType))].sort(), [samples]);
  const uniqueStatuses = useMemo(() => [...new Set(samples.map((s) => s.status))].sort(), [samples]);

  return (
    <div>
      <header className="pb-6 mb-8">
        <div className="flex flex-wrap items-center justify-between gap-4 min-h-11">
          <h1 className="text-2xl font-bold text-gray-800">Samples</h1>
          <div className="flex flex-wrap gap-2">
            {canManageSamples && (
              <Link
                to="/samples/new"
                className="px-4 py-2 bg-mint-800 bg-gradient-to-r from-[#0F766E] to-[#115E59] text-white text-sm font-medium rounded-lg hover:opacity-95 transition-opacity"
              >
                Add Sample
              </Link>
            )}
            {canExportCSV && (
              <button
                type="button"
                onClick={handleExportCSV}
                className="px-4 py-2 bg-white border border-mint-300 text-mint-700 text-sm font-medium rounded-lg hover:bg-mint-50 hover:text-mint-800 dark:bg-slate-900 dark:border-mint-400/70 dark:text-mint-300 dark:hover:bg-mint-400/15 dark:hover:text-mint-200"
              >
                Export CSV
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="space-y-4">
      <div className="bg-white rounded-xl border border-mint-100 p-4 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          <input
            type="text"
            placeholder="Search (Sample ID, disease, organism, project, tissue source, study purpose)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-mint-500 focus:border-mint-500 lg:col-span-2"
          />
          <select
            value={filterOrganism}
            onChange={(e) => setFilterOrganism(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-mint-500"
          >
            <option value="">All Organisms</option>
            {organisms.map((o) => (
              <option key={o.id} value={o.id}>{o.scientificName}</option>
            ))}
          </select>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-mint-500"
          >
            <option value="">All Types</option>
            {uniqueTypes.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <select
            value={filterProject}
            onChange={(e) => setFilterProject(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-mint-500"
          >
            <option value="">All Projects</option>
            {visibleProjects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => {
              const nextStatus = e.target.value;
              setFilterStatus(nextStatus);
              if (atRiskEntryMode && nextStatus !== AT_RISK_FILTER) {
                setAtRiskEntryMode(false);
                setShowAtRiskBanner(false);
                setEmphasizeAtRisk(false);
              }
            }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-mint-500"
          >
            <option value="">All Statuses</option>
            <option value={AT_RISK_FILTER}>At Risk (Expired, Contaminated)</option>
            {uniqueStatuses.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={clearFilters}
          className="text-sm text-mint-700 hover:text-mint-800 dark:text-mint-300 dark:hover:text-mint-200 font-medium"
        >
          Clear Filters
        </button>
      </div>

      {atRiskEntryMode && showAtRiskBanner && filterStatus === AT_RISK_FILTER && (
        <div className="rounded-xl border border-amber-300 bg-amber-50/90 px-4 py-3 shadow-sm dark:border-amber-400/40 dark:bg-amber-950/35">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <p className="text-sm text-amber-950 dark:text-amber-200">
              Showing <span className="font-semibold">{atRiskCounts.total}</span> at-risk samples -{' '}
              <span className="font-semibold">{atRiskCounts.expired}</span> Expired,{' '}
              <span className="font-semibold">{atRiskCounts.contaminated}</span> Contaminated
            </p>
            <button
              type="button"
              aria-label="Dismiss at-risk summary"
              onClick={() => setShowAtRiskBanner(false)}
              className="inline-flex items-center justify-center rounded-md p-1 text-amber-800 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-900/40"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <button
            type="button"
            onClick={clearFilters}
            className="mt-2 text-xs font-semibold text-amber-900 underline underline-offset-2 hover:text-amber-700 dark:text-amber-200 dark:hover:text-amber-100"
          >
            Show all samples
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-mint-100 shadow-sm overflow-hidden">
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
              {filtered.map((r) => {
                const perms = getSamplePermissions(r);
                return (
                <tr
                  key={r.id}
                  onClick={() => navigate(`/samples/${r.id}`)}
                  className={`border-b border-mint-50 cursor-pointer ${
                    atRiskEntryMode && filterStatus === AT_RISK_FILTER && r.status === 'Expired'
                      ? 'bg-amber-50/90 hover:bg-amber-100/70 dark:bg-amber-900/25 dark:hover:bg-amber-900/35'
                      : atRiskEntryMode && filterStatus === AT_RISK_FILTER && r.status === 'Contaminated'
                        ? 'bg-red-50/85 hover:bg-red-100/70 dark:bg-red-900/20 dark:hover:bg-red-900/35'
                        : 'hover:bg-mint-50/50'
                  }`}
                >
                  <td
                    className={`py-2 px-4 ${
                      atRiskEntryMode && filterStatus === AT_RISK_FILTER && r.status === 'Expired'
                        ? 'border-l-4 border-amber-500'
                        : atRiskEntryMode && filterStatus === AT_RISK_FILTER && r.status === 'Contaminated'
                          ? 'border-l-4 border-red-500'
                          : ''
                    }`}
                  >
                    <div className="inline-flex items-center gap-2">
                      <span>{r.sampleId}</span>
                      {atRiskEntryMode && filterStatus === AT_RISK_FILTER && isAtRiskStatus(r.status) && (
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                            r.status === 'Expired'
                              ? 'border-amber-400/90 bg-amber-100 text-amber-900 dark:border-amber-300/70 dark:bg-amber-900/45 dark:text-amber-200'
                              : 'border-red-400/90 bg-red-100 text-red-900 dark:border-red-300/70 dark:bg-red-900/40 dark:text-red-200'
                          } ${emphasizeAtRisk ? 'animate-pulse' : ''}`}
                        >
                          {r.status}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-2 px-4">{r.disease ?? '—'}</td>
                  <td className="py-2 px-4">{r.organismName}</td>
                  <td className="py-2 px-4">{r.sampleType}</td>
                  <td className="py-2 px-4">{r.tissueSource ?? '—'}</td>
                  <td className="py-2 px-4">{r.studyPurpose ?? '—'}</td>
                  <td className="py-2 px-4">{r.projectName}</td>
                  <td className="py-2 px-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <div className="flex flex-nowrap items-center gap-1">
                        <ViewIconLink
                          to={`/samples/${r.id}`}
                          label="View sample"
                          compact
                          onClick={(e) => e.stopPropagation()}
                        />
                        {perms.canEditDirect && (
                          <EditIconLink
                            to={`/samples/${r.id}/edit`}
                            label="Edit sample"
                            compact
                            onClick={(e) => e.stopPropagation()}
                          />
                        )}
                        {perms.canRequestEdit && (
                          <RequestEditIconLink
                            to={`/samples/${r.id}/edit`}
                            state={{ requestEdit: true, returnTo: '/samples' }}
                            compact
                            onClick={(e) => e.stopPropagation()}
                          />
                        )}
                        {perms.canDeleteDirect && (
                          <DeleteIconButton
                            compact
                            label="Delete sample"
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmDelete(r.id);
                            }}
                          />
                        )}
                        {perms.canRequestDelete && (
                          <RequestDeleteIconButton
                            compact
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmRequestDelete(r);
                            }}
                          />
                        )}
                      </div>
                    </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <p className="py-8 text-center text-gray-500">No samples match your filters.</p>
        )}
      </div>
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-xl">
            <p className="text-gray-800 font-medium mb-2">Delete this sample?</p>
            <p className="text-sm text-gray-500 mb-4">This action cannot be undone.</p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDelete(confirmDelete)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmRequestDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-xl">
            <p className="text-gray-800 font-medium mb-2">Request deletion of this sample?</p>
            <p className="text-sm text-gray-500 mb-4">
              The Lead Researcher must approve this delete request before any data is removed.
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
    </div>
  );
}

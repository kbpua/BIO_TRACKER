import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { exportSamplesCSV } from '../utils/export';
import { ViewIconLink, EditIconLink, DeleteIconButton } from '../components/TableActionButtons';
import { getVisibleProjects, getVisibleSamples } from '../utils/visibility';

export default function Samples() {
  const navigate = useNavigate();
  const { user, canManageSamples, canDeleteSamples, canExportCSV, isAdmin, isResearcher } = useAuth();
  const { samples, organisms, projects, coResearcherInvites, deleteSample, addActivity } = useData();
  const [search, setSearch] = useState('');
  const [filterOrganism, setFilterOrganism] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterProject, setFilterProject] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);

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
      if (filterStatus && r.status !== filterStatus) return false;
      return true;
    });
  }, [rows, search, filterOrganism, filterType, filterProject, filterStatus]);

  const clearFilters = () => {
    setSearch('');
    setFilterOrganism('');
    setFilterType('');
    setFilterProject('');
    setFilterStatus('');
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

  const handleExportCSV = () => {
    exportSamplesCSV(filtered, organisms, projects);
    addActivity(`${user?.fullName} exported CSV data`);
  };

  const uniqueTypes = useMemo(() => [...new Set(samples.map((s) => s.sampleType))].sort(), [samples]);
  const uniqueStatuses = useMemo(() => [...new Set(samples.map((s) => s.status))].sort(), [samples]);

  const canEditSample = (r) => canManageSamples && (isAdmin || (isResearcher && r.collectedBy === user?.fullName));
  const canDeleteSample = (r) => canDeleteSamples && (isAdmin || (isResearcher && r.collectedBy === user?.fullName));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
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
              className="px-4 py-2 bg-white border border-mint-300 text-mint-700 text-sm font-medium rounded-lg hover:bg-mint-50"
            >
              Export CSV
            </button>
          )}
        </div>
      </div>

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
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-mint-500"
          >
            <option value="">All Statuses</option>
            {uniqueStatuses.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={clearFilters}
          className="text-sm text-mint-600 hover:text-mint-800 font-medium"
        >
          Clear Filters
        </button>
      </div>

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
              {filtered.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => navigate(`/samples/${r.id}`)}
                  className="border-b border-mint-50 hover:bg-mint-50/50 cursor-pointer"
                >
                  <td className="py-2 px-4">{r.sampleId}</td>
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
                        {canEditSample(r) && (
                          <EditIconLink
                            to={`/samples/${r.id}/edit`}
                            label="Edit sample"
                            compact
                            onClick={(e) => e.stopPropagation()}
                          />
                        )}
                        {canDeleteSample(r) && (
                          <DeleteIconButton
                            compact
                            label="Delete sample"
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmDelete(r.id);
                            }}
                          />
                        )}
                      </div>
                    </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <p className="py-8 text-center text-gray-500">No samples match your filters.</p>
        )}
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
    </div>
  );
}

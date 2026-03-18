import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';

export default function ProjectDetail() {
  const { id } = useParams();
  const { user, isAdmin, isResearcher } = useAuth();
  const { projects, samples, organisms, deleteSample, addActivity } = useData();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const project = projects.find((p) => p.id === id);
  const getOrgName = (oid) => organisms.find((o) => o.id === oid)?.scientificName ?? '';
  const getProjName = (pid) => projects.find((p) => p.id === pid)?.name ?? '';

  const isLeadResearcher = isResearcher && project?.leadResearcher === user?.fullName;
  const canAddSample = isAdmin || isLeadResearcher;
  const canEditSample = (r) => isAdmin || (isResearcher && r.collectedBy === user?.fullName);
  const canDeleteSample = (r) => isAdmin || (isResearcher && r.collectedBy === user?.fullName);

  const relatedSamples = useMemo(() => {
    if (!project) return [];
    return samples
      .filter((s) => s.projectId === project.id)
      .map((s) => ({
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

  const handleDeleteSample = (sampleId) => {
    deleteSample(sampleId);
    setConfirmDeleteId(null);
    addActivity(`${user?.fullName} deleted a sample from project ${project?.name}`);
  };

  if (!project) {
    return (
      <div className="space-y-4">
        <p className="text-gray-500">Project not found.</p>
        <Link to="/projects" className="text-mint-600 hover:underline">Back to Projects</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/projects" className="px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50">
          Back
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-mint-100 shadow-sm p-6">
        <h1 className="text-xl font-bold text-gray-800 mb-4">Project Details</h1>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div><dt className="text-gray-500">Project ID</dt><dd className="font-medium">{project.id}</dd></div>
          <div><dt className="text-gray-500">Project Name</dt><dd className="font-medium">{project.name}</dd></div>
          <div className="sm:col-span-2"><dt className="text-gray-500">Description</dt><dd>{project.description || '—'}</dd></div>
          <div><dt className="text-gray-500">Start Date</dt><dd>{project.startDate || '—'}</dd></div>
          <div><dt className="text-gray-500">End Date</dt><dd>{project.endDate || '—'}</dd></div>
          <div><dt className="text-gray-500">Lead Researcher</dt><dd>{project.leadResearcher || '—'}</dd></div>
          <div><dt className="text-gray-500">Status</dt><dd>{project.status}</dd></div>
        </dl>
      </div>

      <div className="bg-white rounded-xl border border-mint-100 shadow-sm p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h2 className="font-semibold text-gray-800">
            Related Samples
          </h2>
          {canAddSample && (
            <Link
              to="/samples/new"
              state={{ projectId: project.id, lockProject: true, returnTo: `/projects/${project.id}` }}
              className="px-3 py-2 bg-mint-600 text-white text-sm font-medium rounded-lg hover:bg-mint-700"
            >
              Add Sample
            </Link>
          )}
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
            <button type="button" onClick={clearFilters} className="text-sm text-mint-600 hover:text-mint-800 font-medium">
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
                    <div className="flex flex-wrap gap-1.5">
                      <Link
                        to={`/samples/${r.id}`}
                        className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
                      >
                        View
                      </Link>
                      {canEditSample(r) && (
                        <Link
                          to={`/samples/${r.id}/edit`}
                          className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-mint-600 text-white hover:bg-mint-700 transition-colors shadow-sm"
                        >
                          Edit
                        </Link>
                      )}
                      {canDeleteSample(r) && (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(r.id)}
                          className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-red-600 text-white hover:bg-red-700 transition-colors shadow-sm"
                        >
                          Delete
                        </button>
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
    </div>
  );
}

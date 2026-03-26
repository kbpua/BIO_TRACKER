import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { PROJECT_STATUSES } from '../data/mockData';
import { getVisibleProjects, getVisibleSamples } from '../utils/visibility';

export default function OrganismDetail() {
  const { id } = useParams();
  const { projects, samples, organisms } = useData();
  const { user } = useAuth();
  const [projSearch, setProjSearch] = useState('');
  const [projStatus, setProjStatus] = useState('');
  const [sampleSearch, setSampleSearch] = useState('');
  const [sampleType, setSampleType] = useState('');
  const [sampleStatus, setSampleStatus] = useState('');

  const organism = organisms.find((o) => o.id === id);
  const getProjName = (pid) => projects.find((p) => p.id === pid)?.name ?? '';

  const visibleProjects = useMemo(() => getVisibleProjects(projects, user), [projects, user]);
  const visibleSamples = useMemo(() => getVisibleSamples(samples, projects, user), [samples, projects, user]);

  const relatedSamples = useMemo(() => {
    if (!organism) return [];
    return visibleSamples.filter((s) => s.organismId === organism.id);
  }, [organism, visibleSamples]);

  const relatedProjectIds = useMemo(() => [...new Set(relatedSamples.map((s) => s.projectId))], [relatedSamples]);
  const relatedProjects = useMemo(() => {
    return visibleProjects
      .filter((p) => relatedProjectIds.includes(p.id))
      .map((p) => ({
        ...p,
        sampleCount: relatedSamples.filter((s) => s.projectId === p.id).length,
      }));
  }, [visibleProjects, relatedProjectIds, relatedSamples]);

  const samplesWithNames = useMemo(() => {
    return relatedSamples.map((s) => ({
      ...s,
      organismName: organism?.scientificName ?? '',
      projectName: getProjName(s.projectId),
    }));
  }, [relatedSamples, organism, projects]);

  const filteredProjects = useMemo(() => {
    const q = projSearch.toLowerCase();
    return relatedProjects.filter((p) => {
      const matchSearch = !projSearch || [p.name, p.description, p.leadResearcher].some((v) => String(v ?? '').toLowerCase().includes(q));
      const matchStatus = !projStatus || p.status === projStatus;
      return matchSearch && matchStatus;
    });
  }, [relatedProjects, projSearch, projStatus]);

  const filteredSamples = useMemo(() => {
    const q = sampleSearch.toLowerCase();
    return samplesWithNames.filter((r) => {
      if (sampleSearch && ![r.sampleId, r.disease, r.projectName, r.tissueSource, r.studyPurpose].some((v) => String(v ?? '').toLowerCase().includes(q))) return false;
      if (sampleType && r.sampleType !== sampleType) return false;
      if (sampleStatus && r.status !== sampleStatus) return false;
      return true;
    });
  }, [samplesWithNames, sampleSearch, sampleType, sampleStatus]);

  const uniqueSampleTypes = useMemo(() => [...new Set(samplesWithNames.map((s) => s.sampleType))].sort(), [samplesWithNames]);
  const uniqueSampleStatuses = useMemo(() => [...new Set(samplesWithNames.map((s) => s.status))].sort(), [samplesWithNames]);

  if (!organism) {
    return (
      <div className="space-y-4">
        <p className="text-gray-500">Organism not found.</p>
        <Link to="/organisms" className="text-mint-600 hover:underline">Back to Organisms</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/organisms" className="px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50">
          Back
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-mint-100 shadow-sm p-6">
        <h1 className="text-xl font-bold text-gray-800 mb-4">Organism Details</h1>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div><dt className="text-gray-500">Scientific Name</dt><dd className="font-medium">{organism.scientificName}</dd></div>
          <div><dt className="text-gray-500">Common Name</dt><dd>{organism.commonName || '—'}</dd></div>
          <div><dt className="text-gray-500">Taxonomy ID</dt><dd>{organism.taxonomyId || '—'}</dd></div>
          <div><dt className="text-gray-500">Kingdom</dt><dd>{organism.kingdom}</dd></div>
        </dl>
      </div>

      <div className="bg-white rounded-xl border border-mint-100 shadow-sm p-4">
        <h2 className="font-semibold text-gray-800 mb-2">Related Projects</h2>
        <p className="text-sm text-gray-500 mb-3">{filteredProjects.length} related projects</p>
        <div className="flex flex-wrap gap-3 mb-4">
          <input
            type="text"
            placeholder="Search projects..."
            value={projSearch}
            onChange={(e) => setProjSearch(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm flex-1 min-w-[180px]"
          />
          <select value={projStatus} onChange={(e) => setProjStatus(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
            <option value="">All Statuses</option>
            {PROJECT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-mint-50 border-b border-mint-100">
              <tr>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Project ID</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Project Name</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Description</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Start Date</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">End Date</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Lead Researcher</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700"># Samples</th>
              </tr>
            </thead>
            <tbody>
              {filteredProjects.map((p) => (
                <tr key={p.id} className="border-b border-mint-50 hover:bg-mint-50/50">
                  <td className="py-2 px-4">{p.id}</td>
                  <td className="py-2 px-4 font-medium">{p.name}</td>
                  <td className="py-2 px-4 max-w-xs truncate">{p.description}</td>
                  <td className="py-2 px-4">{p.startDate || '—'}</td>
                  <td className="py-2 px-4">{p.endDate || '—'}</td>
                  <td className="py-2 px-4">{p.leadResearcher}</td>
                  <td className="py-2 px-4">{p.status}</td>
                  <td className="py-2 px-4">{p.sampleCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredProjects.length === 0 && <p className="py-6 text-center text-gray-500">No projects match your filters.</p>}
      </div>

      <div className="bg-white rounded-xl border border-mint-100 shadow-sm p-4">
        <h2 className="font-semibold text-gray-800 mb-2">Related Samples</h2>
        <p className="text-sm text-gray-500 mb-3">{filteredSamples.length} related samples</p>
        <div className="flex flex-wrap gap-3 mb-4">
          <input
            type="text"
            placeholder="Search samples..."
            value={sampleSearch}
            onChange={(e) => setSampleSearch(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm flex-1 min-w-[180px]"
          />
          <select value={sampleType} onChange={(e) => setSampleType(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
            <option value="">All Types</option>
            {uniqueSampleTypes.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={sampleStatus} onChange={(e) => setSampleStatus(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
            <option value="">All Statuses</option>
            {uniqueSampleStatuses.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
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
              </tr>
            </thead>
            <tbody>
              {filteredSamples.map((r) => (
                <tr key={r.id} className="border-b border-mint-50 hover:bg-mint-50/50">
                  <td className="py-2 px-4">{r.sampleId}</td>
                  <td className="py-2 px-4">{r.disease ?? '—'}</td>
                  <td className="py-2 px-4">{r.organismName}</td>
                  <td className="py-2 px-4">{r.sampleType}</td>
                  <td className="py-2 px-4">{r.tissueSource ?? '—'}</td>
                  <td className="py-2 px-4">{r.studyPurpose ?? '—'}</td>
                  <td className="py-2 px-4">{r.projectName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredSamples.length === 0 && <p className="py-6 text-center text-gray-500">No samples match your filters.</p>}
      </div>
    </div>
  );
}

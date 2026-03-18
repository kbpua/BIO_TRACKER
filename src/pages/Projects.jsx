import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { PROJECT_STATUSES } from '../data/mockData';
import { generateProjectId } from '../utils/projectId';

function ProjectForm({ project, onSave, onCancel }) {
  const { users, projects } = useData();
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
    status: project?.status ?? 'Active',
  });
  const previewId = !isEdit && form.name && form.startDate
    ? generateProjectId(form.name, form.startDate, projects.length)
    : '';

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(form);
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
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
        required={activeResearchers.length > 0}
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
      <select
        value={form.status}
        onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
      >
        {PROJECT_STATUSES.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
      <div className="flex gap-2">
        <button type="submit" className="px-3 py-1.5 bg-mint-600 text-white text-sm rounded-lg hover:bg-mint-700">
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
  const { user, canManageProjects, isResearcher } = useAuth();
  const { projects, samples, addProject, updateProject, deleteProject } = useData();

  const canEditProject = (p) =>
    canManageProjects || (isResearcher && p.leadResearcher === user?.fullName);
  const [modal, setModal] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const countByProject = samples.reduce((acc, s) => {
    acc[s.projectId] = (acc[s.projectId] || 0) + 1;
    return acc;
  }, {});

  const filteredProjects = projects.filter((p) => {
    const q = search.toLowerCase();
    const matchSearch = !search || [p.name, p.description, p.leadResearcher].some((v) => String(v ?? '').toLowerCase().includes(q));
    const matchStatus = !filterStatus || p.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const clearFilters = () => {
    setSearch('');
    setFilterStatus('');
  };

  const handleSave = (data) => {
    if (modal === 'new') {
      const id = generateProjectId(data.name, data.startDate, projects.length);
      addProject({ ...data, id });
    } else if (modal?.id) updateProject(modal.id, data);
    setModal(null);
  };

  const handleDelete = (id) => {
    deleteProject(id);
    setConfirmDelete(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Projects</h1>
        {canManageProjects && (
          <button
            type="button"
            onClick={() => setModal('new')}
            className="px-4 py-2 bg-mint-600 text-white text-sm font-medium rounded-lg hover:bg-mint-700"
          >
            Add Project
          </button>
        )}
      </div>
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
          <button type="button" onClick={clearFilters} className="text-sm text-mint-600 hover:text-mint-800 font-medium">
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
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Description</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Start Date</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">End Date</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Lead Researcher</th>
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
                <td className="py-2 px-4 max-w-xs truncate">{p.description}</td>
                <td className="py-2 px-4">{p.startDate || '—'}</td>
                <td className="py-2 px-4">{p.endDate || '—'}</td>
                <td className="py-2 px-4">{p.leadResearcher}</td>
                <td className="py-2 px-4">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    p.status === 'Active' ? 'bg-green-100 text-green-800' :
                    p.status === 'Completed' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {p.status}
                  </span>
                </td>
                <td className="py-2 px-4">{countByProject[p.id] ?? 0}</td>
                <td className="py-2 px-4">
                  <div className="flex flex-wrap gap-1.5">
                    <Link
                      to={`/projects/${p.id}`}
                      className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
                    >
                      View
                    </Link>
                    {canEditProject(p) && (
                      <>
                        <button
                          type="button"
                          onClick={() => setModal({ id: p.id, project: p })}
                          className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-mint-600 text-white hover:bg-mint-700 transition-colors shadow-sm"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(p.id)}
                          className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-red-600 text-white hover:bg-red-700 transition-colors shadow-sm"
                        >
                          Delete
                        </button>
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

      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-lg w-full shadow-xl">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              {modal === 'new' ? 'New Project' : 'Edit Project'}
            </h2>
            <ProjectForm
              project={modal === 'new' ? null : modal.project}
              onSave={handleSave}
              onCancel={() => setModal(null)}
            />
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-xl">
            <p className="font-medium text-gray-800 mb-2">Delete this project?</p>
            <p className="text-sm text-gray-500 mb-4">This action cannot be undone.</p>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setConfirmDelete(null)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button type="button" onClick={() => handleDelete(confirmDelete)} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { PROJECT_STATUSES } from '../data/mockData';

function ProjectForm({ project, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: project?.name ?? '',
    description: project?.description ?? '',
    startDate: project?.startDate ?? '',
    endDate: project?.endDate ?? '',
    leadResearcher: project?.leadResearcher ?? '',
    status: project?.status ?? 'Active',
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(form);
      }}
      className="space-y-3"
    >
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
      <input
        type="text"
        placeholder="Lead Researcher"
        value={form.leadResearcher}
        onChange={(e) => setForm((f) => ({ ...f, leadResearcher: e.target.value }))}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
      />
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
  const { canManageProjects } = useAuth();
  const { projects, samples, addProject, updateProject, deleteProject } = useData();
  const [modal, setModal] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [viewProjectId, setViewProjectId] = useState(null);

  const countByProject = samples.reduce((acc, s) => {
    acc[s.projectId] = (acc[s.projectId] || 0) + 1;
    return acc;
  }, {});

  const handleSave = (data) => {
    if (modal === 'new') addProject(data);
    else if (modal?.id) updateProject(modal.id, data);
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
            {projects.map((p) => (
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
                    <button
                      type="button"
                      onClick={() => setViewProjectId(viewProjectId === p.id ? null : p.id)}
                      className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
                    >
                      View
                    </button>
                    {canManageProjects && (
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
      </div>

      {viewProjectId && (() => {
        const p = projects.find((proj) => proj.id === viewProjectId);
        if (!p) return null;
        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setViewProjectId(null)}>
            <div className="bg-white rounded-xl border border-mint-100 shadow-xl p-6 max-w-lg w-full max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-lg font-semibold text-gray-800">Project Details</h2>
                <button
                  type="button"
                  onClick={() => setViewProjectId(null)}
                  className="px-2.5 py-1 rounded-md text-xs font-medium border border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  Close
                </button>
              </div>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div><dt className="text-gray-500">Project ID</dt><dd className="font-medium">{p.id}</dd></div>
                <div><dt className="text-gray-500">Project Name</dt><dd className="font-medium">{p.name}</dd></div>
                <div className="sm:col-span-2"><dt className="text-gray-500">Description</dt><dd>{p.description || '—'}</dd></div>
                <div><dt className="text-gray-500">Start Date</dt><dd>{p.startDate || '—'}</dd></div>
                <div><dt className="text-gray-500">End Date</dt><dd>{p.endDate || '—'}</dd></div>
                <div><dt className="text-gray-500">Lead Researcher</dt><dd>{p.leadResearcher || '—'}</dd></div>
                <div><dt className="text-gray-500">Status</dt><dd>{p.status}</dd></div>
                <div><dt className="text-gray-500"># Associated Samples</dt><dd>{countByProject[p.id] ?? 0}</dd></div>
              </dl>
              {canManageProjects && (
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => { setViewProjectId(null); setModal({ id: p.id, project: p }); }}
                    className="text-mint-600 hover:text-mint-800 font-medium text-sm"
                  >
                    Edit project →
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })()}

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

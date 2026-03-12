import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { KINGDOMS } from '../data/mockData';

function OrganismForm({ organism, onSave, onCancel }) {
  const [form, setForm] = useState({
    scientificName: organism?.scientificName ?? '',
    commonName: organism?.commonName ?? '',
    taxonomyId: organism?.taxonomyId ?? '',
    kingdom: organism?.kingdom ?? 'Animalia',
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
        placeholder="Scientific Name"
        value={form.scientificName}
        onChange={(e) => setForm((f) => ({ ...f, scientificName: e.target.value }))}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
        required
      />
      <input
        type="text"
        placeholder="Common Name"
        value={form.commonName}
        onChange={(e) => setForm((f) => ({ ...f, commonName: e.target.value }))}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
      />
      <input
        type="text"
        placeholder="Taxonomy ID"
        value={form.taxonomyId}
        onChange={(e) => setForm((f) => ({ ...f, taxonomyId: e.target.value }))}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
      />
      <select
        value={form.kingdom}
        onChange={(e) => setForm((f) => ({ ...f, kingdom: e.target.value }))}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
      >
        {KINGDOMS.map((k) => (
          <option key={k} value={k}>{k}</option>
        ))}
      </select>
      <div className="flex gap-2">
        <button type="submit" className="px-3 py-1.5 bg-mint-600 text-white text-sm rounded-lg hover:bg-mint-700">Save</button>
        <button type="button" onClick={onCancel} className="px-3 py-1.5 border border-gray-300 text-sm rounded-lg hover:bg-gray-50">Cancel</button>
      </div>
    </form>
  );
}

export default function Organisms() {
  const { canManageOrganisms } = useAuth();
  const { organisms, samples, addOrganism, updateOrganism, deleteOrganism } = useData();
  const [modal, setModal] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [viewOrganismId, setViewOrganismId] = useState(null);

  const countByOrganism = samples.reduce((acc, s) => {
    acc[s.organismId] = (acc[s.organismId] || 0) + 1;
    return acc;
  }, {});

  const handleSave = (data) => {
    if (modal === 'new') addOrganism(data);
    else if (modal?.id) updateOrganism(modal.id, data);
    setModal(null);
  };

  const handleDelete = (id) => {
    deleteOrganism(id);
    setConfirmDelete(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Organisms</h1>
        {canManageOrganisms && (
          <button
            type="button"
            onClick={() => setModal('new')}
            className="px-4 py-2 bg-mint-600 text-white text-sm font-medium rounded-lg hover:bg-mint-700"
          >
            Add Organism
          </button>
        )}
      </div>
      <div className="bg-white rounded-xl border border-mint-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-mint-50 border-b border-mint-100">
            <tr>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Organism ID</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Scientific Name</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Common Name</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Taxonomy ID</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Kingdom</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700"># Samples</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {organisms.map((o) => (
              <tr key={o.id} className="border-b border-mint-50 hover:bg-mint-50/50">
                <td className="py-2 px-4">{o.id}</td>
                <td className="py-2 px-4 font-medium">{o.scientificName}</td>
                <td className="py-2 px-4">{o.commonName}</td>
                <td className="py-2 px-4">{o.taxonomyId}</td>
                <td className="py-2 px-4">{o.kingdom}</td>
                <td className="py-2 px-4">{countByOrganism[o.id] ?? 0}</td>
                <td className="py-2 px-4">
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setViewOrganismId(viewOrganismId === o.id ? null : o.id)}
                      className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
                    >
                      View
                    </button>
                    {canManageOrganisms && (
                      <>
                        <button
                          type="button"
                          onClick={() => setModal({ id: o.id, organism: o })}
                          className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-mint-600 text-white hover:bg-mint-700 transition-colors shadow-sm"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(o.id)}
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

      {viewOrganismId && (() => {
        const o = organisms.find((org) => org.id === viewOrganismId);
        if (!o) return null;
        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setViewOrganismId(null)}>
            <div className="bg-white rounded-xl border border-mint-100 shadow-xl p-6 max-w-lg w-full max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-lg font-semibold text-gray-800">Organism Details</h2>
                <button
                  type="button"
                  onClick={() => setViewOrganismId(null)}
                  className="px-2.5 py-1 rounded-md text-xs font-medium border border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  Close
                </button>
              </div>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div><dt className="text-gray-500">Organism ID</dt><dd className="font-medium">{o.id}</dd></div>
                <div><dt className="text-gray-500">Scientific Name</dt><dd className="font-medium">{o.scientificName}</dd></div>
                <div><dt className="text-gray-500">Common Name</dt><dd>{o.commonName || '—'}</dd></div>
                <div><dt className="text-gray-500">Taxonomy ID</dt><dd>{o.taxonomyId || '—'}</dd></div>
                <div><dt className="text-gray-500">Kingdom</dt><dd>{o.kingdom}</dd></div>
                <div><dt className="text-gray-500"># Associated Samples</dt><dd>{countByOrganism[o.id] ?? 0}</dd></div>
              </dl>
              {canManageOrganisms && (
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => { setViewOrganismId(null); setModal({ id: o.id, organism: o }); }}
                    className="text-mint-600 hover:text-mint-800 font-medium text-sm"
                  >
                    Edit organism →
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">{modal === 'new' ? 'New Organism' : 'Edit Organism'}</h2>
            <OrganismForm organism={modal === 'new' ? null : modal.organism} onSave={handleSave} onCancel={() => setModal(null)} />
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-xl">
            <p className="font-medium text-gray-800 mb-2">Delete this organism?</p>
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

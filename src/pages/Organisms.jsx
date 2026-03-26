import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { KINGDOMS } from '../data/mockData';
import { getVisibleSamples } from '../utils/visibility';

function organismIdFromTaxonomy(taxonomyId) {
  const t = taxonomyId != null ? String(taxonomyId).trim() : '';
  return t ? `NCBI-${t}` : '';
}

function OrganismForm({ organism, organisms, onSave, onCancel }) {
  const isEdit = Boolean(organism?.id);
  const [form, setForm] = useState({
    scientificName: organism?.scientificName ?? '',
    commonName: organism?.commonName ?? '',
    taxonomyId: organism?.taxonomyId ?? '',
    kingdom: organism?.kingdom ?? 'Animalia',
  });
  const [error, setError] = useState('');

  const previewId = organismIdFromTaxonomy(form.taxonomyId);
  const displayId = isEdit ? previewId : previewId;

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    const taxTrim = String(form.taxonomyId ?? '').trim();
    if (!taxTrim) {
      setError('Taxonomy ID is required to generate Organism ID.');
      return;
    }
    const duplicate = (organisms || []).some(
      (o) => String(o.taxonomyId ?? '').trim() === taxTrim && o.id !== organism?.id
    );
    if (duplicate) {
      setError('An organism with this Taxonomy ID already exists.');
      return;
    }
    const id = organismIdFromTaxonomy(form.taxonomyId);
    onSave({ ...form, id });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && (
        <div className="p-2 rounded-lg bg-red-50 text-red-700 text-sm">
          {error}
        </div>
      )}
      {isEdit ? (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Organism ID</label>
          <input
            type="text"
            value={displayId}
            readOnly
            className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed text-sm"
          />
          <p className="text-xs text-gray-500 mt-1">Organism ID is derived from Taxonomy ID and cannot be edited directly.</p>
        </div>
      ) : (
        form.taxonomyId && (
          <div className="p-3 rounded-lg bg-mint-50 border border-mint-200">
            <label className="block text-sm font-medium text-mint-800 mb-1">Generated Organism ID (preview)</label>
            <p className="font-mono font-semibold text-mint-800">{previewId}</p>
            <p className="text-xs text-gray-500 mt-1">This ID will be assigned when you submit.</p>
          </div>
        )
      )}
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
        required
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
  const { canManageOrganisms, user } = useAuth();
  const { organisms, samples, projects, addOrganism, updateOrganism, deleteOrganism } = useData();
  const [modal, setModal] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [search, setSearch] = useState('');
  const [filterKingdom, setFilterKingdom] = useState('');

  const visibleSamples = getVisibleSamples(samples, projects, user);
  const countByOrganism = visibleSamples.reduce((acc, s) => {
    acc[s.organismId] = (acc[s.organismId] || 0) + 1;
    return acc;
  }, {});

  const filteredOrganisms = organisms.filter((o) => {
    const q = search.toLowerCase();
    const matchSearch = !search || [o.scientificName, o.commonName, o.taxonomyId].some((v) => String(v ?? '').toLowerCase().includes(q));
    const matchKingdom = !filterKingdom || o.kingdom === filterKingdom;
    return matchSearch && matchKingdom;
  });

  const clearFilters = () => {
    setSearch('');
    setFilterKingdom('');
  };

  const handleSave = (data) => {
    if (modal === 'new') {
      addOrganism({ ...data, id: data.id || `NCBI-${String(data.taxonomyId ?? '').trim()}` });
    } else if (modal?.id) {
      const newId = data.id || `NCBI-${String(data.taxonomyId ?? '').trim()}`;
      updateOrganism(modal.id, { ...data, id: newId });
    }
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
      <div className="bg-white rounded-xl border border-mint-100 p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap gap-3 items-center">
          <input
            type="text"
            placeholder="Search by scientific name, common name, or taxonomy ID"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-mint-500 focus:border-mint-500 flex-1 min-w-[200px]"
          />
          <select
            value={filterKingdom}
            onChange={(e) => setFilterKingdom(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-mint-500"
          >
            <option value="">All Kingdoms</option>
            {KINGDOMS.map((k) => (
              <option key={k} value={k}>{k}</option>
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
            {filteredOrganisms.map((o) => (
              <tr key={o.id} className="border-b border-mint-50 hover:bg-mint-50/50">
                <td className="py-2 px-4">{o.id}</td>
                <td className="py-2 px-4 font-medium">{o.scientificName}</td>
                <td className="py-2 px-4">{o.commonName}</td>
                <td className="py-2 px-4">{o.taxonomyId}</td>
                <td className="py-2 px-4">{o.kingdom}</td>
                <td className="py-2 px-4">{countByOrganism[o.id] ?? 0}</td>
                <td className="py-2 px-4">
                  <div className="flex flex-wrap gap-1.5">
                    <Link
                      to={`/organisms/${o.id}`}
                      className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
                    >
                      View
                    </Link>
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
        {filteredOrganisms.length === 0 && (
          <p className="py-8 text-center text-gray-500">No organisms match your filters.</p>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">{modal === 'new' ? 'New Organism' : 'Edit Organism'}</h2>
            <OrganismForm organism={modal === 'new' ? null : modal.organism} organisms={organisms} onSave={handleSave} onCancel={() => setModal(null)} />
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

import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { SAMPLE_TYPES, SAMPLE_STATUSES } from '../data/mockData';

export default function SampleForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { user, canManageSamples } = useAuth();
  const { samples, organisms, projects, addSample, updateSample, addActivity } = useData();

  const [form, setForm] = useState({
    sampleName: '',
    sampleType: '',
    organismId: '',
    projectId: '',
    collectionDate: '',
    collectedBy: '',
    storageLocation: '',
    status: 'Active',
    notes: '',
  });
  const [errors, setErrors] = useState({});

  const sample = isEdit ? samples.find((s) => s.id === id) : null;

  useEffect(() => {
    if (!canManageSamples) {
      navigate('/samples');
      return;
    }
    if (sample) {
      setForm({
        sampleName: sample.sampleName,
        sampleType: sample.sampleType,
        organismId: sample.organismId,
        projectId: sample.projectId,
        collectionDate: sample.collectionDate,
        collectedBy: sample.collectedBy,
        storageLocation: sample.storageLocation,
        status: sample.status,
        notes: sample.notes ?? '',
      });
    }
  }, [sample, isEdit, canManageSamples, navigate]);

  const validate = () => {
    const e = {};
    if (!form.sampleName?.trim()) e.sampleName = 'Required';
    if (!form.sampleType) e.sampleType = 'Required';
    if (!form.organismId) e.organismId = 'Required';
    if (!form.projectId) e.projectId = 'Required';
    if (!form.collectionDate) e.collectionDate = 'Required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    const payload = {
      ...form,
      sampleId: form.sampleName,
    };
    if (isEdit) {
      updateSample(id, payload);
      addActivity(`${user?.fullName} updated sample ${form.sampleName}`);
    } else {
      addSample(payload);
      addActivity(`${user?.fullName} added sample ${form.sampleName}`);
    }
    navigate('/samples');
  };

  if (!canManageSamples) return null;

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">
        {isEdit ? 'Edit Sample' : 'Add Sample'}
      </h1>
      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-mint-100 shadow-sm p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Sample Name *</label>
          <input
            type="text"
            value={form.sampleName}
            onChange={(e) => setForm((f) => ({ ...f, sampleName: e.target.value }))}
            className={`w-full px-3 py-2 border rounded-lg ${errors.sampleName ? 'border-red-500' : 'border-gray-300'} focus:ring-2 focus:ring-mint-500`}
            placeholder="e.g. HGV-TIS-016"
          />
          {errors.sampleName && <p className="text-red-500 text-xs mt-1">{errors.sampleName}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Sample Type *</label>
          <select
            value={form.sampleType}
            onChange={(e) => setForm((f) => ({ ...f, sampleType: e.target.value }))}
            className={`w-full px-3 py-2 border rounded-lg ${errors.sampleType ? 'border-red-500' : 'border-gray-300'} focus:ring-2 focus:ring-mint-500`}
          >
            <option value="">Select type</option>
            {SAMPLE_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          {errors.sampleType && <p className="text-red-500 text-xs mt-1">{errors.sampleType}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Organism *</label>
          <select
            value={form.organismId}
            onChange={(e) => setForm((f) => ({ ...f, organismId: e.target.value }))}
            className={`w-full px-3 py-2 border rounded-lg ${errors.organismId ? 'border-red-500' : 'border-gray-300'} focus:ring-2 focus:ring-mint-500`}
          >
            <option value="">Select organism</option>
            {organisms.map((o) => (
              <option key={o.id} value={o.id}>{o.scientificName}</option>
            ))}
          </select>
          {errors.organismId && <p className="text-red-500 text-xs mt-1">{errors.organismId}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Project *</label>
          <select
            value={form.projectId}
            onChange={(e) => setForm((f) => ({ ...f, projectId: e.target.value }))}
            className={`w-full px-3 py-2 border rounded-lg ${errors.projectId ? 'border-red-500' : 'border-gray-300'} focus:ring-2 focus:ring-mint-500`}
          >
            <option value="">Select project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          {errors.projectId && <p className="text-red-500 text-xs mt-1">{errors.projectId}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Collection Date *</label>
          <input
            type="date"
            value={form.collectionDate}
            onChange={(e) => setForm((f) => ({ ...f, collectionDate: e.target.value }))}
            className={`w-full px-3 py-2 border rounded-lg ${errors.collectionDate ? 'border-red-500' : 'border-gray-300'} focus:ring-2 focus:ring-mint-500`}
          />
          {errors.collectionDate && <p className="text-red-500 text-xs mt-1">{errors.collectionDate}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Collected By</label>
          <input
            type="text"
            value={form.collectedBy}
            onChange={(e) => setForm((f) => ({ ...f, collectedBy: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-mint-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Storage Location</label>
          <input
            type="text"
            value={form.storageLocation}
            onChange={(e) => setForm((f) => ({ ...f, storageLocation: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-mint-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select
            value={form.status}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-mint-500"
          >
            {SAMPLE_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-mint-500"
          />
        </div>
        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            className="px-4 py-2 bg-mint-600 text-white font-medium rounded-lg hover:bg-mint-700"
          >
            {isEdit ? 'Save' : 'Add Sample'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/samples')}
            className="px-4 py-2 border border-gray-300 rounded-lg font-medium hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { SAMPLE_TYPES, SAMPLE_STATUSES } from '../data/mockData';
import { generateSampleId } from '../utils/sampleId';

export default function SampleForm() {
  const { id } = useParams();
  const location = useLocation();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { user, canManageSamples, isAdmin, isResearcher } = useAuth();
  const { samples, organisms, projects, users, addSample, updateSample, addActivity } = useData();

  const lockProject = location.state?.lockProject && location.state?.projectId;
  const returnTo = location.state?.returnTo;

  const activeResearchers = (users || []).filter(
    (u) => u.role === 'Researcher' && u.status === 'Active'
  );

  const lockedProjectId = location.state?.lockProject && location.state?.projectId ? location.state.projectId : '';
  const [form, setForm] = useState({
    sampleType: '',
    organismId: '',
    projectId: lockedProjectId,
    disease: '',
    tissueSource: '',
    studyPurpose: '',
    collectionDate: '',
    collectedBy: '',
    storageLocation: '',
    status: 'Active',
    notes: '',
  });
  const [errors, setErrors] = useState({});

  const sample = isEdit ? samples.find((s) => s.id === id) : null;
  const selectedProject = projects.find((p) => p.id === form.projectId);
  const previewId = !isEdit && form.projectId && form.sampleType
    ? generateSampleId(selectedProject?.name, form.sampleType, samples.length)
    : '';

  useEffect(() => {
    if (!canManageSamples) {
      navigate('/samples');
      return;
    }
    if (sample && isResearcher && sample.collectedBy !== user?.fullName) {
      navigate('/samples');
      return;
    }
    if (sample) {
      setForm({
        sampleType: sample.sampleType,
        organismId: sample.organismId,
        projectId: sample.projectId,
        disease: sample.disease ?? '',
        tissueSource: sample.tissueSource ?? '',
        studyPurpose: sample.studyPurpose ?? '',
        collectionDate: sample.collectionDate,
        collectedBy: sample.collectedBy,
        storageLocation: sample.storageLocation,
        status: sample.status,
        notes: sample.notes ?? '',
      });
    } else if (!isEdit && isResearcher && user?.fullName) {
      setForm((f) => ({ ...f, collectedBy: user.fullName }));
    }
    if (!isEdit && location.state?.projectId && location.state?.lockProject) {
      setForm((f) => ({ ...f, projectId: location.state.projectId }));
    }
  }, [sample, isEdit, canManageSamples, navigate, isResearcher, user?.fullName, location.state?.projectId, location.state?.lockProject]);

  const validate = () => {
    const e = {};
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
    if (isEdit) {
      const payload = { ...form, sampleId: sample.sampleId, sampleName: sample.sampleName };
      updateSample(id, payload);
      addActivity(`${user?.fullName} updated sample ${sample.sampleId}`);
    } else {
      const generatedId = generateSampleId(selectedProject?.name, form.sampleType, samples.length);
      const payload = {
        ...form,
        sampleId: generatedId,
        sampleName: generatedId,
        collectedBy: form.collectedBy || user?.fullName || '',
      };
      addSample(payload);
      addActivity(`${user?.fullName} added sample ${generatedId}`);
    }
    navigate(returnTo || '/samples');
  };

  if (!canManageSamples) return null;

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">
        {isEdit ? 'Edit Sample' : 'Add Sample'}
      </h1>
      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-mint-100 shadow-sm p-6 space-y-4">
        {isEdit ? (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sample ID</label>
            <input
              type="text"
              value={sample?.sampleId ?? ''}
              readOnly
              className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed"
            />
            <p className="text-xs text-gray-500 mt-1">Sample ID cannot be edited.</p>
          </div>
        ) : (
          (form.projectId && form.sampleType) && (
            <div className="p-3 rounded-lg bg-mint-50 border border-mint-200">
              <label className="block text-sm font-medium text-mint-800 mb-1">Generated Sample ID (preview)</label>
              <p className="font-mono font-semibold text-mint-800">{previewId}</p>
              <p className="text-xs text-gray-500 mt-1">This ID will be assigned when you submit.</p>
            </div>
          )
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Disease</label>
          <input
            type="text"
            value={form.disease}
            onChange={(e) => setForm((f) => ({ ...f, disease: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-mint-500"
            placeholder="e.g. Dengue, Hypertension, N/A"
          />
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
          {lockProject ? (
            <>
              <input
                type="text"
                value={projects.find((p) => p.id === form.projectId)?.name ?? form.projectId}
                readOnly
                className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed"
              />
              <p className="text-xs text-gray-500 mt-1">Project is fixed when adding from Project Detail.</p>
            </>
          ) : (
            <>
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
            </>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tissue Source</label>
          <input
            type="text"
            value={form.tissueSource}
            onChange={(e) => setForm((f) => ({ ...f, tissueSource: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-mint-500"
            placeholder="e.g. Plasma, Peripheral Blood, Leaf"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Study Purpose</label>
          <input
            type="text"
            value={form.studyPurpose}
            onChange={(e) => setForm((f) => ({ ...f, studyPurpose: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-mint-500"
            placeholder="e.g. Biomarker Study, Cardiovascular risk analysis"
          />
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
          {isResearcher ? (
            <input
              type="text"
              value={form.collectedBy || user?.fullName || ''}
              readOnly
              className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-600 cursor-not-allowed"
            />
          ) : (
            <select
              value={form.collectedBy}
              onChange={(e) => setForm((f) => ({ ...f, collectedBy: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-mint-500"
            >
              <option value="">Select researcher</option>
              {activeResearchers.map((r) => (
                <option key={r.id} value={r.fullName}>{r.fullName}</option>
              ))}
            </select>
          )}
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
            onClick={() => navigate(returnTo || '/samples')}
            className="px-4 py-2 border border-gray-300 rounded-lg font-medium hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

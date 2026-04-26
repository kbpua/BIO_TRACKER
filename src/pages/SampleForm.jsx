import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { SAMPLE_TYPES, SAMPLE_STATUSES } from '../data/mockData';
import { generateSampleId } from '../utils/sampleId';
import { displayNamesEqual } from '../utils/personName';

export default function SampleForm() {
  const { id } = useParams();
  const location = useLocation();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { user, canManageSamples, isAdmin, isResearcher } = useAuth();
  const {
    samples,
    organisms,
    projects,
    users,
    coResearcherInvites,
    addSample,
    updateSample,
    addActivity,
    submitAddRequest,
    submitEditRequest,
  } = useData();

  const lockProject = location.state?.lockProject && location.state?.projectId;
  const returnTo = location.state?.returnTo;
  const isRequestEdit = Boolean(location.state?.requestEdit);

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
  const sampleProject = sample ? projects.find((p) => p.id === sample.projectId) : null;
  const availableProjects = useMemo(() => {
    if (isAdmin) return projects;
    if (!isResearcher || !user?.fullName) return [];

    return projects.filter((project) => {
      const isLead = displayNamesEqual(project?.leadResearcher, user.fullName);
      const isConfirmedCoResearcher = Array.isArray(project?.coResearchers)
        && project.coResearchers.some((name) => displayNamesEqual(name, user.fullName));
      const acceptedInvite = Array.isArray(coResearcherInvites)
        && coResearcherInvites.some(
          (inv) =>
            inv.projectId === project.id
            && String(inv.status || '').toLowerCase() === 'accepted'
            && (displayNamesEqual(inv.invitedTo, user.fullName)
              || inv.invitedToUserId === user.authId)
        );
      return isLead || isConfirmedCoResearcher || acceptedInvite;
    });
  }, [coResearcherInvites, isAdmin, isResearcher, projects, user?.authId, user?.fullName]);

  const projectRoleById = useMemo(() => {
    const byId = new Map();
    if (!isResearcher || !user?.fullName) return byId;
    availableProjects.forEach((project) => {
      if (displayNamesEqual(project?.leadResearcher, user.fullName)) {
        byId.set(project.id, 'Lead');
      } else {
        byId.set(project.id, 'Co-Researcher');
      }
    });
    return byId;
  }, [availableProjects, isResearcher, user?.fullName]);

  const selectedProjectRole = projectRoleById.get(form.projectId) || null;
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const previewId = !isEdit && form.projectId && form.sampleType
    ? generateSampleId(selectedProject?.name, form.sampleType, samples.length)
    : '';

  const isLeadResearcher = isResearcher && selectedProjectRole === 'Lead';
  const isCoResearcher = isResearcher
    && !isAdmin
    && !isLeadResearcher
    && selectedProjectRole === 'Co-Researcher';

  const isLeadResearcherForExistingSample = isResearcher
    && displayNamesEqual(sampleProject?.leadResearcher, user?.fullName);
  const isCoResearcherForExistingSample = isResearcher
    && Array.isArray(sampleProject?.coResearchers)
    && sampleProject.coResearchers.some((n) => displayNamesEqual(n, user?.fullName));
  const isOwnExistingSample = Boolean(sample) && (
    displayNamesEqual(sample?.collectedBy, user?.fullName)
    || displayNamesEqual(sample?.createdBy, user?.fullName)
  );

  useEffect(() => {
    if (!canManageSamples) {
      navigate('/samples');
      return;
    }
    if (sample && isResearcher && !isAdmin) {
      const canEditAsLead = isLeadResearcherForExistingSample;
      const canEditAsOwnerCoResearcher = isCoResearcherForExistingSample && isOwnExistingSample;
      if (!canEditAsLead && !canEditAsOwnerCoResearcher) {
        navigate('/samples');
        return;
      }
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
  }, [
    sample,
    isEdit,
    canManageSamples,
    navigate,
    isResearcher,
    isAdmin,
    isLeadResearcherForExistingSample,
    isCoResearcherForExistingSample,
    isOwnExistingSample,
    user?.fullName,
    location.state?.projectId,
    location.state?.lockProject,
  ]);

  useEffect(() => {
    if (isEdit || lockProject || !isResearcher) return;
    if (!form.projectId) return;
    const stillAllowed = availableProjects.some((p) => p.id === form.projectId);
    if (!stillAllowed) {
      setForm((prev) => ({ ...prev, projectId: '' }));
    }
  }, [availableProjects, form.projectId, isEdit, isResearcher, lockProject]);

  const validate = () => {
    const e = {};
    if (!form.sampleType) e.sampleType = 'Required';
    if (!form.organismId) e.organismId = 'Required';
    if (!form.projectId) e.projectId = 'Required';
    if (!form.collectionDate) e.collectionDate = 'Required';
    if (form.collectionDate && form.collectionDate > todayStr) {
      e.collectionDate = 'Collection date cannot be in the future';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const buildChanges = (before, after) => {
    const fields = [
      'disease',
      'sampleType',
      'organismId',
      'projectId',
      'tissueSource',
      'studyPurpose',
      'collectionDate',
      'collectedBy',
      'storageLocation',
      'status',
      'notes',
    ];
    return fields
      .filter((k) => String(before?.[k] ?? '') !== String(after?.[k] ?? ''))
      .map((k) => ({ field: k, from: before?.[k] ?? '', to: after?.[k] ?? '' }));
  };

  const formatChangesSummary = (changes) => {
    if (!Array.isArray(changes) || changes.length === 0) return '';
    return changes
      .slice(0, 3)
      .map((c) => `${c.field}: ${String(c.from)} → ${String(c.to)}`)
      .join('; ') + (changes.length > 3 ? ` (+${changes.length - 3} more)` : '');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    if (isEdit) {
      const payload = { ...form, sampleId: sample.sampleId, sampleName: sample.sampleName };
      if (isRequestEdit && isResearcher && !isAdmin) {
        const changes = buildChanges(sample, payload);
        submitEditRequest({
          projectId: sample.projectId,
          requestedBy: user?.fullName || 'Unknown',
          sampleRecordId: sample.id,
          sampleId: sample.sampleId,
          proposedUpdates: payload,
          changes,
        });
        addActivity(`${user?.fullName} submitted an edit request for sample ${sample.sampleId}`);
        const summary = formatChangesSummary(changes);
        const msg = summary
          ? `Your edit request for ${sample.sampleId} has been submitted for approval. ${summary}`
          : `Your edit request for ${sample.sampleId} has been submitted for approval by the Lead Researcher.`;
        try {
          const key = user?.fullName ? `biosample_toast_queue:${user.fullName}` : null;
          if (key) sessionStorage.setItem(key, JSON.stringify([{ message: msg, variant: 'success' }]));
        } catch {}
        navigate(returnTo || '/samples');
        return;
      }
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
      if (isCoResearcher) {
        submitAddRequest({
          projectId: payload.projectId,
          requestedBy: user?.fullName || 'Unknown',
          proposedSample: payload,
          sampleId: generatedId,
        });
        addActivity(`${user?.fullName} submitted an add request for sample ${generatedId}`);
        try {
          const key = user?.fullName ? `biosample_toast_queue:${user.fullName}` : null;
          if (key) {
            sessionStorage.setItem(key, JSON.stringify([{
              message: 'Your add request has been submitted for approval by the Lead Researcher.',
              variant: 'success',
            }]));
          }
        } catch {}
        navigate(returnTo || '/samples');
        return;
      }
      addSample(payload);
      addActivity(`${user?.fullName} added sample ${generatedId}`);
    }
    navigate(returnTo || '/samples');
  };

  if (!canManageSamples) return null;

  return (
    <div className="max-w-2xl">
      <header className="pb-6 mb-8">
        <div className="min-h-11 flex items-center">
          <h1 className="text-2xl font-bold text-gray-800">
            {isEdit ? 'Edit Sample' : (isCoResearcher ? 'Request Add Sample' : 'Add Sample')}
          </h1>
        </div>
      </header>
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
                disabled={isResearcher && !isAdmin && availableProjects.length === 0}
                className={`w-full px-3 py-2 border rounded-lg ${errors.projectId ? 'border-red-500' : 'border-gray-300'} focus:ring-2 focus:ring-mint-500`}
              >
                <option value="">Select project</option>
                {(isAdmin ? projects : availableProjects).map((p) => (
                  <option key={p.id} value={p.id}>
                    {isResearcher && !isAdmin ? `${p.name} (${projectRoleById.get(p.id) || 'Co-Researcher'})` : p.name}
                  </option>
                ))}
              </select>
              {isResearcher && !isAdmin && availableProjects.length === 0 && (
                <p className="text-xs text-amber-700 mt-1">
                  You are not part of any projects. Contact an Admin or Lead Researcher to be added to a project.
                </p>
              )}
              {errors.projectId && <p className="text-red-500 text-xs mt-1">{errors.projectId}</p>}
            </>
          )}
          {!isEdit && isResearcher && !isAdmin && selectedProjectRole === 'Co-Researcher' && (
            <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-400/40 dark:bg-amber-950/35 dark:text-amber-200">
              You are a Co-Researcher on this project. Your sample will be submitted for approval by the Lead Researcher before it is added.
            </div>
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
            max={todayStr}
            onChange={(e) => {
              const nextDate = e.target.value;
              setForm((f) => ({ ...f, collectionDate: nextDate }));
              if (errors.collectionDate && nextDate && nextDate <= todayStr) {
                setErrors((prev) => ({ ...prev, collectionDate: undefined }));
              }
            }}
            className={`date-input-bright-icon w-full px-3 py-2 border rounded-lg ${errors.collectionDate ? 'border-red-500' : 'border-gray-300'} focus:ring-2 focus:ring-mint-500`}
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
            className="px-4 py-2 bg-mint-800 bg-gradient-to-r from-[#0F766E] to-[#115E59] text-white font-medium rounded-lg hover:opacity-95 transition-opacity"
          >
            {isEdit ? 'Save' : (isCoResearcher ? 'Request Add Sample' : 'Add Sample')}
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

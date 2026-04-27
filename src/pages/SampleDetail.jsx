import { useParams, Link } from 'react-router-dom';
import { Dna, FlaskConical, Stethoscope, Microscope } from 'lucide-react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { canUserViewProject } from '../utils/visibility';
import {
  ORGANISM_CONTENT,
  SAMPLE_TYPE_CONTENT,
  DISEASE_CONTENT,
  STUDY_PURPOSE_CONTENT,
  FALLBACK_MESSAGE,
} from '../data/educationalContent';

function EduCard({ title, icon: Icon, children, headerClass }) {
  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm bg-white">
      <div className={`px-4 py-3 flex items-center gap-2.5 border-b border-gray-200 ${headerClass || 'bg-mint-50'}`}>
        {Icon ? (
          <span className="flex shrink-0 text-current opacity-90" aria-hidden>
            <Icon className="h-5 w-5" strokeWidth={2} />
          </span>
        ) : null}
        <h3 className="font-semibold text-current">{title}</h3>
      </div>
      <div className="p-4 text-sm text-gray-700 leading-relaxed">
        {children}
      </div>
    </div>
  );
}

export default function SampleDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { samples, organisms, projects, coResearcherInvites } = useData();

  const getOrgName = (oid) => organisms.find((o) => o.id === oid)?.scientificName ?? '';
  const getProjName = (pid) => projects.find((p) => p.id === pid)?.name ?? '';

  const sample = samples.find((s) => s.id === id);
  const proj = sample ? projects.find((p) => p.id === sample.projectId) : null;
  const organism = sample ? organisms.find((o) => o.id === sample.organismId) : null;
  const row = sample
    ? {
        ...sample,
        organismName: getOrgName(sample.organismId),
        projectName: getProjName(sample.projectId),
      }
    : null;

  const organismContent = organism && ORGANISM_CONTENT[organism.id];
  const sampleTypeContent = row && SAMPLE_TYPE_CONTENT[row.sampleType];
  const diseaseKey = row?.disease?.trim() === '' || row?.disease == null ? 'N/A' : row.disease;
  const diseaseContent = row && DISEASE_CONTENT[diseaseKey];
  const studyPurposeContent = row?.studyPurpose && STUDY_PURPOSE_CONTENT[row.studyPurpose];

  if (!row) {
    return (
      <div className="space-y-4">
        <p className="text-gray-500">Sample not found.</p>
        <Link to="/samples" className="inline-flex items-center px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:hover:bg-slate-200 dark:hover:text-slate-950">
          Back to Samples
        </Link>
      </div>
    );
  }

  if (proj && !canUserViewProject(user, proj, coResearcherInvites)) {
    return (
      <div className="max-w-xl mx-auto mt-12 text-center space-y-3">
        <h1 className="text-xl font-semibold text-gray-800">Access Denied</h1>
        <p className="text-gray-600">This sample belongs to a project that is not available for your role.</p>
        <Link to="/samples" className="text-mint-600 dark:text-mint-300 font-medium hover:underline dark:hover:text-mint-400">Back to Samples</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          to="/samples"
          className="inline-flex items-center px-3 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:hover:bg-slate-200 dark:hover:text-slate-950"
        >
          Back
        </Link>
      </div>

      {/* Metadata */}
      <div className="bg-white rounded-xl border border-mint-100 shadow-sm p-6">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <h1 className="text-xl font-bold text-gray-800">Sample Details</h1>
        </div>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div><dt className="text-gray-500">Sample ID</dt><dd className="font-medium">{row.sampleId}</dd></div>
          <div><dt className="text-gray-500">Disease</dt><dd>{row.disease ?? '—'}</dd></div>
          <div><dt className="text-gray-500">Organism</dt><dd>{row.organismName}</dd></div>
          <div><dt className="text-gray-500">Sample Type</dt><dd>{row.sampleType}</dd></div>
          <div><dt className="text-gray-500">Tissue Source</dt><dd>{row.tissueSource ?? '—'}</dd></div>
          <div><dt className="text-gray-500">Study Purpose</dt><dd>{row.studyPurpose ?? '—'}</dd></div>
          <div><dt className="text-gray-500">Project name</dt><dd>{row.projectName}</dd></div>
          <div><dt className="text-gray-500">Collection Date</dt><dd>{row.collectionDate ?? '—'}</dd></div>
          <div><dt className="text-gray-500">Collected By</dt><dd>{row.collectedBy ?? '—'}</dd></div>
          <div><dt className="text-gray-500">Storage Location</dt><dd>{row.storageLocation ?? '—'}</dd></div>
          <div><dt className="text-gray-500">Status</dt><dd>{row.status ?? '—'}</dd></div>
          <div className="sm:col-span-2"><dt className="text-gray-500">Notes</dt><dd>{row.notes || '—'}</dd></div>
        </dl>
      </div>

      {/* Educational sections: 2x2 grid on lg, stack on small */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <EduCard
          title="About the Organism"
          icon={Dna}
          headerClass="bg-mint-100 text-[#0b3f3b]"
        >
          {organismContent ? (
            <>
              <p className="mb-3">{organismContent.description}</p>
              <p className="text-xs text-gray-500 font-medium mt-2">Taxonomy</p>
              <p className="text-gray-600 text-xs">{organismContent.taxonomy}</p>
            </>
          ) : (
            <p>{FALLBACK_MESSAGE}</p>
          )}
        </EduCard>

        <EduCard
          title="About the Sample Type"
          icon={FlaskConical}
          headerClass="bg-sky-100 text-sky-950"
        >
          {sampleTypeContent ? <p>{sampleTypeContent}</p> : <p>{FALLBACK_MESSAGE}</p>}
        </EduCard>

        <EduCard
          title="About the Disease"
          icon={Stethoscope}
          headerClass="bg-amber-100 text-amber-950"
        >
          {diseaseContent ? <p>{diseaseContent}</p> : <p>{FALLBACK_MESSAGE}</p>}
        </EduCard>

        <EduCard
          title="About the Study Purpose"
          icon={Microscope}
          headerClass="bg-violet-100 text-violet-950"
        >
          {studyPurposeContent ? <p>{studyPurposeContent}</p> : <p>{FALLBACK_MESSAGE}</p>}
        </EduCard>
      </div>
    </div>
  );
}

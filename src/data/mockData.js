// Test login accounts - ID format: [ROLE_CODE]-[NAME_INITIALS]-[INCREMENT]
export const MOCK_USERS = [
  { id: 'ADM-DMS-001', email: 'admin@biosample.com', password: 'admin123', fullName: 'Dr. Maria Santos', role: 'Admin', status: 'Active', dateCreated: '2024-01-15', createdBy: 'System' },
  { id: 'RES-DJDC-002', email: 'researcher@biosample.com', password: 'research123', fullName: 'Dr. Juan Dela Cruz', role: 'Researcher', status: 'Active', dateCreated: '2024-02-01', createdBy: 'Dr. Maria Santos' },
  // Same display name as Admin; use this Researcher login to demo co-researcher CSV export (filtered), since Admin always exports all samples.
  { id: 'RES-DMS2-008', email: 'maria.co@biosample.com', password: 'research123', fullName: 'Dr. Maria Santos', role: 'Researcher', status: 'Active', dateCreated: '2024-02-02', createdBy: 'Dr. Maria Santos' },
  { id: 'RES-DMR-005', email: 'rivera@biosample.com', password: 'research123', fullName: 'Dr. Marco Rivera', role: 'Researcher', status: 'Active', dateCreated: '2024-02-05', createdBy: 'Dr. Maria Santos' },
  { id: 'RES-DSG-006', email: 'garcia@biosample.com', password: 'research123', fullName: 'Dr. Sofia Garcia', role: 'Researcher', status: 'Active', dateCreated: '2024-02-06', createdBy: 'Dr. Maria Santos' },
  { id: 'RES-DLA-007', email: 'aquino@biosample.com', password: 'research123', fullName: 'Dr. Liza Aquino', role: 'Researcher', status: 'Active', dateCreated: '2024-02-07', createdBy: 'Dr. Maria Santos' },
  { id: 'STU-AR-003', email: 'student@biosample.com', password: 'student123', fullName: 'Ana Reyes', role: 'Student', status: 'Active', dateCreated: '2024-02-10', createdBy: 'Dr. Maria Santos' },
  { id: 'RES-CM-004', email: 'pending@biosample.com', password: 'pending123', fullName: 'Carlo Mendoza', role: 'Researcher', status: 'Pending', dateCreated: '2024-02-26', createdBy: 'Self', pendingDaysRemaining: 2 },
];

// Test organisms (at least 8) - ID format: NCBI-[TAXONOMY_ID]
export const MOCK_ORGANISMS = [
  { id: 'NCBI-9606', scientificName: 'Homo sapiens', commonName: 'Human', taxonomyId: '9606', kingdom: 'Animalia' },
  { id: 'NCBI-10090', scientificName: 'Mus musculus', commonName: 'House Mouse', taxonomyId: '10090', kingdom: 'Animalia' },
  { id: 'NCBI-3702', scientificName: 'Arabidopsis thaliana', commonName: 'Thale Cress', taxonomyId: '3702', kingdom: 'Plantae' },
  { id: 'NCBI-562', scientificName: 'Escherichia coli', commonName: 'E. coli', taxonomyId: '562', kingdom: 'Bacteria' },
  { id: 'NCBI-4932', scientificName: 'Saccharomyces cerevisiae', commonName: 'Baker\'s Yeast', taxonomyId: '4932', kingdom: 'Fungi' },
  { id: 'NCBI-7227', scientificName: 'Drosophila melanogaster', commonName: 'Fruit Fly', taxonomyId: '7227', kingdom: 'Animalia' },
  { id: 'NCBI-4530', scientificName: 'Oryza sativa', commonName: 'Rice', taxonomyId: '4530', kingdom: 'Plantae' },
  { id: 'NCBI-7955', scientificName: 'Danio rerio', commonName: 'Zebrafish', taxonomyId: '7955', kingdom: 'Animalia' },
];

// Test projects (at least 5) - IDs: [INITIALS]-[START_YEAR]-[INCREMENT]
export const MOCK_PROJECTS = [
  { id: 'HGV-2023-001', name: 'Human Genome Variant Study', description: 'Investigating genetic variants associated with rare diseases in Filipino populations.', startDate: '2023-06-01', endDate: null, leadResearcher: 'Dr. Maria Santos', coResearchers: ['Dr. Juan Dela Cruz'], status: 'Active', publicationStatus: 'Published' },
  { id: 'RBR-2023-002', name: 'Rice Blast Resistance Genes', description: 'Identifying resistance genes in Philippine rice cultivars against Magnaporthe oryzae.', startDate: '2023-08-15', endDate: null, leadResearcher: 'Dr. Juan Dela Cruz', coResearchers: ['Dr. Maria Santos'], status: 'Active', publicationStatus: 'Published', approvedExporters: ['Dr. Maria Santos'] },
  { id: 'ECA-2022-003', name: 'E. coli Antibiotic Resistance', description: 'Mapping antibiotic resistance patterns in clinical E. coli isolates.', startDate: '2022-01-10', endDate: '2024-01-30', leadResearcher: 'Dr. Liza Aquino', coResearchers: [], status: 'Completed', publicationStatus: 'Published' },
  { id: 'ZND-2023-004', name: 'Zebrafish Neural Development', description: 'Studying neural crest cell migration in zebrafish embryos.', startDate: '2023-09-01', endDate: null, leadResearcher: 'Dr. Marco Rivera', coResearchers: ['Dr. Juan Dela Cruz', 'Dr. Sofia Garcia'], status: 'Active', publicationStatus: 'Draft' },
  { id: 'YFG-2023-005', name: 'Yeast Fermentation Genomics', description: 'Characterizing genomic adaptations in yeast under industrial fermentation conditions.', startDate: '2023-03-01', endDate: null, leadResearcher: 'Dr. Sofia Garcia', coResearchers: [], status: 'On Hold', publicationStatus: 'Draft' },
];

// Test samples (at least 15) - with client columns: Sample ID, Disease, Organism, Sample Type, Tissue Source, Study Purpose, Project
export const MOCK_SAMPLES_INITIAL = [
  { id: 's1', sampleId: 'HGV-DNA-001', sampleName: 'HGV-DNA-001', disease: 'Hypertension', organismId: 'NCBI-9606', projectId: 'HGV-2023-001', sampleType: 'DNA', tissueSource: 'Whole blood', studyPurpose: 'Variant discovery', collectionDate: '2024-01-10', collectedBy: 'Dr. Maria Santos', storageLocation: 'Freezer A-01 Shelf 3', status: 'Active', notes: '' },
  { id: 's2', sampleId: 'HGV-RNA-002', sampleName: 'HGV-RNA-002', disease: 'Dengue', organismId: 'NCBI-9606', projectId: 'HGV-2023-001', sampleType: 'RNA', tissueSource: 'PBMC', studyPurpose: 'Expression profiling', collectionDate: '2024-01-12', collectedBy: 'Dr. Maria Santos', storageLocation: 'Cryo Tank B-12', status: 'Active', notes: '' },
  { id: 's3', sampleId: 'RBR-DNA-003', sampleName: 'RBR-DNA-003', disease: 'Diabetes', organismId: 'NCBI-4530', projectId: 'RBR-2023-002', sampleType: 'DNA', tissueSource: 'Leaf', studyPurpose: 'Resistance gene mapping', collectionDate: '2024-01-15', collectedBy: 'Dr. Juan Dela Cruz', storageLocation: 'Freezer A-02 Shelf 1', status: 'Active', notes: '' },
  { id: 's4', sampleId: 'ECO-CUL-004', sampleName: 'ECO-CUL-004', disease: 'Tuberculosis', organismId: 'NCBI-562', projectId: 'ECA-2022-003', sampleType: 'Cell Culture', tissueSource: 'Clinical isolate', studyPurpose: 'Resistance pattern mapping', collectionDate: '2023-06-20', collectedBy: 'Dr. Liza Aquino', storageLocation: 'Fridge C-05 Rack 2', status: 'Used', notes: '' },
  { id: 's5', sampleId: 'ZND-TIS-005', sampleName: 'ZND-TIS-005', disease: 'N/A', organismId: 'NCBI-7955', projectId: 'ZND-2023-004', sampleType: 'Tissue', tissueSource: 'Neural crest', studyPurpose: 'Neural development', collectionDate: '2024-02-01', collectedBy: 'Dr. Marco Rivera', storageLocation: 'Cryo Tank B-08', status: 'Active', notes: '' },
  { id: 's6', sampleId: 'YFG-PRO-006', sampleName: 'YFG-PRO-006', disease: 'N/A', organismId: 'NCBI-4932', projectId: 'YFG-2023-005', sampleType: 'Protein', tissueSource: 'Fermentation broth', studyPurpose: 'Enzyme characterization', collectionDate: '2023-09-15', collectedBy: 'Dr. Sofia Garcia', storageLocation: 'Freezer A-03 Shelf 5', status: 'Expired', notes: '' },
  { id: 's7', sampleId: 'HGV-BLD-007', sampleName: 'HGV-BLD-007', disease: 'Dengue', organismId: 'NCBI-9606', projectId: 'HGV-2023-001', sampleType: 'Blood', tissueSource: 'Plasma', studyPurpose: 'Biomarker validation', collectionDate: '2024-01-18', collectedBy: 'Dr. Maria Santos', storageLocation: 'Disposed', status: 'Contaminated', notes: '' },
  { id: 's8', sampleId: 'RBR-RNA-008', sampleName: 'RBR-RNA-008', disease: 'Malaria', organismId: 'NCBI-4530', projectId: 'RBR-2023-002', sampleType: 'RNA', tissueSource: 'Leaf', studyPurpose: 'Transcriptomics', collectionDate: '2024-02-05', collectedBy: 'Dr. Juan Dela Cruz', storageLocation: 'Freezer A-02 Shelf 2', status: 'Active', notes: '' },
  { id: 's9', sampleId: 'ECO-DNA-009', sampleName: 'ECO-DNA-009', disease: 'Influenza', organismId: 'NCBI-562', projectId: 'ECA-2022-003', sampleType: 'DNA', tissueSource: 'Clinical isolate', studyPurpose: 'Genome sequencing', collectionDate: '2023-07-10', collectedBy: 'Dr. Liza Aquino', storageLocation: 'Fridge C-05 Rack 3', status: 'Used', notes: '' },
  { id: 's10', sampleId: 'DM-WO-010', sampleName: 'DM-WO-010', disease: 'N/A', organismId: 'NCBI-7227', projectId: 'ZND-2023-004', sampleType: 'Whole Organism', tissueSource: 'Larvae', studyPurpose: 'Developmental genetics', collectionDate: '2024-02-10', collectedBy: 'Dr. Marco Rivera', storageLocation: 'Room Temp Storage D-01', status: 'Active', notes: '' },
  { id: 's11', sampleId: 'MM-TIS-011', sampleName: 'MM-TIS-011', disease: 'Hypertension', organismId: 'NCBI-10090', projectId: 'HGV-2023-001', sampleType: 'Tissue', tissueSource: 'Liver', studyPurpose: 'Model validation', collectionDate: '2024-02-12', collectedBy: 'Dr. Maria Santos', storageLocation: 'Cryo Tank B-05', status: 'Active', notes: '' },
  { id: 's12', sampleId: 'AT-DNA-012', sampleName: 'AT-DNA-012', disease: 'COVID-19', organismId: 'NCBI-3702', projectId: 'RBR-2023-002', sampleType: 'DNA', tissueSource: 'Leaf', studyPurpose: 'Host-pathogen interaction', collectionDate: '2024-02-14', collectedBy: 'Dr. Juan Dela Cruz', storageLocation: 'Freezer A-04 Shelf 1', status: 'Active', notes: '' },
  { id: 's13', sampleId: 'ZND-RNA-013', sampleName: 'ZND-RNA-013', disease: 'N/A', organismId: 'NCBI-7955', projectId: 'ZND-2023-004', sampleType: 'RNA', tissueSource: 'Embryo', studyPurpose: 'Neural gene expression', collectionDate: '2024-02-20', collectedBy: 'Dr. Marco Rivera', storageLocation: 'Cryo Tank B-09', status: 'Active', notes: '' },
  { id: 's14', sampleId: 'SC-CUL-014', sampleName: 'SC-CUL-014', disease: 'N/A', organismId: 'NCBI-4932', projectId: 'YFG-2023-005', sampleType: 'Cell Culture', tissueSource: 'Yeast culture', studyPurpose: 'Fermentation genomics', collectionDate: '2024-02-22', collectedBy: 'Dr. Sofia Garcia', storageLocation: 'Fridge C-02 Rack 1', status: 'Active', notes: '' },
  { id: 's15', sampleId: 'HGV-DNA-015', sampleName: 'HGV-DNA-015', disease: 'Diabetes', organismId: 'NCBI-9606', projectId: 'HGV-2023-001', sampleType: 'DNA', tissueSource: 'Whole blood', studyPurpose: 'Variant discovery', collectionDate: '2024-02-26', collectedBy: 'Dr. Maria Santos', storageLocation: 'Freezer A-01 Shelf 4', status: 'Active', notes: '' },
  { id: 's16', sampleId: 'RBR-DNA-016', sampleName: 'RBR-DNA-016', disease: 'Blast resistance', organismId: 'NCBI-4530', projectId: 'RBR-2023-002', sampleType: 'DNA', tissueSource: 'Leaf', studyPurpose: 'Susceptibility assay', collectionDate: '2024-03-01', collectedBy: 'Dr. Maria Santos', storageLocation: 'Freezer A-05 Shelf 1', status: 'Active', notes: '' },
  { id: 's17', sampleId: 'RBR-RNA-017', sampleName: 'RBR-RNA-017', disease: 'N/A', organismId: 'NCBI-4530', projectId: 'RBR-2023-002', sampleType: 'RNA', tissueSource: 'Root', studyPurpose: 'Gene expression', collectionDate: '2024-03-05', collectedBy: 'Dr. Maria Santos', storageLocation: 'Cryo Tank B-10', status: 'Active', notes: '' },
];

// Recent activity feed
export const MOCK_ACTIVITY_INITIAL = [
  { id: 'a1', text: 'Dr. Maria Santos added sample HGV-DNA-015', timeAgo: '2 hours ago' },
  { id: 'a2', text: 'Dr. Juan Dela Cruz updated sample RBR-RNA-008', timeAgo: '5 hours ago' },
  { id: 'a3', text: 'Dr. Marco Rivera added sample ZND-RNA-013', timeAgo: '1 day ago' },
  { id: 'a4', text: 'Admin approved Dr. Juan Dela Cruz\'s account', timeAgo: '2 days ago' },
  { id: 'a5', text: 'Dr. Sofia Garcia exported CSV data', timeAgo: '3 days ago' },
  { id: 'a6', text: 'Sample YFG-PRO-006 status changed to Expired', timeAgo: '4 days ago' },
  { id: 'a7', text: 'Carlo Mendoza registered a new account (pending approval)', timeAgo: '1 day ago' },
];

export const SAMPLE_TYPES = ['DNA', 'RNA', 'Protein', 'Tissue', 'Blood', 'Cell Culture', 'Whole Organism'];
export const SAMPLE_STATUSES = ['Active', 'Used', 'Expired', 'Contaminated'];
export const PROJECT_STATUSES = ['Active', 'Completed', 'On Hold'];
export const KINGDOMS = ['Animalia', 'Plantae', 'Fungi', 'Bacteria', 'Archaea'];
export const ROLES = ['Admin', 'Researcher', 'Student'];
export const ACCOUNT_STATUSES = ['Active', 'Pending', 'Deactivated'];

// Mock pending requests for demo purposes (stored in local state; no backend)
export const MOCK_PENDING_REQUESTS_INITIAL = [
  {
    id: 'pr-1',
    projectId: 'HGV-2023-001',
    type: 'edit',
    requestedBy: 'Dr. Juan Dela Cruz',
    sampleRecordId: 's2',
    sampleId: 'HGV-RNA-002',
    submittedAt: '2026-03-25T09:00:00.000Z',
    changes: [
      { field: 'status', from: 'Active', to: 'Used' },
    ],
    proposedUpdates: { status: 'Used' },
  },
  {
    id: 'pr-2',
    projectId: 'HGV-2023-001',
    type: 'delete',
    requestedBy: 'Dr. Juan Dela Cruz',
    sampleRecordId: 's7',
    sampleId: 'HGV-BLD-007',
    submittedAt: '2026-03-25T09:05:00.000Z',
    reason: 'Sample is contaminated',
  },
  {
    id: 'pr-export-hgv-1',
    projectId: 'HGV-2023-001',
    type: 'export',
    requestedBy: 'Dr. Juan Dela Cruz',
    submittedAt: '2026-04-14T14:00:00.000Z',
  },
];

// Mock co-researcher invites for demo purposes (pending by default)
// `hoursAgo` is converted to `createdAt` ISO when state initializes.
export const MOCK_CO_RESEARCHER_INVITES_INITIAL = [
  {
    id: 'inv-seed-1',
    projectId: 'HGV-2023-001',
    invitedBy: 'Dr. Maria Santos',
    invitedTo: 'Dr. Juan Dela Cruz',
    status: 'Pending',
    hoursAgo: 2,
  },
  {
    id: 'inv-seed-2',
    projectId: 'ZND-2023-004',
    invitedBy: 'Dr. Marco Rivera',
    invitedTo: 'Dr. Juan Dela Cruz',
    status: 'Pending',
    hoursAgo: 24,
  },
  {
    id: 'inv-seed-3',
    projectId: 'YFG-2023-005',
    invitedBy: 'Dr. Sofia Garcia',
    invitedTo: 'Dr. Juan Dela Cruz',
    status: 'Pending',
    hoursAgo: 72,
  },
];
// Test login accounts
export const MOCK_USERS = [
  { id: 'u1', email: 'admin@biosample.com', password: 'admin123', fullName: 'Dr. Maria Santos', role: 'Admin', status: 'Active', dateCreated: '2024-01-15', createdBy: 'System' },
  { id: 'u2', email: 'researcher@biosample.com', password: 'research123', fullName: 'Dr. Juan Dela Cruz', role: 'Researcher', status: 'Active', dateCreated: '2024-02-01', createdBy: 'Dr. Maria Santos' },
  { id: 'u3', email: 'student@biosample.com', password: 'student123', fullName: 'Ana Reyes', role: 'Student', status: 'Active', dateCreated: '2024-02-10', createdBy: 'Dr. Maria Santos' },
  { id: 'u4', email: 'pending@biosample.com', password: 'pending123', fullName: 'Carlo Mendoza', role: 'Researcher', status: 'Pending', dateCreated: '2024-02-26', createdBy: 'Self', pendingDaysRemaining: 2 },
];

// Test organisms (at least 8)
export const MOCK_ORGANISMS = [
  { id: 'org1', scientificName: 'Homo sapiens', commonName: 'Human', taxonomyId: '9606', kingdom: 'Animalia' },
  { id: 'org2', scientificName: 'Mus musculus', commonName: 'House Mouse', taxonomyId: '10090', kingdom: 'Animalia' },
  { id: 'org3', scientificName: 'Arabidopsis thaliana', commonName: 'Thale Cress', taxonomyId: '3702', kingdom: 'Plantae' },
  { id: 'org4', scientificName: 'Escherichia coli', commonName: 'E. coli', taxonomyId: '562', kingdom: 'Bacteria' },
  { id: 'org5', scientificName: 'Saccharomyces cerevisiae', commonName: 'Baker\'s Yeast', taxonomyId: '4932', kingdom: 'Fungi' },
  { id: 'org6', scientificName: 'Drosophila melanogaster', commonName: 'Fruit Fly', taxonomyId: '7227', kingdom: 'Animalia' },
  { id: 'org7', scientificName: 'Oryza sativa', commonName: 'Rice', taxonomyId: '4530', kingdom: 'Plantae' },
  { id: 'org8', scientificName: 'Danio rerio', commonName: 'Zebrafish', taxonomyId: '7955', kingdom: 'Animalia' },
];

// Test projects (at least 5)
export const MOCK_PROJECTS = [
  { id: 'proj1', name: 'Human Genome Variant Study', description: 'Investigating genetic variants associated with rare diseases in Filipino populations.', startDate: '2023-06-01', endDate: null, leadResearcher: 'Dr. Maria Santos', status: 'Active' },
  { id: 'proj2', name: 'Rice Blast Resistance Genes', description: 'Identifying resistance genes in Philippine rice cultivars against Magnaporthe oryzae.', startDate: '2023-08-15', endDate: null, leadResearcher: 'Dr. Juan Dela Cruz', status: 'Active' },
  { id: 'proj3', name: 'E. coli Antibiotic Resistance', description: 'Mapping antibiotic resistance patterns in clinical E. coli isolates.', startDate: '2022-01-10', endDate: '2024-01-30', leadResearcher: 'Dr. Liza Aquino', status: 'Completed' },
  { id: 'proj4', name: 'Zebrafish Neural Development', description: 'Studying neural crest cell migration in zebrafish embryos.', startDate: '2023-09-01', endDate: null, leadResearcher: 'Dr. Marco Rivera', status: 'Active' },
  { id: 'proj5', name: 'Yeast Fermentation Genomics', description: 'Characterizing genomic adaptations in yeast under industrial fermentation conditions.', startDate: '2023-03-01', endDate: null, leadResearcher: 'Dr. Sofia Garcia', status: 'On Hold' },
];

// Test samples (at least 15) - collection dates as strings for display
export const MOCK_SAMPLES_INITIAL = [
  { id: 's1', sampleId: 'HGV-DNA-001', sampleName: 'HGV-DNA-001', sampleType: 'DNA', organismId: 'org1', projectId: 'proj1', collectionDate: '2024-01-10', collectedBy: 'Dr. Maria Santos', storageLocation: 'Freezer A-01 Shelf 3', status: 'Active', notes: '' },
  { id: 's2', sampleId: 'HGV-RNA-002', sampleName: 'HGV-RNA-002', sampleType: 'RNA', organismId: 'org1', projectId: 'proj1', collectionDate: '2024-01-12', collectedBy: 'Dr. Maria Santos', storageLocation: 'Cryo Tank B-12', status: 'Active', notes: '' },
  { id: 's3', sampleId: 'RBR-DNA-003', sampleName: 'RBR-DNA-003', sampleType: 'DNA', organismId: 'org7', projectId: 'proj2', collectionDate: '2024-01-15', collectedBy: 'Dr. Juan Dela Cruz', storageLocation: 'Freezer A-02 Shelf 1', status: 'Active', notes: '' },
  { id: 's4', sampleId: 'ECO-CUL-004', sampleName: 'ECO-CUL-004', sampleType: 'Cell Culture', organismId: 'org4', projectId: 'proj3', collectionDate: '2023-06-20', collectedBy: 'Dr. Liza Aquino', storageLocation: 'Fridge C-05 Rack 2', status: 'Used', notes: '' },
  { id: 's5', sampleId: 'ZND-TIS-005', sampleName: 'ZND-TIS-005', sampleType: 'Tissue', organismId: 'org8', projectId: 'proj4', collectionDate: '2024-02-01', collectedBy: 'Dr. Marco Rivera', storageLocation: 'Cryo Tank B-08', status: 'Active', notes: '' },
  { id: 's6', sampleId: 'YFG-PRO-006', sampleName: 'YFG-PRO-006', sampleType: 'Protein', organismId: 'org5', projectId: 'proj5', collectionDate: '2023-09-15', collectedBy: 'Dr. Sofia Garcia', storageLocation: 'Freezer A-03 Shelf 5', status: 'Expired', notes: '' },
  { id: 's7', sampleId: 'HGV-BLD-007', sampleName: 'HGV-BLD-007', sampleType: 'Blood', organismId: 'org1', projectId: 'proj1', collectionDate: '2024-01-18', collectedBy: 'Dr. Maria Santos', storageLocation: 'Disposed', status: 'Contaminated', notes: '' },
  { id: 's8', sampleId: 'RBR-RNA-008', sampleName: 'RBR-RNA-008', sampleType: 'RNA', organismId: 'org7', projectId: 'proj2', collectionDate: '2024-02-05', collectedBy: 'Dr. Juan Dela Cruz', storageLocation: 'Freezer A-02 Shelf 2', status: 'Active', notes: '' },
  { id: 's9', sampleId: 'ECO-DNA-009', sampleName: 'ECO-DNA-009', sampleType: 'DNA', organismId: 'org4', projectId: 'proj3', collectionDate: '2023-07-10', collectedBy: 'Dr. Liza Aquino', storageLocation: 'Fridge C-05 Rack 3', status: 'Used', notes: '' },
  { id: 's10', sampleId: 'DM-WO-010', sampleName: 'DM-WO-010', sampleType: 'Whole Organism', organismId: 'org6', projectId: 'proj4', collectionDate: '2024-02-10', collectedBy: 'Dr. Marco Rivera', storageLocation: 'Room Temp Storage D-01', status: 'Active', notes: '' },
  { id: 's11', sampleId: 'MM-TIS-011', sampleName: 'MM-TIS-011', sampleType: 'Tissue', organismId: 'org2', projectId: 'proj1', collectionDate: '2024-02-12', collectedBy: 'Dr. Maria Santos', storageLocation: 'Cryo Tank B-05', status: 'Active', notes: '' },
  { id: 's12', sampleId: 'AT-DNA-012', sampleName: 'AT-DNA-012', sampleType: 'DNA', organismId: 'org3', projectId: 'proj2', collectionDate: '2024-02-14', collectedBy: 'Dr. Juan Dela Cruz', storageLocation: 'Freezer A-04 Shelf 1', status: 'Active', notes: '' },
  { id: 's13', sampleId: 'ZND-RNA-013', sampleName: 'ZND-RNA-013', sampleType: 'RNA', organismId: 'org8', projectId: 'proj4', collectionDate: '2024-02-20', collectedBy: 'Dr. Marco Rivera', storageLocation: 'Cryo Tank B-09', status: 'Active', notes: '' },
  { id: 's14', sampleId: 'SC-CUL-014', sampleName: 'SC-CUL-014', sampleType: 'Cell Culture', organismId: 'org5', projectId: 'proj5', collectionDate: '2024-02-22', collectedBy: 'Dr. Sofia Garcia', storageLocation: 'Fridge C-02 Rack 1', status: 'Active', notes: '' },
  { id: 's15', sampleId: 'HGV-DNA-015', sampleName: 'HGV-DNA-015', sampleType: 'DNA', organismId: 'org1', projectId: 'proj1', collectionDate: '2024-02-26', collectedBy: 'Dr. Maria Santos', storageLocation: 'Freezer A-01 Shelf 4', status: 'Active', notes: '' },
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

-- Seed BioSample Tracker tables from the same data as src/data/mockData.js
-- Run in Supabase SQL Editor AFTER migrations (20250415120000 + 20250415120001).
-- Safe to re-run: uses ON CONFLICT DO NOTHING where applicable.
--
-- NOTE: public.profiles rows are tied to auth.users (UUID). This file does NOT
-- insert profiles. After you create users in Authentication, run the OPTIONAL
-- block at the bottom to align roles/names with the mock accounts.

-- ---------------------------------------------------------------------------
-- Organisms
-- ---------------------------------------------------------------------------
insert into public.organisms (id, scientific_name, common_name, taxonomy_id, kingdom) values
  ('NCBI-9606', 'Homo sapiens', 'Human', '9606', 'Animalia'),
  ('NCBI-10090', 'Mus musculus', 'House Mouse', '10090', 'Animalia'),
  ('NCBI-3702', 'Arabidopsis thaliana', 'Thale Cress', '3702', 'Plantae'),
  ('NCBI-562', 'Escherichia coli', 'E. coli', '562', 'Bacteria'),
  ('NCBI-4932', 'Saccharomyces cerevisiae', 'Baker''s Yeast', '4932', 'Fungi'),
  ('NCBI-7227', 'Drosophila melanogaster', 'Fruit Fly', '7227', 'Animalia'),
  ('NCBI-4530', 'Oryza sativa', 'Rice', '4530', 'Plantae'),
  ('NCBI-7955', 'Danio rerio', 'Zebrafish', '7955', 'Animalia')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Projects (co_researchers / approved_exporters are text[])
-- ---------------------------------------------------------------------------
insert into public.projects (
  id, name, description, start_date, end_date, lead_researcher, co_researchers, status, publication_status, approved_exporters
) values
  (
    'HGV-2023-001',
    'Human Genome Variant Study',
    'Investigating genetic variants associated with rare diseases in Filipino populations.',
    '2023-06-01',
    null,
    'Dr. Maria Santos',
    array['Dr. Juan Dela Cruz']::text[],
    'Active',
    'Published (public)',
    '{}'::text[]
  ),
  (
    'RBR-2023-002',
    'Rice Blast Resistance Genes',
    'Identifying resistance genes in Philippine rice cultivars against Magnaporthe oryzae.',
    '2023-08-15',
    null,
    'Dr. Juan Dela Cruz',
    array['Dr. Maria Santos']::text[],
    'Active',
    'Published (public)',
    array['Dr. Maria Santos']::text[]
  ),
  (
    'ECA-2022-003',
    'E. coli Antibiotic Resistance',
    'Mapping antibiotic resistance patterns in clinical E. coli isolates.',
    '2022-01-10',
    '2024-01-30',
    'Dr. Liza Aquino',
    '{}'::text[],
    'Completed',
    'Published (public)',
    '{}'::text[]
  ),
  (
    'ZND-2023-004',
    'Zebrafish Neural Development',
    'Studying neural crest cell migration in zebrafish embryos.',
    '2023-09-01',
    null,
    'Dr. Marco Rivera',
    array['Dr. Juan Dela Cruz', 'Dr. Sofia Garcia']::text[],
    'Active',
    'Draft',
    '{}'::text[]
  ),
  (
    'YFG-2023-005',
    'Yeast Fermentation Genomics',
    'Characterizing genomic adaptations in yeast under industrial fermentation conditions.',
    '2023-03-01',
    null,
    'Dr. Sofia Garcia',
    '{}'::text[],
    'On Hold',
    'Draft',
    '{}'::text[]
  )
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Samples
-- ---------------------------------------------------------------------------
insert into public.samples (
  id, sample_id, sample_name, disease, organism_id, project_id, sample_type, tissue_source, study_purpose,
  collection_date, collected_by, storage_location, status, notes
) values
  ('s1', 'HGV-DNA-001', 'HGV-DNA-001', 'Hypertension', 'NCBI-9606', 'HGV-2023-001', 'DNA', 'Whole blood', 'Variant discovery', '2024-01-10', 'Dr. Maria Santos', 'Freezer A-01 Shelf 3', 'Active', ''),
  ('s2', 'HGV-RNA-002', 'HGV-RNA-002', 'Dengue', 'NCBI-9606', 'HGV-2023-001', 'RNA', 'PBMC', 'Expression profiling', '2024-01-12', 'Dr. Maria Santos', 'Cryo Tank B-12', 'Active', ''),
  ('s3', 'RBR-DNA-003', 'RBR-DNA-003', 'Diabetes', 'NCBI-4530', 'RBR-2023-002', 'DNA', 'Leaf', 'Resistance gene mapping', '2024-01-15', 'Dr. Juan Dela Cruz', 'Freezer A-02 Shelf 1', 'Active', ''),
  ('s4', 'ECO-CUL-004', 'ECO-CUL-004', 'Tuberculosis', 'NCBI-562', 'ECA-2022-003', 'Cell Culture', 'Clinical isolate', 'Resistance pattern mapping', '2023-06-20', 'Dr. Liza Aquino', 'Fridge C-05 Rack 2', 'Used', ''),
  ('s5', 'ZND-TIS-005', 'ZND-TIS-005', 'N/A', 'NCBI-7955', 'ZND-2023-004', 'Tissue', 'Neural crest', 'Neural development', '2024-02-01', 'Dr. Marco Rivera', 'Cryo Tank B-08', 'Active', ''),
  ('s6', 'YFG-PRO-006', 'YFG-PRO-006', 'N/A', 'NCBI-4932', 'YFG-2023-005', 'Protein', 'Fermentation broth', 'Enzyme characterization', '2023-09-15', 'Dr. Sofia Garcia', 'Freezer A-03 Shelf 5', 'Expired', ''),
  ('s7', 'HGV-BLD-007', 'HGV-BLD-007', 'Dengue', 'NCBI-9606', 'HGV-2023-001', 'Blood', 'Plasma', 'Biomarker validation', '2024-01-18', 'Dr. Maria Santos', 'Disposed', 'Contaminated', ''),
  ('s8', 'RBR-RNA-008', 'RBR-RNA-008', 'Malaria', 'NCBI-4530', 'RBR-2023-002', 'RNA', 'Leaf', 'Transcriptomics', '2024-02-05', 'Dr. Juan Dela Cruz', 'Freezer A-02 Shelf 2', 'Active', ''),
  ('s9', 'ECO-DNA-009', 'ECO-DNA-009', 'Influenza', 'NCBI-562', 'ECA-2022-003', 'DNA', 'Clinical isolate', 'Genome sequencing', '2023-07-10', 'Dr. Liza Aquino', 'Fridge C-05 Rack 3', 'Used', ''),
  ('s10', 'DM-WO-010', 'DM-WO-010', 'N/A', 'NCBI-7227', 'ZND-2023-004', 'Whole Organism', 'Larvae', 'Developmental genetics', '2024-02-10', 'Dr. Marco Rivera', 'Room Temp Storage D-01', 'Active', ''),
  ('s11', 'MM-TIS-011', 'MM-TIS-011', 'Hypertension', 'NCBI-10090', 'HGV-2023-001', 'Tissue', 'Liver', 'Model validation', '2024-02-12', 'Dr. Maria Santos', 'Cryo Tank B-05', 'Active', ''),
  ('s12', 'AT-DNA-012', 'AT-DNA-012', 'COVID-19', 'NCBI-3702', 'RBR-2023-002', 'DNA', 'Leaf', 'Host-pathogen interaction', '2024-02-14', 'Dr. Juan Dela Cruz', 'Freezer A-04 Shelf 1', 'Active', ''),
  ('s13', 'ZND-RNA-013', 'ZND-RNA-013', 'N/A', 'NCBI-7955', 'ZND-2023-004', 'RNA', 'Embryo', 'Neural gene expression', '2024-02-20', 'Dr. Marco Rivera', 'Cryo Tank B-09', 'Active', ''),
  ('s14', 'SC-CUL-014', 'SC-CUL-014', 'N/A', 'NCBI-4932', 'YFG-2023-005', 'Cell Culture', 'Yeast culture', 'Fermentation genomics', '2024-02-22', 'Dr. Sofia Garcia', 'Fridge C-02 Rack 1', 'Active', ''),
  ('s15', 'HGV-DNA-015', 'HGV-DNA-015', 'Diabetes', 'NCBI-9606', 'HGV-2023-001', 'DNA', 'Whole blood', 'Variant discovery', '2024-02-26', 'Dr. Maria Santos', 'Freezer A-01 Shelf 4', 'Active', ''),
  ('s16', 'RBR-DNA-016', 'RBR-DNA-016', 'Blast resistance', 'NCBI-4530', 'RBR-2023-002', 'DNA', 'Leaf', 'Susceptibility assay', '2024-03-01', 'Dr. Maria Santos', 'Freezer A-05 Shelf 1', 'Active', ''),
  ('s17', 'RBR-RNA-017', 'RBR-RNA-017', 'N/A', 'NCBI-4530', 'RBR-2023-002', 'RNA', 'Root', 'Gene expression', '2024-03-05', 'Dr. Maria Santos', 'Cryo Tank B-10', 'Active', '')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Activity log (timestamps approximate mock "time ago")
-- ---------------------------------------------------------------------------
insert into public.activity_log (text, created_at) values
  ('Dr. Maria Santos added sample HGV-DNA-015', timezone('utc', now()) - interval '2 hours'),
  ('Dr. Juan Dela Cruz updated sample RBR-RNA-008', timezone('utc', now()) - interval '5 hours'),
  ('Dr. Marco Rivera added sample ZND-RNA-013', timezone('utc', now()) - interval '1 day'),
  ('Admin approved Dr. Juan Dela Cruz''s account', timezone('utc', now()) - interval '2 days'),
  ('Dr. Sofia Garcia exported CSV data', timezone('utc', now()) - interval '3 days'),
  ('Sample YFG-PRO-006 status changed to Expired', timezone('utc', now()) - interval '4 days'),
  ('Carlo Mendoza registered a new account (pending approval)', timezone('utc', now()) - interval '1 day');

-- ---------------------------------------------------------------------------
-- Pending requests (jsonb matches mock shape)
-- ---------------------------------------------------------------------------
insert into public.pending_requests (
  id, project_id, type, requested_by, sample_record_id, sample_id, submitted_at, reason, changes, proposed_updates, proposed_sample
) values
  (
    'pr-1',
    'HGV-2023-001',
    'edit',
    'Dr. Juan Dela Cruz',
    's2',
    'HGV-RNA-002',
    '2026-03-25T09:00:00.000Z',
    null,
    '[{"field":"status","from":"Active","to":"Used"}]'::jsonb,
    '{"status":"Used"}'::jsonb,
    null
  ),
  (
    'pr-2',
    'HGV-2023-001',
    'delete',
    'Dr. Juan Dela Cruz',
    's7',
    'HGV-BLD-007',
    '2026-03-25T09:05:00.000Z',
    'Sample is contaminated',
    null,
    null,
    null
  ),
  (
    'pr-export-hgv-1',
    'HGV-2023-001',
    'export',
    'Dr. Juan Dela Cruz',
    null,
    null,
    '2026-04-14T14:00:00.000Z',
    null,
    null,
    null,
    null
  )
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Co-researcher invites
-- ---------------------------------------------------------------------------
insert into public.co_researcher_invites (id, project_id, invited_by, invited_to, status, created_at) values
  ('inv-seed-1', 'HGV-2023-001', 'Dr. Maria Santos', 'Dr. Juan Dela Cruz', 'Pending', timezone('utc', now()) - interval '2 hours'),
  ('inv-seed-2', 'ZND-2023-004', 'Dr. Marco Rivera', 'Dr. Juan Dela Cruz', 'Pending', timezone('utc', now()) - interval '1 day'),
  ('inv-seed-3', 'YFG-2023-005', 'Dr. Sofia Garcia', 'Dr. Juan Dela Cruz', 'Pending', timezone('utc', now()) - interval '3 days')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- OPTIONAL: After creating each user in Authentication (same emails as mock),
-- the handle_new_user trigger already inserted a profiles row. Run these to
-- match mock roles / legacy display ids. Adjust emails if yours differ.
-- ---------------------------------------------------------------------------
/*
update public.profiles set
  legacy_id = 'ADM-DMS-001',
  full_name = 'Dr. Maria Santos',
  role = 'Admin',
  status = 'Active',
  date_created = '2024-01-15',
  created_by = 'System'
where lower(email) = lower('admin@biosample.com');

update public.profiles set
  legacy_id = 'RES-DJDC-002',
  full_name = 'Dr. Juan Dela Cruz',
  role = 'Researcher',
  status = 'Active',
  date_created = '2024-02-01',
  created_by = 'Dr. Maria Santos'
where lower(email) = lower('researcher@biosample.com');

update public.profiles set
  legacy_id = 'RES-DMS2-008',
  full_name = 'Dr. Maria Santos',
  role = 'Researcher',
  status = 'Active',
  date_created = '2024-02-02',
  created_by = 'Dr. Maria Santos'
where lower(email) = lower('maria.co@biosample.com');

update public.profiles set
  legacy_id = 'RES-DMR-005',
  full_name = 'Dr. Marco Rivera',
  role = 'Researcher',
  status = 'Active',
  date_created = '2024-02-05',
  created_by = 'Dr. Maria Santos'
where lower(email) = lower('rivera@biosample.com');

update public.profiles set
  legacy_id = 'RES-DSG-006',
  full_name = 'Dr. Sofia Garcia',
  role = 'Researcher',
  status = 'Active',
  date_created = '2024-02-06',
  created_by = 'Dr. Maria Santos'
where lower(email) = lower('garcia@biosample.com');

update public.profiles set
  legacy_id = 'RES-DLA-007',
  full_name = 'Dr. Liza Aquino',
  role = 'Researcher',
  status = 'Active',
  date_created = '2024-02-07',
  created_by = 'Dr. Maria Santos'
where lower(email) = lower('aquino@biosample.com');

update public.profiles set
  legacy_id = 'STU-AR-003',
  full_name = 'Ana Reyes',
  role = 'Student',
  status = 'Active',
  date_created = '2024-02-10',
  created_by = 'Dr. Maria Santos'
where lower(email) = lower('student@biosample.com');

update public.profiles set
  legacy_id = 'RES-CM-004',
  full_name = 'Carlo Mendoza',
  role = 'Researcher',
  status = 'Pending',
  date_created = '2024-02-26',
  created_by = 'Self',
  pending_days_remaining = 2
where lower(email) = lower('pending@biosample.com');
*/

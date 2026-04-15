function escapeCsvCell(str) {
  const s = String(str ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function exportSamplesCSV(samples, organisms, projects, downloadFilename) {
  const getOrg = (id) => organisms.find((o) => o.id === id)?.scientificName ?? '';
  const getProj = (id) => projects.find((p) => p.id === id)?.name ?? '';
  const headers = ['Sample ID', 'Disease', 'Organism', 'Sample Type', 'Tissue Source', 'Study Purpose', 'Project name'];
  const rows = samples.map((s) => [
    s.sampleId,
    s.disease ?? '',
    getOrg(s.organismId),
    s.sampleType,
    s.tissueSource ?? '',
    s.studyPurpose ?? '',
    getProj(s.projectId),
  ]);
  const csv = [headers.map(escapeCsvCell).join(','), ...rows.map((r) => r.map(escapeCsvCell).join(','))].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const dateStr = new Date().toISOString().slice(0, 10);
  a.download = downloadFilename || `biosample-export-${dateStr}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}


import { jsPDF } from 'jspdf';

function escapeCsvCell(str) {
  const s = String(str ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function exportSamplesCSV(samples, organisms, projects) {
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
  a.download = `biosample-export-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportSamplesPDF(samples, organisms, projects) {
  const getOrg = (id) => organisms.find((o) => o.id === id)?.scientificName ?? '';
  const getProj = (id) => projects.find((p) => p.id === id)?.name ?? '';
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm' });
  const pageW = doc.internal.pageSize.getWidth();
  let y = 14;
  const lineH = 6;
  doc.setFontSize(14);
  doc.text('BioSample Tracker — Sample Export', 14, y);
  y += lineH + 2;
  doc.setFontSize(9);
  doc.text(`Generated: ${new Date().toLocaleString()} | Total: ${samples.length} samples`, 14, y);
  y += lineH + 4;
  const cols = ['Sample ID', 'Disease', 'Organism', 'Type', 'Tissue Source', 'Study Purpose', 'Project'];
  const colW = [26, 32, 32, 22, 32, 36, 38];
  let x = 14;
  doc.setFont(undefined, 'bold');
  cols.forEach((c, i) => {
    doc.text(c, x, y);
    x += colW[i];
  });
  y += lineH;
  doc.setFont(undefined, 'normal');
  samples.forEach((s) => {
    if (y > 190) {
      doc.addPage('landscape');
      y = 14;
    }
    x = 14;
    const row = [
      String(s.sampleId ?? '').slice(0, 10),
      String(s.disease ?? '').slice(0, 14),
      getOrg(s.organismId).slice(0, 14),
      String(s.sampleType ?? '').slice(0, 10),
      String(s.tissueSource ?? '').slice(0, 14),
      String(s.studyPurpose ?? '').slice(0, 16),
      getProj(s.projectId).slice(0, 16),
    ];
    row.forEach((v, i) => {
      doc.text(String(v ?? ''), x, y);
      x += colW[i];
    });
    y += lineH;
  });
  doc.save(`biosample-export-${new Date().toISOString().slice(0, 10)}.pdf`);
}

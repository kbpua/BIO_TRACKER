const STOP_WORDS = new Set(['of', 'the', 'and', 'in', 'for', 'a', 'an', 'to', 'on', 'at', 'by']);

/**
 * Get 3-letter project initials from project name.
 * First letter of the three most significant words (excluding stop words), uppercase.
 */
export function getProjectInitials(projectName) {
  if (!projectName || !String(projectName).trim()) return '';
  const words = String(projectName)
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0 && !STOP_WORDS.has(w.toLowerCase()));
  const letters = [];
  for (let i = 0; i < words.length && letters.length < 3; i++) {
    const firstChar = (words[i].match(/[a-zA-Z]/) || [words[i][0]])[0];
    if (firstChar) letters.push(firstChar.toUpperCase());
  }
  return letters.join('').padEnd(3, 'X').slice(0, 3);
}

const SAMPLE_TYPE_ABBREV = {
  DNA: 'DNA',
  RNA: 'RNA',
  Protein: 'PRO',
  Tissue: 'TIS',
  Blood: 'BLD',
  'Cell Culture': 'CUL',
  'Whole Organism': 'WO',
};

export function getSampleTypeAbbrev(sampleType) {
  if (!sampleType) return '';
  return SAMPLE_TYPE_ABBREV[sampleType] || String(sampleType).slice(0, 3).toUpperCase();
}

/**
 * Generate next sample ID: [PROJECT_INITIALS]-[TYPE_ABBREV]-[INCREMENT].
 * Increment is 3-digit zero-padded based on current total sample count.
 */
export function generateSampleId(projectName, sampleType, currentSampleCount) {
  const initials = getProjectInitials(projectName);
  const typeAbbrev = getSampleTypeAbbrev(sampleType);
  if (!initials || !typeAbbrev) return '';
  const num = String((currentSampleCount || 0) + 1).padStart(3, '0');
  return `${initials}-${typeAbbrev}-${num}`;
}

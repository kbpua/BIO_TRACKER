import { getProjectInitials } from './sampleId';

/**
 * Extract 4-digit year from Start Date (YYYY-MM-DD or similar).
 */
function getStartYear(startDate) {
  if (!startDate) return '';
  const str = String(startDate).trim();
  if (str.length >= 4) return str.slice(0, 4);
  return '';
}

function getMaxIncrement(existingProjectsOrIds) {
  const list = Array.isArray(existingProjectsOrIds) ? existingProjectsOrIds : [];
  const re = /^[A-Z]{3}-\d{4}-(\d+)$/;
  let max = 0;
  for (const item of list) {
    const id = typeof item === 'string' ? item : item?.id;
    if (!id) continue;
    const m = String(id).match(re);
    if (!m) continue;
    const n = Number.parseInt(m[1], 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max;
}

/**
 * Generate project ID: [3-LETTER_INITIALS]-[START_YEAR]-[3-DIGIT_INCREMENT].
 * Increment is global (based on current projects present), so it keeps increasing
 * even when initials/year change.
 */
export function generateProjectId(projectName, startDate, existingProjectsOrCount) {
  const initials = getProjectInitials(projectName);
  const year = getStartYear(startDate);
  if (!initials || !year) return '';
  const next = typeof existingProjectsOrCount === 'number'
    ? (existingProjectsOrCount || 0) + 1
    : Math.max(
      ((Array.isArray(existingProjectsOrCount) ? existingProjectsOrCount.length : 0) + 1),
      (getMaxIncrement(existingProjectsOrCount) + 1)
    );
  const num = String(next).padStart(3, '0');
  return `${initials}-${year}-${num}`;
}

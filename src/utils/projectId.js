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

/**
 * Generate project ID: [3-LETTER_INITIALS]-[START_YEAR]-[3-DIGIT_INCREMENT].
 * Increment is based on total existing project count.
 */
export function generateProjectId(projectName, startDate, currentProjectCount) {
  const initials = getProjectInitials(projectName);
  const year = getStartYear(startDate);
  if (!initials || !year) return '';
  const num = String((currentProjectCount || 0) + 1).padStart(3, '0');
  return `${initials}-${year}-${num}`;
}

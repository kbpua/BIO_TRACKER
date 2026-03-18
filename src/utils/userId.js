const ROLE_CODES = {
  Admin: 'ADM',
  Researcher: 'RES',
  Student: 'STU',
};

/**
 * Three-letter uppercase role code.
 */
export function getRoleCode(role) {
  if (!role) return 'USR';
  return ROLE_CODES[role] || String(role).slice(0, 3).toUpperCase();
}

/**
 * First letter of each word in full name, uppercase.
 * e.g. "Dr. Maria Santos" → "DMS", "Ana Reyes" → "AR"
 */
export function getNameInitials(fullName) {
  if (!fullName || !String(fullName).trim()) return 'XX';
  const words = String(fullName).trim().split(/\s+/).filter((w) => w.length > 0);
  const letters = words.map((w) => {
    const match = w.match(/[a-zA-Z]/);
    return match ? match[0].toUpperCase() : w[0]?.toUpperCase() || '';
  }).filter(Boolean);
  return letters.length > 0 ? letters.join('') : 'XX';
}

/**
 * Generate user ID: [ROLE_CODE]-[NAME_INITIALS]-[3-DIGIT_INCREMENT].
 * Increment is based on total existing user count.
 */
export function generateUserId(role, fullName, currentUserCount) {
  const code = getRoleCode(role);
  const initials = getNameInitials(fullName);
  const num = String((currentUserCount || 0) + 1).padStart(3, '0');
  return `${code}-${initials}-${num}`;
}

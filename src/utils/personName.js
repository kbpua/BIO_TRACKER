/** Collapses whitespace for stable display-name comparisons. */
export function normalizePersonName(name) {
  return String(name || '').trim().replace(/\s+/g, ' ');
}

/** Case-insensitive comparison of two person display names. */
export function displayNamesEqual(a, b) {
  return normalizePersonName(a).toLowerCase() === normalizePersonName(b).toLowerCase();
}

/**
 * @param {{ fullName?: string, authId?: string }[]} users
 * @param {string} displayName
 * @returns {string | null} profiles.id (auth uid) or null
 */
export function resolveUserAuthIdFromDisplayName(users, displayName) {
  const needle = normalizePersonName(displayName);
  if (!needle) return null;
  const lower = needle.toLowerCase();
  const u = (users || []).find((x) => {
    if (displayNamesEqual(x?.fullName, displayName)) return true;
    if (x?.email && String(x.email).toLowerCase() === lower) return true;
    return false;
  });
  return u?.authId || null;
}

/** Hash target for /projects — scroll the pending co-researcher invitations panel into view. */
export const PENDING_CO_RESEARCHER_INVITES_HASH = 'pending-co-researcher-invites';

export const projectsPendingCoResearcherInvitesPath = `/projects#${PENDING_CO_RESEARCHER_INVITES_HASH}`;

/**
 * @param {{ status?: string, invitedTo?: string, invitedToUserId?: string | null }} invite
 * @param {{ authId?: string, fullName?: string, email?: string } | null | undefined} user
 */
export function isPendingCoResearcherInviteForUser(invite, user) {
  if (!invite || String(invite.status ?? '').toLowerCase() !== 'pending') return false;
  if (user?.authId && invite.invitedToUserId && invite.invitedToUserId === user.authId) return true;
  if (displayNamesEqual(invite.invitedTo, user?.fullName)) return true;
  if (user?.email && displayNamesEqual(invite.invitedTo, user.email)) return true;
  const ie = normalizePersonName(invite.invitedTo).toLowerCase();
  const ue = normalizePersonName(user?.email || '').toLowerCase();
  return Boolean(ie && ue && ie === ue);
}

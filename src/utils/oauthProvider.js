/**
 * True when this Supabase session was established with Google (or Google is linked).
 * Checks identities + iss: some redirects expose sparse app_metadata briefly.
 */
export function isGoogleAuthUser(sessionUser) {
  if (!sessionUser) return false;
  if (String(sessionUser.app_metadata?.provider || '').toLowerCase() === 'google') {
    return true;
  }
  const providers = sessionUser.app_metadata?.providers;
  if (Array.isArray(providers) && providers.some((p) => String(p).toLowerCase() === 'google')) {
    return true;
  }
  const identities = sessionUser.identities;
  if (Array.isArray(identities) && identities.some((i) => String(i?.provider || '').toLowerCase() === 'google')) {
    return true;
  }
  const iss = String(sessionUser.user_metadata?.iss || '').toLowerCase();
  if (iss.includes('accounts.google.com') || iss.includes('googleusercontent.com')) {
    return true;
  }
  return false;
}

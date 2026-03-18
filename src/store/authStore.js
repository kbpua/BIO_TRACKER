/**
 * Stores passwords for dynamically added users (registration + admin-created).
 * MOCK_USERS passwords are in mockData; only non-mock users use this store.
 */
const passwordsByEmail = {};

export function setUserPassword(email, password) {
  if (email) passwordsByEmail[email.toLowerCase()] = password;
}

export function getUserPassword(email) {
  return email ? passwordsByEmail[email.toLowerCase()] : undefined;
}

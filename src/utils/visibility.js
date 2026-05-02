import { displayNamesEqual } from './personName';

export const PUBLICATION_STATUSES = ['Draft', 'Published (limited)', 'Published (public)'];

export function getProjectPublicationStatus(project) {
  const v = project?.publicationStatus;
  if (v === 'Draft' || v === 'Published (limited)' || v === 'Published (public)') return v;
  // Backward compatibility for older rows/seeds before the new states.
  if (v === 'Published') return 'Published (public)';
  return 'Draft';
}

/** Short label for publication chips in tables; hover uses full status via `title`. */
export function formatPublicationStatusLabel(status) {
  if (status === 'Published (public)') return 'Public';
  if (status === 'Published (limited)') return 'Limited';
  if (status === 'Draft') return 'Draft';
  return status ?? '—';
}

export function isProjectPublished(project) {
  return getProjectPublicationStatus(project) !== 'Draft';
}

export function isProjectPubliclyPublished(project) {
  return getProjectPublicationStatus(project) === 'Published (public)';
}

export function isProjectLimitedPublished(project) {
  return getProjectPublicationStatus(project) === 'Published (limited)';
}

export function isUserOnProjectTeam(user, project) {
  if (!user || !project) return false;
  const name = user.fullName;
  if (!name) return false;
  if (displayNamesEqual(project.leadResearcher, name)) return true;
  if (Array.isArray(project.coResearchers) && project.coResearchers.some((n) => displayNamesEqual(n, name))) return true;
  return false;
}

/**
 * @param {{ role?: string, fullName?: string, authId?: string, email?: string } | null | undefined} user
 * @param {object | null | undefined} project
 * @param {{ projectId?: string, status?: string }[] | null | undefined} coResearcherInvites optional — when set, draft projects
 *   with a pending invite for this user are visible (so they can open the project and accept).
 */
export function canUserViewProject(user, project) {
  if (!project) return false;
  if (user?.role === 'Admin') return true;
  if (isProjectPubliclyPublished(project)) return true;
  if (isProjectLimitedPublished(project) && user?.role === 'Researcher') return true;
  if (user?.role === 'Researcher' && isUserOnProjectTeam(user, project)) return true;
  return false;
}

export function canUserChangeProjectPublication(user, project) {
  if (!project) return false;
  if (user?.role === 'Admin') return true;
  return user?.role === 'Researcher' && displayNamesEqual(project.leadResearcher, user?.fullName);
}

export function getVisibleProjects(projects, user, coResearcherInvites) {
  const list = Array.isArray(projects) ? projects : [];
  return list.filter((p) => canUserViewProject(user, p));
}

export function getVisibleSamples(samples, projects, user, coResearcherInvites) {
  const sList = Array.isArray(samples) ? samples : [];
  const pList = Array.isArray(projects) ? projects : [];
  const projectById = new Map(pList.map((p) => [p.id, p]));

  // Preserve source order from DataContext (already sorted newest to oldest).
  return sList
    .filter((s) => {
      const proj = projectById.get(s.projectId);
      // If project is missing from mock data, don't hide the sample (prototype resilience).
      if (!proj) return true;
      if (user?.role === 'Admin') return true;
      if (isProjectPublished(proj)) return true;
      return user?.role === 'Researcher' && canUserViewProject(user, proj);
    })
    .map((s) => s);
}

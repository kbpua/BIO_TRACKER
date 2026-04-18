import { displayNamesEqual, isPendingCoResearcherInviteForUser } from './personName';

export const PUBLICATION_STATUSES = ['Draft', 'Published'];

export function getProjectPublicationStatus(project) {
  const v = project?.publicationStatus;
  if (v === 'Published' || v === 'Draft') return v;
  return 'Draft';
}

export function isProjectPublished(project) {
  return getProjectPublicationStatus(project) === 'Published';
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
export function canUserViewProject(user, project, coResearcherInvites) {
  if (!project) return false;
  if (user?.role === 'Admin') return true;
  if (isProjectPublished(project)) return true;
  if (user?.role === 'Researcher' && isUserOnProjectTeam(user, project)) return true;
  if (
    user?.role === 'Researcher'
    && Array.isArray(coResearcherInvites)
    && coResearcherInvites.some(
      (inv) =>
        inv.projectId === project.id
        && String(inv.status ?? '').toLowerCase() === 'pending'
        && isPendingCoResearcherInviteForUser(inv, user)
    )
  ) {
    return true;
  }
  return false;
}

export function canUserChangeProjectPublication(user, project) {
  if (!project) return false;
  if (user?.role === 'Admin') return true;
  return user?.role === 'Researcher' && displayNamesEqual(project.leadResearcher, user?.fullName);
}

export function getVisibleProjects(projects, user, coResearcherInvites) {
  const list = Array.isArray(projects) ? projects : [];
  return list.filter((p) => canUserViewProject(user, p, coResearcherInvites));
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
      return user?.role === 'Researcher' && canUserViewProject(user, proj, coResearcherInvites);
    })
    .map((s) => s);
}

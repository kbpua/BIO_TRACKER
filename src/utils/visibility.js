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
  if (project.leadResearcher === name) return true;
  if (Array.isArray(project.coResearchers) && project.coResearchers.includes(name)) return true;
  return false;
}

export function canUserViewProject(user, project) {
  if (!project) return false;
  if (user?.role === 'Admin') return true;
  if (isProjectPublished(project)) return true;
  return user?.role === 'Researcher' && isUserOnProjectTeam(user, project);
}

export function canUserChangeProjectPublication(user, project) {
  if (!project) return false;
  if (user?.role === 'Admin') return true;
  return user?.role === 'Researcher' && project.leadResearcher === user?.fullName;
}

export function getVisibleProjects(projects, user) {
  const list = Array.isArray(projects) ? projects : [];
  return list.filter((p) => canUserViewProject(user, p));
}

export function getVisibleSamples(samples, projects, user) {
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
      return user?.role === 'Researcher' && isUserOnProjectTeam(user, proj);
    })
    .map((s) => s);
}


import { createContext, useContext, useState, useCallback } from 'react';
import {
  MOCK_ORGANISMS,
  MOCK_PROJECTS,
  MOCK_SAMPLES_INITIAL,
  MOCK_ACTIVITY_INITIAL,
  MOCK_USERS,
  MOCK_PENDING_REQUESTS_INITIAL,
  MOCK_CO_RESEARCHER_INVITES_INITIAL,
} from '../data/mockData';
import { setUserPassword } from '../store/authStore';
import { generateUserId } from '../utils/userId';
import { getProjectPublicationStatus } from '../utils/visibility';

const DataContext = createContext(null);

function generateId(prefix = 'id') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function isoFromHoursAgo(hoursAgo = 0) {
  const d = new Date();
  d.setHours(d.getHours() - Number(hoursAgo || 0));
  return d.toISOString();
}

export function DataProvider({ children }) {
  const [samples, setSamples] = useState(MOCK_SAMPLES_INITIAL);
  const [organisms, setOrganisms] = useState(MOCK_ORGANISMS);
  const [projects, setProjects] = useState(() =>
    (MOCK_PROJECTS || []).map((p) => ({ ...p, publicationStatus: getProjectPublicationStatus(p) }))
  );
  const [users, setUsers] = useState(MOCK_USERS.map((u) => ({ ...u, password: undefined })));
  const [activity, setActivity] = useState(MOCK_ACTIVITY_INITIAL);
  const [pendingRequests, setPendingRequests] = useState(MOCK_PENDING_REQUESTS_INITIAL);
  const [coResearcherInvites, setCoResearcherInvites] = useState(() =>
    (MOCK_CO_RESEARCHER_INVITES_INITIAL || []).map((inv) => ({
      ...inv,
      createdAt: inv.createdAt || isoFromHoursAgo(inv.hoursAgo),
    }))
  );

  const addSample = useCallback((sample) => {
    const newSample = {
      ...sample,
      id: sample.id || generateId('s'),
      sampleId: sample.sampleId || sample.sampleName,
    };
    setSamples((prev) => [...prev, newSample]);
    return newSample;
  }, []);

  const updateSample = useCallback((id, updates) => {
    setSamples((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...updates } : s))
    );
  }, []);

  const deleteSample = useCallback((id) => {
    setSamples((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const submitAddRequest = useCallback(({
    projectId,
    requestedBy,
    proposedSample,
    sampleId,
  }) => {
    const req = {
      id: generateId('pr'),
      projectId,
      type: 'add',
      requestedBy,
      sampleRecordId: null,
      sampleId,
      submittedAt: new Date().toISOString(),
      proposedSample,
    };
    setPendingRequests((prev) => [req, ...prev]);
    return req;
  }, []);

  const submitEditRequest = useCallback(({
    projectId,
    requestedBy,
    sampleRecordId,
    sampleId,
    proposedUpdates,
    changes,
  }) => {
    const req = {
      id: generateId('pr'),
      projectId,
      type: 'edit',
      requestedBy,
      sampleRecordId,
      sampleId,
      submittedAt: new Date().toISOString(),
      proposedUpdates,
      changes,
    };
    setPendingRequests((prev) => [req, ...prev]);
    return req;
  }, []);

  const submitDeleteRequest = useCallback(({
    projectId,
    requestedBy,
    sampleRecordId,
    sampleId,
    reason,
  }) => {
    const req = {
      id: generateId('pr'),
      projectId,
      type: 'delete',
      requestedBy,
      sampleRecordId,
      sampleId,
      submittedAt: new Date().toISOString(),
      reason,
    };
    setPendingRequests((prev) => [req, ...prev]);
    return req;
  }, []);

  const approvePendingRequest = useCallback((requestId) => {
    let approved = null;
    setPendingRequests((prev) => {
      const found = prev.find((r) => r.id === requestId);
      approved = found || null;
      return prev.filter((r) => r.id !== requestId);
    });
    if (!approved) return null;

    if (approved.type === 'add') {
      addSample(approved.proposedSample);
    } else if (approved.type === 'edit') {
      setSamples((prev) =>
        prev.map((s) => (s.id === approved.sampleRecordId ? { ...s, ...approved.proposedUpdates } : s))
      );
    } else if (approved.type === 'delete') {
      setSamples((prev) => prev.filter((s) => s.id !== approved.sampleRecordId));
    }

    return approved;
  }, [addSample]);

  const rejectPendingRequest = useCallback((requestId) => {
    let rejected = null;
    setPendingRequests((prev) => {
      const found = prev.find((r) => r.id === requestId);
      rejected = found || null;
      return prev.filter((r) => r.id !== requestId);
    });
    return rejected;
  }, []);

  const sendCoResearcherInvites = useCallback(({
    projectId,
    invitedBy,
    invitedToList,
  }) => {
    const now = new Date().toISOString();
    const created = [];
    setCoResearcherInvites((prev) => {
      const existingKeys = new Set(
        prev
          .filter((i) => i.projectId === projectId && i.status === 'Pending')
          .map((i) => `${i.projectId}::${i.invitedTo}`)
      );
      const next = [...prev];
      (invitedToList || []).forEach((invitedTo) => {
        const key = `${projectId}::${invitedTo}`;
        if (!invitedTo || existingKeys.has(key)) return;
        const invite = {
          id: generateId('inv'),
          projectId,
          invitedBy,
          invitedTo,
          status: 'Pending', // Pending | Accepted | Declined
          createdAt: now,
        };
        existingKeys.add(key);
        created.push(invite);
        next.unshift(invite);
      });
      return next;
    });
    return created;
  }, []);

  const respondToCoResearcherInvite = useCallback((inviteId, decision) => {
    let invite = null;
    setCoResearcherInvites((prev) => {
      const found = prev.find((i) => i.id === inviteId);
      if (!found) return prev;
      invite = found;
      // remove from list after response (prototype)
      return prev.filter((i) => i.id !== inviteId);
    });
    if (!invite) return null;

    if (decision === 'Accepted') {
      setProjects((prev) =>
        prev.map((p) => {
          if (p.id !== invite.projectId) return p;
          const current = Array.isArray(p.coResearchers) ? p.coResearchers : [];
          if (current.includes(invite.invitedTo)) return p;
          return { ...p, coResearchers: [...current, invite.invitedTo] };
        })
      );
    }

    return { ...invite, status: decision };
  }, []);

  const addActivity = useCallback((text) => {
    const timeAgo = 'Just now';
    setActivity((prev) => [{ id: generateId('a'), text, timeAgo }, ...prev.slice(0, 19)]);
  }, []);

  const addProject = useCallback((project) => {
    const newProject = {
      ...project,
      id: project.id || generateId('proj'),
      publicationStatus: getProjectPublicationStatus(project),
    };
    setProjects((prev) => [...prev, newProject]);
    return newProject;
  }, []);

  const updateProject = useCallback((id, updates) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates, publicationStatus: getProjectPublicationStatus({ ...p, ...updates }) } : p))
    );
  }, []);

  const deleteProject = useCallback((id) => {
    setProjects((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const addOrganism = useCallback((organism) => {
    const newOrg = { ...organism, id: organism.id || generateId('org') };
    setOrganisms((prev) => [...prev, newOrg]);
    return newOrg;
  }, []);

  const updateOrganism = useCallback((id, updates) => {
    const newId = updates.id !== undefined ? updates.id : id;
    setOrganisms((prev) =>
      prev.map((o) => (o.id === id ? { ...o, ...updates } : o))
    );
    if (newId !== id) {
      setSamples((prev) =>
        prev.map((s) => (s.organismId === id ? { ...s, organismId: newId } : s))
      );
    }
  }, []);

  const deleteOrganism = useCallback((id) => {
    setOrganisms((prev) => prev.filter((o) => o.id !== id));
  }, []);

  const updateUser = useCallback((id, updates) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === id ? { ...u, ...updates } : u))
    );
  }, []);

  const addUser = useCallback((userData) => {
    const { password, ...rest } = userData;
    setUsers((prev) => {
      const id = generateUserId(userData.role, userData.fullName, prev.length);
      const newUser = {
        ...rest,
        id,
        dateCreated: new Date().toISOString().split('T')[0],
        createdBy: userData.createdBy || 'Admin',
        pendingDaysRemaining: userData.pendingDaysRemaining,
      };
      if (password) setUserPassword(userData.email, password);
      return [...prev, newUser];
    });
    const id = generateUserId(userData.role, userData.fullName, users.length);
    return {
      ...rest,
      id,
      dateCreated: new Date().toISOString().split('T')[0],
      createdBy: userData.createdBy || 'Admin',
      pendingDaysRemaining: userData.pendingDaysRemaining,
    };
  }, [users.length]);

  const deleteUser = useCallback((id) => {
    setUsers((prev) => prev.filter((u) => u.id !== id));
  }, []);

  const pendingCount = users.filter((u) => u.status === 'Pending').length;

  const value = {
    samples,
    setSamples,
    organisms,
    projects,
    users,
    activity,
    pendingRequests,
    coResearcherInvites,
    addSample,
    updateSample,
    deleteSample,
    submitAddRequest,
    submitEditRequest,
    submitDeleteRequest,
    approvePendingRequest,
    rejectPendingRequest,
    sendCoResearcherInvites,
    respondToCoResearcherInvite,
    addActivity,
    addProject,
    updateProject,
    deleteProject,
    addOrganism,
    updateOrganism,
    deleteOrganism,
    updateUser,
    addUser,
    deleteUser,
    pendingCount,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}

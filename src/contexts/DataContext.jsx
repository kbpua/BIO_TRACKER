import { createContext, useContext, useState, useCallback } from 'react';
import {
  MOCK_ORGANISMS,
  MOCK_PROJECTS,
  MOCK_SAMPLES_INITIAL,
  MOCK_ACTIVITY_INITIAL,
  MOCK_USERS,
} from '../data/mockData';

const DataContext = createContext(null);

function generateId(prefix = 'id') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function DataProvider({ children }) {
  const [samples, setSamples] = useState(MOCK_SAMPLES_INITIAL);
  const [organisms, setOrganisms] = useState(MOCK_ORGANISMS);
  const [projects, setProjects] = useState(MOCK_PROJECTS);
  const [users, setUsers] = useState(MOCK_USERS.map((u) => ({ ...u, password: undefined })));
  const [activity, setActivity] = useState(MOCK_ACTIVITY_INITIAL);

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

  const addActivity = useCallback((text) => {
    const timeAgo = 'Just now';
    setActivity((prev) => [{ id: generateId('a'), text, timeAgo }, ...prev.slice(0, 19)]);
  }, []);

  const addProject = useCallback((project) => {
    const newProject = { ...project, id: project.id || generateId('proj') };
    setProjects((prev) => [...prev, newProject]);
    return newProject;
  }, []);

  const updateProject = useCallback((id, updates) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
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
    setOrganisms((prev) =>
      prev.map((o) => (o.id === id ? { ...o, ...updates } : o))
    );
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
    const { password: _, ...rest } = userData;
    const newUser = {
      ...rest,
      id: userData.id || generateId('u'),
      dateCreated: new Date().toISOString().split('T')[0],
      createdBy: userData.createdBy || 'Admin',
    };
    setUsers((prev) => [...prev, newUser]);
    return newUser;
  }, []);

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
    addSample,
    updateSample,
    deleteSample,
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

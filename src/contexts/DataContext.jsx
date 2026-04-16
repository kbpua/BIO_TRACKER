import { createContext, useContext, useState, useCallback, useEffect } from 'react';
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
import { generateUserId, getMaxUserIdIncrement } from '../utils/userId';
import { getProjectPublicationStatus } from '../utils/visibility';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { useAuth } from './AuthContext';

const DataContext = createContext(null);

function generateId(prefix = 'id') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function isoFromHoursAgo(hoursAgo = 0) {
  const d = new Date();
  d.setHours(d.getHours() - Number(hoursAgo || 0));
  return d.toISOString();
}

function trailingNumber(str) {
  const m = String(str || '').match(/(\d+)$/);
  return m ? parseInt(m[1], 10) : 0;
}

export function DataProvider({ children }) {
  const { user, isSupabaseAuth } = useAuth();
  const supabaseEnabled = isSupabaseConfigured() && isSupabaseAuth;
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
  const mapProjectRow = useCallback((row) => ({
    id: row.id,
    name: row.name,
    description: row.description || '',
    startDate: row.start_date || null,
    endDate: row.end_date || null,
    leadResearcher: row.lead_researcher,
    coResearchers: Array.isArray(row.co_researchers) ? row.co_researchers : [],
    status: row.status,
    publicationStatus: row.publication_status || getProjectPublicationStatus(row),
    approvedExporters: Array.isArray(row.approved_exporters) ? row.approved_exporters : [],
  }), []);

  const toProjectRow = useCallback((project) => ({
    id: project.id,
    name: project.name,
    description: project.description || null,
    start_date: project.startDate || null,
    end_date: project.endDate || null,
    lead_researcher: project.leadResearcher,
    co_researchers: project.coResearchers || [],
    status: project.status,
    publication_status: project.publicationStatus || getProjectPublicationStatus(project),
    approved_exporters: project.approvedExporters || [],
  }), []);

  const mapSampleRow = useCallback((row) => ({
    id: row.id,
    sampleId: row.sample_id,
    sampleName: row.sample_name || row.sample_id,
    disease: row.disease || '',
    organismId: row.organism_id,
    projectId: row.project_id,
    sampleType: row.sample_type,
    tissueSource: row.tissue_source || '',
    studyPurpose: row.study_purpose || '',
    collectionDate: row.collection_date || '',
    collectedBy: row.collected_by || '',
    storageLocation: row.storage_location || '',
    status: row.status,
    notes: row.notes || '',
  }), []);

  const toSampleRow = useCallback((sample) => ({
    id: sample.id,
    sample_id: sample.sampleId || sample.sampleName,
    sample_name: sample.sampleName || sample.sampleId || sample.sampleName,
    disease: sample.disease || null,
    organism_id: sample.organismId || null,
    project_id: sample.projectId,
    sample_type: sample.sampleType,
    tissue_source: sample.tissueSource || null,
    study_purpose: sample.studyPurpose || null,
    collection_date: sample.collectionDate || null,
    collected_by: sample.collectedBy || null,
    storage_location: sample.storageLocation || null,
    status: sample.status || 'Active',
    notes: sample.notes || '',
  }), []);

  const mapOrganismRow = useCallback((row) => ({
    id: row.id,
    scientificName: row.scientific_name,
    commonName: row.common_name || '',
    taxonomyId: row.taxonomy_id || '',
    kingdom: row.kingdom,
  }), []);

  const toOrganismRow = useCallback((organism) => ({
    id: organism.id,
    scientific_name: organism.scientificName,
    common_name: organism.commonName || null,
    taxonomy_id: organism.taxonomyId || null,
    kingdom: organism.kingdom,
  }), []);

  const mapProfileRow = useCallback((row) => ({
    id: row.legacy_id || row.id,
    authId: row.id,
    email: row.email || '',
    fullName: row.full_name || '',
    role: row.role,
    status: row.status,
    dateCreated: row.date_created || '',
    createdBy: row.created_by || '',
    pendingDaysRemaining: row.pending_days_remaining ?? undefined,
  }), []);

  const ensureProfileLegacyIds = useCallback(async (profileRows = []) => {
    if (!supabaseEnabled || !supabase || !Array.isArray(profileRows) || profileRows.length === 0) {
      return profileRows;
    }

    const usedLegacyIds = new Set(
      profileRows
        .map((row) => String(row?.legacy_id || '').trim())
        .filter(Boolean)
    );
    let maxIncrement = getMaxUserIdIncrement(Array.from(usedLegacyIds));

    const updateTasks = [];
    const normalizedRows = profileRows.map((row) => {
      if (row?.legacy_id) return row;

      let legacyId = generateUserId(row?.role || 'Student', row?.full_name || row?.email || 'User', maxIncrement);
      while (usedLegacyIds.has(legacyId)) {
        maxIncrement += 1;
        legacyId = generateUserId(row?.role || 'Student', row?.full_name || row?.email || 'User', maxIncrement);
      }
      usedLegacyIds.add(legacyId);
      maxIncrement += 1;
      updateTasks.push(
        supabase.from('profiles').update({ legacy_id: legacyId }).eq('id', row.id)
      );
      return { ...row, legacy_id: legacyId };
    });

    if (updateTasks.length > 0) {
      const results = await Promise.allSettled(updateTasks);
      results.forEach((result) => {
        if (result.status === 'fulfilled' && result.value?.error) {
          console.error('Failed to backfill legacy profile ID in Supabase:', result.value.error.message);
        }
      });
    }

    return normalizedRows;
  }, [supabaseEnabled]);

  useEffect(() => {
    if (!supabaseEnabled || !supabase || !user?.authId) return;
    let cancelled = false;

    const hydrate = async () => {
      const [
        { data: organismsRows },
        { data: projectRows },
        { data: sampleRows },
        { data: profileRows },
        { data: activityRows },
        { data: requestRows },
        { data: inviteRows },
      ] = await Promise.all([
        supabase.from('organisms').select('*').order('created_at', { ascending: false }),
        supabase.from('projects').select('*').order('created_at', { ascending: false }),
        supabase.from('samples').select('*').order('created_at', { ascending: false }),
        supabase.from('profiles').select('*').order('date_created', { ascending: false }),
        supabase.from('activity_log').select('*').order('created_at', { ascending: false }).limit(20),
        supabase.from('pending_requests').select('*').order('submitted_at', { ascending: false }),
        supabase.from('co_researcher_invites').select('*').order('created_at', { ascending: false }),
      ]);

      const normalizedProfiles = await ensureProfileLegacyIds(profileRows || []);

      if (cancelled) return;
      setOrganisms(
        (organismsRows || []).map(mapOrganismRow)
          .sort((a, b) => trailingNumber(b.id) - trailingNumber(a.id))
      );
      setProjects(
        (projectRows || []).map(mapProjectRow)
          .sort((a, b) => trailingNumber(b.id) - trailingNumber(a.id))
      );
      setSamples(
        (sampleRows || []).map(mapSampleRow)
          .sort((a, b) => trailingNumber(b.sampleId || b.id) - trailingNumber(a.sampleId || a.id))
      );
      setUsers(
        (normalizedProfiles || []).map(mapProfileRow)
          .sort((a, b) => trailingNumber(b.id) - trailingNumber(a.id))
      );
      setActivity(
        (activityRows || []).map((a) => ({
          id: a.id,
          text: a.text,
          timeAgo: a.created_at ? new Date(a.created_at).toLocaleString() : 'Just now',
        }))
      );
      setPendingRequests(
        (requestRows || []).map((r) => ({
          id: r.id,
          projectId: r.project_id,
          type: r.type,
          requestedBy: r.requested_by,
          sampleRecordId: r.sample_record_id,
          sampleId: r.sample_id,
          submittedAt: r.submitted_at,
          reason: r.reason,
          changes: r.changes || undefined,
          proposedUpdates: r.proposed_updates || undefined,
          proposedSample: r.proposed_sample || undefined,
        }))
      );
      setCoResearcherInvites(
        (inviteRows || []).map((inv) => ({
          id: inv.id,
          projectId: inv.project_id,
          invitedBy: inv.invited_by,
          invitedTo: inv.invited_to,
          status: inv.status,
          createdAt: inv.created_at,
        }))
      );
    };

    hydrate();
    return () => {
      cancelled = true;
    };
  }, [supabaseEnabled, user?.authId, mapOrganismRow, mapProjectRow, mapSampleRow, mapProfileRow, ensureProfileLegacyIds]);

  const addSample = useCallback((sample) => {
    const newSample = {
      ...sample,
      id: sample.id || generateId('s'),
      sampleId: sample.sampleId || sample.sampleName,
    };
    setSamples((prev) => [newSample, ...prev]);
    if (supabaseEnabled && supabase) {
      supabase.from('samples').insert(toSampleRow(newSample)).then(({ error }) => {
        if (error) console.error('Failed to add sample in Supabase:', error.message);
      });
    }
    return newSample;
  }, [supabaseEnabled, toSampleRow]);

  const updateSample = useCallback((id, updates) => {
    let next = null;
    setSamples((prev) => prev.map((s) => {
      if (s.id !== id) return s;
      next = { ...s, ...updates };
      return next;
    }));
    if (supabaseEnabled && supabase && next) {
      supabase.from('samples').update(toSampleRow(next)).eq('id', id).then(({ error }) => {
        if (error) console.error('Failed to update sample in Supabase:', error.message);
      });
    }
  }, [supabaseEnabled, toSampleRow]);

  const deleteSample = useCallback(async (id) => {
    if (supabaseEnabled && supabase) {
      const { error } = await supabase.from('samples').delete().eq('id', id);
      if (error) {
        console.error('Failed to delete sample in Supabase:', error.message);
        return false;
      }
    }
    setSamples((prev) => prev.filter((s) => s.id !== id));
    return true;
  }, [supabaseEnabled]);

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
    if (supabaseEnabled && supabase) {
      supabase.from('pending_requests').insert({
        id: req.id,
        project_id: req.projectId,
        type: req.type,
        requested_by: req.requestedBy,
        sample_record_id: req.sampleRecordId,
        sample_id: req.sampleId,
        submitted_at: req.submittedAt,
        proposed_sample: req.proposedSample || null,
      }).then(({ error }) => {
        if (error) console.error('Failed to save pending add request:', error.message);
      });
    }
    return req;
  }, [supabaseEnabled]);

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
    if (supabaseEnabled && supabase) {
      supabase.from('pending_requests').insert({
        id: req.id,
        project_id: req.projectId,
        type: req.type,
        requested_by: req.requestedBy,
        sample_record_id: req.sampleRecordId,
        sample_id: req.sampleId,
        submitted_at: req.submittedAt,
        proposed_updates: req.proposedUpdates || null,
        changes: req.changes || null,
      }).then(({ error }) => {
        if (error) console.error('Failed to save pending edit request:', error.message);
      });
    }
    return req;
  }, [supabaseEnabled]);

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
    if (supabaseEnabled && supabase) {
      supabase.from('pending_requests').insert({
        id: req.id,
        project_id: req.projectId,
        type: req.type,
        requested_by: req.requestedBy,
        sample_record_id: req.sampleRecordId,
        sample_id: req.sampleId,
        submitted_at: req.submittedAt,
        reason: req.reason || null,
      }).then(({ error }) => {
        if (error) console.error('Failed to save pending delete request:', error.message);
      });
    }
    return req;
  }, [supabaseEnabled]);

  const submitExportRequest = useCallback(({
    projectId,
    requestedBy,
  }) => {
    let created = null;
    const req = {
      id: generateId('pr'),
      projectId,
      type: 'export',
      requestedBy,
      submittedAt: new Date().toISOString(),
    };
    setPendingRequests((prev) => {
      const dup = prev.some(
        (r) => r.projectId === projectId && r.requestedBy === requestedBy && r.type === 'export'
      );
      if (dup) return prev;
      created = req;
      return [req, ...prev];
    });
    if (created && supabaseEnabled && supabase) {
      supabase.from('pending_requests').insert({
        id: created.id,
        project_id: created.projectId,
        type: created.type,
        requested_by: created.requestedBy,
        submitted_at: created.submittedAt,
      }).then(({ error }) => {
        if (error) console.error('Failed to save export request:', error.message);
      });
    }
    return created;
  }, [supabaseEnabled]);

  const submitCoResearcherInviteRequest = useCallback(({
    projectId,
    requestedBy,
    invitedToList,
  }) => {
    let created = null;
    const cleanInvitedToList = [...new Set((invitedToList || []).filter(Boolean))];
    if (cleanInvitedToList.length === 0) return null;
    const req = {
      id: generateId('pr'),
      projectId,
      type: 'coResearcherInvite',
      requestedBy,
      submittedAt: new Date().toISOString(),
      proposedUpdates: {
        invitedToList: cleanInvitedToList,
      },
    };
    setPendingRequests((prev) => {
      const dup = prev.some((r) => (
        r.projectId === projectId
        && r.requestedBy === requestedBy
        && r.type === 'coResearcherInvite'
        && Array.isArray(r.proposedUpdates?.invitedToList)
        && r.proposedUpdates.invitedToList.length === cleanInvitedToList.length
        && r.proposedUpdates.invitedToList.every((name) => cleanInvitedToList.includes(name))
      ));
      if (dup) return prev;
      created = req;
      return [req, ...prev];
    });
    if (created && supabaseEnabled && supabase) {
      supabase.from('pending_requests').insert({
        id: created.id,
        project_id: created.projectId,
        type: created.type,
        requested_by: created.requestedBy,
        submitted_at: created.submittedAt,
        proposed_updates: created.proposedUpdates || null,
      }).then(({ error }) => {
        if (error) console.error('Failed to save co-researcher invite request:', error.message);
      });
    }
    return created;
  }, [supabaseEnabled]);

  const createCoResearcherInvites = useCallback(({
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
          status: 'Pending',
          createdAt: now,
        };
        existingKeys.add(key);
        created.push(invite);
        next.unshift(invite);
      });
      return next;
    });
    if (created.length > 0 && supabaseEnabled && supabase) {
      supabase.from('co_researcher_invites').insert(
        created.map((inv) => ({
          id: inv.id,
          project_id: inv.projectId,
          invited_by: inv.invitedBy,
          invited_to: inv.invitedTo,
          status: inv.status,
          created_at: inv.createdAt,
        }))
      ).then(({ error }) => {
        if (error) console.error('Failed to save co-researcher invites:', error.message);
      });
    }
    return created;
  }, [supabaseEnabled]);

  const approvePendingRequest = useCallback((requestId) => {
    let approved = null;
    setPendingRequests((prev) => {
      const found = prev.find((r) => r.id === requestId);
      approved = found || null;
      return prev.filter((r) => r.id !== requestId);
    });
    if (supabaseEnabled && supabase) {
      supabase.from('pending_requests').delete().eq('id', requestId).then(({ error }) => {
        if (error) console.error('Failed to remove approved request:', error.message);
      });
    }
    if (!approved) return null;

    if (approved.type === 'export') {
      setProjects((prev) =>
        prev.map((p) => {
          if (p.id !== approved.projectId) return p;
          const cur = Array.isArray(p.approvedExporters) ? p.approvedExporters : [];
          if (cur.includes(approved.requestedBy)) return p;
          const updatedExporters = [...cur, approved.requestedBy];
          const updated = { ...p, approvedExporters: updatedExporters };
          if (supabaseEnabled && supabase) {
            supabase.from('projects')
              .update({ approved_exporters: updatedExporters })
              .eq('id', p.id)
              .then(({ error }) => {
                if (error) console.error('Failed to persist approved_exporters in Supabase:', error.message);
              });
          }
          return updated;
        })
      );
      return approved;
    }

    if (approved.type === 'coResearcherInvite') {
      createCoResearcherInvites({
        projectId: approved.projectId,
        invitedBy: approved.requestedBy,
        invitedToList: approved.proposedUpdates?.invitedToList || [],
      });
      return approved;
    }

    if (approved.type === 'add') {
      addSample(approved.proposedSample);
    } else if (approved.type === 'edit') {
      updateSample(approved.sampleRecordId, approved.proposedUpdates);
    } else if (approved.type === 'delete') {
      deleteSample(approved.sampleRecordId);
    }

    return approved;
  }, [addSample, updateSample, createCoResearcherInvites, deleteSample, supabaseEnabled]);

  const rejectPendingRequest = useCallback((requestId) => {
    let rejected = null;
    setPendingRequests((prev) => {
      const found = prev.find((r) => r.id === requestId);
      rejected = found || null;
      return prev.filter((r) => r.id !== requestId);
    });
    if (supabaseEnabled && supabase) {
      supabase.from('pending_requests').delete().eq('id', requestId).then(({ error }) => {
        if (error) console.error('Failed to remove rejected request:', error.message);
      });
    }
    return rejected;
  }, [supabaseEnabled]);

  const sendCoResearcherInvites = useCallback(({
    projectId,
    invitedBy,
    invitedToList,
  }) => createCoResearcherInvites({ projectId, invitedBy, invitedToList }), [createCoResearcherInvites]);

  const respondToCoResearcherInvite = useCallback((inviteId, decision) => {
    let invite = null;
    setCoResearcherInvites((prev) => {
      const found = prev.find((i) => i.id === inviteId);
      if (!found) return prev;
      invite = found;
      return prev.filter((i) => i.id !== inviteId);
    });
    if (supabaseEnabled && supabase) {
      supabase.from('co_researcher_invites').delete().eq('id', inviteId).then(({ error }) => {
        if (error) console.error('Failed to remove invite:', error.message);
      });
    }
    if (!invite) return null;

    if (decision === 'Accepted') {
      setProjects((prev) =>
        prev.map((p) => {
          if (p.id !== invite.projectId) return p;
          const current = Array.isArray(p.coResearchers) ? p.coResearchers : [];
          if (current.includes(invite.invitedTo)) return p;
          const updatedCoResearchers = [...current, invite.invitedTo];
          if (supabaseEnabled && supabase) {
            supabase.from('projects')
              .update({ co_researchers: updatedCoResearchers })
              .eq('id', invite.projectId)
              .then(({ error }) => {
                if (error) console.error('Failed to update co_researchers in Supabase:', error.message);
              });
          }
          return { ...p, coResearchers: updatedCoResearchers };
        })
      );
    }

    return { ...invite, status: decision };
  }, [supabaseEnabled]);

  const addActivity = useCallback((text) => {
    const timeAgo = 'Just now';
    setActivity((prev) => [{ id: generateId('a'), text, timeAgo }, ...prev.slice(0, 19)]);
    if (supabaseEnabled && supabase) {
      supabase.from('activity_log').insert({ text }).then(({ error }) => {
        if (error) console.error('Failed to save activity log:', error.message);
      });
    }
  }, [supabaseEnabled]);

  const addProject = useCallback((project) => {
    const newProject = {
      ...project,
      id: project.id || generateId('proj'),
      publicationStatus: getProjectPublicationStatus(project),
    };
    setProjects((prev) => [newProject, ...prev]);
    if (supabaseEnabled && supabase) {
      supabase.from('projects').insert(toProjectRow(newProject)).then(({ error }) => {
        if (error) console.error('Failed to add project in Supabase:', error.message);
      });
    }
    return newProject;
  }, [supabaseEnabled, toProjectRow]);

  const updateProject = useCallback((id, updates) => {
    let next = null;
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        next = { ...p, ...updates, publicationStatus: getProjectPublicationStatus({ ...p, ...updates }) };
        return next;
      })
    );
    if (supabaseEnabled && supabase && next) {
      supabase.from('projects').update(toProjectRow(next)).eq('id', id).then(({ error }) => {
        if (error) console.error('Failed to update project in Supabase:', error.message);
      });
    }
  }, [supabaseEnabled, toProjectRow]);

  const deleteProject = useCallback(async (id) => {
    if (supabaseEnabled && supabase) {
      // Project deletion is restricted by FK from samples.project_id,
      // so remove dependent samples first.
      const { error: sampleError } = await supabase.from('samples').delete().eq('project_id', id);
      if (sampleError) {
        console.error('Failed to delete project samples in Supabase:', sampleError.message);
        return false;
      }
      const { error } = await supabase.from('projects').delete().eq('id', id);
      if (error) {
        console.error('Failed to delete project in Supabase:', error.message);
        return false;
      }
    }
    setSamples((prev) => prev.filter((s) => s.projectId !== id));
    setProjects((prev) => prev.filter((p) => p.id !== id));
    return true;
  }, [supabaseEnabled]);

  const addOrganism = useCallback((organism) => {
    const newOrg = { ...organism, id: organism.id || generateId('org') };
    setOrganisms((prev) => [newOrg, ...prev]);
    if (supabaseEnabled && supabase) {
      supabase.from('organisms').insert(toOrganismRow(newOrg)).then(({ error }) => {
        if (error) console.error('Failed to add organism in Supabase:', error.message);
      });
    }
    return newOrg;
  }, [supabaseEnabled, toOrganismRow]);

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
    if (supabaseEnabled && supabase) {
      const rowUpdates = {};
      if (updates.scientificName !== undefined) rowUpdates.scientific_name = updates.scientificName;
      if (updates.commonName !== undefined) rowUpdates.common_name = updates.commonName || null;
      if (updates.taxonomyId !== undefined) rowUpdates.taxonomy_id = updates.taxonomyId || null;
      if (updates.kingdom !== undefined) rowUpdates.kingdom = updates.kingdom;
      if (Object.keys(rowUpdates).length > 0) {
        supabase.from('organisms').update(rowUpdates).eq('id', id).then(({ error }) => {
          if (error) console.error('Failed to update organism in Supabase:', error.message);
        });
      }
      if (newId !== id) {
        supabase.from('organisms').update({ id: newId }).eq('id', id).then(({ error }) => {
          if (error) console.error('Failed to update organism ID in Supabase:', error.message);
        });
      }
      if (newId !== id) {
        supabase.from('samples').update({ organism_id: newId }).eq('organism_id', id).then(({ error }) => {
          if (error) console.error('Failed to update sample organism references in Supabase:', error.message);
        });
      }
    }
  }, [supabaseEnabled]);

  const deleteOrganism = useCallback(async (id) => {
    if (supabaseEnabled && supabase) {
      // Organism deletion is restricted by FK from samples.organism_id,
      // so remove dependent samples first.
      const { error: sampleError } = await supabase.from('samples').delete().eq('organism_id', id);
      if (sampleError) {
        console.error('Failed to delete organism samples in Supabase:', sampleError.message);
        return false;
      }
      const { error } = await supabase.from('organisms').delete().eq('id', id);
      if (error) {
        console.error('Failed to delete organism in Supabase:', error.message);
        return false;
      }
    }
    setSamples((prev) => prev.filter((s) => s.organismId !== id));
    setOrganisms((prev) => prev.filter((o) => o.id !== id));
    return true;
  }, [supabaseEnabled]);

  const updateUser = useCallback(async (id, updates) => {
    const target = users.find((u) => u.id === id);
    if (!target) return false;
    const targetAuthId = target.authId || target.id;

    if (supabaseEnabled && supabase && targetAuthId) {
      const profileUpdates = {};
      if (updates.fullName !== undefined) profileUpdates.full_name = updates.fullName;
      if (updates.role !== undefined) profileUpdates.role = updates.role;
      if (updates.status !== undefined) profileUpdates.status = updates.status;
      if (updates.createdBy !== undefined) profileUpdates.created_by = updates.createdBy;
      if (updates.pendingDaysRemaining !== undefined) profileUpdates.pending_days_remaining = updates.pendingDaysRemaining;
      if (Object.keys(profileUpdates).length === 0) return true;
      const { error } = await supabase
        .from('profiles')
        .update(profileUpdates)
        .eq('id', targetAuthId);
      if (error) {
        console.error(`Failed to update user profile in Supabase (user ${id}):`, error.message);
        return false;
      }
    }

    setUsers((prev) =>
      prev.map((u) => (u.id === id ? { ...u, ...updates } : u))
    );
    return true;
  }, [supabaseEnabled, users]);

  const addUser = useCallback((userData) => {
    if (supabaseEnabled && supabase) {
      throw new Error('Creating users from this page is disabled in Supabase mode. Use the Register form so Auth users are created correctly.');
    }
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
      return [newUser, ...prev];
    });
    const id = generateUserId(userData.role, userData.fullName, users.length);
    return {
      ...rest,
      id,
      dateCreated: new Date().toISOString().split('T')[0],
      createdBy: userData.createdBy || 'Admin',
      pendingDaysRemaining: userData.pendingDaysRemaining,
    };
  }, [users.length, supabaseEnabled]);

  const deleteUser = useCallback(async (id) => {
    let targetAuthId = null;
    const target = users.find((u) => u.id === id);
    if (target) targetAuthId = target.authId || target.id;

    if (supabaseEnabled && supabase && targetAuthId) {
      const { data, error } = await supabase.rpc('admin_delete_user', { target_user_id: targetAuthId });
      if (error || !data) {
        console.error('Failed to delete auth user in Supabase:', error?.message || 'RPC returned false');
        return false;
      }
      setUsers((prev) => prev.filter((u) => u.id !== id));
      return true;
    }

    setUsers((prev) => prev.filter((u) => u.id !== id));
    return true;
  }, [supabaseEnabled, users]);

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
    submitExportRequest,
    submitCoResearcherInviteRequest,
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

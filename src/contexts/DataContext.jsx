import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
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
import { getProjectPublicationStatus, isProjectPubliclyPublished } from '../utils/visibility';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import {
  normalizePersonName,
  displayNamesEqual,
  resolveUserAuthIdFromDisplayName,
  projectsPendingCoResearcherInvitesPath,
  isPendingCoResearcherInviteForUser,
} from '../utils/personName';
import { useAuth } from './AuthContext';
import { useNotifications } from './NotificationContext';

const DataContext = createContext(null);

function mapPendingRequestType(type) {
  const s = String(type ?? '');
  if (/^coresearcherinvite$/i.test(s)) return 'coResearcherInvite';
  return s;
}

function pendingRequestTypeLabel(type) {
  const t = String(type ?? '').toLowerCase();
  if (t === 'add') return 'add';
  if (t === 'edit') return 'edit';
  if (t === 'delete') return 'delete';
  if (t === 'export') return 'export';
  return 'request';
}

function mapPendingRequestFromDb(r) {
  const resRaw = r.resolution;
  const resolution = resRaw != null && String(resRaw).trim() !== '' ? String(resRaw).trim() : null;
  const statusRaw = r.status;
  const status = statusRaw != null && String(statusRaw).trim() !== '' ? String(statusRaw).trim() : null;
  return {
    id: r.id,
    projectId: r.project_id,
    type: mapPendingRequestType(r.type),
    requestedBy: r.requested_by,
    requestedByUserId: r.requested_by_user_id || null,
    status,
    resolution,
    resolvedAt: r.resolved_at || null,
    sampleRecordId: r.sample_record_id,
    sampleId: r.sample_id,
    submittedAt: r.submitted_at,
    reason: r.reason,
    changes: r.changes || undefined,
    proposedUpdates: r.proposed_updates || undefined,
    proposedSample: r.proposed_sample || undefined,
  };
}

function compositeCoResearcherGraceKey(r) {
  if (!r || r.type !== 'coResearcherInvite') return null;
  const uid = r.requestedByUserId ? String(r.requestedByUserId) : '';
  const name = normalizePersonName(r.requestedBy).toLowerCase();
  return `pcr:${r.projectId}:${uid}:${name}`;
}

function clearGraceKeysForCoResearcher(graceUntilById, r, extraIds = []) {
  if (!graceUntilById) return;
  const ck = compositeCoResearcherGraceKey(r);
  if (ck) graceUntilById.delete(ck);
  extraIds.forEach((id) => {
    if (id == null || id === '') return;
    graceUntilById.delete(String(id).trim());
  });
}

function graceExpiryForCoResearcherRow(sr, graceUntilById) {
  const idUntil = graceUntilById.get(sr.id);
  const compKey = compositeCoResearcherGraceKey(sr);
  const compUntil = compKey ? graceUntilById.get(compKey) : null;
  const parts = [idUntil, compUntil].filter((t) => t != null);
  return parts.length ? Math.max(...parts) : null;
}

/**
 * While Supabase catches up (or realtime fires early), keep client-side resolution for co-researcher
 * rows so admin lists do not flicker back to "pending" after approve/reject.
 */
function mergePendingRequestsWithCoResearcherGrace(serverMapped, prevList, graceUntilById) {
  const prevById = new Map((prevList || []).map((r) => [r.id, r]));
  const now = Date.now();
  return serverMapped.map((sr) => {
    if (sr.type !== 'coResearcherInvite') return sr;
    if (sr.resolution) {
      clearGraceKeysForCoResearcher(graceUntilById, sr, [sr.id]);
      return sr;
    }
    const pr = prevById.get(sr.id);
    const until = graceExpiryForCoResearcherRow(sr, graceUntilById);
    if (pr?.resolution && until != null && now < until) {
      return { ...sr, resolution: pr.resolution, resolvedAt: pr.resolvedAt || null };
    }
    const ck = compositeCoResearcherGraceKey(sr);
    if (ck && until != null && now < until) {
      const prevMatch = (prevList || []).find(
        (p) => p.type === 'coResearcherInvite' && p.resolution && compositeCoResearcherGraceKey(p) === ck
      );
      if (prevMatch) {
        return { ...sr, resolution: prevMatch.resolution, resolvedAt: prevMatch.resolvedAt || null };
      }
    }
    if (until != null && now >= until) {
      clearGraceKeysForCoResearcher(graceUntilById, sr, [sr.id]);
    }
    return sr;
  });
}

/**
 * Updates resolution columns on a co-researcher pending row.
 * Tries by id first; if 0 rows (client id drift vs DB), matches by project + requester + unresolved invite.
 */
async function persistCoResearcherInviteResolution(supabaseClient, {
  requestId,
  projectId,
  requestedBy,
  requestedByUserId,
  payload,
}) {
  const rid = String(requestId || '').trim();
  let { data, error } = await supabaseClient
    .from('pending_requests')
    .update(payload)
    .eq('id', rid)
    .select('id');

  if (error) {
    return { data, error, matchedId: null };
  }
  if (data?.length) {
    return { data, error: null, matchedId: rid };
  }

  const { data: rows, error: selErr } = await supabaseClient
    .from('pending_requests')
    .select('id, type, requested_by, requested_by_user_id, resolution, submitted_at')
    .eq('project_id', projectId)
    .is('resolution', null)
    .order('submitted_at', { ascending: false })
    .limit(50);

  if (selErr) {
    return { data: [], error: selErr, matchedId: null };
  }

  const matches = (rows || []).filter((row) => {
    if (mapPendingRequestType(row.type) !== 'coResearcherInvite') return false;
    if (requestedByUserId && row.requested_by_user_id && row.requested_by_user_id === requestedByUserId) {
      return true;
    }
    return displayNamesEqual(row.requested_by, requestedBy);
  });

  const match = matches[0];
  if (!match?.id) {
    return { data: [], error: null, matchedId: null };
  }

  ({ data, error } = await supabaseClient
    .from('pending_requests')
    .update(payload)
    .eq('id', match.id)
    .select('id'));

  return { data, error, matchedId: match.id };
}

function mapCoResearcherInviteFromDb(inv) {
  const rawStatus = inv?.status;
  const s0 = rawStatus == null || rawStatus === '' ? 'Pending' : String(rawStatus);
  const status = ['Pending', 'Accepted', 'Declined', 'Cancelled'].includes(s0)
    ? s0
    : s0.charAt(0).toUpperCase() + s0.slice(1).toLowerCase();
  return {
    id: inv.id,
    projectId: inv.project_id,
    invitedBy: normalizePersonName(inv.invited_by),
    invitedTo: normalizePersonName(inv.invited_to),
    invitedToUserId: inv.invited_to_user_id || null,
    status,
    createdAt: inv.created_at,
  };
}

/** Stable key for “same invite” when merging server refresh with optimistic client rows. */
function coResearcherInviteMergeKey(inv) {
  const u = inv?.invitedToUserId ? String(inv.invitedToUserId).trim() : '';
  const n = normalizePersonName(inv?.invitedTo || '').toLowerCase();
  return `${String(inv?.projectId || '').trim()}::${u}::${n}`;
}

/**
 * Realtime / refresh can run before insert commits; keep short-lived client `inv-*` pending rows
 * that are not yet visible from Postgres so draft projects stay visible for invitees.
 */
function mergeCoResearcherInvitesServerWithOptimistic(inviteRows, prevInvites, mapFromDb) {
  const server = (inviteRows || []).map(mapFromDb);
  const serverIds = new Set(server.map((i) => String(i.id || '').trim()));
  const serverKeys = new Set(server.map(coResearcherInviteMergeKey));
  const merged = [...server];
  (prevInvites || []).forEach((p) => {
    if (String(p.status ?? '').toLowerCase() !== 'pending') return;
    const pid = String(p.id || '').trim();
    if (!pid || serverIds.has(pid)) return;
    if (serverKeys.has(coResearcherInviteMergeKey(p))) return;
    if (!/^inv-\d+/i.test(pid)) return;
    merged.push(p);
  });
  merged.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  return merged;
}

/** Rows for Supabase: only include `invited_to_user_id` when set (avoids PostgREST errors if the column is not migrated yet). */
function mapCoResearcherInvitesToDbRows(created, { includeUserIdColumn }) {
  return created.map((inv) => {
    const row = {
      id: inv.id,
      project_id: inv.projectId,
      invited_by: inv.invitedBy,
      invited_to: inv.invitedTo,
      status: inv.status,
      created_at: inv.createdAt,
    };
    if (includeUserIdColumn && inv.invitedToUserId) {
      row.invited_to_user_id = inv.invitedToUserId;
    }
    return row;
  });
}

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
  const { createNotification, createRoleNotification, refreshNotifications } = useNotifications();
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
  const coResearcherInvitesRef = useRef(coResearcherInvites);
  coResearcherInvitesRef.current = coResearcherInvites;
  const pendingRequestsRef = useRef(pendingRequests);
  pendingRequestsRef.current = pendingRequests;
  /** request id -> epoch ms until which we may overlay resolution if the server row is still unresolved */
  const coResearcherInviteResolutionGraceUntilRef = useRef(new Map());
  const invitesRequestsRealtimeTimerRef = useRef(null);
  /** Monotonic counter so only the latest in-flight invites/requests fetch may commit (avoids stale overwrites). */
  const refreshInvitesSeqRef = useRef(0);

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
    fullName: row.full_name || row.email || '',
    role: row.role,
    status: row.status,
    dateCreated: row.date_created || '',
    createdBy: row.created_by || '',
    pendingDaysRemaining: row.pending_days_remaining ?? undefined,
  }), []);

  const getUserByName = useCallback((fullName) => {
    const needle = normalizePersonName(fullName);
    if (!needle) return undefined;
    const byName = users.find((u) => displayNamesEqual(u.fullName, needle));
    if (byName) return byName;
    const lower = needle.toLowerCase();
    const byEmail = users.find((u) => u.email && u.email.toLowerCase() === lower);
    if (byEmail) return byEmail;
    return undefined;
  }, [users]);

  const notifyUserByName = useCallback(async ({
    fullName,
    type,
    title,
    description,
    linkTo,
    targetEntity,
    targetId,
  }) => {
    const needle = normalizePersonName(fullName);
    if (!needle) return false;

    let target = getUserByName(needle);
    if (!target?.authId && supabaseEnabled && supabase) {
      const { data: rows, error } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .ilike('full_name', needle)
        .limit(10);
      if (!error && Array.isArray(rows) && rows.length > 0) {
        const hit = rows.find((r) => displayNamesEqual(r.full_name, needle))
          || (rows.length === 1 ? rows[0] : null);
        if (hit?.id) target = { authId: hit.id };
      }
      if (!target?.authId && needle.includes('@')) {
        const { data: emailRows, error: emailErr } = await supabase
          .from('profiles')
          .select('id')
          .ilike('email', needle)
          .limit(2);
        if (!emailErr && emailRows?.length === 1) target = { authId: emailRows[0].id };
      }
    }

    if (!target?.authId) {
      console.warn('notifyUserByName: no profile match for', fullName);
      return false;
    }
    return createNotification({
      userId: target.authId,
      type,
      title,
      description,
      linkTo,
      targetEntity,
      targetId,
    });
  }, [createNotification, getUserByName, supabase, supabaseEnabled]);

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

  const refreshInvitesAndRequests = useCallback(async () => {
    if (!supabaseEnabled || !supabase) return;
    const mySeq = ++refreshInvitesSeqRef.current;
    const [{ data: requestRows, error: reqErr }, { data: inviteRows, error: invErr }] = await Promise.all([
      supabase.from('pending_requests').select('*').order('submitted_at', { ascending: false }),
      supabase.from('co_researcher_invites').select('*').order('created_at', { ascending: false }),
    ]);
    if (mySeq !== refreshInvitesSeqRef.current) return;
    if (reqErr) console.error('Failed to refresh pending requests:', reqErr.message);
    if (invErr) console.error('Failed to refresh co-researcher invites:', invErr.message);
    setPendingRequests((prev) => mergePendingRequestsWithCoResearcherGrace(
      (requestRows || []).map(mapPendingRequestFromDb),
      prev,
      coResearcherInviteResolutionGraceUntilRef.current,
    ));
    setCoResearcherInvites((prev) => mergeCoResearcherInvitesServerWithOptimistic(
      inviteRows,
      prev,
      mapCoResearcherInviteFromDb,
    ));
  }, [supabaseEnabled, supabase]);

  const scheduleInvitesAndRequestsRefreshFromRealtime = useCallback(() => {
    if (invitesRequestsRealtimeTimerRef.current != null) {
      window.clearTimeout(invitesRequestsRealtimeTimerRef.current);
    }
    invitesRequestsRealtimeTimerRef.current = window.setTimeout(() => {
      invitesRequestsRealtimeTimerRef.current = null;
      void refreshInvitesAndRequests();
    }, 550);
  }, [refreshInvitesAndRequests]);

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
      setPendingRequests((prev) => mergePendingRequestsWithCoResearcherGrace(
        (requestRows || []).map(mapPendingRequestFromDb),
        prev,
        coResearcherInviteResolutionGraceUntilRef.current,
      ));
      setCoResearcherInvites((inviteRows || []).map(mapCoResearcherInviteFromDb));
    };

    hydrate();
    return () => {
      cancelled = true;
    };
  }, [supabaseEnabled, user?.authId, mapOrganismRow, mapProjectRow, mapSampleRow, mapProfileRow, ensureProfileLegacyIds]);

  useEffect(() => {
    if (!supabaseEnabled || !supabase || !user?.authId) return undefined;

    const channel = supabase
      .channel(`data-invites-requests:${user.authId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'co_researcher_invites' }, () => {
        scheduleInvitesAndRequestsRefreshFromRealtime();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pending_requests' }, () => {
        scheduleInvitesAndRequestsRefreshFromRealtime();
      })
      .subscribe();

    return () => {
      if (invitesRequestsRealtimeTimerRef.current != null) {
        window.clearTimeout(invitesRequestsRealtimeTimerRef.current);
        invitesRequestsRealtimeTimerRef.current = null;
      }
      supabase.removeChannel(channel);
    };
  }, [supabaseEnabled, supabase, user?.authId, scheduleInvitesAndRequestsRefreshFromRealtime]);

  useEffect(() => {
    if (!supabaseEnabled || !supabase || !user?.authId) return undefined;
    const intervalMs = 15_000;
    const intervalId = window.setInterval(() => {
      void refreshInvitesAndRequests();
    }, intervalMs);
    const onFocus = () => {
      void refreshInvitesAndRequests();
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refreshInvitesAndRequests();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [supabaseEnabled, supabase, user?.authId, refreshInvitesAndRequests]);

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
    const project = projects.find((p) => p.id === newSample.projectId);
    if (project?.leadResearcher && user?.fullName && project.leadResearcher !== user.fullName) {
      notifyUserByName({
        fullName: project.leadResearcher,
        type: 'SAMPLE_EVENT',
        title: 'New Sample Added',
        description: `${user.fullName} added sample ${newSample.sampleId || newSample.id} to ${project.name}.`,
        linkTo: `/projects/${project.id}`,
        targetEntity: 'sample',
        targetId: newSample.id,
      });
    }
    return newSample;
  }, [notifyUserByName, projects, supabaseEnabled, toSampleRow, user?.fullName]);

  const updateSample = useCallback((id, updates) => {
    const current = samples.find((s) => s.id === id);
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
    if (next && current?.status !== next.status && (next.status === 'Expired' || next.status === 'Contaminated')) {
      const project = projects.find((p) => p.id === next.projectId);
      if (project?.leadResearcher) {
        notifyUserByName({
          fullName: project.leadResearcher,
          type: 'SAMPLE_EVENT',
          title: 'Sample Status Alert',
          description: `Your sample ${next.sampleId || next.id} has been marked as ${next.status}.`,
          linkTo: `/samples/${next.id}`,
          targetEntity: 'sample',
          targetId: next.id,
        });
      }
      createRoleNotification({
        role: 'Admin',
        type: 'SYSTEM_ALERT',
        title: 'At-risk Sample Alert',
        description: `Sample ${next.sampleId || next.id} has been marked as ${next.status}.`,
        linkTo: '/samples',
        targetEntity: 'sample',
        targetId: next.id,
      });
    }
  }, [createRoleNotification, notifyUserByName, projects, samples, supabaseEnabled, toSampleRow]);

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
    const project = projects.find((p) => p.id === projectId);
    if (project?.leadResearcher) {
      notifyUserByName({
        fullName: project.leadResearcher,
        type: 'APPROVAL_REQUEST',
        title: 'Pending Add Request',
        description: `${requestedBy} requested to add sample ${sampleId || 'record'} in ${project.name}.`,
        linkTo: `/projects/${projectId}`,
        targetEntity: 'project',
        targetId: projectId,
      });
    }
    return req;
  }, [notifyUserByName, projects, supabaseEnabled]);

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
    const project = projects.find((p) => p.id === projectId);
    if (project?.leadResearcher) {
      notifyUserByName({
        fullName: project.leadResearcher,
        type: 'APPROVAL_REQUEST',
        title: 'Pending Edit Request',
        description: `${requestedBy} requested an edit on sample ${sampleId || 'record'} in ${project.name}.`,
        linkTo: `/projects/${projectId}`,
        targetEntity: 'sample',
        targetId: sampleRecordId || sampleId || projectId,
      });
    }
    return req;
  }, [notifyUserByName, projects, supabaseEnabled]);

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
    const project = projects.find((p) => p.id === projectId);
    if (project?.leadResearcher) {
      notifyUserByName({
        fullName: project.leadResearcher,
        type: 'APPROVAL_REQUEST',
        title: 'Pending Delete Request',
        description: `${requestedBy} requested deletion of sample ${sampleId || 'record'} in ${project.name}.`,
        linkTo: `/projects/${projectId}`,
        targetEntity: 'sample',
        targetId: sampleRecordId || sampleId || projectId,
      });
    }
    return req;
  }, [notifyUserByName, projects, supabaseEnabled]);

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
        (r) =>
          r.projectId === projectId
          && r.requestedBy === requestedBy
          && r.type === 'export'
          && !r.resolution
          && (
            r.status == null
            || String(r.status).trim() === ''
            || String(r.status).toLowerCase() === 'pending'
          )
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
    if (created) {
      const project = projects.find((p) => p.id === projectId);
      if (project?.leadResearcher) {
        notifyUserByName({
          fullName: project.leadResearcher,
          type: 'APPROVAL_REQUEST',
          title: 'Pending Export Request',
          description: `${requestedBy} is requesting CSV export access on ${project.name}.`,
          linkTo: `/projects/${projectId}`,
          targetEntity: 'project',
          targetId: projectId,
        });
      }
    }
    return created;
  }, [notifyUserByName, projects, supabaseEnabled]);

  const createCoResearcherInvites = useCallback(async ({
    projectId,
    invitedBy,
    invitedToList,
    invitedToUserIds: invitedToUserIdsFromRequest,
    refreshAfterSupabase = true,
  }) => {
    const now = new Date().toISOString();
    const normalizedInvitedBy = normalizePersonName(invitedBy);
    const rawInvitedList = [...new Set((invitedToList || []).filter(Boolean))];
    const normalizedInvitedToList = [...new Set(rawInvitedList.map(normalizePersonName).filter(Boolean))];

    const idByNormalizedInvitee = new Map();
    rawInvitedList.forEach((raw, i) => {
      const k = normalizePersonName(raw);
      if (!k) return;
      const uid = Array.isArray(invitedToUserIdsFromRequest) ? invitedToUserIdsFromRequest[i] : null;
      if (uid) idByNormalizedInvitee.set(k.toLowerCase(), uid);
    });

    let lookupUsers = users || [];
    if (supabaseEnabled && supabase) {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id,legacy_id,email,full_name,role,status,date_created,created_by,pending_days_remaining')
          .in('role', ['Researcher', 'Admin'])
          .eq('status', 'Active');
        if (error) console.error('Failed to load profiles for co-researcher invites:', error.message);
        const merged = new Map();
        (users || []).forEach((u) => {
          if (u.authId) merged.set(u.authId, u);
        });
        (data || []).forEach((row) => {
          const u = mapProfileRow(row);
          if (u.authId && !merged.has(u.authId)) merged.set(u.authId, u);
        });
        lookupUsers = [...merged.values()];
      } catch (e) {
        console.error('Profile merge for co-researcher invites failed:', e);
      }
    }

    const prev = coResearcherInvitesRef.current;
    const existingKeys = new Set(
      prev
        .filter((i) => i.projectId === projectId && i.status === 'Pending')
        .map((i) => `${i.projectId}::${normalizePersonName(i.invitedTo).toLowerCase()}`)
    );
    const created = [];
    normalizedInvitedToList.forEach((invitedTo) => {
      const key = `${projectId}::${invitedTo.toLowerCase()}`;
      if (!invitedTo || existingKeys.has(key)) return;
      const invitedToUserId = idByNormalizedInvitee.get(invitedTo.toLowerCase())
        || resolveUserAuthIdFromDisplayName(lookupUsers, invitedTo);
      const invite = {
        id: generateId('inv'),
        projectId,
        invitedBy: normalizedInvitedBy,
        invitedTo,
        invitedToUserId,
        status: 'Pending',
        createdAt: now,
      };
      existingKeys.add(key);
      created.push(invite);
    });
    if (created.length === 0) return [];

    const next = [...created, ...prev];
    setCoResearcherInvites(next);
    coResearcherInvitesRef.current = next;

    if (supabaseEnabled && supabase) {
      const tryInsert = async (includeUserIdColumn) => {
        const { error } = await supabase
          .from('co_researcher_invites')
          .insert(mapCoResearcherInvitesToDbRows(created, { includeUserIdColumn }));
        return error;
      };
      let error = await tryInsert(true);
      if (error?.message && /invited_to_user_id/i.test(error.message)) {
        error = await tryInsert(false);
      }
      if (error) {
        console.error('Failed to save co-researcher invites:', error.message);
      } else if (refreshAfterSupabase) {
        await refreshInvitesAndRequests();
      }
    }

    const proj = projects.find((p) => p.id === projectId);
    const projectLabel = proj?.name || projectId;
    const inviteDescription = `${normalizedInvitedBy} invited you to join "${projectLabel}". Open Projects or this project’s page to accept or decline.`;
    created.forEach((inv) => {
      if (inv.invitedToUserId) {
        void createNotification({
          userId: inv.invitedToUserId,
          type: 'INVITE',
          title: 'Research collaboration invite',
          description: inviteDescription,
          linkTo: `/projects/${projectId}`,
          targetEntity: 'project',
          targetId: projectId,
        });
      } else {
        void notifyUserByName({
          fullName: inv.invitedTo,
          type: 'INVITE',
          title: 'Research collaboration invite',
          description: inviteDescription,
          linkTo: projectsPendingCoResearcherInvitesPath,
          targetEntity: 'project',
          targetId: projectId,
        });
      }
    });
    return created;
  }, [createNotification, mapProfileRow, notifyUserByName, projects, refreshInvitesAndRequests, supabase, supabaseEnabled, users]);

  // Compatibility wrapper for the previous request-based flow.
  // The admin approval gate has been removed; invitations now go directly to
  // the target researcher. Returns { ok, reason, created } so existing call
  // sites that branched on { ok, reason } continue to work.
  const submitCoResearcherInviteRequest = useCallback(async ({
    projectId,
    invitedBy,
    requestedBy,
    invitedToList,
  }) => {
    const cleanInvitedToList = [...new Set((invitedToList || []).filter(Boolean))];
    if (cleanInvitedToList.length === 0) return { ok: false, reason: 'empty' };

    const inviter = invitedBy || requestedBy || user?.fullName || 'Unknown';
    const created = await createCoResearcherInvites({
      projectId,
      invitedBy: inviter,
      invitedToList: cleanInvitedToList,
    });

    if (!Array.isArray(created) || created.length === 0) {
      return { ok: false, reason: 'duplicate' };
    }
    return { ok: true, reason: 'created', created };
  }, [createCoResearcherInvites, user?.fullName]);

  /**
   * Lead Researcher (or Admin) cancels a pending co-researcher invitation
   * they sent. The row is removed so it disappears from the target researcher's
   * Dashboard and Projects page. The invitee's pending INVITE notification for
   * this project is also cleaned up so cancel/re-invite cycles do not pile up
   * stale notifications. No new notification is sent on cancellation.
   */
  const cancelCoResearcherInvite = useCallback(async (inviteId) => {
    const iid = String(inviteId || '').trim();
    if (!iid) return false;
    const invite = coResearcherInvitesRef.current.find((i) => String(i.id || '').trim() === iid);
    if (!invite) return false;
    if (String(invite.status ?? '').toLowerCase() !== 'pending') return false;

    if (supabaseEnabled && supabase) {
      const { error } = await supabase.from('co_researcher_invites').delete().eq('id', iid);
      if (error) {
        console.error('Failed to cancel co-researcher invite:', error.message);
        return false;
      }
      if (invite.invitedToUserId && invite.projectId) {
        const { error: notifErr } = await supabase.rpc('delete_co_researcher_invite_notifications', {
          p_user_id: invite.invitedToUserId,
          p_project_id: invite.projectId,
        });
        if (notifErr) {
          console.error('Failed to clear invitee notifications after cancel:', notifErr.message);
        }
      }
    }
    setCoResearcherInvites((prev) => prev.filter((i) => String(i.id || '').trim() !== iid));
    return true;
  }, [supabaseEnabled]);

  const approvePendingRequest = useCallback((requestId) => {
    const rid = String(requestId || '').trim();
    // Snapshot before setState: React Strict Mode may run the state updater twice; mutating an outer
    // `approved` from inside the updater can leave it null and skip notifications while state still updates.
    const snapshot = pendingRequestsRef.current.find((r) => String(r.id || '').trim() === rid);
    if (!snapshot) return null;
    if (snapshot.type === 'coResearcherInvite' && snapshot.resolution) return null;

    setPendingRequests((prev) => {
      const found = prev.find((r) => String(r.id || '').trim() === rid);
      if (!found) return prev;
      if (found.type === 'coResearcherInvite' && found.resolution) return prev;
      if (found.type === 'coResearcherInvite') {
        const resolvedAt = new Date().toISOString();
        return prev.map((r) => (
          String(r.id || '').trim() === rid
            ? { ...r, resolution: 'approved', resolvedAt }
            : r
        ));
      }
      return prev.filter((r) => String(r.id || '').trim() !== rid);
    });

    const approved = snapshot;
    if (supabaseEnabled && supabase && approved && approved.type !== 'coResearcherInvite') {
      void supabase.from('pending_requests').delete().eq('id', rid).then(({ error }) => {
        if (error) console.error('Failed to remove approved request:', error.message);
      });
    }
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
      notifyUserByName({
        fullName: approved.requestedBy,
        type: 'APPROVAL_RESULT',
        title: 'Export Request Approved',
        description: `Your export request on ${approved.projectId} has been approved by ${user?.fullName || 'Lead Researcher'}.`,
        linkTo: `/projects/${approved.projectId}`,
        targetEntity: 'project',
        targetId: approved.projectId,
      });
      return approved;
    }

    if (approved.type === 'coResearcherInvite') {
      const graceUntil = Date.now() + 60_000;
      const graceMap = coResearcherInviteResolutionGraceUntilRef.current;
      graceMap.set(rid, graceUntil);
      const ckStart = compositeCoResearcherGraceKey(approved);
      if (ckStart) graceMap.set(ckStart, graceUntil);
      const inviteeList = Array.isArray(approved.proposedUpdates?.invitedToList)
        ? approved.proposedUpdates.invitedToList
        : [];
      const clearCoResearcherInviteGrace = (...ids) => {
        clearGraceKeysForCoResearcher(coResearcherInviteResolutionGraceUntilRef.current, approved, ids);
      };
      void (async () => {
        const resolvedAt = new Date().toISOString();
        if (supabaseEnabled && supabase) {
          const payload = { resolved_at: resolvedAt, resolution: 'approved' };
          const { data, error, matchedId } = await persistCoResearcherInviteResolution(supabase, {
            requestId: rid,
            projectId: approved.projectId,
            requestedBy: approved.requestedBy,
            requestedByUserId: approved.requestedByUserId,
            payload,
          });
          const idForDelete = matchedId || rid;
          if (error?.message && /resolved_at|resolution/i.test(error.message)) {
            const { error: delErr } = await supabase.from('pending_requests').delete().eq('id', idForDelete);
            if (!delErr) {
              setPendingRequests((prev) => prev.filter((r) => String(r.id || '').trim() !== String(idForDelete).trim()));
            } else {
              console.error('Failed to resolve co-researcher request in Supabase:', delErr.message);
            }
            clearCoResearcherInviteGrace(rid, idForDelete, matchedId);
            await refreshInvitesAndRequests();
            return;
          }
          if (error) {
            console.error('Failed to resolve co-researcher request in Supabase:', error.message);
            clearCoResearcherInviteGrace(rid, idForDelete, matchedId);
            await refreshInvitesAndRequests();
            return;
          }
          if (!data?.length) {
            console.warn(
              'Co-researcher approve: pending_requests update matched 0 rows (id + fallback).',
              { requestId: rid, projectId: approved.projectId, requestedBy: approved.requestedBy },
            );
            clearCoResearcherInviteGrace(rid, idForDelete, matchedId);
            await refreshInvitesAndRequests();
            return;
          }
          const bumpUntil = Date.now() + 60_000;
          const resolvedRowId = data?.[0]?.id != null ? String(data[0].id).trim() : idForDelete;
          graceMap.set(rid, bumpUntil);
          if (resolvedRowId) graceMap.set(resolvedRowId, bumpUntil);
          const ckOk = compositeCoResearcherGraceKey(approved);
          if (ckOk) graceMap.set(ckOk, bumpUntil);
        }
        const createdInvites = await createCoResearcherInvites({
          projectId: approved.projectId,
          invitedBy: normalizePersonName(approved.requestedBy),
          invitedToList: inviteeList,
          invitedToUserIds: Array.isArray(approved.proposedUpdates?.invitedToUserIds)
            ? approved.proposedUpdates.invitedToUserIds
            : undefined,
          refreshAfterSupabase: false,
        });
        await refreshInvitesAndRequests();
        const approverId = user?.authId;
        if (approverId && Array.isArray(createdInvites) && createdInvites.length > 0) {
          const names = createdInvites.map((c) => normalizePersonName(c.invitedTo)).filter(Boolean).join(', ');
          void createNotification({
            userId: approverId,
            type: 'APPROVAL_RESULT',
            title: 'Co-researcher invites sent',
            description: names
              ? `You approved the request. Invitations were sent to: ${names}.`
              : 'You approved the request. Invitations were sent.',
            linkTo: `/projects/${approved.projectId}`,
            targetEntity: 'project',
            targetId: approved.projectId,
          });
          void refreshNotifications();
        }
      })();
      const inviteeNames = inviteeList.join(', ');
      const approvalDescription = inviteeNames
        ? `Your request to add ${inviteeNames} has been approved. Invitations were sent to those researchers; they can accept on their Projects page.`
        : 'Your co-researcher request has been approved.';
      if (approved.requestedByUserId) {
        void createNotification({
          userId: approved.requestedByUserId,
          type: 'APPROVAL_RESULT',
          title: 'Co-Researcher Request Approved',
          description: approvalDescription,
          linkTo: `/projects/${approved.projectId}`,
          targetEntity: 'project',
          targetId: approved.projectId,
        });
      } else {
        void notifyUserByName({
          fullName: normalizePersonName(approved.requestedBy),
          type: 'APPROVAL_RESULT',
          title: 'Co-Researcher Request Approved',
          description: approvalDescription,
          linkTo: `/projects/${approved.projectId}`,
          targetEntity: 'project',
          targetId: approved.projectId,
        });
      }
      return approved;
    }

    if (approved.type === 'add') {
      addSample(approved.proposedSample);
    } else if (approved.type === 'edit') {
      updateSample(approved.sampleRecordId, approved.proposedUpdates);
    } else if (approved.type === 'delete') {
      deleteSample(approved.sampleRecordId);
    }

    notifyUserByName({
      fullName: approved.requestedBy,
      type: 'APPROVAL_RESULT',
      title: `${approved.type[0].toUpperCase()}${approved.type.slice(1)} Request Approved`,
      description: `Your ${approved.type} request on sample ${approved.sampleId || 'record'} has been approved by ${user?.fullName || 'Lead Researcher'}.`,
      linkTo: `/projects/${approved.projectId}`,
      targetEntity: 'sample',
      targetId: approved.sampleRecordId || approved.sampleId || approved.projectId,
    });
    return approved;
  }, [addSample, createCoResearcherInvites, createNotification, deleteSample, notifyUserByName, refreshInvitesAndRequests, refreshNotifications, supabase, supabaseEnabled, updateSample, user?.authId, user?.fullName]);

  const rejectPendingRequest = useCallback((requestId) => {
    const rid = String(requestId || '').trim();
    const snapshot = pendingRequestsRef.current.find((r) => String(r.id || '').trim() === rid);
    if (!snapshot) return null;
    if (snapshot.type === 'coResearcherInvite' && snapshot.resolution) return null;

    setPendingRequests((prev) => {
      const found = prev.find((r) => String(r.id || '').trim() === rid);
      if (!found) return prev;
      if (found.type === 'coResearcherInvite' && found.resolution) return prev;
      if (found.type === 'coResearcherInvite') {
        const resolvedAt = new Date().toISOString();
        return prev.map((r) => (
          String(r.id || '').trim() === rid
            ? { ...r, resolution: 'rejected', resolvedAt }
            : r
        ));
      }
      return prev.filter((r) => String(r.id || '').trim() !== rid);
    });

    const rejected = snapshot;
    if (rejected?.type === 'coResearcherInvite') {
      const until = Date.now() + 60_000;
      const gm = coResearcherInviteResolutionGraceUntilRef.current;
      gm.set(rid, until);
      const ck0 = compositeCoResearcherGraceKey(rejected);
      if (ck0) gm.set(ck0, until);
    }
    if (supabaseEnabled && supabase && rejected) {
      if (rejected.type === 'coResearcherInvite') {
        const payload = {
          resolved_at: new Date().toISOString(),
          resolution: 'rejected',
        };
        const clearCoResearcherInviteGrace = (...ids) => {
          clearGraceKeysForCoResearcher(coResearcherInviteResolutionGraceUntilRef.current, rejected, ids);
        };
        void (async () => {
          const { data, error, matchedId } = await persistCoResearcherInviteResolution(supabase, {
            requestId: rid,
            projectId: rejected.projectId,
            requestedBy: rejected.requestedBy,
            requestedByUserId: rejected.requestedByUserId,
            payload,
          });
          const idForDelete = matchedId || rid;
          if (error?.message && /resolved_at|resolution/i.test(error.message)) {
            const { error: delErr } = await supabase.from('pending_requests').delete().eq('id', idForDelete);
            if (!delErr) {
              setPendingRequests((prev) => prev.filter((r) => String(r.id || '').trim() !== String(idForDelete).trim()));
            }
            clearCoResearcherInviteGrace(rid, idForDelete, matchedId);
          } else if (error) {
            console.error('Failed to resolve co-researcher rejection in Supabase:', error.message);
            clearCoResearcherInviteGrace(rid, idForDelete, matchedId);
          } else if (!data?.length) {
            console.warn(
              'Co-researcher reject: pending_requests update matched 0 rows (id + fallback).',
              { requestId: rid, projectId: rejected.projectId, requestedBy: rejected.requestedBy },
            );
            clearCoResearcherInviteGrace(rid, idForDelete, matchedId);
          } else {
            const bumpUntil = Date.now() + 60_000;
            const graceMap = coResearcherInviteResolutionGraceUntilRef.current;
            const resolvedRowId = data?.[0]?.id != null ? String(data[0].id).trim() : idForDelete;
            graceMap.set(rid, bumpUntil);
            if (resolvedRowId) graceMap.set(resolvedRowId, bumpUntil);
            const ckOk = compositeCoResearcherGraceKey(rejected);
            if (ckOk) graceMap.set(ckOk, bumpUntil);
          }
          await refreshInvitesAndRequests();
        })();
      } else {
        void supabase.from('pending_requests').delete().eq('id', rid).then(({ error }) => {
          if (error) console.error('Failed to remove rejected request:', error.message);
        });
      }
    }
    if (rejected) {
      const notifyReject = (payload) => {
        if (rejected.requestedByUserId) {
          void createNotification({
            userId: rejected.requestedByUserId,
            type: 'APPROVAL_RESULT',
            ...payload,
          });
        } else {
          void notifyUserByName({
            fullName: normalizePersonName(rejected.requestedBy),
            type: 'APPROVAL_RESULT',
            ...payload,
          });
        }
      };

      if (rejected.type === 'coResearcherInvite') {
        const invitees = Array.isArray(rejected.proposedUpdates?.invitedToList)
          ? rejected.proposedUpdates.invitedToList.join(', ')
          : '';
        notifyReject({
          title: 'Co-Researcher Request Declined',
          description: invitees
            ? `Your request to add ${invitees} was declined. No invitations were sent.`
            : 'Your co-researcher request was declined.',
          linkTo: `/projects/${rejected.projectId}`,
          targetEntity: 'project',
          targetId: rejected.projectId,
        });
      } else {
        notifyReject({
          title: `${rejected.type[0].toUpperCase()}${rejected.type.slice(1)} Request Rejected`,
          description: `Your ${rejected.type} request on sample ${rejected.sampleId || 'record'} was rejected by ${user?.fullName || 'Lead Researcher'}.`,
          linkTo: `/projects/${rejected.projectId}`,
          targetEntity: 'sample',
          targetId: rejected.sampleRecordId || rejected.sampleId || rejected.projectId,
        });
      }
    }
    return rejected;
  }, [createNotification, notifyUserByName, refreshInvitesAndRequests, supabase, supabaseEnabled, user?.fullName]);

  const sendCoResearcherInvites = useCallback(({
    projectId,
    invitedBy,
    invitedToList,
  }) => createCoResearcherInvites({ projectId, invitedBy, invitedToList }), [createCoResearcherInvites]);

  const respondToCoResearcherInvite = useCallback(async (inviteId, decision) => {
    const iid = String(inviteId || '').trim();
    const invite = coResearcherInvitesRef.current.find((i) => String(i.id || '').trim() === iid);
    if (!invite) return null;

    const actorLabel = normalizePersonName(
      user?.fullName
        || (user?.authId && invite.invitedToUserId && user.authId === invite.invitedToUserId
          ? users.find((u) => u.authId === invite.invitedToUserId)?.fullName
          : '')
        || invite.invitedTo,
    );

    if (decision === 'Declined') {
      if (supabaseEnabled && supabase) {
        const { error } = await supabase.from('co_researcher_invites').delete().eq('id', iid);
        if (error) {
          console.error('Failed to remove invite:', error.message);
          return null;
        }
        // Clear the invitee's own pending INVITE notification so it does not
        // linger in their bell after they have responded.
        if (user?.authId && invite.projectId) {
          const { error: notifErr } = await supabase.rpc('delete_co_researcher_invite_notifications', {
            p_user_id: user.authId,
            p_project_id: invite.projectId,
          });
          if (notifErr) {
            console.error('Failed to clear own invite notifications after decline:', notifErr.message);
          }
        }
      }
      setCoResearcherInvites((prev) => prev.filter((i) => String(i.id || '').trim() !== iid));
      void notifyUserByName({
        fullName: invite.invitedBy,
        type: 'INVITE',
        title: 'Invite declined',
        description: `${actorLabel} declined your invite to collaborate on this project.`,
        linkTo: `/projects/${invite.projectId}`,
        targetEntity: 'project',
        targetId: invite.projectId,
      });
      void refreshNotifications();
      return { ...invite, status: decision };
    }

    if (decision !== 'Accepted') return null;

    let nameToAdd;
    const authMatchesInvitee =
      Boolean(user?.authId && invite.invitedToUserId && user.authId === invite.invitedToUserId);
    if (authMatchesInvitee) {
      const fromProfile = users.find((u) => u.authId === invite.invitedToUserId)?.fullName;
      nameToAdd = normalizePersonName(user?.fullName || fromProfile || invite.invitedTo);
    } else if (user && isPendingCoResearcherInviteForUser(invite, user) && user.fullName) {
      nameToAdd = normalizePersonName(user.fullName);
    } else if (invite.invitedToUserId) {
      const profile = users.find((u) => u.authId === invite.invitedToUserId);
      nameToAdd = normalizePersonName(profile?.fullName || invite.invitedTo);
    } else {
      nameToAdd = normalizePersonName(invite.invitedTo);
    }

    const projectBefore = projects.find((p) => p.id === invite.projectId);
    if (!projectBefore) return null;
    const projectName = projectBefore.name || invite.projectId;
    const currentCoResearchers = Array.isArray(projectBefore.coResearchers)
      ? projectBefore.coResearchers
      : [];
    const updatedCoResearchers = currentCoResearchers.some((n) => displayNamesEqual(n, nameToAdd))
      ? currentCoResearchers
      : [...currentCoResearchers, nameToAdd];
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id !== invite.projectId) return p;
        const already = Array.isArray(p.coResearchers)
          && p.coResearchers.some((n) => displayNamesEqual(n, nameToAdd));
        if (already) return p;
        return { ...p, coResearchers: updatedCoResearchers };
      })
    );

    if (supabaseEnabled && supabase) {
      const { error } = await supabase
        .from('projects')
        .update({ co_researchers: updatedCoResearchers })
        .eq('id', invite.projectId);
      if (error) {
        console.error('Failed to update co_researchers in Supabase:', error.message);
        setProjects((prev) =>
          prev.map((p) => {
            if (p.id !== invite.projectId) return p;
            const c = Array.isArray(p.coResearchers) ? p.coResearchers : [];
            return { ...p, coResearchers: c.filter((n) => !displayNamesEqual(n, nameToAdd)) };
          })
        );
        return null;
      }
    }

    setCoResearcherInvites((prev) => prev.filter((i) => String(i.id || '').trim() !== iid));
    if (supabaseEnabled && supabase) {
      const { error: delErr } = await supabase.from('co_researcher_invites').delete().eq('id', iid);
      if (delErr) {
        console.error('Failed to remove invite after accept:', delErr.message);
      }
      // Clear the invitee's own pending INVITE notification so it does not
      // linger in their bell after they have responded.
      if (user?.authId && invite.projectId) {
        const { error: notifErr } = await supabase.rpc('delete_co_researcher_invite_notifications', {
          p_user_id: user.authId,
          p_project_id: invite.projectId,
        });
        if (notifErr) {
          console.error('Failed to clear own invite notifications after accept:', notifErr.message);
        }
      }
    }

    void notifyUserByName({
      fullName: invite.invitedBy,
      type: 'INVITE',
      title: 'Invite accepted',
      description: `${actorLabel} accepted your invite to collaborate on “${projectName}”.`,
      linkTo: `/projects/${invite.projectId}`,
      targetEntity: 'project',
      targetId: invite.projectId,
    });

    if (user?.authId) {
      void createNotification({
        userId: user.authId,
        type: 'APPROVAL_RESULT',
        title: 'Co-researcher access granted',
        description: `You accepted the invitation. You are now a co-researcher on “${projectName}”.`,
        linkTo: `/projects/${invite.projectId}`,
        targetEntity: 'project',
        targetId: invite.projectId,
      });
      void refreshNotifications();
    }

    return { ...invite, status: decision };
  }, [createNotification, notifyUserByName, projects, refreshNotifications, supabase, supabaseEnabled, user, users]);

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
        if (error) {
          console.error('Failed to add project in Supabase:', error.message);
          // Roll back optimistic local insert so UI matches persisted DB state.
          setProjects((prev) => prev.filter((p) => p.id !== newProject.id));
          try {
            window.dispatchEvent(
              new CustomEvent('biosample_flash', {
                detail: {
                  message: `Failed to save project to database: ${error.message}`,
                  variant: 'error',
                },
              })
            );
          } catch {}
        }
      });
    }
    return newProject;
  }, [supabaseEnabled, toProjectRow]);

  const updateProject = useCallback((id, updates) => {
    const currentProject = projects.find((p) => p.id === id);
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
    if (
      currentProject
      && next
      && currentProject.publicationStatus !== next.publicationStatus
      && (
        next.publicationStatus === 'Published (public)'
        || next.publicationStatus === 'Published (limited)'
        || next.publicationStatus === 'Draft'
      )
    ) {
      const statusWord = next.publicationStatus === 'Draft'
        ? 'Unpublished'
        : next.publicationStatus === 'Published (limited)'
          ? 'Published (limited)'
          : 'Published (public)';
      const recipients = [next.leadResearcher, ...(next.coResearchers || [])];
      recipients.filter(Boolean).forEach((name) => {
        notifyUserByName({
          fullName: name,
          type: 'PROJECT_EVENT',
          title: `Project ${statusWord}`,
          description: `${next.name} has been ${statusWord.toLowerCase()} by ${user?.fullName || next.leadResearcher}.`,
          linkTo: `/projects/${id}`,
          targetEntity: 'project',
          targetId: id,
        });
      });
      if (isProjectPubliclyPublished(next)) {
        createRoleNotification({
          role: 'Student',
          type: 'PROJECT_EVENT',
          title: 'New Published Project',
          description: `${next.name} by ${next.leadResearcher} has been published. Click to explore.`,
          linkTo: `/projects/${id}`,
          targetEntity: 'project',
          targetId: id,
        });
      }
    }
  }, [createRoleNotification, notifyUserByName, projects, supabaseEnabled, toProjectRow, user?.fullName]);

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
    if (targetAuthId && target.status === 'Pending' && updates.status === 'Active') {
      await createNotification({
        userId: targetAuthId,
        type: 'ACCOUNT',
        title: 'Account Approved',
        description: 'Your account has been approved. You can now log in and access the system.',
        linkTo: '/dashboard',
        targetEntity: 'user',
        targetId: targetAuthId,
      });
    }
    return true;
  }, [createNotification, supabaseEnabled, users]);

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

  const removeCoResearcherFromProject = useCallback(async (projectId, coResearcherFullName) => {
    const pid = String(projectId || '').trim();
    const removedNorm = normalizePersonName(coResearcherFullName);
    if (!pid || !removedNorm) return { ok: false, error: 'Missing project or co-researcher.' };

    const project = projects.find((p) => p.id === pid);
    if (!project) return { ok: false, error: 'Project not found.' };

    const isAdminUser = user?.role === 'Admin';
    const isLead = displayNamesEqual(project.leadResearcher, user?.fullName);
    if (!isAdminUser && !isLead) {
      return { ok: false, error: 'Only the lead researcher or an admin can remove co-researchers.' };
    }

    if (displayNamesEqual(removedNorm, project.leadResearcher)) {
      return { ok: false, error: 'The lead researcher cannot be removed from co-researchers.' };
    }

    const coList = Array.isArray(project.coResearchers) ? project.coResearchers : [];
    if (!coList.some((n) => displayNamesEqual(n, removedNorm))) {
      return { ok: false, error: 'This person is not listed as a co-researcher.' };
    }

    const updatedCo = coList.filter((n) => !displayNamesEqual(n, removedNorm));
    const projectName = project.name || pid;
    const actorName = user?.fullName || 'Administrator';

    const cancellableTypes = new Set(['add', 'edit', 'delete', 'export']);
    const toCancel = pendingRequestsRef.current.filter(
      (r) =>
        String(r.projectId || '').trim() === pid
        && displayNamesEqual(r.requestedBy, removedNorm)
        && !r.resolution
        && cancellableTypes.has(String(r.type ?? '').toLowerCase())
    );

    const idsToRemove = [...new Set(toCancel.map((r) => String(r.id || '').trim()).filter(Boolean))];

    if (idsToRemove.length > 0) {
      setPendingRequests((prev) => prev.filter((r) => !idsToRemove.includes(String(r.id || '').trim())));
      if (supabaseEnabled && supabase) {
        const { error } = await supabase.from('pending_requests').delete().in('id', idsToRemove);
        if (error) console.error('Failed to delete cancelled pending requests:', error.message);
      }
    }

    updateProject(pid, { coResearchers: updatedCo });

    for (const req of toCancel) {
      const tw = pendingRequestTypeLabel(req.type);
      void notifyUserByName({
        fullName: removedNorm,
        type: 'APPROVAL_RESULT',
        title: 'Request cancelled',
        description: `Your ${tw} request on ${projectName} has been cancelled because you were removed from the project.`,
        linkTo: '/projects',
        targetEntity: 'project',
        targetId: pid,
      });
    }

    void notifyUserByName({
      fullName: removedNorm,
      type: 'PROJECT_EVENT',
      title: 'Removed from Project',
      description: `You have been removed from ${projectName} by ${actorName}. You no longer have Co-Researcher access to this project.`,
      linkTo: '/projects',
      targetEntity: 'project',
      targetId: pid,
    });

    addActivity(`${actorName} removed ${removedNorm} from ${projectName}.`);

    await refreshInvitesAndRequests();
    await refreshNotifications();

    return { ok: true };
  }, [
    addActivity,
    notifyUserByName,
    projects,
    refreshInvitesAndRequests,
    refreshNotifications,
    supabase,
    supabaseEnabled,
    updateProject,
    user?.fullName,
    user?.role,
  ]);

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
    refreshInvitesAndRequests,
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
    cancelCoResearcherInvite,
    respondToCoResearcherInvite,
    removeCoResearcherFromProject,
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

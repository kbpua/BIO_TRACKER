import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList } from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { getVisibleProjects, getVisibleSamples } from '../utils/visibility';

function StatCard({ label, value, tone = 'mint' }) {
  const toneStyles = {
    mint: 'border-mint-200 bg-white text-mint-900',
    amber: 'border-amber-200 bg-amber-50/70 text-amber-900',
    rose: 'border-rose-200 bg-rose-50/70 text-rose-900',
  };
  return (
    <div className={`rounded-xl border p-4 shadow-sm ${toneStyles[tone] || toneStyles.mint}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}

function ActionCard({ title, count, to, detail, tone = 'mint' }) {
  const toneStyles = {
    mint: 'border-mint-200 hover:border-mint-300 hover:bg-mint-50/60',
    amber: 'border-amber-300 bg-amber-50/40 hover:bg-amber-50',
    rose: 'border-rose-300 bg-rose-50/40 hover:bg-rose-50',
  };
  return (
    <Link
      to={to}
      className={`rounded-xl border p-4 shadow-sm transition-colors ${toneStyles[tone] || toneStyles.mint}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">{title}</p>
          <p className="text-xs text-gray-500 mt-1">{detail}</p>
        </div>
        <span className="text-2xl font-bold text-gray-900">{count}</span>
      </div>
    </Link>
  );
}

const STATUS_COLORS = {
  Active: '#22c55e',
  Used: '#3b82f6',
  Expired: '#f59e0b',
  Contaminated: '#ef4444',
};

function parseActivityDaysAgo(timeAgo, index) {
  const raw = String(timeAgo || '').toLowerCase().trim();
  if (!raw) return Math.min(index, 29);
  if (raw.includes('just now') || raw.includes('hour')) return 0;
  const dayMatch = raw.match(/(\d+)\s*day/);
  if (dayMatch) return Number(dayMatch[1]);
  const weekMatch = raw.match(/(\d+)\s*week/);
  if (weekMatch) return Number(weekMatch[1]) * 7;
  return Math.min(index, 29);
}

function toShortDate(date) {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function relativeTimeFromIso(isoString) {
  if (!isoString) return 'just now';
  const created = new Date(isoString);
  if (Number.isNaN(created.getTime())) return 'just now';
  const diffMs = Math.max(0, Date.now() - created.getTime());
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function splitActivityText(text) {
  const val = String(text || '');
  const marker = val.match(/\s(added|updated|deleted|exported|approved|registered|changed)\s/i);
  if (!marker || marker.index == null) return { actor: 'System', action: val };
  return {
    actor: val.slice(0, marker.index).trim(),
    action: val.slice(marker.index + 1).trim(),
  };
}

function activityLink(text, isAdmin) {
  const lower = String(text || '').toLowerCase();
  if (lower.includes('account') || lower.includes('user') || lower.includes('approved')) return isAdmin ? '/users' : '/projects';
  if (lower.includes('project')) return '/projects';
  if (lower.includes('sample')) return '/samples';
  return '/projects';
}

export default function Dashboard() {
  const { user, isAdmin, isResearcher, isStudent } = useAuth();
  const {
    samples,
    projects,
    organisms,
    users,
    activity,
    pendingCount,
    pendingRequests,
    coResearcherInvites,
  } = useData();

  const visibleProjects = useMemo(() => getVisibleProjects(projects, user), [projects, user]);
  const visibleSamples = useMemo(() => getVisibleSamples(samples, projects, user), [samples, projects, user]);
  const criticalSamples = useMemo(
    () => visibleSamples.filter((s) => s.status === 'Expired' || s.status === 'Contaminated'),
    [visibleSamples]
  );

  const activeProjects = useMemo(
    () => visibleProjects.filter((p) => p.status === 'Active').length,
    [visibleProjects]
  );

  const publishedProjects = useMemo(
    () => visibleProjects.filter((p) => p.publicationStatus === 'Published').length,
    [visibleProjects]
  );

  const myLeadProjects = useMemo(
    () => visibleProjects.filter((p) => p.leadResearcher === user?.fullName),
    [visibleProjects, user]
  );
  const myInvolvedProjects = useMemo(
    () =>
      projects.filter(
        (p) => p.leadResearcher === user?.fullName || (Array.isArray(p.coResearchers) && p.coResearchers.includes(user?.fullName))
      ),
    [projects, user]
  );

  const myProjectIds = useMemo(() => new Set(myLeadProjects.map((p) => p.id)), [myLeadProjects]);
  const myPendingRequestCount = useMemo(
    () => (pendingRequests || []).filter((r) => myProjectIds.has(r.projectId)).length,
    [pendingRequests, myProjectIds]
  );
  const firstPendingProjectId = useMemo(() => {
    const req = (pendingRequests || []).find((r) => myProjectIds.has(r.projectId));
    return req?.projectId || myLeadProjects[0]?.id || null;
  }, [pendingRequests, myProjectIds, myLeadProjects]);

  const myInviteCount = useMemo(
    () => (coResearcherInvites || []).filter((i) => i.status === 'Pending' && i.invitedTo === user?.fullName).length,
    [coResearcherInvites, user]
  );
  const myOwnPendingRequestCount = useMemo(
    () => (pendingRequests || []).filter((r) => r.requestedBy === user?.fullName).length,
    [pendingRequests, user]
  );
  const myPendingInvites = useMemo(
    () =>
      (coResearcherInvites || [])
        .filter((inv) => inv.status === 'Pending' && inv.invitedTo === user?.fullName)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [coResearcherInvites, user]
  );
  const recentPendingInvites = myPendingInvites.slice(0, 2);
  const firstLeadPendingProject = useMemo(() => {
    const match = myLeadProjects
      .map((project) => ({
        project,
        count: (pendingRequests || []).filter((r) => r.projectId === project.id).length,
      }))
      .find((x) => x.count > 0);
    return match || null;
  }, [myLeadProjects, pendingRequests]);
  const myDraftLeadProjectCount = useMemo(
    () => myLeadProjects.filter((p) => p.publicationStatus === 'Draft').length,
    [myLeadProjects]
  );
  const mySamples = useMemo(
    () => samples.filter((s) => s.collectedBy === user?.fullName),
    [samples, user]
  );
  const publishedVisibleProjectsCount = useMemo(
    () => visibleProjects.filter((p) => p.publicationStatus === 'Published').length,
    [visibleProjects]
  );

  const samplesPerProject = useMemo(() => {
    const countByProject = visibleSamples.reduce((acc, s) => {
      acc[s.projectId] = (acc[s.projectId] || 0) + 1;
      return acc;
    }, {});
    return visibleProjects
      .map((p) => ({
        id: p.id,
        name: p.name.length > 16 ? `${p.name.slice(0, 16)}...` : p.name,
        samples: countByProject[p.id] || 0,
      }))
      .filter((p) => p.samples > 0)
      .sort((a, b) => b.samples - a.samples)
      .slice(0, 6);
  }, [visibleSamples, visibleProjects]);

  const recentActivity = activity.slice(0, 5);
  const draftProjectCount = useMemo(
    () => projects.filter((p) => p.publicationStatus === 'Draft').length,
    [projects]
  );
  const activeResearcherCount = useMemo(
    () => users.filter((u) => u.role === 'Researcher' && u.status === 'Active').length,
    [users]
  );

  const growthByMonth = useMemo(() => {
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      return { key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleString('en-US', { month: 'short' }), cutoff: d };
    });
    const sortedSamples = [...samples].sort((a, b) => new Date(a.collectionDate) - new Date(b.collectionDate));
    let cumulative = 0;
    return months.map((m, i) => {
      const nextCutoff = i < months.length - 1 ? months[i + 1].cutoff : new Date(now.getFullYear(), now.getMonth() + 1, 1);
      while (cumulative < sortedSamples.length) {
        const sampleDate = new Date(sortedSamples[cumulative].collectionDate);
        if (!(sampleDate >= m.cutoff && sampleDate < nextCutoff)) break;
        cumulative += 1;
      }
      const totalToMonth = sortedSamples.filter((s) => new Date(s.collectionDate) < nextCutoff).length;
      return { month: m.label, total: totalToMonth };
    });
  }, [samples]);
  const myGrowthByMonth = useMemo(() => {
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      return { key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleString('en-US', { month: 'short' }), cutoff: d };
    });
    const sortedSamples = [...mySamples].sort((a, b) => new Date(a.collectionDate) - new Date(b.collectionDate));
    return months.map((m, i) => {
      const nextCutoff = i < months.length - 1 ? months[i + 1].cutoff : new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const totalToMonth = sortedSamples.filter((s) => new Date(s.collectionDate) < nextCutoff).length;
      return { month: m.label, total: totalToMonth };
    });
  }, [mySamples]);

  const statusDistribution = useMemo(() => {
    const counts = visibleSamples.reduce((acc, sample) => {
      acc[sample.status] = (acc[sample.status] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [visibleSamples]);
  const myStatusDistribution = useMemo(() => {
    const counts = mySamples.reduce((acc, sample) => {
      acc[sample.status] = (acc[sample.status] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [mySamples]);

  const activity30Day = useMemo(() => {
    const today = new Date();
    const dateKeys = Array.from({ length: 30 }, (_, idx) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (29 - idx));
      return {
        key: d.toISOString().slice(0, 10),
        label: toShortDate(d),
        actions: 0,
      };
    });
    const indexByKey = new Map(dateKeys.map((d, idx) => [d.key, idx]));
    activity.forEach((item, idx) => {
      const daysAgo = Math.max(0, Math.min(29, parseActivityDaysAgo(item.timeAgo, idx)));
      const d = new Date(today);
      d.setDate(today.getDate() - daysAgo);
      const key = d.toISOString().slice(0, 10);
      const chartIdx = indexByKey.get(key);
      if (chartIdx != null) dateKeys[chartIdx].actions += 1;
    });
    return dateKeys;
  }, [activity]);
  const avgActionsPerDay = useMemo(() => {
    const total = activity30Day.reduce((acc, d) => acc + d.actions, 0);
    return (total / 30).toFixed(2);
  }, [activity30Day]);
  const myProjectIdsSet = useMemo(() => new Set(myInvolvedProjects.map((p) => p.id)), [myInvolvedProjects]);
  const myProjectNames = useMemo(() => myInvolvedProjects.map((p) => p.name.toLowerCase()), [myInvolvedProjects]);
  const myProjectSampleIds = useMemo(
    () =>
      samples
        .filter((s) => myProjectIdsSet.has(s.projectId))
        .map((s) => String(s.sampleId || s.sampleName || '').toLowerCase())
        .filter(Boolean),
    [samples, myProjectIdsSet]
  );
  const researcherRelevantActivity = useMemo(() => {
    const myName = String(user?.fullName || '').toLowerCase();
    return activity.filter((item) => {
      const text = String(item.text || '').toLowerCase();
      if (!text) return false;
      if (myName && text.includes(myName)) return true;
      if (myProjectNames.some((name) => name && text.includes(name))) return true;
      if (myProjectSampleIds.some((sid) => sid && text.includes(sid))) return true;
      return false;
    });
  }, [activity, user, myProjectNames, myProjectSampleIds]);
  const myProjectsOverview = useMemo(() => {
    const countByProject = samples.reduce((acc, s) => {
      acc[s.projectId] = (acc[s.projectId] || 0) + 1;
      return acc;
    }, {});
    return myInvolvedProjects.map((p) => ({
      id: p.id,
      name: p.name,
      role: p.leadResearcher === user?.fullName ? 'Lead' : 'Co-Researcher',
      publicationStatus: p.publicationStatus,
      sampleCount: countByProject[p.id] || 0,
      pendingCount: p.leadResearcher === user?.fullName ? (pendingRequests || []).filter((r) => r.projectId === p.id).length : 0,
    }));
  }, [myInvolvedProjects, samples, user, pendingRequests]);
  const publishedProjectsAll = useMemo(
    () => projects.filter((p) => p.publicationStatus === 'Published'),
    [projects]
  );
  const publishedProjectIdSet = useMemo(
    () => new Set(publishedProjectsAll.map((p) => p.id)),
    [publishedProjectsAll]
  );
  const publishedSamples = useMemo(
    () => samples.filter((s) => publishedProjectIdSet.has(s.projectId)),
    [samples, publishedProjectIdSet]
  );
  const samplesByOrganism = useMemo(() => {
    const countByOrg = publishedSamples.reduce((acc, s) => {
      acc[s.organismId] = (acc[s.organismId] || 0) + 1;
      return acc;
    }, {});
    return organisms
      .map((org) => ({
        name: org.commonName || org.scientificName,
        count: countByOrg[org.id] || 0,
      }))
      .filter((d) => d.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [publishedSamples, organisms]);
  const publishedStatusDistribution = useMemo(() => {
    const counts = publishedSamples.reduce((acc, sample) => {
      acc[sample.status] = (acc[sample.status] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [publishedSamples]);
  const projectOrder = useMemo(
    () => new Map(projects.map((p, idx) => [p.id, idx])),
    [projects]
  );
  const recentlyPublishedProjects = useMemo(() => {
    const countByProject = publishedSamples.reduce((acc, s) => {
      acc[s.projectId] = (acc[s.projectId] || 0) + 1;
      return acc;
    }, {});
    return [...publishedProjectsAll]
      .sort((a, b) => (projectOrder.get(b.id) || 0) - (projectOrder.get(a.id) || 0))
      .slice(0, 3)
      .map((p) => ({
        id: p.id,
        name: p.name,
        leadResearcher: p.leadResearcher,
        sampleCount: countByProject[p.id] || 0,
      }));
  }, [publishedProjectsAll, projectOrder, publishedSamples]);
  const studentDiscoveryActivity = useMemo(() => {
    return activity.filter((item) => {
      const text = String(item.text || '').toLowerCase();
      const isRecentAddSample = text.includes('added sample');
      const isPublishedEvent = (text.includes('publish') || text.includes('published')) && text.includes('project');
      return isRecentAddSample || isPublishedEvent;
    });
  }, [activity]);

  const adminActions = [
    { title: 'Pending account approvals', count: pendingCount, to: '/users', detail: 'Open User Management to approve accounts', tone: 'amber' },
    {
      title: 'Pending sample change requests',
      count: (pendingRequests || []).length,
      to: firstPendingProjectId ? `/projects/${firstPendingProjectId}` : '/projects',
      detail: 'Go straight to project queue and approve/reject',
      tone: 'rose',
    },
    { title: 'At-risk samples', count: criticalSamples.length, to: '/samples', detail: 'Expired or contaminated samples need review', tone: 'rose' },
  ];

  const researcherActions = [
    { title: 'Co-researcher invites', count: myInviteCount, to: '/projects', detail: 'Accept or decline pending project invites', tone: 'amber' },
    {
      title: 'Requests waiting on your decision',
      count: myPendingRequestCount,
      to: firstPendingProjectId ? `/projects/${firstPendingProjectId}` : '/projects',
      detail: 'Open project detail and resolve requests',
      tone: 'rose',
    },
    { title: 'At-risk samples', count: criticalSamples.length, to: '/samples', detail: 'Review expired/contaminated samples', tone: 'rose' },
  ];

  const studentActions = [
    { title: 'Published projects to explore', count: publishedProjects, to: '/projects', detail: 'Open projects available to students', tone: 'mint' },
    { title: 'Recent samples visible to you', count: visibleSamples.length, to: '/samples', detail: 'Browse and inspect latest sample records', tone: 'mint' },
  ];

  const topActions = isAdmin ? adminActions : isResearcher ? researcherActions : studentActions;

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
        <p className="text-xs text-gray-500">{user?.role} control view</p>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-gray-700">Needs Attention</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {topActions.map((item) => (
            <ActionCard key={item.title} {...item} />
          ))}
        </div>
      </section>

      {isAdmin && (
        <>
          <section className="rounded-xl border border-mint-100 bg-white p-3 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              {pendingCount > 0 && (
                <Link to="/users" className="inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900">
                  {pendingCount} accounts pending approval
                </Link>
              )}
              {(pendingRequests || []).length > 0 && (
                <Link
                  to={firstPendingProjectId ? `/projects/${firstPendingProjectId}` : '/projects'}
                  className="inline-flex items-center rounded-full border border-rose-300 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-900"
                >
                  {(pendingRequests || []).length} sample requests awaiting review
                </Link>
              )}
              {draftProjectCount > 0 && (
                <Link
                  to="/projects"
                  state={{ filterPublication: 'Draft' }}
                  className="inline-flex items-center rounded-full border border-orange-300 bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-900"
                >
                  {draftProjectCount} unpublished projects
                </Link>
              )}
              {pendingCount === 0 && (pendingRequests || []).length === 0 && draftProjectCount === 0 && (
                <div className="inline-flex items-center rounded-full border border-green-300 bg-green-50 px-3 py-1 text-xs font-semibold text-green-800">
                  All clear - no pending actions
                </div>
              )}
            </div>
          </section>

          <section className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <StatCard label="Total Samples" value={samples.length} />
            <StatCard label="Total Projects" value={projects.length} />
            <StatCard label="Total Organisms" value={organisms.length} />
            <StatCard label="Total Users" value={users.length} />
            <StatCard label="Active Researchers" value={activeResearcherCount} />
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-mint-100 shadow-sm p-4">
              <h3 className="text-sm font-semibold text-gray-800 mb-2">Sample Growth Over Time</h3>
              <div className="h-56">
                {growthByMonth.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={growthByMonth} margin={{ top: 8, right: 8, left: -12, bottom: 8 }}>
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Area type="monotone" dataKey="total" stroke="#0d9488" fill="#99f6e4" fillOpacity={0.7} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-gray-500 h-full flex items-center justify-center">No sample history available.</p>
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-mint-100 shadow-sm p-4">
              <h3 className="text-sm font-semibold text-gray-800 mb-2">Sample Status Distribution</h3>
              <div className="h-56">
                {statusDistribution.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusDistribution}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={48}
                        outerRadius={72}
                        paddingAngle={2}
                      >
                        {statusDistribution.map((entry) => (
                          <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || '#14b8a6'} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-gray-500 h-full flex items-center justify-center">No sample status data.</p>
                )}
              </div>
            </div>
          </section>

          <section className="bg-white rounded-xl border border-mint-100 shadow-sm p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-800">Activity Timeline (30 Days)</h3>
              <span className="text-xs text-gray-500">Avg {avgActionsPerDay} actions/day</span>
            </div>
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={activity30Day} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={4} tickLine={false} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="actions" stroke="#0d9488" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="bg-white rounded-xl border border-mint-100 shadow-sm overflow-hidden">
            <h3 className="px-4 py-3 text-sm font-semibold text-gray-800 border-b border-mint-100">Recent Activity</h3>
            <ul className="divide-y divide-mint-50">
              {recentActivity.map((item) => {
                const parts = splitActivityText(item.text);
                return (
                  <li key={item.id}>
                    <Link
                      to={activityLink(item.text, isAdmin)}
                      className="px-4 py-2.5 text-sm flex items-center justify-between gap-3 hover:bg-mint-50/60"
                    >
                      <span className="min-w-0">
                        <span className="font-medium text-gray-800">{parts.actor}</span>
                        <span className="text-gray-600"> {parts.action}</span>
                      </span>
                      <span className="text-xs text-gray-400 shrink-0">{item.timeAgo}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
            <div className="px-4 py-2.5 border-t border-mint-100 text-right">
              <Link to="/samples" className="text-xs font-semibold text-mint-700 hover:text-mint-800">
                View All
              </Link>
            </div>
          </section>
        </>
      )}

      {isResearcher && (
        <>
          <section className="rounded-xl border border-mint-100 bg-white p-3 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              {firstLeadPendingProject && (
                <Link
                  to={`/projects/${firstLeadPendingProject.project.id}`}
                  className="inline-flex items-center rounded-full border border-rose-300 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-900"
                >
                  {firstLeadPendingProject.count} pending requests on {firstLeadPendingProject.project.name}
                </Link>
              )}
              {myDraftLeadProjectCount > 0 && (
                <Link
                  to="/projects"
                  state={{ filterPublication: 'Draft' }}
                  className="inline-flex items-center rounded-full border border-orange-300 bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-900"
                >
                  {myDraftLeadProjectCount} unpublished projects
                </Link>
              )}
            </div>
            {myPendingInvites.length > 0 && (
              <div className="mt-3 rounded-lg border border-indigo-200 border-l-4 border-l-indigo-500 bg-indigo-50/40 p-3">
                <p className="text-xs font-semibold text-indigo-900">
                  {myPendingInvites.length === 1
                    ? 'You have 1 pending invite for a co-researcher role:'
                    : `You have ${myPendingInvites.length} pending invites for a co-researcher role:`}
                </p>
                <div className="mt-1.5 space-y-1">
                  {recentPendingInvites.map((inv) => {
                    const proj = projects.find((p) => p.id === inv.projectId);
                    return (
                      <p key={inv.id} className="flex items-start gap-1.5 text-xs text-indigo-900">
                        <ClipboardList className="h-3.5 w-3.5 shrink-0 mt-0.5 opacity-90" strokeWidth={2} aria-hidden />
                        <span>
                          {proj?.name || inv.projectId} - Invited by {inv.invitedBy} ({relativeTimeFromIso(inv.createdAt)})
                        </span>
                      </p>
                    );
                  })}
                  {myPendingInvites.length > 2 && (
                    <p className="text-xs text-indigo-700">...and {myPendingInvites.length - 2} more</p>
                  )}
                </div>
                <Link
                  to="/projects"
                  className="inline-flex mt-2 px-2.5 py-1 rounded-md bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700"
                >
                  View All Invites
                </Link>
              </div>
            )}
          </section>

          <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="My Samples" value={mySamples.length} />
            <StatCard label="My Projects" value={myInvolvedProjects.length} />
            <StatCard label="Published Projects" value={publishedVisibleProjectsCount} />
            <StatCard label="Total Organisms" value={organisms.length} />
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-mint-100 shadow-sm p-4">
              <h3 className="text-sm font-semibold text-gray-800 mb-2">My Sample Growth</h3>
              <div className="h-56">
                {myGrowthByMonth.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={myGrowthByMonth} margin={{ top: 8, right: 8, left: -12, bottom: 8 }}>
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Area type="monotone" dataKey="total" stroke="#0d9488" fill="#99f6e4" fillOpacity={0.7} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-gray-500 h-full flex items-center justify-center">No personal sample history available.</p>
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-mint-100 shadow-sm p-4">
              <h3 className="text-sm font-semibold text-gray-800 mb-2">My Samples by Status</h3>
              <div className="h-56">
                {myStatusDistribution.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={myStatusDistribution}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={48}
                        outerRadius={72}
                        paddingAngle={2}
                      >
                        {myStatusDistribution.map((entry) => (
                          <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || '#14b8a6'} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-gray-500 h-full flex items-center justify-center">No personal sample status data.</p>
                )}
              </div>
            </div>
          </section>

          <section className="bg-white rounded-xl border border-mint-100 shadow-sm overflow-hidden">
            <h3 className="px-4 py-3 text-sm font-semibold text-gray-800 border-b border-mint-100">My Projects Overview</h3>
            <table className="w-full text-sm">
              <thead className="bg-mint-50 border-b border-mint-100">
                <tr>
                  <th className="text-left py-2.5 px-4 font-semibold text-gray-700">Project Name</th>
                  <th className="text-left py-2.5 px-4 font-semibold text-gray-700">Role</th>
                  <th className="text-left py-2.5 px-4 font-semibold text-gray-700">Publication</th>
                  <th className="text-left py-2.5 px-4 font-semibold text-gray-700">Sample Count</th>
                  <th className="text-left py-2.5 px-4 font-semibold text-gray-700">Pending Requests</th>
                </tr>
              </thead>
              <tbody>
                {myProjectsOverview.slice(0, 5).map((project) => (
                  <tr
                    key={project.id}
                    className="border-b border-mint-50 hover:bg-mint-50/50"
                  >
                    <td className="py-2.5 px-4">
                      <Link to={`/projects/${project.id}`} className="font-medium text-gray-800 hover:text-mint-700">
                        {project.name}
                      </Link>
                    </td>
                    <td className="py-2.5 px-4">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        project.role === 'Lead' ? 'bg-mint-100 text-mint-800' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {project.role}
                      </span>
                    </td>
                    <td className="py-2.5 px-4">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        project.publicationStatus === 'Published' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'
                      }`}>
                        {project.publicationStatus}
                      </span>
                    </td>
                    <td className="py-2.5 px-4">{project.sampleCount}</td>
                    <td className="py-2.5 px-4">{project.role === 'Lead' ? project.pendingCount : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {myProjectsOverview.length > 5 && (
              <div className="px-4 py-2.5 border-t border-mint-100 text-right">
                <Link to="/projects" className="text-xs font-semibold text-mint-700 hover:text-mint-800">
                  View All Projects
                </Link>
              </div>
            )}
            {myProjectsOverview.length === 0 && (
              <p className="px-4 py-6 text-sm text-gray-500">You are not assigned to any projects yet.</p>
            )}
          </section>

          <section className="bg-white rounded-xl border border-mint-100 shadow-sm overflow-hidden">
            <h3 className="px-4 py-3 text-sm font-semibold text-gray-800 border-b border-mint-100">Recent Activity</h3>
            <ul className="divide-y divide-mint-50">
              {researcherRelevantActivity.slice(0, 5).map((item) => {
                const parts = splitActivityText(item.text);
                return (
                  <li key={item.id}>
                    <Link
                      to={activityLink(item.text, false)}
                      className="px-4 py-2.5 text-sm flex items-center justify-between gap-3 hover:bg-mint-50/60"
                    >
                      <span className="min-w-0">
                        <span className="font-medium text-gray-800">{parts.actor}</span>
                        <span className="text-gray-600"> {parts.action}</span>
                      </span>
                      <span className="text-xs text-gray-400 shrink-0">{item.timeAgo}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
            <div className="px-4 py-2.5 border-t border-mint-100 text-right">
              <Link to="/samples" className="text-xs font-semibold text-mint-700 hover:text-mint-800">
                View All
              </Link>
            </div>
          </section>
        </>
      )}

      {isStudent && (
        <>
          <section className="rounded-xl border border-mint-100 bg-white p-3 shadow-sm">
            <p className="text-sm text-gray-700">
              Welcome back, {user?.fullName}. Explore the latest published research data below.
            </p>
          </section>

          <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <StatCard label="Published Samples" value={publishedSamples.length} />
            <StatCard label="Published Projects" value={publishedProjectsAll.length} />
            <StatCard label="Total Organisms" value={organisms.length} />
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-mint-100 shadow-sm p-4">
              <h3 className="text-sm font-semibold text-gray-800 mb-2">Samples by Organism</h3>
              <div className="h-56">
                {samplesByOrganism.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={samplesByOrganism} layout="vertical" margin={{ top: 4, right: 8, left: 10, bottom: 4 }}>
                      <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={90} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#14b8a6" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-gray-500 h-full flex items-center justify-center">No published sample data yet.</p>
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-mint-100 shadow-sm p-4">
              <h3 className="text-sm font-semibold text-gray-800 mb-2">Sample Status Distribution</h3>
              <div className="h-56">
                {publishedStatusDistribution.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={publishedStatusDistribution}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={48}
                        outerRadius={72}
                        paddingAngle={2}
                      >
                        {publishedStatusDistribution.map((entry) => (
                          <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || '#14b8a6'} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-gray-500 h-full flex items-center justify-center">No status data for published samples.</p>
                )}
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {recentlyPublishedProjects.map((project) => (
              <div
                key={project.id}
                className="rounded-2xl border border-white/10 bg-gradient-to-b from-[#166534] to-[#14532D] shadow-[0_4px_16px_rgba(0,0,0,0.12)] p-4 transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgba(0,0,0,0.16)]"
              >
                <p className="text-sm font-semibold text-white truncate">{project.name}</p>
                <p className="text-xs text-white/75 mt-1">Lead: {project.leadResearcher}</p>
                <p className="text-xs text-white/65 mt-1">Samples: {project.sampleCount}</p>
                <Link
                  to={`/projects/${project.id}`}
                  className="inline-flex mt-3 px-3 py-1.5 rounded-lg bg-white text-[#14532D] text-xs font-semibold hover:bg-emerald-50 transition-colors"
                >
                  View Project
                </Link>
              </div>
            ))}
          </section>

          <section className="bg-white rounded-xl border border-mint-100 shadow-sm overflow-hidden">
            <h3 className="px-4 py-3 text-sm font-semibold text-gray-800 border-b border-mint-100">Recent Activity</h3>
            <ul className="divide-y divide-mint-50">
              {studentDiscoveryActivity.slice(0, 3).map((item) => {
                const parts = splitActivityText(item.text);
                return (
                  <li key={item.id}>
                    <Link
                      to={activityLink(item.text, false)}
                      className="px-4 py-2.5 text-sm flex items-center justify-between gap-3 hover:bg-mint-50/60"
                    >
                      <span className="min-w-0">
                        <span className="font-medium text-gray-800">{parts.actor}</span>
                        <span className="text-gray-600"> {parts.action}</span>
                      </span>
                      <span className="text-xs text-gray-400 shrink-0">{item.timeAgo}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

import { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

const STATUS_COLORS = { Active: '#22c55e', Used: '#3b82f6', Expired: '#f59e0b', Contaminated: '#ef4444' };
const CHART_COLORS = ['#2dd4bf', '#14b8a6', '#0d9488', '#0f766e', '#115e59', '#134e4a'];

export default function Dashboard() {
  const { isAdmin } = useAuth();
  const { samples, projects, organisms, users, activity, pendingCount } = useData();

  const stats = [
    { label: 'Total Samples', value: samples.length, color: 'bg-mint-500' },
    { label: 'Total Projects', value: projects.length, color: 'bg-teal-500' },
    { label: 'Total Organisms', value: organisms.length, color: 'bg-emerald-500' },
    ...(isAdmin ? [{ label: 'Total Users', value: users.length, color: 'bg-cyan-500' }] : []),
    ...(isAdmin ? [{ label: 'Pending Approvals', value: pendingCount, color: 'bg-amber-500' }] : []),
  ];

  const samplesByProject = useMemo(() => {
    const countByProject = samples.reduce((acc, s) => {
      acc[s.projectId] = (acc[s.projectId] || 0) + 1;
      return acc;
    }, {});
    return projects
      .map((p) => ({ name: p.name.length > 18 ? p.name.slice(0, 18) + '…' : p.name, samples: countByProject[p.id] ?? 0 }))
      .filter((d) => d.samples > 0)
      .sort((a, b) => b.samples - a.samples)
      .slice(0, 8);
  }, [samples, projects]);

  const samplesByStatus = useMemo(() => {
    const countByStatus = samples.reduce((acc, s) => {
      acc[s.status] = (acc[s.status] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(countByStatus).map(([name, value]) => ({ name, value }));
  }, [samples]);

  const samplesByType = useMemo(() => {
    const countByType = samples.reduce((acc, s) => {
      acc[s.sampleType] = (acc[s.sampleType] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(countByType).map(([name, value]) => ({ name, value }));
  }, [samples]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {stats.map(({ label, value, color }) => (
          <div
            key={label}
            className="bg-white rounded-xl border border-mint-100 p-5 shadow-sm hover:shadow-md transition-shadow"
          >
            <p className="text-sm font-medium text-gray-500">{label}</p>
            <p className="text-2xl font-bold mt-1 text-mint-800">{value}</p>
            <div className={`mt-2 h-1 w-12 rounded ${color}`} />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-mint-100 shadow-sm p-4">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Samples per Project</h2>
          <div className="h-64">
            {samplesByProject.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={samplesByProject} margin={{ top: 5, right: 5, left: 0, bottom: 20 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-25} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="samples" fill="#2dd4bf" radius={[4, 4, 0, 0]} name="Samples" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-gray-500 text-sm flex items-center justify-center h-full">No sample data by project yet.</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-mint-100 shadow-sm p-4">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Sample Status Distribution</h2>
          <div className="h-64">
            {samplesByStatus.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={samplesByStatus}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {samplesByStatus.map((entry, index) => (
                      <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-gray-500 text-sm flex items-center justify-center h-full">No sample data yet.</p>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-mint-100 shadow-sm p-4 max-w-md">
        <h2 className="text-base font-semibold text-gray-800 mb-4">Samples by Type</h2>
        <div className="h-56">
          {samplesByType.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={samplesByType}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                  paddingAngle={2}
                >
                  {samplesByType.map((_, index) => (
                    <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-500 text-sm flex items-center justify-center h-full">No sample data yet.</p>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-mint-100 shadow-sm overflow-hidden">
        <h2 className="px-6 py-4 font-semibold text-gray-800 border-b border-mint-100">
          Recent Activity
        </h2>
        <ul className="divide-y divide-mint-50">
          {activity.slice(0, 7).map((item) => (
            <li key={item.id} className="px-6 py-3 flex justify-between items-center text-sm">
              <span className="text-gray-700">{item.text}</span>
              <span className="text-gray-400">{item.timeAgo}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';

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

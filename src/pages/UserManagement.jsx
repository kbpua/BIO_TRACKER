import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ViewIconButton, DeleteIconButton } from '../components/TableActionButtons';
import { useData } from '../contexts/DataContext';
import { ROLES, ACCOUNT_STATUSES } from '../data/mockData';

export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const { users, updateUser, addUser, deleteUser } = useData();
  const [modal, setModal] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [viewUserId, setViewUserId] = useState(null);
  const [newUserForm, setNewUserForm] = useState({
    fullName: '',
    email: '',
    password: '',
    role: 'Researcher',
    status: 'Pending',
    createdBy: currentUser?.fullName ?? 'Admin',
  });

  const pending = users.filter((u) => u.status === 'Pending');

  const handleApprove = (id) => {
    updateUser(id, { status: 'Active' });
  };

  const handleRoleChange = (id, role) => {
    updateUser(id, { role });
  };

  const handleDeactivate = (id) => {
    updateUser(id, { status: 'Deactivated' });
  };

  const handleCreateUser = (e) => {
    e.preventDefault();
    addUser({
      ...newUserForm,
      dateCreated: new Date().toISOString().split('T')[0],
      createdBy: currentUser?.fullName ?? 'Admin',
    });
    setNewUserForm({ fullName: '', email: '', password: '', role: 'Researcher', status: 'Active', createdBy: currentUser?.fullName ?? 'Admin' });
    setModal(null);
  };

  const handleDelete = (id) => {
    deleteUser(id);
    setConfirmDelete(null);
  };

  const pendingDeadline = (u) => {
    const days = u.pendingDaysRemaining;
    if (days == null) return null;
    if (days <= 0) return 'Approval expired.';
    return `${days} day${days === 1 ? '' : 's'} remaining`;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">User Management</h1>
        <button
          type="button"
          onClick={() => setModal('new')}
          className="px-4 py-2 bg-mint-600 text-white text-sm font-medium rounded-lg hover:bg-mint-700"
        >
          Create User
        </button>
      </div>

      {pending.length > 0 && (
        <div className="bg-amber-50/90 border border-amber-300 rounded-xl p-5 shadow-sm">
          <h2 className="font-bold text-amber-900 text-lg mb-4">Pending Approvals</h2>
          <ul className="space-y-0 divide-y divide-amber-200/80">
            {pending.map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                <span className="text-blue-900 font-medium flex-1 min-w-0 truncate">
                  {u.fullName} ({u.email})
                </span>
                <span className="text-amber-600 text-sm font-medium shrink-0">
                  {pendingDeadline(u)}
                </span>
                <button
                  type="button"
                  onClick={() => handleApprove(u.id)}
                  className="px-4 py-2 bg-mint-600 text-white text-sm font-medium rounded-lg hover:bg-mint-700 shadow-sm shrink-0"
                >
                  Approve
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="bg-white rounded-xl border border-mint-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-mint-50 border-b border-mint-100">
            <tr>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">User ID</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Full Name</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Email</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Role</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Account Status</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Date Created</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700">Created By</th>
              <th className="text-left py-3 px-4 font-semibold text-gray-700 min-w-[200px]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-mint-50 hover:bg-mint-50/50">
                <td className="py-2 px-4">{u.id}</td>
                <td className="py-2 px-4 font-medium">{u.fullName}</td>
                <td className="py-2 px-4">{u.email}</td>
                <td className="py-2 px-4">
                  <select
                    value={u.role}
                    onChange={(e) => handleRoleChange(u.id, e.target.value)}
                    className="border border-gray-300 rounded px-2 py-1 text-xs"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </td>
                <td className="py-2 px-4">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    u.status === 'Active' ? 'bg-green-100 text-green-800' :
                    u.status === 'Pending' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {u.status}
                    {u.status === 'Pending' && u.pendingDaysRemaining != null && (
                      <span className="ml-1">({pendingDeadline(u)})</span>
                    )}
                  </span>
                </td>
                <td className="py-2 px-4">{u.dateCreated}</td>
                <td className="py-2 px-4">{u.createdBy}</td>
                <td className="py-2 px-4 min-w-[200px]">
                  <div className="flex items-center flex-nowrap gap-2">
                    <ViewIconButton
                      pressed={viewUserId === u.id}
                      label={viewUserId === u.id ? 'Hide user details' : 'View user details'}
                      onClick={() => setViewUserId(viewUserId === u.id ? null : u.id)}
                    />
                    {u.status === 'Pending' && (
                      <button
                        type="button"
                        onClick={() => handleApprove(u.id)}
                        className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-mint-600 text-white hover:bg-mint-700 transition-colors shadow-sm shrink-0"
                      >
                        Approve
                      </button>
                    )}
                    {u.status === 'Active' && u.id !== currentUser?.id && (
                      <button
                        type="button"
                        onClick={() => handleDeactivate(u.id)}
                        className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-amber-600 text-white hover:bg-amber-700 transition-colors shadow-sm shrink-0"
                      >
                        Deactivate
                      </button>
                    )}
                    {u.id !== currentUser?.id && (
                      <DeleteIconButton label="Delete user" onClick={() => setConfirmDelete(u.id)} />
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {viewUserId && (() => {
        const u = users.find((usr) => usr.id === viewUserId);
        if (!u) return null;
        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setViewUserId(null)}>
            <div className="bg-white rounded-xl border border-mint-100 shadow-xl p-6 max-w-lg w-full max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-lg font-semibold text-gray-800">User Details</h2>
                <button
                  type="button"
                  onClick={() => setViewUserId(null)}
                  className="px-2.5 py-1 rounded-md text-xs font-medium border border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  Close
                </button>
              </div>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div><dt className="text-gray-500">User ID</dt><dd className="font-medium">{u.id}</dd></div>
                <div><dt className="text-gray-500">Full Name</dt><dd className="font-medium">{u.fullName}</dd></div>
                <div><dt className="text-gray-500">Email</dt><dd>{u.email}</dd></div>
                <div><dt className="text-gray-500">Role</dt><dd>{u.role}</dd></div>
                <div><dt className="text-gray-500">Account Status</dt><dd>{u.status}{u.status === 'Pending' && u.pendingDaysRemaining != null ? ` (${pendingDeadline(u)})` : ''}</dd></div>
                <div><dt className="text-gray-500">Date Created</dt><dd>{u.dateCreated || '—'}</dd></div>
                <div className="sm:col-span-2"><dt className="text-gray-500">Created By</dt><dd>{u.createdBy || '—'}</dd></div>
              </dl>
            </div>
          </div>
        );
      })()}

      {modal === 'new' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Create User</h2>
            <form onSubmit={handleCreateUser} className="space-y-3">
              <input
                type="text"
                placeholder="Full Name"
                value={newUserForm.fullName}
                onChange={(e) => setNewUserForm((f) => ({ ...f, fullName: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                required
              />
              <input
                type="email"
                placeholder="Email"
                value={newUserForm.email}
                onChange={(e) => setNewUserForm((f) => ({ ...f, email: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                required
              />
              <input
                type="password"
                placeholder="Password"
                value={newUserForm.password}
                onChange={(e) => setNewUserForm((f) => ({ ...f, password: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                required
              />
              <select
                value={newUserForm.role}
                onChange={(e) => setNewUserForm((f) => ({ ...f, role: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              <select
                value={newUserForm.status}
                onChange={(e) => setNewUserForm((f) => ({ ...f, status: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                {ACCOUNT_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="px-4 py-2 bg-mint-600 text-white text-sm rounded-lg hover:bg-mint-700">Create</button>
                <button type="button" onClick={() => setModal(null)} className="px-4 py-2 border border-gray-300 text-sm rounded-lg hover:bg-gray-50">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-xl">
            <p className="font-medium text-gray-800 mb-2">Delete this user account?</p>
            <p className="text-sm text-gray-500 mb-4">This action cannot be undone.</p>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setConfirmDelete(null)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button type="button" onClick={() => handleDelete(confirmDelete)} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

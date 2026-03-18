import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useData } from '../contexts/DataContext';
import { ROLES } from '../data/mockData';

export default function CreateUser() {
  const { user: currentUser, isAdmin } = useAuth();
  const navigate = useNavigate();
  const { addUser } = useData();

  useEffect(() => {
    if (!isAdmin) navigate('/dashboard', { replace: true });
  }, [isAdmin, navigate]);

  if (!isAdmin) return null;
  const [message, setMessage] = useState({ type: '', text: '' });
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    role: 'Researcher',
    createdBy: currentUser?.fullName ?? 'Admin',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });
    const payload = {
      ...form,
      dateCreated: new Date().toISOString().split('T')[0],
      createdBy: currentUser?.fullName ?? 'Admin',
    };
    payload.status = 'Active';
    addUser(payload);
    setForm({ fullName: '', email: '', password: '', role: 'Researcher', createdBy: currentUser?.fullName ?? 'Admin' });
    setMessage({
      type: 'success',
      text: 'User account created successfully.',
    });
  };

  return (
    <div className="max-w-md">
      <h1 className="text-2xl font-bold text-gray-800 mb-2">Create User Account</h1>
      {message.text && (
        <div
          className={`mb-4 p-3 rounded-lg text-sm ${
            message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800'
          }`}
        >
          {message.text}
        </div>
      )}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-mint-100 shadow-sm p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
          <input
            type="text"
            value={form.fullName}
            onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
          <input
            type="password"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
          <select
            value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2 pt-2">
          <button type="submit" className="px-4 py-2 bg-mint-600 text-white text-sm font-medium rounded-lg hover:bg-mint-700">
            Create User
          </button>
        </div>
      </form>
    </div>
  );
}

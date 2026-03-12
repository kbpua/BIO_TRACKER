import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Samples from './pages/Samples';
import SampleForm from './pages/SampleForm';
import Projects from './pages/Projects';
import Organisms from './pages/Organisms';
import UserManagement from './pages/UserManagement';
import ExportData from './pages/ExportData';

function App() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout><Outlet /></Layout>
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="samples" element={<Samples />} />
        <Route path="samples/new" element={<SampleForm />} />
        <Route path="samples/:id/edit" element={<SampleForm />} />
        <Route path="projects" element={<Projects />} />
        <Route path="organisms" element={<Organisms />} />
        <Route
          path="users"
          element={
            <ProtectedRoute adminOnly>
              <UserManagement />
            </ProtectedRoute>
          }
        />
        <Route path="export" element={<ExportData />} />
      </Route>
      <Route path="*" element={<Navigate to={user ? '/dashboard' : '/login'} replace />} />
    </Routes>
  );
}

export default App;

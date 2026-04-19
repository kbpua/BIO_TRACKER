import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import Login from './pages/Login';
import CompleteGoogleProfile from './pages/CompleteGoogleProfile';
import GoogleAccountPending from './pages/GoogleAccountPending';
import Dashboard from './pages/Dashboard';
import Samples from './pages/Samples';
import SampleDetail from './pages/SampleDetail';
import SampleForm from './pages/SampleForm';
import Projects from './pages/Projects';
import ProjectDetail from './pages/ProjectDetail';
import Organisms from './pages/Organisms';
import OrganismDetail from './pages/OrganismDetail';
import UserManagement from './pages/UserManagement';
import CreateUser from './pages/CreateUser';
import Notifications from './pages/Notifications';

function App() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/auth/complete-google-profile" element={<CompleteGoogleProfile />} />
      <Route path="/auth/google-pending" element={<GoogleAccountPending />} />
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
        <Route path="samples/:id" element={<SampleDetail />} />
        <Route path="projects" element={<Projects />} />
        <Route path="projects/:id" element={<ProjectDetail />} />
        <Route path="organisms" element={<Organisms />} />
        <Route path="organisms/:id" element={<OrganismDetail />} />
        <Route path="notifications" element={<Notifications />} />
        <Route
          path="users"
          element={
            <ProtectedRoute adminOnly>
              <UserManagement />
            </ProtectedRoute>
          }
        />
        <Route path="create-user" element={<ProtectedRoute adminOnly><CreateUser /></ProtectedRoute>} />
      </Route>
      <Route path="*" element={<Navigate to={user ? '/dashboard' : '/login'} replace />} />
    </Routes>
  );
}

export default App;

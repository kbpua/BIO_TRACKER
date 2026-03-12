import { createContext, useContext, useState, useCallback } from 'react';
import { MOCK_USERS } from '../data/mockData';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = sessionStorage.getItem('biosample_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const login = useCallback((email, password) => {
    const found = MOCK_USERS.find(
      (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
    );
    if (!found) return { success: false, error: 'Invalid email or password.' };
    const { password: _, ...userWithoutPassword } = found;
    const userData = { ...userWithoutPassword };
    setUser(userData);
    sessionStorage.setItem('biosample_user', JSON.stringify(userData));
    return { success: true };
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    sessionStorage.removeItem('biosample_user');
  }, []);

  const isAdmin = user?.role === 'Admin';
  const isResearcher = user?.role === 'Researcher';
  const isStudent = user?.role === 'Student';
  const canManageSamples = isAdmin || isResearcher;
  const canDeleteSamples = isAdmin;
  const canExportCSV = isAdmin || isResearcher;
  const canExportPDF = isAdmin;
  const canManageProjects = isAdmin;
  const canManageOrganisms = isAdmin;
  const canManageUsers = isAdmin;
  const canExportData = isAdmin || isResearcher;

  const value = {
    user,
    login,
    logout,
    isAdmin,
    isResearcher,
    isStudent,
    canManageSamples,
    canDeleteSamples,
    canExportCSV,
    canExportPDF,
    canManageProjects,
    canManageOrganisms,
    canManageUsers,
    canExportData,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

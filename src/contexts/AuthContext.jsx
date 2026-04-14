import { createContext, useContext, useState, useCallback } from 'react';
import { MOCK_USERS } from '../data/mockData';
import { getUserPassword } from '../store/authStore';

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

  const login = useCallback((email, password, dataUsers = []) => {
    const emailLower = email.toLowerCase();
    const foundMock = MOCK_USERS.find(
      (u) => u.email.toLowerCase() === emailLower && u.password === password
    );
    if (foundMock) {
      const { password: _, ...userWithoutPassword } = foundMock;
      if (userWithoutPassword.status === 'Pending') {
        return { success: false, error: 'Your account is pending admin approval. Please contact your administrator.' };
      }
      setUser(userWithoutPassword);
      sessionStorage.setItem('biosample_user', JSON.stringify(userWithoutPassword));
      return { success: true };
    }
    const foundData = dataUsers.find((u) => u.email?.toLowerCase() === emailLower);
    if (foundData) {
      const storedPassword = getUserPassword(foundData.email);
      if (storedPassword !== password) return { success: false, error: 'Invalid email or password.' };
      if (foundData.status === 'Pending') {
        return { success: false, error: 'Your account is pending admin approval. Please contact your administrator.' };
      }
      const { password: __, ...userWithoutPassword } = { ...foundData };
      setUser(userWithoutPassword);
      sessionStorage.setItem('biosample_user', JSON.stringify(userWithoutPassword));
      return { success: true };
    }
    return { success: false, error: 'Invalid email or password.' };
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    sessionStorage.removeItem('biosample_user');
  }, []);

  const isAdmin = user?.role === 'Admin';
  const isResearcher = user?.role === 'Researcher';
  const isStudent = user?.role === 'Student';
  const canManageSamples = isAdmin || isResearcher;
  const canDeleteSamples = isAdmin || isResearcher; // Researcher may delete only own (enforced per-row)
  const canExportCSV = isAdmin || isResearcher;
  const canExportPDF = isAdmin;
  const canManageProjects = isAdmin;
  const canManageOrganisms = isAdmin;
  const canManageUsers = isAdmin;
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
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

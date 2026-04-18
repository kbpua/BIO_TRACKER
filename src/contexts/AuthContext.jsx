import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { MOCK_USERS } from '../data/mockData';
import { getUserPassword } from '../store/authStore';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const supabaseEnabled = isSupabaseConfigured();

  const createNotificationDirect = useCallback(async ({
    userId,
    type = 'INFO',
    title,
    description = '',
    linkTo = '/dashboard',
    targetEntity = null,
    targetId = null,
  }) => {
    if (!supabaseEnabled || !supabase || !userId || !title) return;
    const { error } = await supabase.rpc('create_notification', {
      p_user_id: userId,
      p_type: type,
      p_title: title,
      p_description: description,
      p_link_to: linkTo,
      p_target_entity: targetEntity,
      p_target_id: targetId,
    });
    if (error) {
      console.error('create_notification RPC failed:', error.message);
    }
  }, [supabaseEnabled]);

  const [isHydratingSession, setIsHydratingSession] = useState(supabaseEnabled);
  const [authBlockedMessage, setAuthBlockedMessage] = useState('');
  const [user, setUser] = useState(() => {
    if (supabaseEnabled) return null;
    try {
      const stored = sessionStorage.getItem('biosample_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const mapProfileUser = useCallback((profile, fallbackEmail = '') => ({
    id: profile?.legacy_id || profile?.id,
    authId: profile?.id,
    email: profile?.email || fallbackEmail,
    fullName: profile?.full_name || fallbackEmail || 'Unknown User',
    role: profile?.role || 'Student',
    status: profile?.status || 'Pending',
    dateCreated: profile?.date_created || '',
    createdBy: profile?.created_by || 'Self',
    pendingDaysRemaining: profile?.pending_days_remaining ?? undefined,
  }), []);

  const ensureProfileForSessionUser = useCallback(async (sessionUser) => {
    if (!supabaseEnabled || !supabase || !sessionUser?.id) return null;

    let { data: profile } = await supabase
      .from('profiles')
      .select('id,legacy_id,email,full_name,role,status,date_created,created_by,pending_days_remaining')
      .eq('id', sessionUser.id)
      .maybeSingle();

    if (!profile && sessionUser.email) {
      const fallback = await supabase
        .from('profiles')
        .select('id,legacy_id,email,full_name,role,status,date_created,created_by,pending_days_remaining')
        .eq('email', sessionUser.email)
        .maybeSingle();
      profile = fallback.data;
    }

    if (profile) return profile;

    // Auto-provision profile for first-time OAuth users.
    const displayName =
      sessionUser.user_metadata?.full_name ||
      sessionUser.user_metadata?.name ||
      sessionUser.email ||
      'Unknown User';

    const { data: inserted, error: insertError } = await supabase
      .from('profiles')
      .insert({
        id: sessionUser.id,
        email: sessionUser.email || '',
        full_name: displayName,
        role: 'Student',
        status: 'Active',
        created_by: 'Self',
      })
      .select('id,legacy_id,email,full_name,role,status,date_created,created_by,pending_days_remaining')
      .single();

    if (insertError) {
      console.error('Failed to auto-provision profile for OAuth user:', insertError.message);
      // Profile may have been created by a database trigger in the meantime — retry fetch.
      const { data: retryProfile } = await supabase
        .from('profiles')
        .select('id,legacy_id,email,full_name,role,status,date_created,created_by,pending_days_remaining')
        .eq('id', sessionUser.id)
        .maybeSingle();
      return retryProfile || null;
    }

    return inserted || null;
  }, [supabaseEnabled]);

  useEffect(() => {
    if (!supabaseEnabled || !supabase) return undefined;

    let cancelled = false;
    let timeoutId = null;

    const finishHydration = () => {
      if (!cancelled) setIsHydratingSession(false);
    };

    const loadProfileUser = async (sessionUser) => {
      if (!sessionUser) {
        setUser(null);
        finishHydration();
        return;
      }
      try {
        const profile = await ensureProfileForSessionUser(sessionUser);
        if (profile?.status === 'Pending' || profile?.status === 'Deactivated') {
          try { await supabase.auth.signOut({ scope: 'local' }); } catch { /* ignore */ }
          if (!cancelled) {
            setUser(null);
            if (profile.status === 'Pending') {
              setAuthBlockedMessage('Your account is awaiting admin approval. You will be able to sign in once an administrator activates your account.');
            } else {
              setAuthBlockedMessage('Your account has been deactivated. Please contact your administrator.');
            }
          }
          return;
        }
        if (profile) {
          if (!cancelled) setUser(mapProfileUser(profile, sessionUser.email || ''));
        } else {
          // Profile could not be fetched or created (e.g. RLS blocks insert
          // and no DB trigger exists). Build a minimal user from session
          // metadata so the OAuth user is not silently locked out.
          const fallbackName =
            sessionUser.user_metadata?.full_name ||
            sessionUser.user_metadata?.name ||
            sessionUser.email ||
            'Unknown User';
          if (!cancelled) setUser({
            id: sessionUser.id,
            authId: sessionUser.id,
            email: sessionUser.email || '',
            fullName: fallbackName,
            role: 'Student',
            status: 'Active',
            dateCreated: '',
            createdBy: 'Self',
          });
        }
      } catch (error) {
        console.error('Failed to load Supabase profile:', error);
        if (!cancelled) setUser(null);
      } finally {
        finishHydration();
      }
    };

    const hydrateSession = async () => {
      try {
        // If the URL contains an OAuth hash fragment, let onAuthStateChange
        // handle session creation instead of reading a stale (empty) session.
        const hasOAuthHash =
          window.location.hash &&
          (window.location.hash.includes('access_token') || window.location.hash.includes('error'));

        if (!hasOAuthHash) {
          const { data } = await supabase.auth.getSession();
          await loadProfileUser(data?.session?.user || null);
        }
      } catch (error) {
        console.error('Failed to hydrate Supabase session:', error);
        if (!cancelled) {
          setUser(null);
        }
        finishHydration();
      }
    };

    timeoutId = setTimeout(() => {
      console.warn('Supabase session hydration timed out; allowing manual sign-in.');
      finishHydration();
    }, 8000);

    hydrateSession();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      loadProfileUser(session?.user || null);
    });

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
      sub?.subscription?.unsubscribe();
    };
  }, [supabaseEnabled, mapProfileUser, ensureProfileForSessionUser]);

  const login = useCallback(async (email, password, dataUsers = []) => {
    if (supabaseEnabled && supabase) {
      try {
        // Clear any stale persisted session so the auth lock is free.
        try { await supabase.auth.signOut({ scope: 'local' }); } catch { /* ignore */ }

        const signInPromise = supabase.auth.signInWithPassword({ email, password });
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Login timed out. Check your Supabase URL and API key (must be the JWT-format anon key starting with eyJ...).')), 15000)
        );
        const { data, error } = await Promise.race([signInPromise, timeoutPromise]);
        if (error || !data?.user) {
          return { success: false, error: error?.message || 'Invalid email or password.' };
        }
        let { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id,legacy_id,email,full_name,role,status,date_created,created_by,pending_days_remaining')
          .eq('id', data.user.id)
          .maybeSingle();
        if (!profile && !profileError && data.user.email) {
          const fallback = await supabase
            .from('profiles')
            .select('id,legacy_id,email,full_name,role,status,date_created,created_by,pending_days_remaining')
            .eq('email', data.user.email)
            .maybeSingle();
          profile = fallback.data;
          profileError = fallback.error;
        }
        if (profileError || !profile) {
          await supabase.auth.signOut();
          return { success: false, error: 'Profile not found for this account.' };
        }
        if (profile.status === 'Pending') {
          await supabase.auth.signOut();
          return { success: false, error: 'Your account is pending admin approval. Please contact your administrator.' };
        }
        if (profile.status === 'Deactivated') {
          await supabase.auth.signOut();
          return { success: false, error: 'Your account is deactivated. Please contact your administrator.' };
        }
        setUser(mapProfileUser(profile, data.user.email || email));
        return { success: true };
      } catch (err) {
        console.error('Supabase login error:', err);
        return { success: false, error: err?.message || 'Connection error. Check your Supabase configuration.' };
      }
    }

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
  }, [supabaseEnabled, mapProfileUser]);

  const register = useCallback(async ({ fullName, email, password, role = 'Researcher' }) => {
    if (supabaseEnabled && supabase) {
      const desiredStatus = role === 'Researcher' ? 'Pending' : 'Active';
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            created_by: 'Self',
            role,
            status: desiredStatus,
          },
        },
      });
      if (error) return { success: false, error: error.message || 'Registration failed.' };

      const userId = data?.user?.id;
      if (userId && data?.session) {
        await supabase
          .from('profiles')
          .update({
            full_name: fullName,
            role,
            status: desiredStatus,
            created_by: 'Self',
          })
          .eq('id', userId);
      }

      // Admin alerts for new signups are handled in the database (see migration
      // notify_admins_profile_events) so they work even when RLS blocks client RPC inserts.

      if (role === 'Student' && userId) {
        await createNotificationDirect({
          userId,
          type: 'ACCOUNT',
          title: 'Account Created',
          description: 'Your student account has been activated. Welcome aboard.',
          linkTo: '/dashboard',
          targetEntity: 'user',
          targetId: userId,
        });
        await createNotificationDirect({
          userId,
          type: 'INFO',
          title: 'Welcome to BioSample Tracker!',
          description: 'Explore published research projects, samples, and organisms to support your learning.',
          linkTo: '/projects',
          targetEntity: 'project',
          targetId: null,
        });
      }

      // If approval is required, force logout immediately even if
      // Supabase returned a session (e.g. email confirmation disabled).
      if (desiredStatus === 'Pending') {
        try { await supabase.auth.signOut({ scope: 'local' }); } catch { /* ignore */ }
        setUser(null);
      }

      return {
        success: true,
        pendingApproval: desiredStatus === 'Pending',
        requiresEmailVerification: !data?.session,
      };
    }
    return { success: false, error: 'Supabase is not configured.' };
  }, [createNotificationDirect, supabaseEnabled]);

  const loginWithGoogle = useCallback(async () => {
    if (!supabaseEnabled || !supabase) {
      return { success: false, error: 'Google sign-in requires Supabase configuration.' };
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/login`,
      },
    });

    if (error) {
      return { success: false, error: error.message || 'Google sign-in failed.' };
    }
    return { success: true };
  }, [supabaseEnabled]);

  const logout = useCallback(async () => {
    if (supabaseEnabled && supabase) {
      try {
        await supabase.auth.signOut();
      } catch (error) {
        console.error('Failed to sign out from Supabase:', error);
      } finally {
        setUser(null);
      }
      return;
    }
    setUser(null);
    sessionStorage.removeItem('biosample_user');
  }, [supabaseEnabled]);

  const isAdmin = user?.role === 'Admin';
  const isResearcher = user?.role === 'Researcher';
  const isStudent = user?.role === 'Student';
  const canManageSamples = isAdmin || isResearcher;
  const canDeleteSamples = isAdmin || isResearcher; // Researcher may delete only own (enforced per-row)
  const canExportCSV = isAdmin || isResearcher;
  const canManageProjects = isAdmin;
  const canManageOrganisms = isAdmin;
  const canManageUsers = isAdmin;
  const clearAuthBlockedMessage = useCallback(() => setAuthBlockedMessage(''), []);

  const value = {
    user,
    login,
    loginWithGoogle,
    register,
    logout,
    isHydratingSession,
    isSupabaseAuth: supabaseEnabled,
    authBlockedMessage,
    clearAuthBlockedMessage,
    isAdmin,
    isResearcher,
    isStudent,
    canManageSamples,
    canDeleteSamples,
    canExportCSV,
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

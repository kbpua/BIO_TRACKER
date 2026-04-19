import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { MOCK_USERS } from '../data/mockData';
import { getUserPassword } from '../store/authStore';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { isGoogleAuthUser } from '../utils/oauthProvider';

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
  const [googleRegistrationUi, setGoogleRegistrationUi] = useState(null);
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

  const fetchProfileDirect = useCallback(async (sessionUser) => {
    if (!sessionUser?.id || !supabaseEnabled || !supabase) return null;
    const selectCols =
      'id,legacy_id,email,full_name,role,status,date_created,created_by,pending_days_remaining';
    let { data: profile } = await supabase
      .from('profiles')
      .select(selectCols)
      .eq('id', sessionUser.id)
      .maybeSingle();
    if (!profile && sessionUser.email) {
      const { data: byEmail } = await supabase
        .from('profiles')
        .select(selectCols)
        .eq('email', sessionUser.email)
        .maybeSingle();
      profile = byEmail || null;
    }
    return profile;
  }, [supabaseEnabled]);

  const applyResolvedProfile = useCallback(
    async ({ sessionUser, profile, cancelled }) => {
      if (profile?.status === 'Deactivated') {
        try { await supabase.auth.signOut({ scope: 'local' }); } catch { /* ignore */ }
        if (!cancelled) {
          setUser(null);
          setGoogleRegistrationUi(null);
          setAuthBlockedMessage('Your account has been deactivated. Please contact your administrator.');
        }
        return;
      }

      if (profile?.status === 'Pending') {
        if (isGoogleAuthUser(sessionUser)) {
          if (!cancelled) {
            setUser(null);
            setGoogleRegistrationUi({ step: 'pending_researcher', profile });
          }
          return;
        }
        try { await supabase.auth.signOut({ scope: 'local' }); } catch { /* ignore */ }
        if (!cancelled) {
          setUser(null);
          setGoogleRegistrationUi(null);
          setAuthBlockedMessage(
            'Your account is awaiting admin approval. You will be able to sign in once an administrator activates your account.'
          );
        }
        return;
      }

      if (!cancelled) {
        setUser(mapProfileUser(profile, sessionUser.email || ''));
        setGoogleRegistrationUi(null);
      }
    },
    [mapProfileUser]
  );

  const loadProfileUser = useCallback(
    async (sessionUser, options = {}) => {
      const { cancelled = false, finishHydration = () => {} } = options;
      try {
        if (!sessionUser) {
          if (!cancelled) {
            setUser(null);
            // Do not clear googleRegistrationUi here: onAuthStateChange can emit a null
            // session before OAuth hash is processed; clearing would strand users on /login.
          }
          return;
        }

        if (!supabaseEnabled || !supabase) {
          return;
        }

        const { data: resolved, error: rpcError } = await supabase.rpc('resolve_oauth_profile');

        // If the RPC is unavailable or errors, fall back to a direct profiles SELECT
        // so existing accounts (especially normal email/password) keep working.
        if (rpcError) {
          console.error('resolve_oauth_profile failed, falling back to direct profile lookup:', rpcError.message);
          const profile = await fetchProfileDirect(sessionUser);
          if (!profile) {
            if (isGoogleAuthUser(sessionUser)) {
              if (!cancelled) {
                setUser(null);
                setGoogleRegistrationUi({
                  step: 'needs_role',
                  email: sessionUser.email || '',
                  defaultFullName:
                    sessionUser.user_metadata?.full_name ||
                    sessionUser.user_metadata?.name ||
                    '',
                });
              }
              return;
            }
            if (!cancelled) setUser(null);
            return;
          }
          await applyResolvedProfile({ sessionUser, profile, cancelled });
          return;
        }

        const kind = resolved?.kind;

        if (kind === 'email_exists_other_account') {
          try { await supabase.auth.signOut({ scope: 'local' }); } catch { /* ignore */ }
          if (!cancelled) {
            setUser(null);
            setGoogleRegistrationUi(null);
            setAuthBlockedMessage(
              'An account with this email already exists. Please contact your administrator.'
            );
          }
          return;
        }

        if (kind === 'no_profile') {
          if (!isGoogleAuthUser(sessionUser)) {
            // Safety net: maybe RLS made resolve_oauth_profile miss this user. Try direct.
            const profile = await fetchProfileDirect(sessionUser);
            if (profile) {
              await applyResolvedProfile({ sessionUser, profile, cancelled });
              return;
            }
            try { await supabase.auth.signOut({ scope: 'local' }); } catch { /* ignore */ }
            if (!cancelled) {
              setUser(null);
              setGoogleRegistrationUi(null);
              setAuthBlockedMessage(
                'Your account is not fully set up. Please contact your administrator.'
              );
            }
            return;
          }
          if (!cancelled) {
            setUser(null);
            setGoogleRegistrationUi({
              step: 'needs_role',
              email: sessionUser.email || '',
              defaultFullName:
                sessionUser.user_metadata?.full_name ||
                sessionUser.user_metadata?.name ||
                '',
            });
          }
          return;
        }

        if (kind === 'profile') {
          await applyResolvedProfile({
            sessionUser,
            profile: resolved.profile,
            cancelled,
          });
          return;
        }

        // Unknown kind: don't clobber existing user state.
      } catch (err) {
        console.error('Failed to load Supabase profile:', err);
        // Leave user as-is; login() or subsequent events will correct it.
      } finally {
        if (!cancelled) finishHydration();
      }
    },
    [applyResolvedProfile, fetchProfileDirect, supabaseEnabled]
  );

  useEffect(() => {
    if (!supabaseEnabled || !supabase) return undefined;

    let cancelled = false;
    let timeoutId = null;

    const finishHydration = () => {
      if (!cancelled) setIsHydratingSession(false);
    };

    const runLoad = async (sessionUser) => {
      await loadProfileUser(sessionUser, { cancelled, finishHydration });
    };

    // Use onAuthStateChange for hydration: Supabase fires INITIAL_SESSION *after*
    // it finishes the PKCE code exchange from ?code=..., so we always see the
    // post-OAuth session here instead of racing with getSession().
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        if (!cancelled) {
          setUser(null);
          setGoogleRegistrationUi(null);
        }
        finishHydration();
        return;
      }
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        void runLoad(session?.user || null);
      }
    });

    // Fallback: if INITIAL_SESSION doesn't arrive for some reason, end hydration.
    timeoutId = setTimeout(() => {
      console.warn('Supabase session hydration timed out; allowing manual sign-in.');
      finishHydration();
    }, 8000);

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
      sub?.subscription?.unsubscribe();
    };
  }, [supabaseEnabled, loadProfileUser]);

  const completeGoogleProfileRegistration = useCallback(
    async ({ fullName, role }) => {
      if (!supabaseEnabled || !supabase) {
        return { success: false, error: 'Supabase is not configured.' };
      }
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      const authUser = authData?.user;
      if (authErr || !authUser) {
        return { success: false, error: 'Session expired. Please sign in with Google again.' };
      }

      const { data: resolved, error: rErr } = await supabase.rpc('resolve_oauth_profile');
      if (rErr) {
        return { success: false, error: rErr.message || 'Could not verify account state.' };
      }
      if (resolved?.kind === 'profile') {
        return { success: false, error: 'Profile already exists.' };
      }
      if (resolved?.kind === 'email_exists_other_account') {
        return { success: false, error: 'duplicate_email' };
      }
      if (resolved?.kind !== 'no_profile') {
        return { success: false, error: 'Unable to complete registration.' };
      }

      const trimmedName = String(fullName || '').trim();
      if (!trimmedName) {
        return { success: false, error: 'Please enter your full name.' };
      }

      const { data: legacyId, error: legErr } = await supabase.rpc('generate_profile_legacy_id', {
        p_role: role,
        p_full_name: trimmedName,
      });
      if (legErr || !legacyId) {
        return { success: false, error: legErr?.message || 'Could not generate user ID.' };
      }

      const status = role === 'Researcher' ? 'Pending' : 'Active';
      const pendingDays = role === 'Researcher' ? 3 : null;

      const { error: insErr } = await supabase.from('profiles').insert({
        id: authUser.id,
        legacy_id: legacyId,
        email: authUser.email || '',
        full_name: trimmedName,
        role,
        status,
        created_by: 'Self',
        pending_days_remaining: pendingDays,
      });

      if (insErr) {
        return { success: false, error: insErr.message || 'Failed to create profile.' };
      }

      setGoogleRegistrationUi(null);

      if (role === 'Researcher') {
        try {
          await supabase.auth.signOut({ scope: 'local' });
        } catch {
          /* ignore */
        }
        setUser(null);
        return { success: true, outcome: 'researcher_pending' };
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('id,legacy_id,email,full_name,role,status,date_created,created_by,pending_days_remaining')
        .eq('id', authUser.id)
        .single();

      if (profile) {
        setUser(mapProfileUser(profile, authUser.email || ''));
      }

      await createNotificationDirect({
        userId: authUser.id,
        type: 'ACCOUNT',
        title: 'Account Created',
        description: 'Your student account has been activated. Welcome aboard.',
        linkTo: '/dashboard',
        targetEntity: 'user',
        targetId: authUser.id,
      });
      await createNotificationDirect({
        userId: authUser.id,
        type: 'INFO',
        title: 'Welcome to BioSample Tracker!',
        description:
          'Explore published research projects, samples, and organisms to support your learning.',
        linkTo: '/projects',
        targetEntity: 'project',
        targetId: null,
      });

      return { success: true, outcome: 'student_active' };
    },
    [createNotificationDirect, mapProfileUser, supabaseEnabled]
  );

  const refreshGooglePendingProfile = useCallback(async () => {
    if (!supabaseEnabled || !supabase) return { nowActive: false };
    const { data: resolved, error } = await supabase.rpc('resolve_oauth_profile');
    if (error) {
      console.error('resolve_oauth_profile failed:', error.message);
      return { nowActive: false, error: error.message };
    }
    if (resolved?.kind !== 'profile') {
      return { nowActive: false };
    }
    const profile = resolved.profile;
    const { data: authData } = await supabase.auth.getUser();
    const email = authData?.user?.email || '';

    if (profile.status === 'Active') {
      setUser(mapProfileUser(profile, email));
      setGoogleRegistrationUi(null);
      return { nowActive: true };
    }

    if (profile.status === 'Pending' && isGoogleAuthUser(authData?.user)) {
      setGoogleRegistrationUi({ step: 'pending_researcher', profile });
    }

    return { nowActive: false };
  }, [mapProfileUser, supabaseEnabled]);

  const cancelGoogleRegistration = useCallback(async () => {
    if (supabaseEnabled && supabase) {
      try {
        await supabase.auth.signOut();
      } catch (e) {
        console.error('Sign out failed:', e);
      }
    }
    setGoogleRegistrationUi(null);
    setUser(null);
  }, [supabaseEnabled]);

  const login = useCallback(async (email, password, dataUsers = []) => {
    if (supabaseEnabled && supabase) {
      try {
        try {
          await supabase.auth.signOut({ scope: 'local' });
        } catch {
          /* ignore */
        }

        const signInPromise = supabase.auth.signInWithPassword({ email, password });
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(
            () =>
              reject(
                new Error(
                  'Login timed out. Check your Supabase URL and API key (must be the JWT-format anon key starting with eyJ...).'
                )
              ),
            15000
          )
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
          return {
            success: false,
            error: 'Your account is pending admin approval. Please contact your administrator.',
          };
        }
        if (profile.status === 'Deactivated') {
          await supabase.auth.signOut();
          return { success: false, error: 'Your account is deactivated. Please contact your administrator.' };
        }
        setUser(mapProfileUser(profile, data.user.email || email));
        setGoogleRegistrationUi(null);
        return { success: true };
      } catch (err) {
        console.error('Supabase login error:', err);
        return {
          success: false,
          error: err?.message || 'Connection error. Check your Supabase configuration.',
        };
      }
    }

    const emailLower = email.toLowerCase();
    const foundMock = MOCK_USERS.find(
      (u) => u.email.toLowerCase() === emailLower && u.password === password
    );
    if (foundMock) {
      const { password: _, ...userWithoutPassword } = foundMock;
      if (userWithoutPassword.status === 'Pending') {
        return {
          success: false,
          error: 'Your account is pending admin approval. Please contact your administrator.',
        };
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
        return {
          success: false,
          error: 'Your account is pending admin approval. Please contact your administrator.',
        };
      }
      const { password: __, ...userWithoutPassword } = { ...foundData };
      setUser(userWithoutPassword);
      sessionStorage.setItem('biosample_user', JSON.stringify(userWithoutPassword));
      return { success: true };
    }
    return { success: false, error: 'Invalid email or password.' };
  }, [supabaseEnabled, mapProfileUser]);

  const register = useCallback(
    async ({ fullName, email, password, role = 'Researcher' }) => {
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
              pending_days_remaining: role === 'Researcher' ? 3 : null,
            })
            .eq('id', userId);
        }

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
            description:
              'Explore published research projects, samples, and organisms to support your learning.',
            linkTo: '/projects',
            targetEntity: 'project',
            targetId: null,
          });
        }

        if (desiredStatus === 'Pending') {
          try {
            await supabase.auth.signOut({ scope: 'local' });
          } catch {
            /* ignore */
          }
          setUser(null);
        }

        return {
          success: true,
          pendingApproval: desiredStatus === 'Pending',
          requiresEmailVerification: !data?.session,
        };
      }
      return { success: false, error: 'Supabase is not configured.' };
    },
    [createNotificationDirect, supabaseEnabled]
  );

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
        setGoogleRegistrationUi(null);
      }
      return;
    }
    setUser(null);
    setGoogleRegistrationUi(null);
    sessionStorage.removeItem('biosample_user');
  }, [supabaseEnabled]);

  const isAdmin = user?.role === 'Admin';
  const isResearcher = user?.role === 'Researcher';
  const isStudent = user?.role === 'Student';
  const canManageSamples = isAdmin || isResearcher;
  const canDeleteSamples = isAdmin || isResearcher;
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
    googleRegistrationUi,
    completeGoogleProfileRegistration,
    refreshGooglePendingProfile,
    cancelGoogleRegistration,
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

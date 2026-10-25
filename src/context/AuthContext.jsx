import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import dataService, { isMock } from '../lib/dataService';

// Global authentication state.
// Mock mode    : session lives in localStorage (mock backend).
// Supabase mode: Supabase Auth sessions — this context additionally
//                subscribes to onAuthStateChange so sign-in/out, email
//                confirmations and recovery links reflect app-wide instantly.
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    dataService
      .getSession()
      .then((session) => {
        if (!cancelled && session) setUser(session.user);
      })
      .catch(() => {
        /* not signed in */
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Supabase mode: react to auth events (sign in/out, email confirmation,
  // recovery link sessions) even when they start outside this component.
  useEffect(() => {
    if (isMock || typeof dataService.onAuthStateChange !== 'function') return undefined;
    let cancelled = false;
    const unsubscribe = dataService.onAuthStateChange(async (event, sessionUser) => {
      if (cancelled) return;
      if (event === 'SIGNED_OUT') {
        setUser(null);
        return;
      }
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'USER_UPDATED') {
        if (!sessionUser) {
          setUser(null);
          return;
        }
        const session = await dataService.getSession();
        if (!cancelled) setUser(session ? session.user : null);
      }
    });
    return () => {
      cancelled = true;
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  const login = useCallback(async (email, password) => {
    const { user: u } = await dataService.login({ email, password });
    setUser(u);
    return u;
  }, []);

  const register = useCallback((data) => dataService.register(data), []);
  const verifyEmail = useCallback((email) => dataService.verifyEmail(email), []);
  const requestPasswordReset = useCallback((email) => dataService.requestPasswordReset(email), []);
  const resetPassword = useCallback((data) => dataService.resetPassword(data), []);

  const logout = useCallback(async () => {
    await dataService.logout();
    setUser(null);
  }, []);

  // Re-reads the session (used after profile updates, since the profile
  // travels inside the user object).
  const refreshUser = useCallback(async () => {
    const session = await dataService.getSession();
    setUser(session ? session.user : null);
  }, []);

  const isAdmin = user?.profile?.role === 'admin';

  const value = {
    user,
    loading,
    isAdmin,
    login,
    register,
    verifyEmail,
    logout,
    requestPasswordReset,
    resetPassword,
    refreshUser
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import dataService from '../lib/dataService';

// Global authentication state. Phase 1: backed by the mock backend.
// Phase 2: same API, backed by Supabase Auth sessions.
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

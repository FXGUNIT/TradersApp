import { useState, useEffect, createContext, useContext, useCallback, useRef } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '../services/firebase';

const AuthContext = createContext(null);

// Firebase ID tokens expire after ~1 hour. Refresh proactively at 50 min.
const TOKEN_REFRESH_INTERVAL_MS = 50 * 60 * 1000;
const AUTH_SYNC_CHANNEL = 'traders-auth-sync';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(() => !!auth);
  const [error, setError] = useState(null);
  const refreshTimerRef = useRef(null);
  const channelRef = useRef(null);

  // ── Proactive token refresh ────────────────────────────────────────────────
  const scheduleTokenRefresh = useCallback((firebaseUser) => {
    if (!firebaseUser) return;
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current);
    }
    refreshTimerRef.current = setInterval(async () => {
      try {
        await firebaseUser.getIdToken(true);
        console.debug('[useAuth] Token refreshed proactively');
      } catch (err) {
        console.warn('[useAuth] Proactive token refresh failed:', err?.message);
        // If refresh fails (e.g. account deleted), sign out
        try { await signOut(auth); } catch { /* noop */ }
      }
    }, TOKEN_REFRESH_INTERVAL_MS);
  }, []);

  // ── Cross-tab session sync via BroadcastChannel ───────────────────────────
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;

    const channel = new BroadcastChannel(AUTH_SYNC_CHANNEL);
    channelRef.current = channel;

    channel.onmessage = (event) => {
      const { type, uid } = event.data ?? {};
      if (!type) return;

      if (type === 'logout') {
        // Another tab signed out — converge this tab to signed-out state
        console.debug('[useAuth] Received logout broadcast from another tab');
        if (auth && auth.currentUser) {
          signOut(auth).catch(() => {/* noop */});
        }
      } else if (type === 'token_refreshed' && uid && user?.uid === uid) {
        // Token refreshed in another tab — trigger local refresh
        console.debug('[useAuth] Token refreshed in another tab, syncing');
        if (auth?.currentUser) {
          auth.currentUser.getIdToken(true).catch(() => {/* noop */});
        }
      }
    };

    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, [user?.uid]);

  // ── Broadcast local sign-out so other tabs converge ────────────────────────
  const broadcastLogout = useCallback(() => {
    channelRef.current?.postMessage({ type: 'logout', uid: user?.uid });
  }, [user?.uid]);

  // ── Firebase auth state listener ──────────────────────────────────────────
  useEffect(() => {
    if (!auth) {
      return;
    }

    const unsubscribe = onAuthStateChanged(
      auth,
      (firebaseUser) => {
        setUser(firebaseUser);
        setLoading(false);
        if (firebaseUser) {
          scheduleTokenRefresh(firebaseUser);
        } else {
          if (refreshTimerRef.current) {
            clearInterval(refreshTimerRef.current);
            refreshTimerRef.current = null;
          }
        }
      },
      (err) => {
        setError(err);
        setLoading(false);
      },
    );

    return () => {
      unsubscribe();
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
    };
  }, [scheduleTokenRefresh]);

  // ── Sign-out helper that also broadcasts ───────────────────────────────────
  const handleSignOut = useCallback(async () => {
    broadcastLogout();
    if (auth) {
      await signOut(auth);
    }
  }, [broadcastLogout]);

  const value = {
    user,
    loading,
    error,
    isAuthenticated: !!user,
    isAdmin: user?.uid === 'N3z04ZYCleZjOApobL3VZepaOwi1',
    signOut: handleSignOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default useAuth;


import { useEffect, useRef } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../../services/firebase.js";
import {
  clearPendingGoogleSignup,
} from "./authFlowStorage.js";

/**
 * Bootstraps the Firebase auth state listener, syncing Firebase session to app state.
 * App.jsx no longer holds Firebase plumbing directly.
 */
export function useAuthBootstrap({
  checkUserStatus,
  isAdminAuthenticated,
  setAuth,
  setProfile,
  setGoogleUser,
  setScreen,
  setIsInitialLoading,
}) {
  const authBootstrapCompleteRef = useRef(false);

  useEffect(() => {
    if (!auth) {
      // Firebase not configured — proceed to login screen after a brief moment
      const timer = setTimeout(() => {
        if (!authBootstrapCompleteRef.current) {
          authBootstrapCompleteRef.current = true;
          setScreen("login");
          setIsInitialLoading(false);
        }
      }, 3000);
      return () => clearTimeout(timer);
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        const auditHarnessEnabled =
          typeof window !== "undefined" &&
          import.meta.env.DEV &&
          Boolean(window.__TradersAppAudit);
        if (auditHarnessEnabled) {
          return;
        }

        const auditMode =
          typeof window !== "undefined" &&
          window.__TRADERS_AUDIT_DATA?.active === true;
        if (auditMode) {
          return;
        }

        if (user) {
          if (isAdminAuthenticated) {
            return;
          }

          try {
            await user.reload();
          } catch (reloadError) {
            console.warn("Auth user reload skipped:", reloadError.message);
          }

          try {
            const token = await user.getIdToken(true);
            const authData = {
              uid: user.uid,
              token,
              refreshToken: user.refreshToken,
              email: user.email,
              emailVerified: user.emailVerified,
            };
            setAuth(authData);
            await checkUserStatus(authData);
          } catch (tokenError) {
            console.warn(
              "Token refresh failed, trying non-refreshed token:",
              tokenError.message,
            );
            try {
              const token = await user.getIdToken(false);
              const authData = {
                uid: user.uid,
                token,
                refreshToken: user.refreshToken,
                email: user.email,
                emailVerified: user.emailVerified,
              };
              setAuth(authData);
              await checkUserStatus(authData);
            } catch (fallbackError) {
              console.warn(
                "All token methods failed but user exists in Firebase:",
                fallbackError.message,
              );
            }
          }
        } else if (!isAdminAuthenticated) {
          setAuth(null);
          setProfile(null);
          setGoogleUser(null);
          clearPendingGoogleSignup();
          setScreen("login");
        }
      } catch (error) {
        console.error("Auth state change error:", error);
      } finally {
        if (!authBootstrapCompleteRef.current) {
          authBootstrapCompleteRef.current = true;
          setIsInitialLoading(false);
        }
      }
    });

    return () => unsubscribe();
  }, [checkUserStatus, isAdminAuthenticated, setAuth, setProfile, setGoogleUser, setScreen, setIsInitialLoading]);
}

export default useAuthBootstrap;

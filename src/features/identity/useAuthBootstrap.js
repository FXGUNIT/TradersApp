import { useEffect, useRef } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../../services/firebase.js";
import {
  clearPendingGoogleSignup,
} from "./authFlowStorage.js";
const AUDIT_MODE_KEY = "TradersApp_AuditMode";

/** Wrap any promise with a timeout — resolves to null on timeout. */
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

function isAuditBootstrapRuntime() {
  if (typeof window === "undefined") {
    return false;
  }

  if (
    window.__TRADERS_UI_AUDIT__ === true ||
    window.__TRADERS_AUDIT_DATA?.active === true ||
    Boolean(window.__TradersAppAudit)
  ) {
    return true;
  }

  try {
    return localStorage.getItem(AUDIT_MODE_KEY) === "true";
  } catch {
    return false;
  }
}

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
  authBootstrapCompleteRef: externalAuthBootstrapCompleteRef,
}) {
  const internalAuthBootstrapCompleteRef = useRef(false);
  const authBootstrapCompleteRef =
    externalAuthBootstrapCompleteRef || internalAuthBootstrapCompleteRef;

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

    // Safety timeout: if Firebase auth doesn't respond within 8s, go to login
    const authTimeout = setTimeout(() => {
      if (!authBootstrapCompleteRef.current) {
        authBootstrapCompleteRef.current = true;
        console.warn("[AuthBootstrap] Firebase auth timed out — proceeding to login");
        setScreen("login");
        setIsInitialLoading(false);
      }
    }, 8000);

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        if (isAuditBootstrapRuntime()) {
          clearTimeout(authTimeout);
          if (!authBootstrapCompleteRef.current) {
            authBootstrapCompleteRef.current = true;
            setIsInitialLoading(false);
          }
          return;
        }

        if (user) {
          if (isAdminAuthenticated) {
            return;
          }

          // Wrap network calls with 5s timeout to prevent hanging
          await withTimeout(user.reload(), 5000);

          const token = await withTimeout(user.getIdToken(true), 5000);
          if (!token) {
            // Timed out or failed — proceed without token
            console.warn("[AuthBootstrap] Token fetch timed out, proceeding without auth");
          }

          const authData = {
            uid: user.uid,
            token: token || null,
            refreshToken: user.refreshToken,
            email: user.email,
            emailVerified: user.emailVerified,
          };
          setAuth(authData);

          // checkUserStatus can also hang — give it 5s max
          await withTimeout(checkUserStatus(authData), 5000);
        } else {
          setAuth(null);
          setProfile(null);
          setGoogleUser(null);
          clearPendingGoogleSignup();
          setScreen("login");
        }
      } catch (error) {
        console.error("Auth state change error:", error);
        setAuth(null);
        setScreen("login");
      } finally {
        clearTimeout(authTimeout);
        if (!authBootstrapCompleteRef.current) {
          authBootstrapCompleteRef.current = true;
          setIsInitialLoading(false);
        }
      }
    });

    return () => {
      clearTimeout(authTimeout);
      unsubscribe();
    };
  }, [
    authBootstrapCompleteRef,
    checkUserStatus,
    isAdminAuthenticated,
    setAuth,
    setProfile,
    setGoogleUser,
    setScreen,
    setIsInitialLoading,
  ]);
}

export default useAuthBootstrap;

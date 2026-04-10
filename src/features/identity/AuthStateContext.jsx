/**
 * AuthStateContext — owns auth + bootstrap + screen routing state
 * Extracted from App.jsx (I07)
 *
 * State: auth, profile, googleUser, screen, isInitialLoading, sessionId.
 * Consumed by: AppShellProvider, AppScreenRegistry, DiamondNavigationLattice
 */
import React, { createContext, useContext, useRef, useState } from "react";
import { SCREEN_IDS } from "../shell/screenIds.js";
import {
  readPendingGoogleSignup,
} from "./authFlowStorage.js";

export const AuthStateContext = createContext(null);

export function AuthStateProvider({ children }) {
  // ── Auth state ───────────────────────────────────────────────────────────
  const [auth, setAuth] = useState(null);
  const [profile, setProfile] = useState(null);
  const [googleUser, setGoogleUser] = useState(() => readPendingGoogleSignup());
  const [, _setActiveSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);

  // ── Screen routing ────────────────────────────────────────────────────────
  const [screen, setScreen] = useState(SCREEN_IDS.LOADING);

  // ── Bootstrap ─────────────────────────────────────────────────────────────
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const authBootstrapCompleteRef = useRef(false);
  const hardTimeoutRef = useRef(false);

  const value = {
    // State
    auth,
    profile,
    googleUser,
    currentSessionId,
    screen,
    isInitialLoading,
    authBootstrapCompleteRef,
    hardTimeoutRef,
    // Setters
    setAuth,
    setProfile,
    setGoogleUser,
    setCurrentSessionId,
    setScreen,
    setIsInitialLoading,
    // Constants
    SCREEN_IDS,
  };

  return (
    <AuthStateContext.Provider value={value}>
      {children}
    </AuthStateContext.Provider>
  );
}

/** Hook to consume auth state — throws if outside provider */
export function useAuthState() {
  const ctx = useContext(AuthStateContext);
  if (!ctx) throw new Error("useAuthState must be used within AuthStateProvider");
  return ctx;
}

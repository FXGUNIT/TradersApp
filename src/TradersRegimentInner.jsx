/* eslint-disable */
/**
 * TradersRegimentInner — inner app (I07 + I09 continuation)
 * Extracted from App.jsx to achieve ≤300L on App.jsx itself.
 * Imports screen/shell helpers from TradersRegimentInner.render.jsx.
 *
 * Architecture:
 *   App.jsx                        — thin shell: imports + providers + JSX mount (28L)
 *   TradersRegimentInner.jsx       — inner component with all state (~290L)
 *   TradersRegimentInner.render.jsx — screen + shell JSX helpers (~175L)
 *   AuthStateContext               — auth/screen/bootstrap state
 *   AdminAccessContext             — admin gate state + handlers
 *   features/identity/useAuthSessionHandlers — auth action handlers
 *   features/admin-security/useAdminAccessHandlers — admin gate handlers
 */
import React, {
  useState,
  useCallback,
  useEffect,
  Suspense,
} from "react";
import emailjs from "@emailjs/browser";

import LoadingFallback from "./features/shell/LoadingFallback.jsx";
import SplashScreen from "./features/shell/SplashScreen.jsx";
import { useTheme } from "./hooks/useTheme.jsx";
import { getRandomQuote } from "./features/shell/appShellChrome.jsx";
import { useMaintenanceMode } from "./features/shell/useMaintenanceMode.js";
import {
  useToastNotifications,
  setAudioMuted,
} from "./features/shell/useToastNotifications.js";
import { useSessionFatigue } from "./features/shell/useSessionFatigue.js";
import { useAdminDiagnosticsEffects } from "./features/shell/useAdminDiagnosticsEffects.js";
import { useTelegramDiagnosticsAuditEffect } from "./features/shell/useTelegramDiagnosticsAuditEffect.js";
import { useAdminSessionRestoreEffect } from "./features/shell/useAdminSessionRestoreEffect.js";
import { useDashboardMotionEffect } from "./features/shell/useDashboardMotionEffect.js";
import { useConnectionStatusEffect } from "./features/shell/useConnectionStatusEffect.js";
import { useResizeOptimizationEffect } from "./features/shell/useResizeOptimizationEffect.js";
import { useFirebaseHeartbeatEffect } from "./features/shell/useFirebaseHeartbeatEffect.js";
import { useDevAuditHarnessEffect } from "./features/shell/useDevAuditHarnessEffect.js";
import { useDesktopClientPolicy } from "./features/shell/useDesktopClientPolicy.js";
import { useAuthBootstrap } from "./features/identity/useAuthBootstrap.js";
import { useTerminalWorkspaceHydration } from "./features/shell/useTerminalWorkspaceHydration.js";
import { useTerminalPersistenceHandlers } from "./features/terminal/useTerminalPersistenceHandlers.js";
import {
  getAIStatusesDetailed,
  checkAllAIStatus,
  startAIStatusScheduler,
  stopAIStatusScheduler,
  quadCoreStatus as aiQuadCoreStatus,
} from "./services/ai-router.js";
import {
  getInitialWatchtowerStatus,
  startWatchtower,
  stopWatchtower,
} from "./services/watchtower.js";
import { ADMIN_EMAIL, ADMIN_UID } from "./services/firebase.js";
import {
  listUsers as _listAdminUsers,
  approveUser as _approveAdminUser,
  blockUser as _blockAdminUser,
  fetchMaintenanceState as _fetchMaintenanceState,
  toggleMaintenanceState as _toggleMaintenanceState,
} from "./services/clients/AdminSecurityClient.js";
import {
  loadWorkspace as loadTerminalWorkspace,
  saveAccountState as saveTerminalAccountState,
  saveFirmRules as saveTerminalFirmRules,
  saveJournal as saveTerminalJournal,
} from "./services/clients/TerminalClient.js";
import {
  submitApplication as submitOnboardingApplication,
} from "./services/clients/OnboardingClient.js";
import { AppProviders } from "./features/identity/AppProviders.jsx";
import { useAuthState } from "./features/identity/AuthStateContext.jsx";
import { useAdminAccess } from "./features/admin-security/AdminAccessContext.jsx";
import { useAuthSessionHandlers } from "./features/identity/useAuthSessionHandlers.js";
import {
  isValidGmailAddress,
  isPasswordExpired,
} from "./utils/securityUtils.js";
import {
  getLoginRateLimitRemainingMs,
  formatCooldown,
  clearLoginFailures,
  recordLoginFailure,
} from "./features/identity/authFlowStorage.js";
import {
  readPendingGoogleSignup,
  persistPendingGoogleSignup,
  clearPendingGoogleSignup,
  resolveRestorableScreen,
  resolveConsciousnessReturnScreen,
  persistLastScreen,
  persistConsciousnessReturnScreen,
  isRestorableScreen,
} from "./features/identity/authFlowStorage.js";
import { buildPendingProfile } from "./features/identity/authSessionUtils.js";
import {
  findUserByEmail as findIdentityUserByEmail,
  loadUserProfile as loadIdentityUserProfile,
  provisionUserRecord as provisionIdentityUserRecord,
  updateLoginSecurityCounters,
} from "./services/clients/IdentityClient.js";
import { sendForensicAlert } from "./utils/securityAlertUtils.js";
import { sendWelcomeEmail } from "./utils/email.js";
import { sendTelegramAlert } from "./utils/securityAlertUtils.js";
import {
  buildScreenContent,
  buildAppShell,
} from "./TradersRegimentInner.render.jsx";

import "./features/shell/registerLegacyRuntimeStyles.js";
import "./styles/global.css";
import "./index.css";

// J01: Telegram tokens removed from browser bundle — diagnostic hooks degrade gracefully
// when passed null. Real sends route through BFF at /telegram/send-message.
const TELEGRAM_TOKEN = null;
const TELEGRAM_CHAT_ID = null;
const ENABLE_TELEGRAM_DIAGNOSTICS =
  import.meta.env.VITE_ENABLE_TELEGRAM_DIAGNOSTICS === "true";
const fetchMaintenanceStateFn = null;
const toggleMaintenanceStateFn = null;

// ── Inner app (consumes both contexts) ──────────────────────────────────────
function TradersRegimentInner() {
  const { currentTheme, setTheme: setAppTheme, theme } = useTheme();
  const {
    auth, setAuth,
    profile, setProfile,
    googleUser, setGoogleUser,
    currentSessionId, setCurrentSessionId,
    screen, setScreen,
    isInitialLoading, setIsInitialLoading,
    authBootstrapCompleteRef,
    hardTimeoutRef,
    SCREEN_IDS: _SCREEN_IDS,
  } = useAuthState();
  const {
    totpCode, setTotpCode,
    showAdminPrompt, setShowAdminPrompt,
    adminMasterEmail, setAdminMasterEmail,
    adminMasterEmailVerified, setAdminMasterEmailVerified,
    adminOtpStep, setAdminOtpStep,
    adminOtpsVerified, setAdminOtpsVerified,
    adminOtps, setAdminOtps,
    adminOtpErr, setAdminOtpErr,
    totpErr, setTotpErr,
    
    isAdminAuthenticated, setIsAdminAuthenticated,
    sendAdminOTPs,
    handleAdminAccess,
    resetAdminPromptState,
    handleAdminVerifyCodes,
    handleAdminRequestNewCodes,
  } = useAdminAccess();

  const { toasts, showToast, dismissToast } = useToastNotifications();

  // ── Hard timeout fallback ──────────────────────────────────────────────────
  useEffect(() => {
    if (hardTimeoutRef.current || !isInitialLoading) return;
    const timer = setTimeout(() => {
      if (hardTimeoutRef.current || authBootstrapCompleteRef.current || !isInitialLoading) return;
      hardTimeoutRef.current = true;
      authBootstrapCompleteRef.current = true;
      console.warn("[App] Auth hard timeout — forcing to login screen");
      setScreen("login");
      setIsInitialLoading(false);
    }, 20000);
    return () => clearTimeout(timer);
  }, [authBootstrapCompleteRef, isInitialLoading, setScreen, setIsInitialLoading]);

  // ── Audio mute ─────────────────────────────────────────────────────────────
  const [isAudioMuted, setIsAudioMuted] = useState(() => {
    try { return localStorage.getItem("audio_muted") === "true"; } catch { return false; }
  });
  useEffect(() => {
    setAudioMuted(isAudioMuted);
    try { localStorage.setItem("audio_muted", String(isAudioMuted)); } catch { /* best-effort */ }
  }, [isAudioMuted]);

  // ── Session fatigue ─────────────────────────────────────────────────────────
  const { start: startFatigue, stop: stopFatigue } = useSessionFatigue();
  useEffect(() => {
    if (auth?.uid) startFatigue();
    return () => stopFatigue();
  }, [auth?.uid]);

  // ── AI status scheduler ────────────────────────────────────────────────────
  const [aiStatuses, setAiStatuses] = useState(() => getAIStatusesDetailed());
  const [watchtowerStatus, setWatchtowerStatus] = useState(() =>
    getInitialWatchtowerStatus(),
  );
  useEffect(() => {
    if (!auth?.uid) {
      stopAIStatusScheduler();
      checkAllAIStatus().then(() => setAiStatuses(getAIStatusesDetailed()));
      return () => stopAIStatusScheduler();
    }
    startAIStatusScheduler(setAiStatuses);
    return () => stopAIStatusScheduler();
  }, [auth?.uid]);
  useEffect(() => {
    if (!auth?.uid) {
      stopWatchtower();
      setWatchtowerStatus(getInitialWatchtowerStatus());
      return () => stopWatchtower();
    }
    startWatchtower(setWatchtowerStatus);
    return () => stopWatchtower();
  }, [auth?.uid]);

  // ── Screen persistence ─────────────────────────────────────────────────────
  const [consciousnessReturnScreen, setConsciousnessReturnScreen] = useState("hub");
  useEffect(() => {
    if (!auth?.uid || !isRestorableScreen(screen)) return;
    persistLastScreen(auth.uid, screen);
  }, [auth?.uid, screen]);
  useEffect(() => {
    if (!auth?.uid || screen !== _SCREEN_IDS?.CONSCIOUSNESS || !isRestorableScreen(consciousnessReturnScreen)) return;
    persistConsciousnessReturnScreen(auth.uid, consciousnessReturnScreen);
  }, [auth?.uid, screen, consciousnessReturnScreen]);

  // ── Theme ──────────────────────────────────────────────────────────────────
  const handleThemeChange = useCallback((newTheme) => {
    const normalized = {
      day: "lumiere", eye: "amber", night: "midnight",
      lumiere: "lumiere", amber: "amber", obsidian: "obsidian", midnight: "midnight",
    };
    setAppTheme(normalized[newTheme] || "lumiere");
  }, [setAppTheme]);

  // ── Maintenance mode ───────────────────────────────────────────────────────
  const { maintenanceModeActive, handleToggleMaintenanceMode, setMaintenanceModeActive } =
    useMaintenanceMode({ fetchMaintenanceState: fetchMaintenanceStateFn, toggleMaintenanceState: toggleMaintenanceStateFn, showToast });

  // ── Debug overlay ───────────────────────────────────────────────────────────
  const [debugLogs, setDebugLogs] = useState([]);
  const [debugLatencies, setDebugLatencies] = useState([]);
  const [debugTTI, setDebugTTI] = useState(0);
  const [debugComponentStatus] = useState({});
  const [debugOverlayOpen, setDebugOverlayOpen] = useState(false);

  useAdminDiagnosticsEffects({ isAdminAuthenticated, setDebugLogs, setDebugLatencies, setDebugTTI, showToast });
  useTelegramDiagnosticsAuditEffect({ enableTelegramDiagnostics: ENABLE_TELEGRAM_DIAGNOSTICS });
  useAdminSessionRestoreEffect({ setIsAdminAuthenticated, setScreen, setIsInitialLoading, authBootstrapCompleteRef });
  useDashboardMotionEffect({ screen });
  useConnectionStatusEffect({ showToast });
  useResizeOptimizationEffect();
  useFirebaseHeartbeatEffect();
  useDevAuditHarnessEffect({ adminUid: ADMIN_UID, adminEmail: ADMIN_EMAIL, setScreen, setAuth, setProfile, setIsAdminAuthenticated, setCurrentSessionId, setAppTheme, setMaintenanceModeActive, setShowAdminPrompt });

  // ── Auth handlers ───────────────────────────────────────────────────────────
  const {
    checkUserStatus, handleLoginPasswordReset, handleLogin, handleStructuredSignup,
    handleStructuredGoogleAuth, handleGoogleRedirectResult, handleBackToLoginFromSignup,
    handlePasswordReset, handleResendVerificationEmail,
    checkApprovalStatus, handleLogout,
  } = useAuthSessionHandlers({
    auth, profile,
    isValidGmailAddress, getLoginRateLimitRemainingMs, formatCooldown,
    findIdentityUserByEmail, clearLoginFailures, recordLoginFailure,
    loadUserProfile: loadIdentityUserProfile, updateLoginSecurityCounters,
    sendForensicAlert, isPasswordExpired,
    setAuth, setCurrentSessionId, setProfile, setScreen, showToast,
    googleUser, ADMIN_UID, ADMIN_EMAIL,
    readPendingGoogleSignup, persistPendingGoogleSignup,
    clearPendingGoogleSignup, resolveRestorableScreen,
    resolveConsciousnessReturnScreen, setConsciousnessReturnScreen,
    SCREEN_IDS: _SCREEN_IDS, setGoogleUser, submitOnboardingApplication,
    provisionIdentityUserRecord, buildPendingProfile,
    sendWelcomeEmail, sendTelegramAlert,
    setIsAdminAuthenticated, setShowAdminPrompt,
    setAdminMasterEmail, setAdminMasterEmailVerified,
    setAdminOtpStep, setAdminOtpsVerified, setAdminOtps,
    setAdminOtpErr,
  });

  useAuthBootstrap({ checkUserStatus, isAdminAuthenticated, setAuth, setProfile, setGoogleUser, setScreen, setIsInitialLoading, authBootstrapCompleteRef, pendingRedirectResultHandler: handleGoogleRedirectResult });
  useDesktopClientPolicy({
    auth,
    currentSessionId,
    handleLogout,
    setMaintenanceModeActive,
    showToast,
  });
  useTerminalWorkspaceHydration({ auth, profile, adminUid: ADMIN_UID, loadTerminalWorkspace, setProfile });

  // ── Admin access handlers ───────────────────────────────────────────────────
  const { saveJournal, saveAccount, saveFirmRules } = useTerminalPersistenceHandlers({
    auth, saveTerminalJournal, saveTerminalAccountState, saveTerminalFirmRules,
  });

  // ── Daily quote ────────────────────────────────────────────────────────────
  const [dailyQuote] = useState(getRandomQuote);

  if (isInitialLoading) return <SplashScreen />;

  const screenContent = buildScreenContent({
    screen, currentTheme, theme, aiStatuses, watchtowerStatus, consciousnessReturnScreen,
    isAdminAuthenticated, isAudioMuted, maintenanceModeActive,
    setIsAudioMuted,
    auth, profile, googleUser, currentSessionId,
    adminMasterEmail, adminMasterEmailVerified, adminOtpStep, adminOtps,
    adminOtpsVerified, totpErr, totpCode, adminOtpErr,
    showAdminPrompt, _SCREEN_IDS, ADMIN_UID, ADMIN_EMAIL,
    listAdminUsers: _listAdminUsers,
    approveAdminUser: _approveAdminUser,
    blockAdminUser: _blockAdminUser,
    setIsAudioMuted: (v) => setIsAudioMuted(v),
    handleLogin, handleStructuredGoogleAuth, handleLoginPasswordReset,
    resetAdminPromptState, setShowAdminPrompt, setAdminMasterEmail,
    setTotpCode, setAdminOtps, setAdminOtpStep,
    handleAdminRequestNewCodes, sendAdminOTPs,
    handleAdminAccess, handleAdminVerifyCodes,
    handleStructuredSignup, handleBackToLoginFromSignup,
    checkApprovalStatus, handleResendVerificationEmail,
    handleLogout, handlePasswordReset, setScreen, setConsciousnessReturnScreen,
    handleThemeChange, handleToggleMaintenanceMode,
    saveJournal, saveAccount, saveFirmRules, showToast,
  });

  return buildAppShell({
    currentTheme, screen, setScreen, auth, profile, maintenanceModeActive, _SCREEN_IDS,
    ADMIN_UID, screenContent, toasts, dismissToast, theme,
    handleThemeChange, debugLogs, debugLatencies, debugTTI,
    debugComponentStatus, debugOverlayOpen, setDebugOverlayOpen, aiQuadCoreStatus, watchtowerStatus, dailyQuote,
    showToast,
  });
}

export { TradersRegimentInner };

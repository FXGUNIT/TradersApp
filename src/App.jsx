/* eslint-disable */
import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  Suspense,
} from "react";
import emailjs from "@emailjs/browser";
import { sendWelcomeEmail } from "./utils/email.js";
import FloatingChatWidget from "./components/FloatingChatWidget.jsx";
import ChatHelpline from "./components/ChatHelpline.jsx";
import MainTerminal from "./features/terminal/MainTerminal.jsx";
import { useTerminalPersistenceHandlers } from "./features/terminal/useTerminalPersistenceHandlers.js";
import CollectiveConsciousnessPage from "./pages/CollectiveConsciousness.jsx";
import {
  quadCoreStatus as aiQuadCoreStatus,
  councilStage as aiCouncilStage,
  getAIStatusesDetailed,
  startAIStatusScheduler,
  stopAIStatusScheduler,
} from "./services/ai-router.js";
import AiEnginesStatus from "./components/AiEnginesStatus.jsx";
import {
  calculateVolatilityRatio,
  getDynamicParameters,
  calculateThrottledRisk,
} from "./utils/math-engine.js";
import {
  TradersRegimentWatermark,
  ExchangeFacilityBadge,
} from "./utils/businessLogicUtils.jsx";
import {
  getSession,
  getTradingDate,
  parseAndAggregate,
  buildDataSummary,
} from "./utils/sessionParser.js";
import {
  fuzzySearchScore,
  highlightMatches,
  renderHighlightedText,
} from "./utils/searchUtils.jsx";
import {
  encryptSessionToken,
  generateSessionId,
  getDeviceInfo,
  getSessionGeoData,
  getDevice,
} from "./utils/sessionUtils.js";
import {
  getTimeBasedGreeting,
  getUserLevelBadge,
  clearUserListCache,
  getUserListCacheMetadata,
} from "./utils/userUtils.js";
import { calcRoR, getISTState } from "./utils/tradingUtils.js";
import {
  gatherForensicData,
  sendTelegramAlert,
  sendForensicAlert,
} from "./utils/securityAlertUtils.js";
import {
  triggerConfetti,
} from "./utils/uiUtils.js";
import { copyToClipboard } from "./utils/searchUtils.jsx";
import {
  isValidGmailAddress,
  isPasswordExpired,
  detectGPUSupport,
  withExponentialBackoff,
} from "./utils/securityUtils.js";
import LoadingOverlay from "./components/LoadingOverlay.jsx";
import SkeletonLoader from "./components/SkeletonLoader.jsx";
import LazyImage from "./components/LazyImage.jsx";
import { useTheme } from "./hooks/useTheme.jsx";
import { getRandomQuote } from "./features/shell/appShellChrome.jsx";
import { AppShellProvider } from "./features/shell/AppShellContext.jsx";
import AppScreenRegistry from "./features/shell/AppScreenRegistry.jsx";
import LoadingFallback from "./features/shell/LoadingFallback.jsx";
import MaintenanceScreen from "./features/shell/MaintenanceScreen.jsx";
import SplashScreen from "./features/shell/SplashScreen.jsx";
import ShellThemeOverlay from "./features/shell/ShellThemeOverlay.jsx";
import OfficersBriefingFooter from "./features/shell/OfficersBriefingFooter.jsx";
import { useMaintenanceMode } from "./features/shell/useMaintenanceMode.js";
import { useToastNotifications, setAudioMuted } from "./features/shell/useToastNotifications.js";
import { useSessionFatigue } from "./features/shell/useSessionFatigue.js";
import { useTerminalWorkspaceHydration } from "./features/shell/useTerminalWorkspaceHydration.js";
import { useAdminDiagnosticsEffects } from "./features/shell/useAdminDiagnosticsEffects.js";
import { useTelegramDiagnosticsAuditEffect } from "./features/shell/useTelegramDiagnosticsAuditEffect.js";
import { useAdminSessionRestoreEffect } from "./features/shell/useAdminSessionRestoreEffect.js";
import { useDashboardMotionEffect } from "./features/shell/useDashboardMotionEffect.js";
import { useConnectionStatusEffect } from "./features/shell/useConnectionStatusEffect.js";
import { useResizeOptimizationEffect } from "./features/shell/useResizeOptimizationEffect.js";
import { useFirebaseHeartbeatEffect } from "./features/shell/useFirebaseHeartbeatEffect.js";
import { useDevAuditHarnessEffect } from "./features/shell/useDevAuditHarnessEffect.js";
import { useAuthSessionHandlers } from "./features/identity/useAuthSessionHandlers.js";
import { useAuthBootstrap } from "./features/identity/useAuthBootstrap.js";
import { SCREEN_IDS } from "./features/shell/screenIds.js";
import DiamondNavigationLattice from "./features/shell/navigation-lattice/DiamondNavigationLattice.jsx";
import {
  clearConsciousnessReturnScreen,
  clearLastScreen,
  clearLoginFailures,
  clearPendingGoogleSignup,
  formatCooldown,
  getLoginRateLimitRemainingMs,
  persistConsciousnessReturnScreen,
  persistLastScreen,
  persistPendingGoogleSignup,
  isRestorableScreen,
  readPendingGoogleSignup,
  recordLoginFailure,
  resolveConsciousnessReturnScreen,
  resolveRestorableScreen,
} from "./features/identity/authFlowStorage.js";
import {
  buildPendingProfile,
  createSyncedAuthSession,
} from "./features/identity/authSessionUtils.js";
import {
  executeSyncAuthSessionFromUser,
  executeSendVerificationLink,
} from "./features/identity/authSessionHandlers.js";
import {
  executePasswordReset,
  executeResendVerificationEmail,
  executeApprovalStatusCheck,
} from "./features/identity/authActionHandlers.js";
import {
  executeLoginPasswordReset,
  executeLogin,
  executeStructuredSignup,
  executeStructuredGoogleAuth,
} from "./features/identity/authCredentialHandlers.js";
import { executeCheckUserStatus } from "./features/identity/authRoutingHandlers.js";
import {
  findUserByEmail as findIdentityUserByEmail,
  loadUserProfile as loadIdentityUserProfile,
  provisionUserRecord as provisionIdentityUserRecord,
  updateLoginSecurityCounters,
} from "./services/clients/IdentityClient.js";
import { submitApplication as submitOnboardingApplication } from "./services/clients/OnboardingClient.js";
import * as AdminSecurityClient from "./services/clients/AdminSecurityClient.js";
import {
  loadWorkspace as loadTerminalWorkspace,
  saveAccountState as saveTerminalAccountState,
  saveFirmRules as saveTerminalFirmRules,
  saveJournal as saveTerminalJournal,
} from "./services/clients/TerminalClient.js";
import {
  ADMIN_EMAIL,
  ADMIN_UID,
} from "./services/firebase.js";
import "./features/shell/registerLegacyRuntimeStyles.js";
import "./styles/global.css";
import NotificationCenter from "./components/NotificationCenter.jsx";
import CommandPalette from "./components/CommandPalette.jsx";
import UserSwitcher from "./components/UserSwitcher.jsx";
import FullScreenToggle from "./components/FullScreenToggle.jsx";
import MobileBottomNav from "./components/MobileBottomNav.jsx";
import FeatureGuard from "./components/FeatureGuard.jsx";
import EmptyStateCard from "./components/EmptyStateCard.jsx";
import CleanLoginScreen from "./features/auth/CleanLoginScreen.jsx";
import AdminUnlockModal from "./features/admin-security/AdminUnlockModal.jsx";
import AdminDashboardScreen from "./features/admin-security/AdminDashboardScreen.jsx";
import AdminInvitesView from "./features/admin-security/AdminInvitesView.jsx";
import DebugOverlay from "./features/admin-security/DebugOverlay.jsx";
import ErrorBoundaryAdmin from "./features/admin-security/ErrorBoundaryAdmin.jsx";
import { useAdminAccessHandlers } from "./features/admin-security/useAdminAccessHandlers.js";
import {
  UserListProvider,
  useUserList,
} from "./features/admin-security/UserListContext.jsx";
import SessionsManagementScreen from "./features/identity/SessionsManagementScreen.jsx";
import ForcePasswordResetScreen from "./features/identity/ForcePasswordResetScreen.jsx";
import WaitingRoomScreen from "./features/identity/WaitingRoomScreen.jsx";
import SupportChatModal from "./features/support/SupportChatModal.jsx";
import {
  BackToTopButton,
  Breadcrumbs,
  MegaMenu,
} from "./features/shell/ShellPrimitives.jsx";
import Toast from "./features/shell/Toast.jsx";
import { verifyAdminPassword } from "./services/adminAuthService.js";

const hasEmailJsConfig = Boolean(
  import.meta.env.VITE_EMAILJS_SERVICE_ID &&
  import.meta.env.VITE_EMAILJS_TEMPLATE_ID &&
  import.meta.env.VITE_EMAILJS_PUBLIC_KEY,
);

// math-engine & ai-router are both inlined (files exist but have no exports)
// Swap to real imports once those files are complete

const TELEGRAM_TOKEN = import.meta.env.VITE_TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = import.meta.env.VITE_TELEGRAM_CHAT_ID;
const enableTelegramDiagnostics =
  import.meta.env.VITE_ENABLE_TELEGRAM_DIAGNOSTICS === "true";
const resolveAdminClientFn = (...names) => {
  for (const name of names) {
    const fn = AdminSecurityClient?.[name];
    if (typeof fn === "function") {
      return fn;
    }
  }
  return null;
};
const listAdminUsers = resolveAdminClientFn("listUsers", "fetchAdminUsers");
const approveAdminUser = resolveAdminClientFn(
  "approveUser",
  "approveAdminUser",
);
const blockAdminUser = resolveAdminClientFn("blockUser", "blockAdminUser");
const fetchMaintenanceState = resolveAdminClientFn(
  "fetchMaintenanceState",
  "getMaintenanceState",
  "loadMaintenanceState",
);
const toggleMaintenanceState = resolveAdminClientFn(
  "toggleMaintenanceState",
  "setMaintenanceState",
  "updateMaintenanceMode",
);

import "./index.css";

const CleanOnboarding = React.lazy(
  () => import("./features/onboarding/CleanOnboardingScreen.jsx"),
);
const RegimentHub = React.lazy(
  () => import("./features/hub-content/RegimentHubScreen.jsx"),
);

// GPU detection now imported from securityUtils.js
const _gpuSupport = detectGPUSupport();

// Exponential backoff now imported from securityUtils.js

// calculateVolatilityRatio, getDynamicParameters, calculateThrottledRisk
// are imported from ./utils/math-engine.js

// ai-router is now imported from ./services/ai-router.js

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  TOAST NOTIFICATION SYSTEM
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// RULE #181-185, #193, #208: Advanced Notification Engine with Toast Stacking & Swipe-to-Dismiss
//  THEME PICKER COMPONENT â€” GLASSMORPHIC ACCENT COLOR SELECTOR
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  LOGIN SCREEN â€” WITH PASSWORD RESET
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// CODE SPLITTING & PERFORMANCE - SUSPENSE BOUNDARIES (RULE #157, #161)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// ERROR BOUNDARIES - Graceful Error Handling (RULE #166)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// MODULE 6: GLOBAL STATE MANAGEMENT - USER LIST CONTEXT
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// RULE #172: Global Context for User List - Instant data flow to all components
// RULE #165: Cache Persistence - Initialize from localStorage cache
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  RULE #244, #246, #247, #266, #270: FRAUD DETECTION & SUPPORT CHAT
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// Component: Real-time Direct Support Chat Modal (RULE #209: Typing Indicator)

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  RULE #295, #296: MAINTENANCE MODE - 'BACK SOON' SCREEN
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// RULE #315: ADMIN DEBUG OVERLAY - System Audit & Monitoring
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  ADMIN DASHBOARD (PART 1: Logic & Header)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  SESSIONS MANAGEMENT SCREEN â€” Rules #5, #6
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  MAIN TRADING TERMINAL (PART 1: State & Math Engine)
// Note: MainTerminal is now imported from features/terminal/MainTerminal.jsx
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

//  ROOT â€” AUTH STATE MACHINE
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
export default function TradersRegiment() {
  const { currentTheme, setTheme: setAppTheme, theme } = useTheme();
  const T = theme;
  const [screen, setScreen] = useState(SCREEN_IDS.LOADING);
  const [auth, setAuth] = useState(null);
  const [profile, setProfile] = useState(null);
  const [adminPassInput, setAdminPassInput] = useState("");
  const [showAdminPrompt, setShowAdminPrompt] = useState(false);
  const [adminMasterEmail, setAdminMasterEmail] = useState("");
  const [adminMasterEmailVerified, setAdminMasterEmailVerified] =
    useState(false);
  const [adminOtpStep, setAdminOtpStep] = useState(false); // true when OTPs are sent and need verification
  const [adminOtpsVerified, setAdminOtpsVerified] = useState(false); // true after successful OTP verification
  const [adminOtps, setAdminOtps] = useState({ otp1: "", otp2: "", otp3: "" });
  const [adminOtpErr, setAdminOtpErr] = useState("");
  const [adminPassErr, setAdminPassErr] = useState("");
  const [showAdminPwd, setShowAdminPwd] = useState(false);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  // Last-resort timeout if both admin restore and auth bootstrap stall.
  // This is intentionally slower than the hook-level auth timeout so it only
  // catches truly stuck startup states.
  const hardTimeoutRef = useRef(false);
  useEffect(() => {
    if (hardTimeoutRef.current || !isInitialLoading) return;
    const timer = setTimeout(() => {
      if (
        hardTimeoutRef.current ||
        authBootstrapCompleteRef.current ||
        !isInitialLoading
      ) {
        return;
      }
      hardTimeoutRef.current = true;
      authBootstrapCompleteRef.current = true;
      console.warn("[App] Auth hard timeout — forcing to login screen");
      setScreen("login");
      setIsInitialLoading(false);
    }, 20000);
    return () => clearTimeout(timer);
  }, [authBootstrapCompleteRef, isInitialLoading]);
  const [isAudioMuted, setIsAudioMuted] = useState(() => {
    try { return localStorage.getItem("audio_muted") === "true"; } catch { return false; }
  });
  const { toasts, showToast, dismissToast } = useToastNotifications();

  // Sync mute state to the audio singleton
  useEffect(() => {
    setAudioMuted(isAudioMuted);
    try { localStorage.setItem("audio_muted", String(isAudioMuted)); } catch { /* best-effort */ }
  }, [isAudioMuted]);

  // Session fatigue: start rAF timer on mount, stop on logout
  const { start: startFatigue, stop: stopFatigue } = useSessionFatigue();

  // Start fatigue timer once authenticated; reset on re-login
  useEffect(() => {
    if (auth?.uid) startFatigue();
    return () => stopFatigue();
  }, [auth?.uid]);
  const [aiStatuses, setAiStatuses] = useState(() => getAIStatusesDetailed());
  const [consciousnessReturnScreen, setConsciousnessReturnScreen] =
    useState("hub");
  const [dailyQuote, _setDailyQuote] = useState(getRandomQuote());

  useEffect(() => {
    startAIStatusScheduler((statuses) => {
      setAiStatuses(statuses);
    });
    return () => stopAIStatusScheduler();
  }, []);

  useEffect(() => {
    if (!auth?.uid || !isRestorableScreen(screen)) {
      return;
    }
    persistLastScreen(auth.uid, screen);
  }, [auth?.uid, screen]);

  useEffect(() => {
    if (
      !auth?.uid ||
      screen !== SCREEN_IDS.CONSCIOUSNESS ||
      !isRestorableScreen(consciousnessReturnScreen)
    ) {
      return;
    }
    persistConsciousnessReturnScreen(auth.uid, consciousnessReturnScreen);
  }, [auth?.uid, screen, consciousnessReturnScreen]);

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  const handleThemeChange = useCallback(
    (newTheme) => {
      const normalized = {
        day: "lumiere",
        eye: "amber",
        night: "midnight",
        lumiere: "lumiere",
        amber: "amber",
        midnight: "midnight",
      };
      setAppTheme(normalized[newTheme] || "lumiere");
    },
    [setAppTheme],
  );
  // MODULE 1 PHASE 2: SESSION MANAGEMENT
  const [googleUser, setGoogleUser] = useState(() => readPendingGoogleSignup());
  const [, _setActiveSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const authBootstrapCompleteRef = useRef(false);
  const {
    maintenanceModeActive,
    handleToggleMaintenanceMode,
    setMaintenanceModeActive,
  } =
    useMaintenanceMode({
      fetchMaintenanceState,
      toggleMaintenanceState,
      showToast,
    });

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // RULE #315: ADMIN DEBUG OVERLAY - System Audit & Monitoring State
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  const [debugLogs, setDebugLogs] = useState([]);
  const [debugLatencies, setDebugLatencies] = useState([]);
  const [debugTTI, setDebugTTI] = useState(0);
  const [debugComponentStatus] = useState({});
  const [debugOverlayOpen, setDebugOverlayOpen] = useState(false);

  useAdminDiagnosticsEffects({
    isAdminAuthenticated,
    setDebugLogs,
    setDebugLatencies,
    setDebugTTI,
    showToast,
    telegramToken: TELEGRAM_TOKEN,
    telegramChatId: TELEGRAM_CHAT_ID,
  });

  useTelegramDiagnosticsAuditEffect({
    enableTelegramDiagnostics,
    telegramToken: TELEGRAM_TOKEN,
    telegramChatId: TELEGRAM_CHAT_ID,
  });

  useAdminSessionRestoreEffect({
    setIsAdminAuthenticated,
    setScreen,
    setIsInitialLoading,
    authBootstrapCompleteRef,
  });

  useDashboardMotionEffect({ screen });

  useConnectionStatusEffect({ showToast });

  useResizeOptimizationEffect();

  useFirebaseHeartbeatEffect();

  useDevAuditHarnessEffect({
    adminUid: ADMIN_UID,
    adminEmail: ADMIN_EMAIL,
    setScreen,
    setAuth,
    setProfile,
    setIsAdminAuthenticated,
    setCurrentSessionId,
    setAppTheme,
    setMaintenanceModeActive,
  });

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // RULE #160, #176: Connection Status Toast - Show online/offline status
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // RULE #172: Debounced Resize Listener - Prevent layout lag
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // RULE #175: FIREBASE HEARTBEAT SIGNAL - Monitor real-time database connection
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // THEME MANAGEMENT SYSTEM - Persistence & Body Styling
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  const {
    checkUserStatus,
    syncAuthSessionFromUser,
    sendVerificationLink,
    handleLoginPasswordReset,
    handleLogin,
    handleStructuredSignup,
    handleStructuredGoogleAuth,
    handleBackToLoginFromSignup,
    handlePasswordReset,
    handleResendVerificationEmail,
    checkApprovalStatus,
    handleLogout,
  } = useAuthSessionHandlers({
    auth,
    profile,
    isValidGmailAddress,
    getLoginRateLimitRemainingMs,
    formatCooldown,
    findIdentityUserByEmail,
    clearLoginFailures,
    recordLoginFailure,
    loadUserProfile: loadIdentityUserProfile,
    updateLoginSecurityCounters,
    sendForensicAlert,
    isPasswordExpired,
    setAuth,
    setCurrentSessionId,
    setProfile,
    setScreen,
    showToast,
    googleUser,
    ADMIN_UID,
    ADMIN_EMAIL,
    readPendingGoogleSignup,
    persistPendingGoogleSignup,
    clearPendingGoogleSignup,
    resolveRestorableScreen,
    resolveConsciousnessReturnScreen,
    setConsciousnessReturnScreen,
    SCREEN_IDS,
    setGoogleUser,
    submitOnboardingApplication,
    provisionIdentityUserRecord,
    buildPendingProfile,
    sendWelcomeEmail,
    sendTelegramAlert,
    setIsAdminAuthenticated,
    setShowAdminPrompt,
    setAdminMasterEmail,
    setAdminMasterEmailVerified,
    setAdminOtpStep,
    setAdminOtpsVerified,
    setAdminOtps,
    setAdminPassInput,
    setAdminPassErr,
    setAdminOtpErr,
  });

  useAuthBootstrap({
    checkUserStatus,
    isAdminAuthenticated,
    setAuth,
    setProfile,
    setGoogleUser,
    setScreen,
    setIsInitialLoading,
    authBootstrapCompleteRef,
  });

  useTerminalWorkspaceHydration({
    auth,
    profile,
    adminUid: ADMIN_UID,
    loadTerminalWorkspace,
    setProfile,
  });

  const {
    sendAdminOTPs,
    handleAdminAccess,
    resetAdminPromptState,
    handleAdminVerifyCodes,
    handleAdminRequestNewCodes,
  } = useAdminAccessHandlers({
    adminMasterEmail,
    adminOtps,
    adminOtpsVerified,
    adminPassInput,
    hasEmailJsConfig,
    emailjs,
    serviceId: import.meta.env.VITE_EMAILJS_SERVICE_ID,
    templateId: import.meta.env.VITE_EMAILJS_TEMPLATE_ID,
    publicKey: import.meta.env.VITE_EMAILJS_PUBLIC_KEY,
    sendForensicAlert,
    verifyAdminPassword,
    showToast,
    setShowAdminPrompt,
    setAdminMasterEmail,
    setAdminMasterEmailVerified,
    setAdminOtpStep,
    setAdminOtpsVerified,
    setAdminOtps,
    setAdminPassInput,
    setAdminPassErr,
    setAdminOtpErr,
    setIsAdminAuthenticated,
    setScreen,
    setShowAdminPwd,
  });

  const { saveJournal, saveAccount, saveFirmRules } =
    useTerminalPersistenceHandlers({
      auth,
      saveTerminalJournal,
      saveTerminalAccountState,
      saveTerminalFirmRules,
    });
  // â”€â”€â”€ MAIN ROUTER RENDER â”€â”€â”€
  // Phase 3: Invite flow overlay (password reset -> invite screen) - simple hook in UI
  // The InviteScreen is shown when user has initiated an invite flow (password reset leading here)
  // The actual flow is wired in future patches; this is a safe default to present the screen when requested

  if (isInitialLoading) {
    return <SplashScreen />;
  }

  const screenContent = (
    <AppScreenRegistry
      screen={screen}
      CleanLoginScreen={CleanLoginScreen}
      AdminUnlockModal={AdminUnlockModal}
      CleanOnboarding={CleanOnboarding}
      WaitingRoomScreen={WaitingRoomScreen}
      ForcePasswordResetScreen={ForcePasswordResetScreen}
      SessionsManagementScreen={SessionsManagementScreen}
      RegimentHub={RegimentHub}
      CollectiveConsciousnessPage={CollectiveConsciousnessPage}
      ErrorBoundaryAdmin={ErrorBoundaryAdmin}
      LoadingFallback={LoadingFallback}
      UserListProvider={UserListProvider}
      AiEnginesStatus={AiEnginesStatus}
      AdminDashboardScreen={AdminDashboardScreen}
      AdminInvitesView={AdminInvitesView}
      SplashScreen={SplashScreen}
      MainTerminal={MainTerminal}
      auth={auth}
      profile={profile}
      googleUser={googleUser}
      currentSessionId={currentSessionId}
      currentTheme={currentTheme}
      theme={theme}
      aiStatuses={aiStatuses}
      consciousnessReturnScreen={consciousnessReturnScreen}
      isAdminAuthenticated={isAdminAuthenticated}
      isAudioMuted={isAudioMuted}
      setIsAudioMuted={setIsAudioMuted}
      maintenanceModeActive={maintenanceModeActive}
      ADMIN_UID={ADMIN_UID}
      ADMIN_EMAIL={ADMIN_EMAIL}
      listAdminUsers={listAdminUsers}
      approveAdminUser={approveAdminUser}
      blockAdminUser={blockAdminUser}
      EmptyStateCard={EmptyStateCard}
      SupportChatModal={SupportChatModal}
      showAdminPrompt={showAdminPrompt}
      showAdminPwd={showAdminPwd}
      adminMasterEmail={adminMasterEmail}
      adminMasterEmailVerified={adminMasterEmailVerified}
      adminOtpStep={adminOtpStep}
      adminOtps={adminOtps}
      adminOtpsVerified={adminOtpsVerified}
      adminPassErr={adminPassErr}
      adminPassInput={adminPassInput}
      adminOtpErr={adminOtpErr}
      showToast={showToast}
      handleLogin={handleLogin}
      handleStructuredGoogleAuth={handleStructuredGoogleAuth}
      handleLoginPasswordReset={handleLoginPasswordReset}
      resetAdminPromptState={resetAdminPromptState}
      setShowAdminPrompt={setShowAdminPrompt}
      setAdminMasterEmail={setAdminMasterEmail}
      setAdminPassInput={setAdminPassInput}
      setAdminOtps={setAdminOtps}
      setAdminOtpStep={setAdminOtpStep}
      handleAdminRequestNewCodes={handleAdminRequestNewCodes}
      sendAdminOTPs={sendAdminOTPs}
      setShowAdminPwd={setShowAdminPwd}
      handleAdminAccess={handleAdminAccess}
      handleAdminVerifyCodes={handleAdminVerifyCodes}
      handleStructuredSignup={handleStructuredSignup}
      handleBackToLoginFromSignup={handleBackToLoginFromSignup}
      checkApprovalStatus={checkApprovalStatus}
      handleResendVerificationEmail={handleResendVerificationEmail}
      handleLogout={handleLogout}
      handlePasswordReset={handlePasswordReset}
      setScreen={setScreen}
      setConsciousnessReturnScreen={setConsciousnessReturnScreen}
      handleThemeChange={handleThemeChange}
      handleToggleMaintenanceMode={handleToggleMaintenanceMode}
      saveJournal={saveJournal}
      saveAccount={saveAccount}
      saveFirmRules={saveFirmRules}
    />
  );

  return (
    <AppShellProvider
      value={{
        screen,
        setScreen,
        navigateToScreen: setScreen,
        profile,
        theme,
        currentTheme,
        maintenanceMode: maintenanceModeActive,
      }}
    >
      <section className={`app-container theme-${currentTheme}`}>
        <ShellThemeOverlay
          screen={screen}
          currentTheme={currentTheme}
          onThemeChange={handleThemeChange}
        />
        {/* RULE #295, #296: Maintenance Mode - Show "Back Soon" screen if active, except for Master Admin */}
        {maintenanceModeActive &&
        auth?.uid !== ADMIN_UID &&
        screen !== "admin" ? (
          <MaintenanceScreen />
        ) : (
          screenContent
        )}
        <DiamondNavigationLattice
          screen={screen}
          setScreen={setScreen}
          auth={auth}
          disabled={
            maintenanceModeActive &&
            auth?.uid !== ADMIN_UID &&
            screen !== SCREEN_IDS.ADMIN
          }
          onRestrictedBack={() =>
            showToast(
              "Back navigation is restricted after logout. Sign in again to continue.",
              "error",
            )
          }
        />

        {/* Admin Debug Overlay - System Audit Dashboard */}
        <DebugOverlay
          logs={debugLogs}
          latencies={debugLatencies}
          tti={debugTTI}
          componentStatus={debugComponentStatus}
          isOpen={debugOverlayOpen}
          onToggle={() => setDebugOverlayOpen(!debugOverlayOpen)}
          auth={auth}
        />
        <Toast toasts={toasts} onDismiss={dismissToast} fontFamily={theme.font} />
        <FeatureGuard feature="floatingSupportChat">
          <FloatingChatWidget auth={auth} profile={profile} />
        </FeatureGuard>

        <OfficersBriefingFooter
          dailyQuote={dailyQuote}
          theme={theme}
          quadCoreStatus={aiQuadCoreStatus}
        />
      </section>
    </AppShellProvider>
  );
}


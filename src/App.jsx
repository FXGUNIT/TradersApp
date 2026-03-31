/* eslint-disable */
import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  Suspense,
} from "react";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  sendPasswordResetEmail,
  setPersistence,
  browserLocalPersistence,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { getDatabase, ref, onValue } from "firebase/database";
import emailjs from "@emailjs/browser";
import { sendWelcomeEmail } from "./utils/email.js";
import FloatingChatWidget from "./components/FloatingChatWidget.jsx";
import ChatHelpline from "./components/ChatHelpline.jsx";
import MainTerminal from "./features/terminal/MainTerminal.jsx";
import CollectiveConsciousnessPage from "./pages/CollectiveConsciousness.jsx";
import {
  quadCoreStatus as aiQuadCoreStatus,
  councilStage as aiCouncilStage,
  getAIStatusesDetailed,
  startAIStatusScheduler,
  stopAIStatusScheduler,
} from "./services/ai-router.js";
import { firebaseOptimizer } from "./services/firebase.js";
import AiEnginesStatus from "./components/AiEnginesStatus.jsx";
import { setupConsoleInterceptor } from "./services/telemetry.js";
import { setupNetworkMonitor } from "./services/networkMonitor.js";
import { setupTTITracker } from "./services/ttiTracker.js";
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
import { dbR, dbW, dbM, dbDel, genOTP } from "./utils/firebaseDbUtils.js";
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
  createCardTiltHandler,
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
import { useToastNotifications } from "./features/shell/useToastNotifications.js";
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
import {
  executeSendAdminOTPs,
  executeVerifyAdminOTPs,
  executeHandleAdminAccess,
  executeHandleAdminVerifyCodes,
} from "./features/identity/adminAccessHandlers.js";
import { executeCheckUserStatus } from "./features/identity/authRoutingHandlers.js";
import {
  findUserByEmail as findIdentityUserByEmail,
  loadLegacyUserProfile,
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
import {
  UserListProvider,
  useUserList,
} from "./features/admin-security/UserListContext.jsx";
import SessionsManagementScreen from "./features/identity/SessionsManagementScreen.jsx";
import ForcePasswordResetScreen from "./features/identity/ForcePasswordResetScreen.jsx";
import WaitingRoomScreen from "./features/identity/WaitingRoomScreen.jsx";
import { executeLogSecurityAlert } from "./features/admin-security/securityForensicsHandlers.js";
import SupportChatModal from "./features/support/SupportChatModal.jsx";
import {
  executeSaveJournal,
  executeSaveAccount,
  executeSaveFirmRules,
} from "./features/terminal/terminalPersistenceHandlers.js";
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

const FB_KEY = import.meta.env.VITE_FIREBASE_API_KEY;
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
};
const hasFirebaseConfig = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.authDomain &&
  firebaseConfig.projectId &&
  firebaseConfig.appId,
);
const firebaseApp = hasFirebaseConfig ? initializeApp(firebaseConfig) : null;
const firebaseAuth = firebaseApp ? getAuth(firebaseApp) : null;
const firebaseDb = firebaseApp ? getDatabase(firebaseApp) : null;
const googleProvider = new GoogleAuthProvider();
const FB_AUTH_URL = "https://identitytoolkit.googleapis.com/v1/accounts";
const ADMIN_EMAIL = "gunitsingh1994@gmail.com";
const ADMIN_UID = "N3z04ZYCleZjOApobL3VZepaOwi1";
const TELEGRAM_TOKEN = import.meta.env.VITE_TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = import.meta.env.VITE_TELEGRAM_CHAT_ID;
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
const DATABASE_URL = firebaseConfig.databaseURL;

if (firebaseAuth) {
  googleProvider.setCustomParameters({
    hd: "gmail.com",
    prompt: "select_account",
  });

  try {
    setPersistence(firebaseAuth, browserLocalPersistence);
  } catch {
    console.warn("Failed to set auth persistence");
  }
}

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
// firebaseOptimizer is imported from ./services/firebase.js

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
  const { toasts, showToast, dismissToast } = useToastNotifications();
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

  // Intercept console logs using modular telemetry service
  useEffect(() => {
    if (!isAdminAuthenticated) return;
    const restoreConsole = setupConsoleInterceptor(setDebugLogs);
    const restoreNetwork = setupNetworkMonitor(setDebugLatencies);
    return () => {
      restoreConsole();
      restoreNetwork();
    };
  }, [isAdminAuthenticated]);

  // Measure Time-to-Interactive (TTI) using modular tracker
  useEffect(() => {
    if (!isAdminAuthenticated) return;
    const restoreTTI = setupTTITracker(setDebugTTI);
    return restoreTTI;
  }, [isAdminAuthenticated]);

  // Initialize Performance Tests for institutional benchmarking
  useEffect(() => {
    if (isAdminAuthenticated) {
      try {
        /* eslint-disable no-console */
        exposePerformanceTestToWindow();
        console.log(
          "âœ… Performance tests initialized - accessible via window.__performanceTest",
        );

        exposeSecurityAPIToWindow();
        console.log(
          "âœ… Security monitor initialized - accessible via window.__SecurityMonitor",
        );

        initLeakagePrevention(showToast);
        console.log(
          "âœ… Leakage Prevention module initialized - accessible via window.__LeakagePrevention",
        );

        initSocialEngineeringDetection(showToast);
        console.log(
          "âœ… Social Engineering Detection initialized - accessible via window.__SocialEngineeringDetection",
        );

        // Initialize Telegram Monitor for admin diagnostics
        initTelegramMonitor(TELEGRAM_TOKEN, TELEGRAM_CHAT_ID);
        console.log(
          "âœ… Telegram Monitor initialized - use window.__TelegramMonitor for diagnostics",
        );

        // Expose Firebase Optimizer metrics to admin console
        window.__FirebaseOptimizerMetrics = () =>
          firebaseOptimizer.getMetrics();
        console.log(
          "âœ… Firebase Optimizer active - use window.__FirebaseOptimizerMetrics() for stats",
        );
        /* eslint-enable no-console */
      } catch (error) {
        console.error("Failed to initialize admin systems:", error);
        showToast(`Admin setup failed: ${error.message}`, "error");
      }
    }
  }, [isAdminAuthenticated, showToast]);

  // MOTION & INTERACTION: Apply tilt effects to dashboard cards
  useEffect(() => {
    if (screen === "app" || screen === "admin") {
      // Apply tilt to all cards with card-tilt class
      const tiltCards = document.querySelectorAll(".card-tilt");
      tiltCards.forEach((card) => {
        createCardTiltHandler(card);
      });

      // Apply pulse animation to pending buttons
      const pendingButtons = document.querySelectorAll(
        '[data-status="pending"]',
      );
      pendingButtons.forEach((btn) => {
        btn.classList.add("btn-pending-pulse");
      });
    }
  }, [screen]);

  // Check for persistent admin session on mount
  useEffect(() => {
    try {
      const savedAdminStatus = localStorage.getItem("isAdminAuthenticated");
      if (savedAdminStatus === "true") {
        // Restore admin authentication from localStorage
        setIsAdminAuthenticated(true);
        setScreen("admin");

        // Send god mode activation alert
        sendTelegramAlert(
          "ðŸ”¥ <b>ADMIN TERMINAL RESUMED</b>\nGod Mode session active on this device.",
        );
        setIsInitialLoading(false);
        authBootstrapCompleteRef.current = true;
        return;
      }
    } catch (error) {
      console.warn("Failed to restore admin session:", error);
    }

    if (!firebaseAuth) {
      setScreen("login");
      setIsInitialLoading(false);
      authBootstrapCompleteRef.current = true;
    }
  }, []);

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // RULE #160, #176: Connection Status Toast - Show online/offline status
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  // RUN TELEGRAM CONNECTIVITY AUDIT ON APP LOAD
  useEffect(() => {
    // Run diagnostics asynchronously without blocking app initialization
    const runDiagnostics = async () => {
      try {
        /* eslint-disable no-console */
        console.log("ðŸ”Œ Starting Telegram connectivity audit...");
        const diagnostics = await testTelegramConnectivity(
          TELEGRAM_TOKEN,
          TELEGRAM_CHAT_ID,
        );

        // Log summary to console
        console.log("âœ… Telegram audit complete:", diagnostics.summary);

        // Send diagnostic summary as Telegram message (non-blocking)
        if (diagnostics.summary.status === "ALL_SYSTEMS_OPERATIONAL") {
          console.log("ðŸ“± Telegram system is fully operational");
        } else {
          /* eslint-enable no-console */
          console.warn(
            "âš ï¸ Telegram system issues detected:",
            diagnostics.summary,
          );

          // Send alert notification
          try {
            await fetch(
              `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  chat_id: TELEGRAM_CHAT_ID,
                  text: `âš ï¸ <b>TELEGRAM CONNECTIVITY WARNING</b>\n<code>${diagnostics.summary.status}</code>\n\nDiagnostic tests: ${diagnostics.summary.passedTests}/${diagnostics.summary.totalTests} passed`,
                  parse_mode: "HTML",
                }),
              },
            );
          } catch (e) {
            console.error("Could not send diagnostic alert:", e);
          }
        }
      } catch (error) {
        console.error("âŒ Telegram connectivity audit failed:", error);
      }
    };

    // Run diagnostics with a small delay to avoid blocking initial render
    const timer = setTimeout(runDiagnostics, 500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Track connection status to avoid duplicate toasts
    let isOnline = navigator.onLine;

    // Show initial status on mount if needed
    if (!isOnline) {
      showToast(
        "Offline Protocol Engaged. Using cached memory. Sync pending.",
        "warning",
      );
    }

    const handleOnline = () => {
      if (!isOnline) {
        isOnline = true;
        showToast(
          "Network bridge restored. Data synchronization in progress...",
          "success",
        );

        // Trigger any necessary data synchronization after reconnection
        const reconnectEvent = new CustomEvent("connectionRestored", {
          detail: { timestamp: Date.now() },
        });
        window.dispatchEvent(reconnectEvent);
      }
    };

    const handleOffline = () => {
      if (isOnline) {
        isOnline = false;
        showToast(
          "Network link severed. Verify connection strength and retry.",
          "warning",
        );

        // Notify app that connection lost for graceful degradation
        const disconnectEvent = new CustomEvent("connectionLost", {
          detail: { timestamp: Date.now() },
        });
        window.dispatchEvent(disconnectEvent);
      }
    };

    // Add event listeners for connection status changes
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Cleanup: Remove listeners on unmount
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [showToast]);

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // RULE #172: Debounced Resize Listener - Prevent layout lag
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  useEffect(() => {
    let resizeTimer = null;

    const handleResizeDebounced = () => {
      // Clear previous timer
      if (resizeTimer) clearTimeout(resizeTimer);

      // Set new timer - only fire after 150ms of no resize events
      resizeTimer = setTimeout(() => {
        // Trigger any necessary layout recalculations here
        // This prevents excessive re-renders during window resize
        const event = new CustomEvent("layoutOptimized", {
          detail: {
            width: window.innerWidth,
            height: window.innerHeight,
          },
        });
        window.dispatchEvent(event);
      }, 150); // 150ms debounce delay for smooth resizing
    };

    // Add resize listener with debouncing
    window.addEventListener("resize", handleResizeDebounced, { passive: true });

    // Cleanup: Remove listener and clear timer
    return () => {
      window.removeEventListener("resize", handleResizeDebounced);
      if (resizeTimer) clearTimeout(resizeTimer);
    };
  }, []);

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // RULE #175: FIREBASE HEARTBEAT SIGNAL - Monitor real-time database connection
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  useEffect(() => {
    if (!firebaseDb) {
      return;
    }

    let unsubscribe = null;
    let heartbeatCheckTimer = null;
    let lastHeartbeatTime = Date.now();

    const initializeHeartbeat = async () => {
      try {
        // Optimized heartbeat listener with connection pooling
        unsubscribe = firebaseOptimizer.createOptimizedListener(
          ".info/connected",
          (result) => {
            const isConnected = result.isBatched
              ? result.updates[result.updates.length - 1] === true
              : result === true;
            lastHeartbeatTime = Date.now();

            if (isConnected) {
              window.dispatchEvent(
                new CustomEvent("firebaseConnected", {
                  detail: { timestamp: lastHeartbeatTime, status: "healthy" },
                }),
              );
            } else {
              window.dispatchEvent(
                new CustomEvent("firebaseDisconnected", {
                  detail: {
                    timestamp: lastHeartbeatTime,
                    status: "reconnecting",
                  },
                }),
              );
            }
          },
          firebaseDb,
          ref,
          onValue,
        );

        // Set up heartbeat check interval - verify connection every 5 seconds
        heartbeatCheckTimer = setInterval(() => {
          const timeSinceLastHeartbeat = Date.now() - lastHeartbeatTime;

          // If no heartbeat update in 10 seconds, connection likely stale
          if (timeSinceLastHeartbeat > 10000) {
            window.dispatchEvent(
              new CustomEvent("firebaseHeartbeatTimeout", {
                detail: {
                  timestamp: Date.now(),
                  status: "stale",
                  lastHeartbeat: timeSinceLastHeartbeat,
                },
              }),
            );
          }
        }, 5000); // Check every 5 seconds
      } catch (error) {
        console.error("Firebase heartbeat initialization error:", error);
      }
    };

    // Only initialize heartbeat if auth is ready and we have a database reference
    if (firebaseDb) {
      initializeHeartbeat();
    }

    // Cleanup: Remove listener and clear timers
    return () => {
      if (unsubscribe) unsubscribe();
      if (heartbeatCheckTimer) clearInterval(heartbeatCheckTimer);
    };
  }, []);

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // THEME MANAGEMENT SYSTEM - Persistence & Body Styling
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  useEffect(() => {
    if (!import.meta.env.DEV) {
      return undefined;
    }

    let cancelled = false;
    let cleanup = () => {};

    import("./testing/appAuditHarness.js")
      .then(({ registerAppAuditHarness }) => {
        if (cancelled) return;

        cleanup = registerAppAuditHarness({
          adminUid: ADMIN_UID,
          adminEmail: ADMIN_EMAIL,
          setScreen,
          setAuth,
          setProfile,
          setIsAdminAuthenticated,
          setCurrentSessionId,
          setTheme: setAppTheme,
          setAccentColor: () => {},
          setShowThemePicker: () => {},
          setMaintenanceModeActive,
        });
      })
      .catch((error) => {
        console.warn("App audit harness unavailable:", error);
      });

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [
    setAuth,
    setCurrentSessionId,
    setIsAdminAuthenticated,
    setMaintenanceModeActive,
    setProfile,
    setScreen,
    setAppTheme,
  ]);

  // Check user status and route to appropriate screen
  const checkUserStatus = useCallback(
    async (authData) => {
      await executeCheckUserStatus({
        authData,
        loadLegacyUserProfile,
        firebaseAuth,
        readPendingGoogleSignup,
        persistPendingGoogleSignup,
        setGoogleUser,
        setProfile,
        setScreen,
        showToast,
        ADMIN_UID,
        resolveRestorableScreen,
        resolveConsciousnessReturnScreen,
        setConsciousnessReturnScreen,
        clearPendingGoogleSignup,
        SCREEN_IDS,
      });
    },
    [showToast],
  );

  // Auth state listener for persistent login
  useEffect(() => {
    if (!firebaseAuth) {
      return () => {};
    }

    const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
      try {
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
  }, [checkUserStatus, isAdminAuthenticated]);

  useEffect(() => {
    if (!auth?.uid || !profile || auth.uid === ADMIN_UID) {
      return undefined;
    }

    let active = true;

    const hydrateTerminalWorkspace = async () => {
      const workspace = await loadTerminalWorkspace(auth.uid, auth.token);
      if (!active || !workspace) {
        return;
      }

      const nextJournal = workspace.journal || {};

      setProfile((prev) => {
        if (!prev || prev.uid !== auth.uid) {
          return prev;
        }

        const nextAccountState = {
          ...(prev.accountState || {}),
          ...(workspace.accountState || {}),
        };
        const nextFirmRules = {
          ...(prev.firmRules || {}),
          ...(workspace.firmRules || {}),
        };

        const currentJournal = JSON.stringify(prev.journal || {});
        const currentAccountState = JSON.stringify(prev.accountState || {});
        const currentFirmRules = JSON.stringify(prev.firmRules || {});
        const incomingJournal = JSON.stringify(nextJournal);
        const incomingAccountState = JSON.stringify(nextAccountState);
        const incomingFirmRules = JSON.stringify(nextFirmRules);

        if (
          currentJournal === incomingJournal &&
          currentAccountState === incomingAccountState &&
          currentFirmRules === incomingFirmRules
        ) {
          return prev;
        }

        return {
          ...prev,
          journal: nextJournal,
          accountState: nextAccountState,
          firmRules: nextFirmRules,
        };
      });
    };

    void hydrateTerminalWorkspace();

    return () => {
      active = false;
    };
  }, [auth?.token, auth?.uid, profile?.uid, setProfile]);

  const syncAuthSessionFromUser = useCallback(
    async (user, stayLoggedIn = false) => {
      return executeSyncAuthSessionFromUser({
        user,
        stayLoggedIn,
        createSyncedAuthSession,
        setAuth,
        setCurrentSessionId,
      });
    },
    [],
  );

  const sendVerificationLink = useCallback(async () => {
    await executeSendVerificationLink({ firebaseAuth });
  }, []);

  const handleLoginPasswordReset = useCallback(async (email) => {
    return executeLoginPasswordReset({
      email,
      firebaseAuth,
      isValidGmailAddress,
    });
  }, []);

  const handleLogin = async (email, password, stayLoggedIn = false) => {
    return executeLogin({
      email,
      password,
      stayLoggedIn,
      firebaseAuth,
      FB_KEY,
      isValidGmailAddress,
      getLoginRateLimitRemainingMs,
      formatCooldown,
      findIdentityUserByEmail,
      clearLoginFailures,
      recordLoginFailure,
      loadLegacyUserProfile,
      updateLoginSecurityCounters,
      sendForensicAlert,
      isPasswordExpired,
      syncAuthSessionFromUser,
      setAuth,
      setCurrentSessionId,
      setProfile,
      setScreen,
      showToast,
      checkUserStatus,
      provisionIdentityUserRecord,
      ADMIN_UID,
      sendTelegramAlert,
    });
  };

  const handleStructuredSignup = async (formData) => {
    return executeStructuredSignup({
      formData,
      googleUser,
      firebaseAuth,
      FB_KEY,
      isValidGmailAddress,
      findIdentityUserByEmail,
      sendVerificationLink,
      syncAuthSessionFromUser,
      buildPendingProfile,
      submitOnboardingApplication,
      provisionIdentityUserRecord,
      sendWelcomeEmail,
      sendTelegramAlert,
      setAuth,
      setProfile,
      setGoogleUser,
      clearPendingGoogleSignup,
      setScreen,
      showToast,
      checkUserStatus,
      ADMIN_EMAIL,
      sendForensicAlert,
    });
  };

  const handleStructuredGoogleAuth = async (
    applicationData = null,
    authenticatedUser = null,
  ) => {
    return executeStructuredGoogleAuth({
      applicationData,
      authenticatedUser,
      firebaseAuth,
      FB_KEY,
      googleProvider,
      isValidGmailAddress,
      syncAuthSessionFromUser,
      loadLegacyUserProfile,
      handleStructuredSignup,
      persistPendingGoogleSignup,
      setGoogleUser,
      clearPendingGoogleSignup,
      setScreen,
      checkUserStatus,
    });
  };

  const handleBackToLoginFromSignup = async () => {
    clearPendingGoogleSignup();
    setGoogleUser(null);

    if (
      firebaseAuth?.currentUser &&
      firebaseAuth.currentUser.providerData?.some(
        (provider) => provider?.providerId === "google.com",
      )
    ) {
      try {
        await firebaseAuth.signOut();
      } catch (error) {
        console.warn("Failed to clear pending Google session:", error);
      }
    }

    setAuth(null);
    setProfile(null);
    setScreen("login");
  };

  // RULE 18: Handle forced password reset
  const handlePasswordReset = async (newPassword) => {
    return executePasswordReset({
      newPassword,
      auth,
      profile,
      firebaseAuth,
      provisionIdentityUserRecord,
      setProfile,
      checkUserStatus,
      showToast,
    });
  };

  const handleResendVerificationEmail = async () => {
    return executeResendVerificationEmail({
      auth,
      firebaseAuth,
      sendVerificationLink,
      setAuth,
      showToast,
    });
  };

  const checkApprovalStatus = async () => {
    return executeApprovalStatusCheck({
      auth,
      profile,
      firebaseAuth,
      checkUserStatus,
      setAuth,
    });
  };

  const handleLogout = async () => {
    const activeUid = auth?.uid;
    try {
      if (firebaseAuth?.signOut) {
        await firebaseAuth.signOut();
      }
    } catch (error) {
      console.warn("Error signing out:", error);
    }
    // RULE #165: Clear cache persistence on logout
    clearUserListCache();
    // Clear admin session from localStorage
    localStorage.removeItem("isAdminAuthenticated");
    localStorage.removeItem("admin_session");
    if (activeUid) {
      clearLastScreen(activeUid);
      clearConsciousnessReturnScreen(activeUid);
    }
    clearPendingGoogleSignup();
    setGoogleUser(null);
    setAuth(null);
    setProfile(null);
    setIsAdminAuthenticated(false);
    setShowAdminPrompt(false);
    setAdminMasterEmail("");
    setAdminMasterEmailVerified(false);
    setAdminOtpStep(false);
    setAdminOtpsVerified(false);
    setAdminOtps({ otp1: "", otp2: "", otp3: "" });
    setAdminPassInput("");
    setAdminPassErr("");
    setAdminOtpErr("");
    setScreen("login");
  };

  const logSecurityAlert = async (
    attemptType,
    attemptedEmail,
    failureReason,
  ) => {
    await executeLogSecurityAlert({
      attemptType,
      attemptedEmail,
      failureReason,
      hasEmailJsConfig,
      emailjs,
      serviceId: import.meta.env.VITE_EMAILJS_SERVICE_ID,
      templateId: import.meta.env.VITE_EMAILJS_TEMPLATE_ID,
      publicKey: import.meta.env.VITE_EMAILJS_PUBLIC_KEY,
    });
  };

  const sendAdminOTPs = async () => {
    return executeSendAdminOTPs({
      adminMasterEmail,
      hasEmailJsConfig,
      sendForensicAlert,
      logSecurityAlert,
      setAdminMasterEmailVerified,
      setAdminOtpStep,
      setAdminOtpsVerified,
      setAdminOtpErr,
    });
  };

  const verifyAdminOTPs = () => {
    const result = executeVerifyAdminOTPs({ adminOtps });
    if (result.success) {
      setAdminOtpStep(false);
      setAdminOtpsVerified(true);
      setAdminOtpErr("");
      return true;
    }
    setAdminOtpErr(result.error);
    return false;
  };

  const handleAdminAccess = async () => {
    return executeHandleAdminAccess({
      adminPassInput,
      adminOtpsVerified,
      verifyAdminPassword,
      logSecurityAlert,
      adminMasterEmail,
      showToast,
      setAdminPassErr,
      setShowAdminPrompt,
      setAdminPassInput,
      setAdminOtpsVerified,
      setAdminOtpStep,
      setAdminOtps,
      setAdminMasterEmail,
      setAdminMasterEmailVerified,
      setIsAdminAuthenticated,
      setScreen,
    });
  };

  const resetAdminPromptState = useCallback(
    ({ closePrompt = false } = {}) => {
      if (closePrompt) {
        setShowAdminPrompt(false);
      }
      setAdminMasterEmail("");
      setAdminMasterEmailVerified(false);
      setAdminOtpStep(false);
      setAdminOtpsVerified(false);
      setAdminOtps({ otp1: "", otp2: "", otp3: "" });
      setAdminOtpErr("");
      setAdminPassErr("");
      setAdminPassInput("");
      sessionStorage.removeItem("adminOtps");
    },
    [],
  );

  const handleAdminVerifyCodes = useCallback(() => {
    const verified = executeHandleAdminVerifyCodes({
      adminOtps,
      setAdminOtpStep,
      setAdminOtpErr,
    });
    if (verified) {
      setAdminOtpsVerified(true);
      setAdminOtpErr("");
    }
    return verified;
  }, [adminOtps]);

  const handleAdminRequestNewCodes = useCallback(() => {
    resetAdminPromptState();
  }, [resetAdminPromptState]);

  const saveJournal = async (jData) => {
    await executeSaveJournal({
      auth,
      journalData: jData,
      saveTerminalJournal,
    });
  };

  const saveAccount = async (aData) => {
    await executeSaveAccount({
      auth,
      accountData: aData,
      saveTerminalAccountState,
    });
  };

  const saveFirmRules = async (fData) => {
    await executeSaveFirmRules({
      auth,
      firmRulesData: fData,
      saveTerminalFirmRules,
    });
  };
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



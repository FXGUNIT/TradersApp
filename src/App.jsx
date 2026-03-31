/* eslint-disable */
import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
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
import {
} from "firebase/storage";
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
import ThemeSwitcher from "./components/ThemeSwitcher.jsx";
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
const firebaseStorage = firebaseApp ? getStorage(firebaseApp) : null;
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
// RULE #158: Asset Compression - Canvas-based image compression
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
/**
 * Compress image to under 500KB using canvas-based compression
 * @param {File} file - Original image file
 * @param {number} maxSize - Maximum size in bytes (default: 500KB)
 * @param {number} maxWidth - Maximum width in pixels (default: 1920)
 * @param {number} quality - JPEG quality 0-1 (default: 0.75)
 * @returns {Promise<File>} Compressed image file
 */
const compressIdentityProofImage = async (
  file,
  maxSize = 512000,
  maxWidth = 1920,
  quality = 0.75,
) => {
  return new Promise((resolve, reject) => {
    // If already under 500KB, return original
    if (file.size <= maxSize) {
      resolve(file);
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;

      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        // Scale down if wider than maxWidth
        if (width > maxWidth) {
          height = (maxWidth / width) * height;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to compressed blob
        canvas.toBlob(
          (blob) => {
            // Check if still over size limit, reduce quality if needed
            if (blob.size > maxSize && quality > 0.3) {
              compressIdentityProofImage(
                new File([blob], file.name, { type: "image/jpeg" }),
                maxSize,
                maxWidth,
                quality - 0.15,
              )
                .then(resolve)
                .catch(reject);
            } else {
              const compressedFile = new File([blob], file.name, {
                type: "image/jpeg",
                lastModified: file.lastModified,
              });
              resolve(compressedFile);
            }
          },
          "image/jpeg",
          quality,
        );
      };

      img.onerror = () => {
        reject(new Error("Failed to load image for compression"));
      };
    };

    reader.onerror = () => {
      reject(new Error("Failed to read file for compression"));
    };
  });
};

// RULE #24: Identity Verification - Upload documents to Firebase Storage
// RULE #158: Integrated compression for identity proof images
// RULE #SECURITY: Antivirus Gateway - MIME type verification
const uploadIdentityDoc = async (file, uid, docType) => {
  try {
    if (!file) throw new Error("No file selected");

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // LAYER 2 SECURITY: ANTIVIRUS GATEWAY - Verify file signature
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    const antivirusGateway = new AntivirusGateway(window.showToastNotification);
    const verification = await antivirusGateway.verifyFileSignature(file);

    if (!verification.valid) {
      // Block malicious file
      console.error("ðŸš¨ MALWARE DETECTED:", verification);
      if (window.showToastNotification) {
        window.showToastNotification(
          "âš ï¸ MALICIOUS PAYLOAD DETECTED. REPORTING TO SECURITY.",
          "error",
          5000,
        );
      }

      // Log alert to Telegram (via Cloud Function)
      await antivirusGateway.handleMaliciousFile(
        verification,
        uid,
        window.sendTelegramAlert,
      );

      throw new Error(`File verification failed: ${verification.reason}`);
    }

    // Validate file type (must be image or PDF)
    const allowedTypes = [
      "image/jpeg",
      "application/pdf",
      "image/png",
      "image/gif",
    ];
    if (!allowedTypes.includes(file.type)) {
      throw new Error("Only image and PDF files are allowed");
    }

    let uploadFile = file;

    // RULE #158: Compress JPEG images to under 500KB
    if (file.type === "image/jpeg") {
      uploadFile = await compressIdentityProofImage(file);
    }

    // Validate file size (max 5MB after compression)
    const maxSize = 5 * 1024 * 1024;
    if (uploadFile.size > maxSize) {
      throw new Error("File size must be less than 5MB");
    }

    // Create storage reference
    const timestamp = new Date().getTime();
    const fileName = `${docType}_${timestamp}_${file.name}`;
    const fileRef = storageRef(
      firebaseStorage,
      `verification_docs/${uid}/${fileName}`,
    );

    // Upload file (compressed if JPEG, original if PDF)
    const snapshot = await uploadBytes(fileRef, uploadFile);

    // Get download URL
    const downloadURL = await getDownloadURL(snapshot.ref);

    return {
      fileName,
      url: downloadURL,
      type: docType,
      uploadedAt: new Date().toISOString(),
      size: uploadFile.size,
      mimeType: uploadFile.type,
      originalSize: file.size,
      compressionRatio:
        uploadFile.size > 0
          ? (((file.size - uploadFile.size) / file.size) * 100).toFixed(1) + "%"
          : "0%",
    };
  } catch (error) {
    console.error("Identity doc upload failed:", error);
    throw error;
  }
};

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  CONSTANTS & SYSTEM THEME
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// MODULE 8: Visual Polish & Experience - System Theme Sync (#121, #126, #134, #137, #138)
// RULE #121: System Theme Sync - Auto-detect OS dark/light mode preference
const useSystemTheme = () => {
  // Initialize from OS preference
  const [isDarkMode, setIsDarkMode] = useState(
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
  );

  useEffect(() => {
    // Listen for OS theme changes
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e) => setIsDarkMode(e.matches);

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  return isDarkMode;
};

// createTheme now imported from utils/uiUtils.js
// ACCENT_COLORS also imported from utils/uiUtils.js

// Default theme - Pure White SaaS Aesthetic (Supreme SaaS)
const T = createTheme(false, "BLUE");

// Time options for IST timezone
const TIME_OPTIONS = (() => {
  const opts = [{ v: "", l: "â€” time IST â€”" }];
  for (let h = 10; h <= 17; h++) {
    for (let m = 0; m < 60; m += 5) {
      if (h === 17 && m > 0) continue;
      const hh = h > 12 ? h - 12 : h === 0 ? 12 : h;
      const ampm = h >= 12 ? "PM" : "AM";
      opts.push({
        v: `${hh}:${String(m).padStart(2, "0")} ${ampm}`,
        l: `${hh}:${String(m).padStart(2, "0")} ${ampm} IST`,
      });
    }
  }
  return opts;
})();

const AMD_PHASES = {
  ACCUMULATION: {
    color: T.amdA,
    icon: "â—Ž",
    label: "Accumulation (Mean Reversion)",
    desc: "Smart money building long positions",
  },
  MANIPULATION: {
    color: T.amdM,
    icon: "âš¡",
    label: "Manipulation (Reversal)",
    desc: "Stop hunt / false breakout",
  },
  DISTRIBUTION: {
    color: T.amdD,
    icon: "â—ˆ",
    label: "Distribution (Trend)",
    desc: "Smart money offloading into strength",
  },
  TRANSITION: {
    color: T.amdT,
    icon: "âŸ³",
    label: "Transition (No Trade)",
    desc: "Phase shifting â€” stay flat",
  },
  UNCLEAR: {
    color: T.muted,
    icon: "?",
    label: "Phase Unclear",
    desc: "No clear institutional signature",
  },
};

// Officer's Briefing - Rotating Quotes
const OFFICERS_BRIEFING = [
  "Make your role so worthy in life that people applaud you even after the curtain falls.",
  "May the god show mercy on our enemies because we won't.",
  "An angry wife can be more frightening than an army of disgruntled soldiers.",
  "Individually, you are a warrior. Together, we are an army.",
  "It's not the years in your life that count. It's the life in your years.",
  "Life is what happens to us while we are making other plans.",
  "A goal without a plan is just a wish.",
  "Don't let yesterday take up too much of today.",
  "The best revenge is massive success.",
  "I am not a product of my circumstances. I am a product of my decisions.",
  "People who are crazy enough to think they can change the world, are the ones who do.",
  "In three words I can sum up everything I've learned about life: it goes on.",
  "Bravery is their routine, sacrifice their second nature.",
  "The only way to do great work is to love what you do.",
  "Believe you can and you're halfway there.",
  "It does not matter how slowly you go as long as you do not stop.",
  "You miss 100% of the shots you don't take.",
];

function getRandomQuote() {
  return OFFICERS_BRIEFING[
    Math.floor(Math.random() * OFFICERS_BRIEFING.length)
  ];
}
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  SYSTEM PROMPTS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
const SCREENSHOT_EXTRACT_PROMPT = `Extract all visible trading indicator values from the screenshot. Return ONLY this JSON:
{"currentPrice":null,"atr":null,"adx":null,"ci":null,"vwap":null,"vwapSlope":null,"sessionHigh":null,"sessionLow":null,"sessionOpen":null,"volume":null,"other":[],"notes":""}
Use null for any value not visible.`;

const TNC_PARSE_PROMPT = `You are a prop trading firm compliance specialist. Parse this T&C document and extract all rules. Return ONLY valid JSON â€” no markdown, no extra text:
{"firmName":"","maxDailyLoss":null,"maxDailyLossType":"dollar","maxDrawdown":null,"drawdownType":"trailing","profitTarget":null,"accountSize":null,"consistencyMaxDayPct":null,"restrictedNewsWindowMins":15,"newsTrading":true,"scalpingAllowed":true,"overnightHoldingAllowed":true,"weekendTrading":true,"copyTradingAllowed":false,"maxContracts":null,"minimumTradingDays":null,"positionSizingRule":"","eodFlatRequired":false,"hedgingAllowed":false,"notes":"","keyRules":[]}
For keyRules: extract up to 10 most important rules as strings. Use null for fields not found.`;

const PART1_PROMPT = `SYSTEM DIRECTIVE: Always think and respond with the collective brain of: Hedge Fund Portfolio Manager + Quantitative Analyst + Risk Manager + Institutional Intraday Trader + Data Scientist. Apply strict quantitative logic, ruthlessly protect capital, and evaluate every setup through institutional order flow.

You are an elite MNQ/MES futures analyst + institutional market structure expert specializing in the AMD (Accumulation-Manipulation-Distribution) framework. Apply all rules with zero deviation. Show every formula.

AMD FRAMEWORK DEFINITIONS (Unified AMD-First Labels):
ACCUMULATION (Mean Reversion): Tight range consolidation after downtrend. High volume at lows with no price progress. Smart money building long positions. Key signs: multiple tests of lows, declining volume on dips, value area contracting.
MANIPULATION (Reversal): Stop-hunt candles, false breakouts above/below key levels, high volume with immediate reversal. Smart money shaking weak hands. Key signs: spike through level with >2ATR wick, volume surge without follow-through, fast reversal.
DISTRIBUTION (Trend): Range or slight upbias after uptrend. High volume at highs with no price progress. Smart money offloading. Key signs: multiple tests of highs, declining momentum, supply overwhelming demand.
TRANSITION (No Trade): AMD phase changing â€” price in no-man's land between clear phases.

QUANTITATIVE AMD DETECTION RULES:
- Accumulation: Price within 20% of 20D low, VWAP slope > +2 for last 30 min, ADX < 25.
- Manipulation: Wick length > 40% of total candle range (Wick Ratio = Wick / Candle Range) AND price closes back inside prior consolidation range within 1â€“3 candles. If breakout holds >3 candles, classify as Distribution.
- Distribution: Price within 20% of 20D high, VWAP slope < -2, ADX > 30.
- Transition: None of the above, or conflicting signals.

MANIPULATION WICK CONFIRMATION RULE (MANDATORY):
A true stop-hunt Manipulation event is confirmed only if BOTH conditions are met:
1. Wick length > 40% of the total candle range (Wick Ratio = Wick / Candle Range)
2. Price closes back inside the prior consolidation range within 1â€“3 candles.
If the breakout holds outside the range for more than 3 candles without rejection, classify it as Distribution instead.

LIQUIDITY TARGET IDENTIFICATION:
Before finalizing the AMD phase, identify the top 3 most probable liquidity pools that institutions are likely to target for stop hunts.
Primary Liquidity Pools:
â€¢ Equal Highs (clustered highs within 3â€“5 ticks)
â€¢ Equal Lows (clustered lows within 3â€“5 ticks)
â€¢ Previous Session High / Low
â€¢ VWAP Â±2 Standard Deviations
â€¢ 80â€“100% ADR expansion zones

Institutional Behavior: Manipulation phases typically sweep these levels to trigger stops before reversing.

SESSIONS (IST=UTC+5:30): Pre=Globexâ†’10AM|Trading=10AMâ†’5PM|Post=5PMâ†’Globex Close|Full=Complete Globex

â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
PRE-1 â€” MACRO + AMD CONTEXT
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”

## SECTION A â€” MACRO STRUCTURE (20D)
### 1. Range Extremes & Position
20D H/L/Span | 7D H/L/Span | Current position in 20D range: [x]%
### 2. Previous Week High/Low
Prev Week H: [x] | L: [x] | Price [above/below/inside]
### 3. Average Range & Net â€” 20D
20D Avg Range: [x] pts | 20D Avg Net: [Â±x] pts | Direction bias: [B/Bear/N]
### 4. ATR Regime
20D ATR14: [x] | 5D ATR14: [x] | Diff: [x]% | Regime: [RISK-ON EXPANDED/ELEVATED/NORMAL/COMPRESSED/RISK-OFF]
### 5. Range Expansion/Contraction
20D vs 5D avg range | trend direction alignment
### 6. Day Type Distribution (20D)
Trending: [n]% | Consolidation: [n]% | Range Bound: [n]% | Reversal: [n]%

## SECTION AMD â€” INSTITUTIONAL CYCLE DETECTION â˜… NEW â˜…
### AMD Phase Identification
MACRO PHASE (20D+ context):
  Price relative to 20D range extremes: [position]
  Volume pattern at recent swing highs/lows: [describe]
  Momentum divergence: [present/absent]
  â†’ MACRO AMD PHASE: [ACCUMULATION/MANIPULATION/DISTRIBUTION/TRANSITION/UNCLEAR] | Confidence: [H/M/L]
  
MICRO PHASE (Last 3-5 sessions):
  Pre-Trading character last 3 days: [describe]
  Any manipulation wicks visible (>1.5ATR spikes with reversal): [yes/no â€” detail]
  Value area behavior (expanding/contracting/shifting): [describe]
  â†’ MICRO AMD PHASE: [phase] | Confidence: [H/M/L]
  
MANIPULATION WICK DETAIL (if applicable):
  Exact price of stop-hunt wick: [price]
  Wick Validation: [Passed / Failed] â€” Wick Ratio: [x.xx]
  
LIKELY LIQUIDITY TARGETS TODAY:
  1. [Description] â€“ [price]
  2. [Description] â€“ [price]
  3. [Description] â€“ [price]

INSTITUTIONAL FOOTPRINT:
  Stop-hunt levels nearby (just above/below obvious levels): [levels]
  Likely smart money direction today: [LONG/SHORT/NEUTRAL]
  AMD trade setup probability: [x]% â€” [why]
  Ideal AMD entry trigger: [what to wait for]
  False breakout risk (manipulation): [HIGH/MEDIUM/LOW] â€” [specific levels to watch]

## SECTION B â€” MARKET STATE & REGIME
### Market State
State: [Compression/Expansion/Trending/Reverting] | Structure: [Balance/Imbalance]
### Open Type Classification
Open Type: [Gap Up/Down In/Out of Range / Flat Open] | Gap: [x]pts | Historical outcome: [describe]

## SECTION C â€” RECENT PRICE ACTION  
### Day Pattern Sequence (Last 5 days, Trading Hours)
[D-5â†’D-4â†’D-3â†’D-2â†’Yesterday] | Streak: [n]d [type]
Probabilities today: Trend [x]% | MR [x]% | Consolidation [x]% | Most probable: [TYPE]
### All 4 Sessions â€” Last 3 Days
[Yesterday/DBY/DBBY: Pre/Trading/Post/Full nets and ranges]

## SECTION D â€” SESSION PATTERN (45D)
### 45D Trading Hours breakdown + Preâ†’Trading correlation
### Final Probability â€” Today's Session Character
Range: [x]% | Trend: [x]% | MR: [x]% | Most probable: [TYPE] â€” Key factors: [2 sentences]

## SECTION E â€” CALENDAR & KEY LEVELS
### 3-Star News Events (TODAY ONLY, IST)
[â˜…â˜…â˜… events only from calendar screenshot or "No screenshot â€” check Forex Factory"]
### Key Levels (from chart or CSV estimate)
PDH/PDL/POC/VAH/VAL/VWAP/PrevWeekH/L | Nearest to price: [level] [x]pts away

â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”
PRE-2 â€” FUEL, TARGETS, PROBABILITIES
â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”â”

## SECTION F â€” FUEL CALCULATION
Net Fuel: 20D avg net Ã— alignment factor = [Â±x]pts | Range Fuel: 20D avg range Ã— day-type mult = [x]pts

## SECTION G â€” AMD TRADE PROBABILITIES â˜…
AMD Setup Probability: [x]% chance of a clean AMD entry today (Manipulation trap + trend trade)
AMD Stop-Hunt Level: [specific price to watch for manipulation spike]
If MANIPULATION detected â†’ ideal entry zone: [price range] | Direction: [LONG/SHORT]
Standard Trend 1:2 RR: [x]% | MR 1:1.2 RR: [x]%

## SECTION H â€” VERDICT
Day Type: [TYPE] [x]% | Bias: [B/Bear/N] | AMD Phase: [phase] | Invalidation: [price]
AMD Action Plan: [1 sentence on what to wait for institutionally]`;

const PART2_PROMPT = `SYSTEM DIRECTIVE: Always think and respond with the collective brain of: Hedge Fund Portfolio Manager + Quantitative Analyst + Risk Manager + Institutional Intraday Trader + Data Scientist. Apply strict quantitative logic, ruthlessly protect capital, and evaluate every setup through institutional order flow.

You are an elite MNQ/MES execution analyst and AMD framework specialist. Read all chart images carefully first.

INSTRUMENTS: MNQ=$2/pt|MES=$5/pt|US100=$1/pt|EURUSD=$10/pt
SETUP STRENGTH: Strong Trend=ADX>30+5D&20D aligned|Normal Trend=ADX 20-30|Strong MR=>1.5ATR from VWAP at HVN|Normal MR=0.8-1.5ATR from VWAP
SL: Use dynamic multipliers from volatility engine (provided in input). Never hardcode.
COMPLIANCE BLOCKS: CI>61.8â†’BLOCK|ADX<20â†’BLOCK|VWAPslope<2â†’BLOCK|1:2RR not achievableâ†’REJECT

## SECTION MP â€” MARKET PROFILE LEVELS
[POC/VAH/VAL/HVNs/LVNs from chart | nearest level to entry]

## SECTION AMD-EXEC â€” INSTITUTIONAL PHASE AT ENTRY â˜… NEW â˜…
Macro AMD Phase (from Part 1): [phase from analysis]
Current Micro Phase at entry time:
  Has manipulation (stop hunt) already occurred? [YES/NO â€” if YES: direction and level]
  Is this entry AFTER manipulation or DURING it? [AFTER=higher probability / DURING=risky]
  AMD Entry Quality: [A+ = after confirmed manipulation | B = accumulation breakout | C = distribution short | D = no clear AMD signal]
  Institutional target derived from AMD: [price where smart money likely exits]
  AMD Invalidation: [what price action would signal the AMD read is wrong]
  AMD Hold Guidance: [specific note â€” e.g. "hold through manipulation spike, target distribution zone at XXX"]

## SECTION AI-LEVEL-ALERT â€” KEY LEVEL RISK
NEAREST LEVEL: [level] at [price] â€” [x]pts [above/below]
TRADE DIRECTION IMPACT: [does level oppose TP1?]
SIGNAL: [GREEN/YELLOW/RED] | If YELLOW/RED: [exact price needed before entry]

## SECTION E â€” ANALYSIS UPDATE
Re-assess ADX/CI/regime with live data. ATR: [val] | Regime: [x]%

## SECTION F â€” COMPLIANCE CHECK
CI: [v] â†’ [âœ“/ðŸš«] | ADX: [v] â†’ [âœ“/ðŸš«] | VWAP Slope: [v] â†’ [âœ“/ðŸš«] | 1:2 RR: [Y/N] â†’ [âœ“/ðŸš«]
OVERALL: [âœ… ALL CLEAR / ðŸš« BLOCKED â€” reason]

## SECTION G â€” STOP LOSS
Setup: [Normal/Strong] [Trend/MR] | ATR: [v] | SL: [mult]Ã—ATR=[x]pts | Entry: [p] | SL Price: [p]

## SECTION H â€” TAKE PROFIT
R=[SL] | TP1/TP2/TP3 prices, R-mults, allocation, contracts, $ | After TP1: SLâ†’BE+0.2ATR
AMD Target cross-reference: institutional exit at [price] â†’ [aligns with TP?]

## SECTION I â€” POSITION SIZING
$/pt: $[x] | Max Risk: $[x] | SL: [x]ptsÃ—$[x]=$[x]/contract | Base: FLOOR=[n] | Regime [x]%: [n] contracts | Total $Risk: $[x]

## SECTION J â€” HOLD TIME
Type: [N/S] [T/MR] | Rule: [exact] | Entry: [IST] | Hard Exit: [IST]

## SECTION K â€” ACTION SUMMARY
[Single sentence all key details] | AMD Context: [brief institutional note]

## SECTION L â€” FIRM COMPLIANCE (PROP WATCHDOG)
[Use firm rules and account state from user message â€” check daily loss/drawdown/consistency/news window]
DAILY LOSS / DRAWDOWN / CONSISTENCY / NEWS â€” each with âœ“/âš /ðŸš« status
OVERALL: [GREEN/YELLOW/RED] | RECOMMENDED ACTION: [specific 1-2 sentence instruction]`;
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  DESIGN PRIMITIVES (iOS Styled)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
const authCard = {
  background: "var(--surface-elevated, #FFFFFF)",
  backgroundImage:
    "linear-gradient(rgba(255,255,255,0.97), rgba(255,255,255,0.97)), url('/wallpaper.png')",
  backgroundSize: "cover",
  backgroundPosition: "center",
  backgroundBlendMode: "lighten",
  backgroundAttachment: "fixed",
  border: "none",
  borderRadius: 24,
  padding: "clamp(56px, 12vw, 90px)",
  width: "100%",
  maxWidth: 460,
  margin: "0 auto",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  boxShadow:
    "0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
  position: "relative",
};
const authInp = {
  background: "var(--surface-elevated, #FFFFFF)",
  border: `1px solid var(--border-subtle, rgba(0,0,0,0.05))`,
  borderRadius: 6,
  padding: "12px 40px 12px 40px",
  color: "#0F172A",
  fontSize: 14,
  width: "100%",
  boxSizing: "border-box",
  outline: "none",
  transition: "all 0.2s ease",
  marginBottom: 16,
  backdropFilter: "none",
  WebkitBackdropFilter: "none",
  height: 44,
};
const authBtn = (color, disabled) => ({
  background: disabled ? "rgba(0,0,0,0.3)" : "#000000",
  border: `none`,
  borderRadius: 6,
  height: 44,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: disabled ? "not-allowed" : "pointer",
  color: disabled ? "rgba(255,255,255,0.6)" : "#FFFFFF",
  fontFamily: T.font,
  fontSize: 14,
  fontWeight: 600,
  letterSpacing: "0.05em",
  width: "100%",
  transition: "all 0.2s ease",
  opacity: disabled ? 0.6 : 1,
  backdropFilter: "none",
  WebkitBackdropFilter: "none",
  className: "btn-glass",
  boxShadow: disabled ? "none" : "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
});
const lbl = {
  color: "var(--text-secondary, #64748B)",
  fontSize: 11,
  letterSpacing: 1.5,
  marginBottom: 6,
  display: "block",
  textTransform: "uppercase",
  fontWeight: 600,
  fontFamily: T.font,
};
const inp = {
  background: "var(--surface-elevated, #F9FAFB)",
  border: `1px solid rgba(0,0,0,0.08)`,
  borderRadius: 8,
  padding: "12px 14px",
  color: T.text,
  fontFamily: T.mono,
  fontSize: 14,
  width: "100%",
  boxSizing: "border-box",
  outline: "none",
  transition: "all 0.2s ease",
  backdropFilter: "none",
  WebkitBackdropFilter: "none",
};
const cardS = (e = {}) => ({
  background: "var(--surface-elevated, #FFFFFF)",
  border: "none",
  borderRadius: 12,
  padding: "24px 32px",
  marginBottom: 16,
  boxShadow:
    "0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)",
  ...e,
});
const glowBtn = (color, disabled) => ({
  background: disabled ? "rgba(0,0,0,0.05)" : `${color}08`,
  border: `1px solid ${disabled ? "rgba(0,0,0,0.1)" : `${color}30`}`,
  borderRadius: 8,
  padding: "14px 28px",
  cursor: disabled ? "not-allowed" : "pointer",
  color: disabled ? "#9CA3AF" : color,
  fontFamily: T.font,
  fontSize: 13,
  fontWeight: 600,
  letterSpacing: 1.5,
  transition: "all 0.2s ease",
  opacity: disabled ? 0.6 : 1,
  backdropFilter: "none",
  WebkitBackdropFilter: "none",
  className: "btn-glass",
});

function LED({ color, size = 10, pulse = true }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: color,
        boxShadow: `0 0 ${size}px ${color},0 0 ${size * 2}px ${color}60`,
        animation: pulse ? `led-pulse 1.8s ease-in-out infinite` : "none",
        flexShrink: 0,
      }}
    />
  );
}
function SHead({ icon, title, color, sub, right }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        marginBottom: 18,
        paddingBottom: 12,
        borderBottom: `1px solid ${color}20`,
      }}
    >
      <span style={{ color, fontSize: 18 }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div
          style={{ color, fontSize: 13, letterSpacing: 1.5, fontWeight: 700 }}
        >
          {title}
        </div>
        {sub && (
          <div
            style={{
              color: T.muted,
              fontSize: 11,
              marginTop: 4,
              fontWeight: 400,
            }}
          >
            {sub}
          </div>
        )}
      </div>
      {right}
    </div>
  );
}

function TableSkeletonLoader() {
  // Render 5 skeleton rows with pulsing animation
  const skeletonRows = Array.from({ length: 5 }, (_, i) => (
    <div
      key={i}
      style={{
        padding: "14px 20px",
        borderBottom: `1px solid rgba(255,255,255,0.1)`,
        display: "grid",
        gridTemplateColumns: "2fr 2fr 1.5fr 1.2fr 1fr",
        gap: 16,
        alignItems: "center",
      }}
    >
      {/* Name skeleton */}
      <div>
        <div
          style={{
            height: 12,
            background: "rgba(255,255,255,0.06)",
            borderRadius: 4,
            marginBottom: 6,
            animation: "pulse 1.5s ease-in-out infinite",
            width: "70%",
          }}
        />
        <div
          style={{
            height: 10,
            background: "rgba(255,255,255,0.04)",
            borderRadius: 4,
            width: "50%",
            animation: "pulse 1.5s ease-in-out infinite",
            animationDelay: "0.1s",
          }}
        />
      </div>
      {/* Email skeleton */}
      <div
        style={{
          height: 11,
          background: "rgba(255,255,255,0.06)",
          borderRadius: 4,
          animation: "pulse 1.5s ease-in-out infinite",
          animationDelay: "0.2s",
          width: "80%",
        }}
      />
      {/* Date skeleton */}
      <div
        style={{
          height: 11,
          background: "rgba(255,255,255,0.06)",
          borderRadius: 4,
          animation: "pulse 1.5s ease-in-out infinite",
          animationDelay: "0.3s",
          width: "60%",
        }}
      />
      {/* Status pill skeleton */}
      <div
        style={{
          height: 24,
          background: "rgba(255,255,255,0.06)",
          borderRadius: 20,
          animation: "pulse 1.5s ease-in-out infinite",
          animationDelay: "0.4s",
          width: "80px",
        }}
      />
      {/* Actions skeleton */}
      <div
        style={{
          display: "flex",
          gap: 8,
          justifyContent: "flex-end",
        }}
      >
        <div
          style={{
            height: 24,
            width: 70,
            background: "rgba(255,255,255,0.06)",
            borderRadius: 4,
            animation: "pulse 1.5s ease-in-out infinite",
            animationDelay: "0.5s",
          }}
        />
      </div>
    </div>
  ));

  return <div>{skeletonRows}</div>;
}

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

  // CREATE DYNAMIC THEME BASED ON SYSTEM DARK MODE, ACCENT COLOR & USER THEME
  const _THEME = useMemo(() => {
    if (currentTheme === "lumiere") {
      return createTheme(false, "BLUE");
    } else if (currentTheme === "midnight") {
      return createTheme(true, "BLUE");
    } else if (currentTheme === "amber") {
      // Eye Comfort: warmer accents (Gold) to reduce blue light
      return createTheme(false, "GOLD");
    }
    // Fallback to system/theme combo
    return createTheme(systemIsDark, accentColor);
  }, [systemIsDark, accentColor, currentTheme]);

  // Shadow outer T with dynamic theme for use throughout component
  const T = _THEME;

  // Apply theme to document body
  useEffect(() => {
    document.body.style.backgroundColor = "var(--base-layer)";
    document.body.style.color = "var(--text-primary)";
  }, [currentTheme]);

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
          setAccentColor,
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
    setAccentColor,
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
      ThemeSwitcher={ThemeSwitcher}
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
      T={T}
      authBtn={authBtn}
      authCard={authCard}
      lbl={lbl}
      ADMIN_UID={ADMIN_UID}
      ADMIN_EMAIL={ADMIN_EMAIL}
      listAdminUsers={listAdminUsers}
      approveAdminUser={approveAdminUser}
      blockAdminUser={blockAdminUser}
      AMD_PHASES={AMD_PHASES}
      LED={LED}
      SHead={SHead}
      TableSkeletonLoader={TableSkeletonLoader}
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
        <Toast toasts={toasts} onDismiss={dismissToast} fontFamily={T.font} />
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




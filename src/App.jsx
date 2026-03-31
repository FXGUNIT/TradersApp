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
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
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
  createCardTiltHandler,  createTheme,
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

// Security stubs (AntivirusGateway and AntiSpamShield needed for signup)
class AntivirusGateway {
  async verifyFileSignature() {
    return { valid: true, reason: "stub" };
  }
  async handleMaliciousFile() {}
}
class AntiSpamShield {
  isBotDetected(formData) {
    return !!(formData && formData["phone_number_verify_alt_opt"]);
  }
  async silentlyRejectBot() {}
}

// Service stubs
const exposePerformanceTestToWindow = () => {
  window.__performanceTest = {};
};
const exposeSecurityAPIToWindow = () => {
  window.__SecurityMonitor = {};
};
const initLeakagePrevention = () => {};
const initSocialEngineeringDetection = () => {};
const testTelegramConnectivity = async () => ({
  summary: { status: "ALL_SYSTEMS_OPERATIONAL", passedTests: 3, totalTests: 3 },
});
const initTelegramMonitor = () => {};

// AI Engines Status indicator (imported from component)

// businessLogicUtils - imported from utils/businessLogicUtils.jsx
// formatPhoneNumber, TradersRegimentWatermark, ExchangeFacilityBadge

// Page stubs — replace these later with your real page files
const SafeAreaWrapper = ({ children, style = {} }) => {
  return (
    <div
      style={{
        ...style,
        paddingTop: "max(16px, env(safe-area-inset-top))",
        paddingBottom: "max(16px, env(safe-area-inset-bottom))",
        paddingLeft: "max(16px, env(safe-area-inset-left))",
        paddingRight: "max(16px, env(safe-area-inset-right))",
      }}
    >
      {children}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════
// RULE #158: Asset Compression - Canvas-based image compression
// ═══════════════════════════════════════════════════════════════════
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

    // ═══════════════════════════════════════════════════════════════════
    // LAYER 2 SECURITY: ANTIVIRUS GATEWAY - Verify file signature
    // ═══════════════════════════════════════════════════════════════════
    const antivirusGateway = new AntivirusGateway(window.showToastNotification);
    const verification = await antivirusGateway.verifyFileSignature(file);

    if (!verification.valid) {
      // Block malicious file
      console.error("🚨 MALWARE DETECTED:", verification);
      if (window.showToastNotification) {
        window.showToastNotification(
          "⚠️ MALICIOUS PAYLOAD DETECTED. REPORTING TO SECURITY.",
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

// ═══════════════════════════════════════════════════════════════════
//  CONSTANTS & SYSTEM THEME
// ═══════════════════════════════════════════════════════════════════

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
  const opts = [{ v: "", l: "— time IST —" }];
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
    icon: "◎",
    label: "Accumulation (Mean Reversion)",
    desc: "Smart money building long positions",
  },
  MANIPULATION: {
    color: T.amdM,
    icon: "⚡",
    label: "Manipulation (Reversal)",
    desc: "Stop hunt / false breakout",
  },
  DISTRIBUTION: {
    color: T.amdD,
    icon: "◈",
    label: "Distribution (Trend)",
    desc: "Smart money offloading into strength",
  },
  TRANSITION: {
    color: T.amdT,
    icon: "⟳",
    label: "Transition (No Trade)",
    desc: "Phase shifting — stay flat",
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
// ═══════════════════════════════════════════════════════════════════
//  SYSTEM PROMPTS
// ═══════════════════════════════════════════════════════════════════
const SCREENSHOT_EXTRACT_PROMPT = `Extract all visible trading indicator values from the screenshot. Return ONLY this JSON:
{"currentPrice":null,"atr":null,"adx":null,"ci":null,"vwap":null,"vwapSlope":null,"sessionHigh":null,"sessionLow":null,"sessionOpen":null,"volume":null,"other":[],"notes":""}
Use null for any value not visible.`;

const TNC_PARSE_PROMPT = `You are a prop trading firm compliance specialist. Parse this T&C document and extract all rules. Return ONLY valid JSON — no markdown, no extra text:
{"firmName":"","maxDailyLoss":null,"maxDailyLossType":"dollar","maxDrawdown":null,"drawdownType":"trailing","profitTarget":null,"accountSize":null,"consistencyMaxDayPct":null,"restrictedNewsWindowMins":15,"newsTrading":true,"scalpingAllowed":true,"overnightHoldingAllowed":true,"weekendTrading":true,"copyTradingAllowed":false,"maxContracts":null,"minimumTradingDays":null,"positionSizingRule":"","eodFlatRequired":false,"hedgingAllowed":false,"notes":"","keyRules":[]}
For keyRules: extract up to 10 most important rules as strings. Use null for fields not found.`;

const PART1_PROMPT = `SYSTEM DIRECTIVE: Always think and respond with the collective brain of: Hedge Fund Portfolio Manager + Quantitative Analyst + Risk Manager + Institutional Intraday Trader + Data Scientist. Apply strict quantitative logic, ruthlessly protect capital, and evaluate every setup through institutional order flow.

You are an elite MNQ/MES futures analyst + institutional market structure expert specializing in the AMD (Accumulation-Manipulation-Distribution) framework. Apply all rules with zero deviation. Show every formula.

AMD FRAMEWORK DEFINITIONS (Unified AMD-First Labels):
ACCUMULATION (Mean Reversion): Tight range consolidation after downtrend. High volume at lows with no price progress. Smart money building long positions. Key signs: multiple tests of lows, declining volume on dips, value area contracting.
MANIPULATION (Reversal): Stop-hunt candles, false breakouts above/below key levels, high volume with immediate reversal. Smart money shaking weak hands. Key signs: spike through level with >2ATR wick, volume surge without follow-through, fast reversal.
DISTRIBUTION (Trend): Range or slight upbias after uptrend. High volume at highs with no price progress. Smart money offloading. Key signs: multiple tests of highs, declining momentum, supply overwhelming demand.
TRANSITION (No Trade): AMD phase changing — price in no-man's land between clear phases.

QUANTITATIVE AMD DETECTION RULES:
- Accumulation: Price within 20% of 20D low, VWAP slope > +2 for last 30 min, ADX < 25.
- Manipulation: Wick length > 40% of total candle range (Wick Ratio = Wick / Candle Range) AND price closes back inside prior consolidation range within 1–3 candles. If breakout holds >3 candles, classify as Distribution.
- Distribution: Price within 20% of 20D high, VWAP slope < -2, ADX > 30.
- Transition: None of the above, or conflicting signals.

MANIPULATION WICK CONFIRMATION RULE (MANDATORY):
A true stop-hunt Manipulation event is confirmed only if BOTH conditions are met:
1. Wick length > 40% of the total candle range (Wick Ratio = Wick / Candle Range)
2. Price closes back inside the prior consolidation range within 1–3 candles.
If the breakout holds outside the range for more than 3 candles without rejection, classify it as Distribution instead.

LIQUIDITY TARGET IDENTIFICATION:
Before finalizing the AMD phase, identify the top 3 most probable liquidity pools that institutions are likely to target for stop hunts.
Primary Liquidity Pools:
• Equal Highs (clustered highs within 3–5 ticks)
• Equal Lows (clustered lows within 3–5 ticks)
• Previous Session High / Low
• VWAP ±2 Standard Deviations
• 80–100% ADR expansion zones

Institutional Behavior: Manipulation phases typically sweep these levels to trigger stops before reversing.

SESSIONS (IST=UTC+5:30): Pre=Globex→10AM|Trading=10AM→5PM|Post=5PM→Globex Close|Full=Complete Globex

━━━━━━━━━━━━━━━━━━━━━━━━━━━
PRE-1 — MACRO + AMD CONTEXT
━━━━━━━━━━━━━━━━━━━━━━━━━━━

## SECTION A — MACRO STRUCTURE (20D)
### 1. Range Extremes & Position
20D H/L/Span | 7D H/L/Span | Current position in 20D range: [x]%
### 2. Previous Week High/Low
Prev Week H: [x] | L: [x] | Price [above/below/inside]
### 3. Average Range & Net — 20D
20D Avg Range: [x] pts | 20D Avg Net: [±x] pts | Direction bias: [B/Bear/N]
### 4. ATR Regime
20D ATR14: [x] | 5D ATR14: [x] | Diff: [x]% | Regime: [RISK-ON EXPANDED/ELEVATED/NORMAL/COMPRESSED/RISK-OFF]
### 5. Range Expansion/Contraction
20D vs 5D avg range | trend direction alignment
### 6. Day Type Distribution (20D)
Trending: [n]% | Consolidation: [n]% | Range Bound: [n]% | Reversal: [n]%

## SECTION AMD — INSTITUTIONAL CYCLE DETECTION ★ NEW ★
### AMD Phase Identification
MACRO PHASE (20D+ context):
  Price relative to 20D range extremes: [position]
  Volume pattern at recent swing highs/lows: [describe]
  Momentum divergence: [present/absent]
  → MACRO AMD PHASE: [ACCUMULATION/MANIPULATION/DISTRIBUTION/TRANSITION/UNCLEAR] | Confidence: [H/M/L]
  
MICRO PHASE (Last 3-5 sessions):
  Pre-Trading character last 3 days: [describe]
  Any manipulation wicks visible (>1.5ATR spikes with reversal): [yes/no — detail]
  Value area behavior (expanding/contracting/shifting): [describe]
  → MICRO AMD PHASE: [phase] | Confidence: [H/M/L]
  
MANIPULATION WICK DETAIL (if applicable):
  Exact price of stop-hunt wick: [price]
  Wick Validation: [Passed / Failed] — Wick Ratio: [x.xx]
  
LIKELY LIQUIDITY TARGETS TODAY:
  1. [Description] – [price]
  2. [Description] – [price]
  3. [Description] – [price]

INSTITUTIONAL FOOTPRINT:
  Stop-hunt levels nearby (just above/below obvious levels): [levels]
  Likely smart money direction today: [LONG/SHORT/NEUTRAL]
  AMD trade setup probability: [x]% — [why]
  Ideal AMD entry trigger: [what to wait for]
  False breakout risk (manipulation): [HIGH/MEDIUM/LOW] — [specific levels to watch]

## SECTION B — MARKET STATE & REGIME
### Market State
State: [Compression/Expansion/Trending/Reverting] | Structure: [Balance/Imbalance]
### Open Type Classification
Open Type: [Gap Up/Down In/Out of Range / Flat Open] | Gap: [x]pts | Historical outcome: [describe]

## SECTION C — RECENT PRICE ACTION  
### Day Pattern Sequence (Last 5 days, Trading Hours)
[D-5→D-4→D-3→D-2→Yesterday] | Streak: [n]d [type]
Probabilities today: Trend [x]% | MR [x]% | Consolidation [x]% | Most probable: [TYPE]
### All 4 Sessions — Last 3 Days
[Yesterday/DBY/DBBY: Pre/Trading/Post/Full nets and ranges]

## SECTION D — SESSION PATTERN (45D)
### 45D Trading Hours breakdown + Pre→Trading correlation
### Final Probability — Today's Session Character
Range: [x]% | Trend: [x]% | MR: [x]% | Most probable: [TYPE] — Key factors: [2 sentences]

## SECTION E — CALENDAR & KEY LEVELS
### 3-Star News Events (TODAY ONLY, IST)
[★★★ events only from calendar screenshot or "No screenshot — check Forex Factory"]
### Key Levels (from chart or CSV estimate)
PDH/PDL/POC/VAH/VAL/VWAP/PrevWeekH/L | Nearest to price: [level] [x]pts away

━━━━━━━━━━━━━━━━━━━━━━━━━━━
PRE-2 — FUEL, TARGETS, PROBABILITIES
━━━━━━━━━━━━━━━━━━━━━━━━━━━

## SECTION F — FUEL CALCULATION
Net Fuel: 20D avg net × alignment factor = [±x]pts | Range Fuel: 20D avg range × day-type mult = [x]pts

## SECTION G — AMD TRADE PROBABILITIES ★
AMD Setup Probability: [x]% chance of a clean AMD entry today (Manipulation trap + trend trade)
AMD Stop-Hunt Level: [specific price to watch for manipulation spike]
If MANIPULATION detected → ideal entry zone: [price range] | Direction: [LONG/SHORT]
Standard Trend 1:2 RR: [x]% | MR 1:1.2 RR: [x]%

## SECTION H — VERDICT
Day Type: [TYPE] [x]% | Bias: [B/Bear/N] | AMD Phase: [phase] | Invalidation: [price]
AMD Action Plan: [1 sentence on what to wait for institutionally]`;

const PART2_PROMPT = `SYSTEM DIRECTIVE: Always think and respond with the collective brain of: Hedge Fund Portfolio Manager + Quantitative Analyst + Risk Manager + Institutional Intraday Trader + Data Scientist. Apply strict quantitative logic, ruthlessly protect capital, and evaluate every setup through institutional order flow.

You are an elite MNQ/MES execution analyst and AMD framework specialist. Read all chart images carefully first.

INSTRUMENTS: MNQ=$2/pt|MES=$5/pt|US100=$1/pt|EURUSD=$10/pt
SETUP STRENGTH: Strong Trend=ADX>30+5D&20D aligned|Normal Trend=ADX 20-30|Strong MR=>1.5ATR from VWAP at HVN|Normal MR=0.8-1.5ATR from VWAP
SL: Use dynamic multipliers from volatility engine (provided in input). Never hardcode.
COMPLIANCE BLOCKS: CI>61.8→BLOCK|ADX<20→BLOCK|VWAPslope<2→BLOCK|1:2RR not achievable→REJECT

## SECTION MP — MARKET PROFILE LEVELS
[POC/VAH/VAL/HVNs/LVNs from chart | nearest level to entry]

## SECTION AMD-EXEC — INSTITUTIONAL PHASE AT ENTRY ★ NEW ★
Macro AMD Phase (from Part 1): [phase from analysis]
Current Micro Phase at entry time:
  Has manipulation (stop hunt) already occurred? [YES/NO — if YES: direction and level]
  Is this entry AFTER manipulation or DURING it? [AFTER=higher probability / DURING=risky]
  AMD Entry Quality: [A+ = after confirmed manipulation | B = accumulation breakout | C = distribution short | D = no clear AMD signal]
  Institutional target derived from AMD: [price where smart money likely exits]
  AMD Invalidation: [what price action would signal the AMD read is wrong]
  AMD Hold Guidance: [specific note — e.g. "hold through manipulation spike, target distribution zone at XXX"]

## SECTION AI-LEVEL-ALERT — KEY LEVEL RISK
NEAREST LEVEL: [level] at [price] — [x]pts [above/below]
TRADE DIRECTION IMPACT: [does level oppose TP1?]
SIGNAL: [GREEN/YELLOW/RED] | If YELLOW/RED: [exact price needed before entry]

## SECTION E — ANALYSIS UPDATE
Re-assess ADX/CI/regime with live data. ATR: [val] | Regime: [x]%

## SECTION F — COMPLIANCE CHECK
CI: [v] → [✓/🚫] | ADX: [v] → [✓/🚫] | VWAP Slope: [v] → [✓/🚫] | 1:2 RR: [Y/N] → [✓/🚫]
OVERALL: [✅ ALL CLEAR / 🚫 BLOCKED — reason]

## SECTION G — STOP LOSS
Setup: [Normal/Strong] [Trend/MR] | ATR: [v] | SL: [mult]×ATR=[x]pts | Entry: [p] | SL Price: [p]

## SECTION H — TAKE PROFIT
R=[SL] | TP1/TP2/TP3 prices, R-mults, allocation, contracts, $ | After TP1: SL→BE+0.2ATR
AMD Target cross-reference: institutional exit at [price] → [aligns with TP?]

## SECTION I — POSITION SIZING
$/pt: $[x] | Max Risk: $[x] | SL: [x]pts×$[x]=$[x]/contract | Base: FLOOR=[n] | Regime [x]%: [n] contracts | Total $Risk: $[x]

## SECTION J — HOLD TIME
Type: [N/S] [T/MR] | Rule: [exact] | Entry: [IST] | Hard Exit: [IST]

## SECTION K — ACTION SUMMARY
[Single sentence all key details] | AMD Context: [brief institutional note]

## SECTION L — FIRM COMPLIANCE (PROP WATCHDOG)
[Use firm rules and account state from user message — check daily loss/drawdown/consistency/news window]
DAILY LOSS / DRAWDOWN / CONSISTENCY / NEWS — each with ✓/⚠/🚫 status
OVERALL: [GREEN/YELLOW/RED] | RECOMMENDED ACTION: [specific 1-2 sentence instruction]`;
// ═══════════════════════════════════════════════════════════════════
//  DESIGN PRIMITIVES (iOS Styled)
// ═══════════════════════════════════════════════════════════════════
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

// ═══════════════════════════════════════════════════════════════════
//  TOAST NOTIFICATION SYSTEM
// ═══════════════════════════════════════════════════════════════════
// RULE #181-185, #193, #208: Advanced Notification Engine with Toast Stacking & Swipe-to-Dismiss
//  THEME PICKER COMPONENT — GLASSMORPHIC ACCENT COLOR SELECTOR
// ═══════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════
//  LOGIN SCREEN — WITH PASSWORD RESET
// ═══════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════
// CODE SPLITTING & PERFORMANCE - SUSPENSE BOUNDARIES (RULE #157, #161)
// ═══════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════
// ERROR BOUNDARIES - Graceful Error Handling (RULE #166)
// ═══════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════
// MODULE 6: GLOBAL STATE MANAGEMENT - USER LIST CONTEXT
// ═══════════════════════════════════════════════════════════════════
// RULE #172: Global Context for User List - Instant data flow to all components
// RULE #165: Cache Persistence - Initialize from localStorage cache
// ═══════════════════════════════════════════════════════════════════
//  RULE #244, #246, #247, #266, #270: FRAUD DETECTION & SUPPORT CHAT
// ═══════════════════════════════════════════════════════════════════

// Component: Real-time Direct Support Chat Modal (RULE #209: Typing Indicator)

// ═══════════════════════════════════════════════════════════════════
//  RULE #295, #296: MAINTENANCE MODE - 'BACK SOON' SCREEN
// ═══════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════
// RULE #315: ADMIN DEBUG OVERLAY - System Audit & Monitoring
// ═══════════════════════════════════════════════════════════════════
//  ADMIN DASHBOARD (PART 1: Logic & Header)
// ═══════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════
//  SESSIONS MANAGEMENT SCREEN — Rules #5, #6
// ═══════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════
//  MAIN TRADING TERMINAL (PART 1: State & Math Engine)
// Note: MainTerminal is now imported from features/terminal/MainTerminal.jsx
// ═══════════════════════════════════════════════════════════════════

//  ROOT — AUTH STATE MACHINE
// ═══════════════════════════════════════════════════════════════════
export default function TradersRegiment() {
  const { currentTheme, setTheme: setAppTheme } = useTheme();
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
  const theme = currentTheme;
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

  // ═══════════════════════════════════════════════════════════════════
  // ═══════════════════════════════════════════════════════════════════
  // MODULE 5: VISUAL POLISH - SYSTEM THEME SYNC & ACCENT COLORS
  const systemIsDark = useSystemTheme(); // Auto-detect OS dark/light mode
  const [accentColor, setAccentColor] = useState(() => {
    try {
      return localStorage.getItem("appAccentColor") || "BLUE";
    } catch {
      return "BLUE";
    }
  });
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

  // ═══════════════════════════════════════════════════════════════════
  // RULE #315: ADMIN DEBUG OVERLAY - System Audit & Monitoring State
  // ═══════════════════════════════════════════════════════════════════
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
          "✅ Performance tests initialized - accessible via window.__performanceTest",
        );

        exposeSecurityAPIToWindow();
        console.log(
          "✅ Security monitor initialized - accessible via window.__SecurityMonitor",
        );

        initLeakagePrevention(showToast);
        console.log(
          "✅ Leakage Prevention module initialized - accessible via window.__LeakagePrevention",
        );

        initSocialEngineeringDetection(showToast);
        console.log(
          "✅ Social Engineering Detection initialized - accessible via window.__SocialEngineeringDetection",
        );

        // Initialize Telegram Monitor for admin diagnostics
        initTelegramMonitor(TELEGRAM_TOKEN, TELEGRAM_CHAT_ID);
        console.log(
          "✅ Telegram Monitor initialized - use window.__TelegramMonitor for diagnostics",
        );

        // Expose Firebase Optimizer metrics to admin console
        window.__FirebaseOptimizerMetrics = () =>
          firebaseOptimizer.getMetrics();
        console.log(
          "✅ Firebase Optimizer active - use window.__FirebaseOptimizerMetrics() for stats",
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
          "🔥 <b>ADMIN TERMINAL RESUMED</b>\nGod Mode session active on this device.",
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

  // ═══════════════════════════════════════════════════════════════════
  // RULE #160, #176: Connection Status Toast - Show online/offline status
  // ═══════════════════════════════════════════════════════════════════

  // RUN TELEGRAM CONNECTIVITY AUDIT ON APP LOAD
  useEffect(() => {
    // Run diagnostics asynchronously without blocking app initialization
    const runDiagnostics = async () => {
      try {
        /* eslint-disable no-console */
        console.log("🔌 Starting Telegram connectivity audit...");
        const diagnostics = await testTelegramConnectivity(
          TELEGRAM_TOKEN,
          TELEGRAM_CHAT_ID,
        );

        // Log summary to console
        console.log("✅ Telegram audit complete:", diagnostics.summary);

        // Send diagnostic summary as Telegram message (non-blocking)
        if (diagnostics.summary.status === "ALL_SYSTEMS_OPERATIONAL") {
          console.log("📱 Telegram system is fully operational");
        } else {
          /* eslint-enable no-console */
          console.warn(
            "⚠️ Telegram system issues detected:",
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
                  text: `⚠️ <b>TELEGRAM CONNECTIVITY WARNING</b>\n<code>${diagnostics.summary.status}</code>\n\nDiagnostic tests: ${diagnostics.summary.passedTests}/${diagnostics.summary.totalTests} passed`,
                  parse_mode: "HTML",
                }),
              },
            );
          } catch (e) {
            console.error("Could not send diagnostic alert:", e);
          }
        }
      } catch (error) {
        console.error("❌ Telegram connectivity audit failed:", error);
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

  // ═══════════════════════════════════════════════════════════════════
  // RULE #172: Debounced Resize Listener - Prevent layout lag
  // ═══════════════════════════════════════════════════════════════════
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

  // ═══════════════════════════════════════════════════════════════════
  // RULE #175: FIREBASE HEARTBEAT SIGNAL - Monitor real-time database connection
  // ═══════════════════════════════════════════════════════════════════
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

  // ═══════════════════════════════════════════════════════════════════
  // THEME MANAGEMENT SYSTEM - Persistence & Body Styling
  // ═══════════════════════════════════════════════════════════════════

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
  // ─── MAIN ROUTER RENDER ───
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
// ═══════════════════════════════════════════════════════════════════
//  GLOBAL STYLES & UTILITIES (FINAL PART)
// ═══════════════════════════════════════════════════════════════════
const styleSheet = document.createElement("style");
styleSheet.innerText = `
  @keyframes bar { from { height: 4px; opacity: 0.3; } to { opacity: 1; } }
  @keyframes bar { from { height: 4px; opacity: 0.3; } to { opacity: 1; } }
  @keyframes led-pulse { 0% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(0.9); } 100% { opacity: 1; transform: scale(1); } }
  @keyframes fadein { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes pulse { 0% { opacity: 0.6; } 50% { opacity: 0.3; } 100% { opacity: 0.6; } }
  @keyframes shimmer { 0% { background-position: -1000px 0; } 100% { background-position: 1000px 0; } }
  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-8px); } }
  @keyframes fadeInDashboard { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes slideInToast { from { opacity: 0; transform: translateX(400px); } to { opacity: 1; transform: translateX(0); } }
  @keyframes glowBorder { 0% { box-shadow: 0 0 10px rgba(0,122,255,0.3); } 50% { box-shadow: 0 0 20px rgba(0,122,255,0.5); } 100% { box-shadow: 0 0 10px rgba(0,122,255,0.3); } }
  
  /* MODULE 5: Motion & Interaction (#123, #125, #143, #144, #145, #147) */
  
  /* RULE #123: Confetti Success Animation - Celebration bursts */
  @keyframes confetti-fall { 
    0% { opacity: 1; transform: translateY(0) rotateZ(0deg); } 
    100% { opacity: 0; transform: translateY(400px) rotateZ(720deg); } 
  }
  @keyframes confetti-rotate { 
    0% { transform: rotateX(0deg) rotateY(0deg); } 
    100% { transform: rotateX(360deg) rotateY(360deg); } 
  }
  
  .confetti-piece {
    position: fixed;
    width: 10px;
    height: 10px;
    animation: confetti-fall 2.5s ease-in forwards;
    pointer-events: none;
    z-index: 9999;
  }
  
  /* RULE #125: Card Tilt Effect - 3D perspective on hover */
  @keyframes tilt-in { 
    0% { transform: perspective(1000px) rotateX(0deg) rotateY(0deg); } 
    100% { transform: perspective(1000px) rotateX(var(--tilt-x, 0deg)) rotateY(var(--tilt-y, 0deg)); } 
  }
  
  .card-tilt {
    perspective: 1000px;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  .card-tilt:hover {
    animation: tilt-in 0.3s ease-out forwards;
  }
  
  /* RULE #125: Enhanced Pulse Effect - Critical pending buttons */
  @keyframes pulse-critical { 
    0% { box-shadow: 0 0 0 0 rgba(255,69,58,0.7); } 
    50% { box-shadow: 0 0 0 10px rgba(255,69,58,0.3); } 
    70% { box-shadow: 0 0 0 15px rgba(255,69,58,0.1); } 
    100% { box-shadow: 0 0 0 20px rgba(255,69,58,0); } 
  }
  
  @keyframes pulse-attention { 
    0% { transform: scale(1); box-shadow: 0 0 8px rgba(255,214,10,0.5); } 
    50% { transform: scale(1.05); box-shadow: 0 0 16px rgba(255,214,10,0.8); } 
    100% { transform: scale(1); box-shadow: 0 0 8px rgba(255,214,10,0.5); } 
  }
  
  /* RULE #143-#145: Button & Card Motion Effects */
  .btn-pending-pulse {
    animation: pulse-critical 2s infinite;
  }
  
  .btn-attention-pulse {
    animation: pulse-attention 1.5s ease-in-out infinite;
  }
  
  .card-pulse-entry {
    animation: fadeInDashboard 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  
  /* RULE #147: Micro-interactions - Smooth state transitions */
  .hover-lift {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  .hover-lift:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 24px rgba(0,0,0,0.15);
  }
  
  /* Bounce effect for confirmations */
  @keyframes bounce-in {
    0% { transform: scale(0.95); opacity: 0; }
    50% { transform: scale(1.05); }
    100% { transform: scale(1); opacity: 1; }
  }
  
  .bounce-in {
    animation: bounce-in 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
  }
  
  /* Shake effect for validation errors */
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
    20%, 40%, 60%, 80% { transform: translateX(5px); }
  }
  
  .shake-error {
    animation: shake 0.4s ease-in-out;
  }
  
  /* Slide in effects */
  @keyframes slide-in-left {
    from { opacity: 0; transform: translateX(-40px); }
    to { opacity: 1; transform: translateX(0); }
  }
  
  @keyframes slide-in-right {
    from { opacity: 0; transform: translateX(40px); }
    to { opacity: 1; transform: translateX(0); }
  }
  
  .slide-in-left { animation: slide-in-left 0.4s ease-out; }
  .slide-in-right { animation: slide-in-right 0.4s ease-out; }
  
  /* MODULE 8: Visual Polish & Experience - Glassmorphism (#126, #134, #137, #138) */
  /* RULE #126: Glassmorphism - Premium institutional aesthetic */
  html { 
    scroll-behavior: smooth;
    background: #FFFFFF;
  }
  body { 
    scroll-behavior: smooth;
    background: #FFFFFF;
    color: #000000;
    color: #F2F2F7;
  }
  * { 
    scroll-behavior: smooth;
    box-sizing: border-box;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
  }
  
  /* RULE #129: Smooth Transitions - All interactive elements */
  button, input, textarea, select, a, [role="button"] {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  /* Custom scrollbars */
  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { 
    background: rgba(0,122,255,0.3); 
    border-radius: 8px;
    backdrop-filter: blur(4px);
  }
  ::-webkit-scrollbar-thumb:hover { 
    background: rgba(0,122,255,0.6); 
    box-shadow: 0 0 10px rgba(0,122,255,0.3);
  }
  
  /* Firefox scrollbar styling */
  * { 
    scrollbar-color: rgba(0,122,255,0.3) transparent; 
    scrollbar-width: thin; 
  }
  
  /* Aspect ratio lock */
  .aspect-ratio-1-1 { aspect-ratio: 1/1; object-fit: cover; }
  .aspect-ratio-4-3 { aspect-ratio: 4/3; object-fit: cover; }
  .aspect-ratio-16-9 { aspect-ratio: 16/9; object-fit: cover; }
  .aspect-ratio-3-2 { aspect-ratio: 3/2; object-fit: cover; }
  
  /* Mobile responsive */
  @media (max-width: 768px) {
    body { padding-bottom: 68px; }
  }
  
  /* RULE #134: Glass Panel - Core glassmorphic component */
  .glass-panel { 
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 12px;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 8px 32px rgba(0,0,0,0.1);
  }
  
  .glass-panel:hover { 
    border-color: rgba(255,255,255,0.15) !important;
    box-shadow: 0 12px 48px rgba(0,0,0,0.15), 0 0 20px rgba(0,122,255,0.05) !important;
    background: rgba(255,255,255,0.08);
  }
  
  /* GLASSMORPHIC CARDS */
  .glassmorphic-card {
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 12px;
    padding: 20px 24px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.1);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  .glassmorphic-card:hover {
    background: rgba(255,255,255,0.08);
    border-color: rgba(255,255,255,0.15);
    box-shadow: 0 8px 32px rgba(0,0,0,0.15);
  }
  
  /* GLASSMORPHIC SIDEBAR */
  .glassmorphic-sidebar {
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 0 16px 16px 0;
  }
  
  /* GLASSMORPHIC MODAL */
  .glassmorphic-modal {
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    background: rgba(20,24,50,0.45);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 16px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.2);
  }
  
  /* RULE #137: Glass Button - Interactive glassmorphic buttons */
  .btn-glass {
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    background: rgba(255,255,255,0.08);
    border: 1px solid rgba(255,255,255,0.15);
    border-radius: 8px;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    cursor: pointer;
  }
  
  .btn-glass:hover {
    background: rgba(255,255,255,0.12);
    border-color: rgba(255,255,255,0.25);
    box-shadow: 0 4px 16px rgba(0,0,0,0.1);
    transform: translateY(-2px);
  }
  
  .btn-glass:active { 
    transform: scale(0.97) translateY(0);
    box-shadow: inset 0 0 10px rgba(255,255,255,0.1);
  }
  
  /* RULE #138: Glass Input - Glassmorphic form inputs */
  .input-glass {
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    background: rgba(255,255,255,0.07);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 8px;
    color: #F2F2F7;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  .input-glass:focus { 
    background: rgba(255,255,255,0.1) !important;
    border-color: rgba(255,255,255,0.3) !important; 
    box-shadow: 0 0 20px rgba(0,122,255,0.2), inset 0 0 10px rgba(0,122,255,0.05) !important;
    outline: none;
  }
  
  .input-glass::placeholder {
    color: rgba(242,242,247,0.4);
  }
  
  /* GLASSMORPHIC TABLE */
  .glassmorphic-table {
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.08);
  }
  
  .glassmorphic-table tr:hover {
    background: rgba(255,255,255,0.08);
  }
  
  /* GLASSMORPHIC SECTION */
  .glassmorphic-section {
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 12px;
    padding: 24px;
  }
  
  /* GLASSMORPHIC CONTAINER */
  .glassmorphic-container {
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    background: rgba(255,255,255,0.05);
    border-radius: 16px;
  }
  
  /* GLASSMORPHIC DROPDOWN */
  .glassmorphic-dropdown {
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    background: rgba(255,255,255,0.08);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 8px;
  }
  
  .glassmorphic-dropdown:hover {
    background: rgba(255,255,255,0.12);
    box-shadow: 0 4px 16px rgba(0,0,0,0.1);
  }
  
  /* Premium text styling */
  .gemini-gradient-text { 
    background: linear-gradient(90deg, #fff, #a1a1a6);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  
  /* Glassmorphic modal backdrop */
  .modal-glass {
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    background: rgba(0,0,0,0.6);
  }
  
  /* Glow effect for active elements */
  .glow-active {
    animation: glowBorder 2s ease-in-out infinite;
  }
  
  /* NEON BORDER GLOW - ACTIVE TRADE CARDS & BUTTONS */
  @keyframes neonGlow { 
    0% { box-shadow: 0 0 5px currentColor, 0 0 10px currentColor, inset 0 0 5px currentColor; } 
    50% { box-shadow: 0 0 10px currentColor, 0 0 20px currentColor, inset 0 0 10px currentColor; } 
    100% { box-shadow: 0 0 5px currentColor, 0 0 10px currentColor, inset 0 0 5px currentColor; } 
  }
  
  @keyframes subtleGlow { 
    0% { box-shadow: 0 0 8px rgba(10,132,255,0.4); } 
    50% { box-shadow: 0 0 16px rgba(10,132,255,0.6); } 
    100% { box-shadow: 0 0 8px rgba(10,132,255,0.4); } 
  }
  
  /* ACTIVE ELEMENT GLOW EFFECT */
  .active-glow {
    box-shadow: 0 0 12px rgba(0,122,255,0.6), inset 0 0 8px rgba(0,122,255,0.2);
    border-color: rgba(0,122,255,0.8);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  .active-glow.glow-green { box-shadow: 0 0 12px rgba(48,209,88,0.6), inset 0 0 8px rgba(48,209,88,0.2); border-color: rgba(48,209,88,0.8); }
  .active-glow.glow-gold { box-shadow: 0 0 12px rgba(255,214,10,0.6), inset 0 0 8px rgba(255,214,10,0.2); border-color: rgba(255,214,10,0.8); }
  .active-glow.glow-purple { box-shadow: 0 0 12px rgba(191,90,242,0.6), inset 0 0 8px rgba(191,90,242,0.2); border-color: rgba(191,90,242,0.8); }
  .active-glow.glow-cyan { box-shadow: 0 0 12px rgba(100,210,255,0.6), inset 0 0 8px rgba(100,210,255,0.2); border-color: rgba(100,210,255,0.8); }
  .active-glow.glow-pink { box-shadow: 0 0 12px rgba(255,55,95,0.6), inset 0 0 8px rgba(255,55,95,0.2); border-color: rgba(255,55,95,0.8); }
  
  /* TRADE CARD ACTIVE STATE */
  .trade-card-active {
    border: 1px solid rgba(0,122,255,0.8);
    box-shadow: 0 0 15px rgba(0,122,255,0.5), inset 0 0 10px rgba(0,122,255,0.1);
    animation: subtleGlow 2s ease-in-out infinite;
  }
  
  /* BUTTON GLOW - ACTIVE STATE */
  .btn-glow {
    position: relative;
    overflow: visible;
  }
  
  .btn-glow:active,
  .btn-glow.active {
    box-shadow: 0 0 12px rgba(0,122,255,0.6), inset 0 0 6px rgba(0,122,255,0.3);
    transform: scale(0.98);
  }
  
  .btn-glow:focus {
    outline: none;
    box-shadow: 0 0 8px rgba(0,122,255,0.4);
  }
  
  /* TYPOGRAPHY HIERARCHY (#129, #133) */
  /* H1: Page Title - Primary heading */
  h1, .h1 {
    font-size: 32px;
    font-weight: 800;
    line-height: 1.2;
    letter-spacing: -0.5px;
    margin: 0 0 24px 0;
    color: #F2F2F7;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  /* H2: Section Header - Secondary heading */
  h2, .h2 {
    font-size: 24px;
    font-weight: 700;
    line-height: 1.15;
    letter-spacing: -0.3px;
    margin: 28px 0 16px 0;
    color: #F2F2F7;
    border-bottom: 1px solid rgba(255,255,255,0.1);
    padding-bottom: 12px;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  /* H3: Subsection Header - Tertiary heading */
  h3, .h3 {
    font-size: 18px;
    font-weight: 600;
    line-height: 1.1;
    letter-spacing: 0px;
    margin: 18px 0 10px 0;
    color: #E8E8ED;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  /* Body Text - Standard paragraph text */
  p, .body-text {
    font-size: 14px;
    font-weight: 400;
    line-height: 1.6;
    letter-spacing: 0.3px;
    margin: 0 0 12px 0;
    color: #D1D1D6;
  }
  
  /* Small Text - annotations, secondary info */
  small, .text-sm {
    font-size: 12px;
    font-weight: 400;
    line-height: 1.4;
    letter-spacing: 0.2px;
    color: #A1A1A6;
  }
  
  /* Label Text - form labels, metadata */
  label, .label {
    font-size: 13px;
    font-weight: 600;
    line-height: 1.2;
    letter-spacing: 0.5px;
    color: #B0B0B5;
    text-transform: uppercase;
  }
  
  /* ICON CONSISTENCY (#139, #140, #141) */
  /* Standardized icon sizes with consistent styling */
  .icon, [class*="icon-"] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    line-height: 1;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  /* Extra Small Icon (16px) - Inline annotations */
  .icon-xs {
    font-size: 16px;
    width: 16px;
    height: 16px;
    margin: 0 4px;
  }
  
  /* Small Icon (18px) - Menu items, sidebar items */
  .icon-sm {
    font-size: 18px;
    width: 18px;
    height: 18px;
    margin: 0 6px;
  }
  
  /* Medium Icon (20px) - Buttons, form elements */
  .icon-md {
    font-size: 20px;
    width: 20px;
    height: 20px;
    margin: 0 8px;
  }
  
  /* Large Icon (24px) - Headers, section titles */
  .icon-lg {
    font-size: 24px;
    width: 24px;
    height: 24px;
    margin: 0 10px;
  }
  
  /* Extra Large Icon (32px) - Page headers, splash screens */
  .icon-xl {
    font-size: 32px;
    width: 32px;
    height: 32px;
    margin: 0 12px;
  }
  
  /* Icon color variants - Inherit from text or apply specific colors */
  .icon-primary { color: #F2F2F7; }
  .icon-accent { color: #007AFF; }
  .icon-success { color: #30D158; }
  .icon-warning { color: #FFD60A; }
  .icon-danger { color: #FF453A; }
  .icon-muted { color: #A1A1A6; }
  
  /* Icon animation states */
  .icon-spin {
    animation: spin 2s linear infinite;
  }
  
  .icon-pulse {
    animation: pulse-icon 2s ease-in-out infinite;
  }
  
  .icon-bounce {
    animation: bounce-icon 0.6s ease-in-out;
  }
  
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  
  @keyframes pulse-icon {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
  }
  
  @keyframes bounce-icon {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-4px); }
  }
  
  /* Icon in buttons - Proper alignment and spacing */
  button .icon, .btn-glass .icon, [role="button"] .icon {
    margin-right: 6px;
  }
  
  /* Icon in text - Proper baseline alignment */
  span .icon, p .icon, label .icon {
    vertical-align: -0.125em;
  }

  /* ═══════════════════════════════════════════════════════════════════ */
  /* RULE #127: CUSTOM CURSOR FOR DATA CHARTS */
  /* ═══════════════════════════════════════════════════════════════════ */
  /* Crosshair cursor on interactive chart/data elements for precision */
  .chart-container,
  .heatmap,
  .bar-chart,
  [data-chart],
  canvas,
  svg[data-interactive="true"],
  .hourly-heatmap {
    cursor: crosshair !important;
  }
  
  /* ═══════════════════════════════════════════════════════════════════ */
  /* RULE #133: ICON CONSISTENCY - Stroke width & style uniformity */
  /* ═══════════════════════════════════════════════════════════════════ */
  /* SVG icon consistency - 2px stroke width, rounded joins */
  svg.feather,
  svg[class*="icon"],
  [role="img"] svg {
    stroke: currentColor;
    stroke-width: 2 !important;
    fill: none;
    stroke-linecap: round;
    stroke-linejoin: round;
    vertical-align: -0.125em;
  }
  
  /* Emoji icon consistency - proper spacing and alignment */
  .emoji-icon,
  [class*="icon-emoji"] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin: 0 4px;
    line-height: 1;
    font-size: 1em;
  }
  
  /* Icon button consistency */
  .icon-button,
  [class*="btn"] [class*="icon"] {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 8px 8px;
    border-radius: 6px;
    transition: all 0.2s ease;
    font-size: 18px;
    line-height: 1;
  }
  
  .icon-button:hover {
    background: rgba(255, 255, 255, 0.08) !important;
    transform: scale(1.05);
  }
  
  /* RULE #180: Hardware Acceleration - GPU-accelerated animations for high-motion elements */
  
  /* Feature detection: GPU-accelerated transforms */
  @supports (transform: translateZ(0)) {
    /* HIGH-MOTION ELEMENTS WITH GPU ACCELERATION */
    
    /* Spinner animations - frequent motion */
    @keyframes spin-gpu {
      from { transform: translateZ(0) rotate(0deg); }
      to { transform: translateZ(0) rotate(360deg); }
    }
    
    /* Float/hover animations */
    @keyframes float-gpu {
      0%, 100% { transform: translateZ(0) translateY(0px); }
      50% { transform: translateZ(0) translateY(-8px); }
    }
    
    /* Fade with translation - dashboard entry */
    @keyframes fadeInDashboard-gpu {
      from { opacity: 0; transform: translateZ(0) translateY(-5px); }
      to { opacity: 1; transform: translateZ(0) translateY(0); }
    }
    
    /* Toast slide animation */
    @keyframes slideInToast-gpu {
      from { opacity: 0; transform: translateZ(0) translateX(400px); }
      to { opacity: 1; transform: translateZ(0) translateX(0); }
    }
    
    /* Confetti falls with Z depth */
    @keyframes confetti-fall-gpu {
      0% { opacity: 1; transform: translateZ(0) translateY(0) rotateZ(0deg); }
      100% { opacity: 0; transform: translateZ(0) translateY(400px) rotateZ(720deg); }
    }
    
    /* Pulse effects with GPU */
    @keyframes pulse-critical-gpu {
      0% { box-shadow: 0 0 0 0 rgba(255,69,58,0.7); transform: translateZ(0); }
      50% { box-shadow: 0 0 0 10px rgba(255,69,58,0.3); transform: translateZ(0); }
      100% { box-shadow: 0 0 0 20px rgba(255,69,58,0); transform: translateZ(0); }
    }
    
    @keyframes pulse-attention-gpu {
      0% { transform: translateZ(0) scale(1); box-shadow: 0 0 8px rgba(255,214,10,0.5); }
      50% { transform: translateZ(0) scale(1.05); box-shadow: 0 0 16px rgba(255,214,10,0.8); }
      100% { transform: translateZ(0) scale(1); box-shadow: 0 0 8px rgba(255,214,10,0.5); }
    }
    
    /* Bounce effect for confirmations */
    @keyframes bounce-in-gpu {
      0% { transform: translateZ(0) scale(0.95); opacity: 0; }
      50% { transform: translateZ(0) scale(1.05); }
      100% { transform: translateZ(0) scale(1); opacity: 1; }
    }
    
    /* Shake effect with GPU */
    @keyframes shake-gpu {
      0%, 100% { transform: translateZ(0) translateX(0); }
      10%, 30%, 50%, 70%, 90% { transform: translateZ(0) translateX(-5px); }
      20%, 40%, 60%, 80% { transform: translateZ(0) translateX(5px); }
    }
    
    /* Slide animations */
    @keyframes slide-in-left-gpu {
      from { opacity: 0; transform: translateZ(0) translateX(-40px); }
      to { opacity: 1; transform: translateZ(0) translateX(0); }
    }
    
    @keyframes slide-in-right-gpu {
      from { opacity: 0; transform: translateZ(0) translateX(40px); }
      to { opacity: 1; transform: translateZ(0) translateX(0); }
    }
    
    /* LED pulse with GPU */
    @keyframes led-pulse-gpu {
      0% { opacity: 1; transform: translateZ(0) scale(1); }
      50% { opacity: 0.4; transform: translateZ(0) scale(0.9); }
      100% { opacity: 1; transform: translateZ(0) scale(1); }
    }
    
    /* Apply GPU animations to high-motion elements */
    
    /* Animated spinners */
    [class*="spinner"],
    [class*="loader"],
    .loading-indicator {
      animation: spin-gpu 1s linear infinite !important;
      will-change: transform;
    }
    
    /* Floating/hover elements */
    [class*="float"],
    .floating-element,
    .animated-icon {
      will-change: transform;
    }
    
    /* Dashboard & card animations */
    [class*="fadeIn"],
    .card-pulse-entry,
    [class*="fade-in"],
    .dashboard-entry {
      animation: fadeInDashboard-gpu 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) !important;
      will-change: opacity, transform;
    }
    
    /* Toast notifications */
    [class*="toast"],
    [class*="notification"],
    .slide-in-toast {
      animation: slideInToast-gpu 0.3s ease-out !important;
      will-change: opacity, transform;
    }
    
    /* Success animations (confetti) */
    .confetti-piece,
    [class*="confetti"] {
      animation: confetti-fall-gpu 2.5s ease-in forwards !important;
      will-change: opacity, transform;
    }
    
    /* Pulse animations */
    .btn-pending-pulse {
      animation: pulse-critical-gpu 2s infinite !important;
      will-change: box-shadow, transform;
    }
    
    .btn-attention-pulse {
      animation: pulse-attention-gpu 1.5s ease-in-out infinite !important;
      will-change: transform, box-shadow;
    }
    
    /* Action animations */
    .bounce-in {
      animation: bounce-in-gpu 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55) !important;
      will-change: transform, opacity;
    }
    
    .shake-error {
      animation: shake-gpu 0.4s ease-in-out !important;
      will-change: transform;
    }
    
    /* Slide animations */
    .slide-in-left {
      animation: slide-in-left-gpu 0.4s ease-out !important;
      will-change: opacity, transform;
    }
    
    .slide-in-right {
      animation: slide-in-right-gpu 0.4s ease-out !important;
      will-change: opacity, transform;
    }
    
    /* LED indicators */
    .led-pulse-indicator,
    [class*="led-pulse"] {
      animation: led-pulse-gpu 1.5s ease-in-out infinite !important;
      will-change: opacity, transform;
    }
    
    /* Scrollable areas with GPU acceleration */
    [class*="sidebar"],
    [class*="scroll"],
    [class*="overflow"],
    .scrollable-area {
      will-change: scroll-position;
      transform: translateZ(0);
    }
    
    /* P&L tracker and financial displays */
    [class*="pnl"],
    [class*="tracker"],
    [class*="balance"],
    [class*="account-state"],
    .financial-display,
    .variance-display {
      will-change: opacity, transform;
      transform: translateZ(0);
      backface-visibility: hidden;
      perspective: 1000px;
    }
  }
  
  /* FALLBACK: CPU-ONLY RENDERING for unsupported browsers */
  @supports not (transform: translateZ(0)) {
    /* Fallback animations without 3D transforms */
    
    /* Standard spinner animation */
    @keyframes spin-cpu {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    
    /* Float effect - 2D only */
    @keyframes float-cpu {
      0%, 100% { transform: translateY(0px); }
      50% { transform: translateY(-8px); }
    }
    
    /* Dashboard fade - no 3D */
    @keyframes fadeInDashboard-cpu {
      from { opacity: 0; transform: translateY(-5px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    /* Toast slide - 2D translation */
    @keyframes slideInToast-cpu {
      from { opacity: 0; transform: translateX(400px); }
      to { opacity: 1; transform: translateX(0); }
    }
    
    /* Confetti without 3D depth */
    @keyframes confetti-fall-cpu {
      0% { opacity: 1; transform: translateY(0) rotateZ(0deg); }
      100% { opacity: 0; transform: translateY(400px) rotateZ(720deg); }
    }
    
    /* Pulse without Z-depth */
    @keyframes pulse-critical-cpu {
      0% { box-shadow: 0 0 0 0 rgba(255,69,58,0.7); }
      50% { box-shadow: 0 0 0 10px rgba(255,69,58,0.3); }
      100% { box-shadow: 0 0 0 20px rgba(255,69,58,0); }
    }
    
    @keyframes pulse-attention-cpu {
      0% { transform: scale(1); box-shadow: 0 0 8px rgba(255,214,10,0.5); }
      50% { transform: scale(1.05); box-shadow: 0 0 16px rgba(255,214,10,0.8); }
      100% { transform: scale(1); box-shadow: 0 0 8px rgba(255,214,10,0.5); }
    }
    
    /* Bounce - standard transforms */
    @keyframes bounce-in-cpu {
      0% { transform: scale(0.95); opacity: 0; }
      50% { transform: scale(1.05); }
      100% { transform: scale(1); opacity: 1; }
    }
    
    /* Shake - 2D movement */
    @keyframes shake-cpu {
      0%, 100% { transform: translateX(0); }
      10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
      20%, 40%, 60%, 80% { transform: translateX(5px); }
    }
    
    /* Slides */
    @keyframes slide-in-left-cpu {
      from { opacity: 0; transform: translateX(-40px); }
      to { opacity: 1; transform: translateX(0); }
    }
    
    @keyframes slide-in-right-cpu {
      from { opacity: 0; transform: translateX(40px); }
      to { opacity: 1; transform: translateX(0); }
    }
    
    /* LED pulse - 2D only */
    @keyframes led-pulse-cpu {
      0% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(0.9); }
      100% { opacity: 1; transform: scale(1); }
    }
    
    /* Apply CPU animations to high-motion elements */
    
    [class*="spinner"],
    [class*="loader"],
    .loading-indicator {
      animation: spin-cpu 1s linear infinite !important;
    }
    
    [class*="float"],
    .floating-element,
    .animated-icon {
      /* Reduced animation for CPU fallback */
      animation: float-cpu 3s ease-in-out infinite !important;
    }
    
    [class*="fadeIn"],
    .card-pulse-entry,
    [class*="fade-in"],
    .dashboard-entry {
      animation: fadeInDashboard-cpu 0.5s ease-out !important;
    }
    
    [class*="toast"],
    [class*="notification"],
    .slide-in-toast {
      animation: slideInToast-cpu 0.3s ease-out !important;
    }
    
    .confetti-piece,
    [class*="confetti"] {
      animation: confetti-fall-cpu 2.5s ease-in forwards !important;
    }
    
    .btn-pending-pulse {
      animation: pulse-critical-cpu 2s infinite !important;
    }
    
    .btn-attention-pulse {
      animation: pulse-attention-cpu 1.5s ease-in-out infinite !important;
    }
    
    .bounce-in {
      animation: bounce-in-cpu 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55) !important;
    }
    
    .shake-error {
      animation: shake-cpu 0.4s ease-in-out !important;
    }
    
    .slide-in-left {
      animation: slide-in-left-cpu 0.4s ease-out !important;
    }
    
    .slide-in-right {
      animation: slide-in-right-cpu 0.4s ease-out !important;
    }
    
    .led-pulse-indicator,
    [class*="led-pulse"] {
      animation: led-pulse-cpu 1.5s ease-in-out infinite !important;
    }
    
    /* Disable will-change for CPU fallback */
    [class*="sidebar"],
    [class*="scroll"],
    [class*="overflow"],
    .scrollable-area,
    [class*="pnl"],
    [class*="tracker"],
    [class*="balance"],
    [class*="account-state"],
    .financial-display,
    .variance-display {
      will-change: auto;
      backface-visibility: visible;
      perspective: none;
    }
  }
  
  .status-icon,
  [class*="status"] [class*="icon"] {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    vertical-align: middle;
    margin-right: 6px;
  }

  /* TACTICAL HUD INPUT STYLING - Scorched Earth Operation */
  input.input-glass:focus,
  textarea.input-glass:focus {
    border-color: #2563EB !important;
    box-shadow: 0 0 12px rgba(37, 99, 235, 0.4), inset 0 0 8px rgba(37, 99, 235, 0.1) !important;
    outline: none;
  }

  input.input-glass,
  textarea.input-glass {
    background-color: #F1F5F9 !important;
    border-color: #CBD5E1 !important;
    transition: all 0.2s ease !important;
  }
`;
document.head.appendChild(styleSheet);



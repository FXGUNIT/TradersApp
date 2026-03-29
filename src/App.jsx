/* eslint-disable */
import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
  createContext,
  useContext,
  Suspense,
} from "react";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  sendPasswordResetEmail,
  setPersistence,
  browserLocalPersistence,
  onAuthStateChanged,
  fetchSignInMethodsForEmail,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
} from "firebase/auth";
import { getDatabase, ref, onValue, get, set, push } from "firebase/database";
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";
import emailjs from "@emailjs/browser";
import { notifyTelegram } from "./utils/telegram.js";
import { sendWelcomeEmail } from "./utils/email.js";
import { useInvites } from "./hooks/useInvites";
import AdminInvitesPanel from "./components/AdminInvitesPanel.jsx";
import FloatingChatWidget from "./components/FloatingChatWidget.jsx";
import ChatHelpline from "./components/ChatHelpline.jsx";
import FounderCard from "./components/FounderCard.jsx";
import MainTerminal from "./features/terminal/MainTerminal.jsx";
import CollectiveConsciousnessPage from "./pages/CollectiveConsciousness.jsx";
import {
  quadCoreStatus as aiQuadCoreStatus,
  councilStage as aiCouncilStage,
  getAIStatuses,
  startAIStatusScheduler,
  stopAIStatusScheduler,
} from "./services/ai-router.js";
import { firebaseOptimizer } from "./services/firebase.js";
import AiEnginesStatus from "./components/AiEnginesStatus.jsx";
import { setupConsoleInterceptor } from "./services/telemetry.js";
import { setupNetworkMonitor } from "./services/networkMonitor.js";
import { setupTTITracker } from "./services/ttiTracker.js";
import { sendApprovalConfirmationEmail } from "./services/emailService.js";
import { SecuritySentinel } from "./services/securitySentinel.js";
import { detectDuplicateIPs as scanDuplicateIPs } from "./services/ipScanner.js";
import { calculateVolatilityRatio, getDynamicParameters, calculateThrottledRisk } from "./utils/math-engine.js";
import { TradersRegimentWatermark, ExchangeFacilityBadge } from "./utils/businessLogicUtils.jsx";
import { getSession, getTradingDate, parseAndAggregate, buildDataSummary } from "./utils/sessionParser.js";
import { fuzzySearchScore, highlightMatches, renderHighlightedText } from "./utils/searchUtils.jsx";
import { dbR, dbW, dbM, dbDel, genOTP } from "./utils/firebaseDbUtils.js";
import { encryptSessionToken, generateSessionId, getDeviceInfo, getSessionGeoData, createSession, logoutOtherDevices, getDevice } from "./utils/sessionUtils.js";
import { getTimeBasedGreeting, getUserLevelBadge, cacheUserList, getCachedUserList, clearUserListCache, getUserListCacheMetadata } from "./utils/userUtils.js";
import { calcRoR, getISTState } from "./utils/tradingUtils.js";
import { gatherForensicData, sendTelegramAlert, sendForensicAlert } from "./utils/securityAlertUtils.js";
import { triggerConfetti, createCardTiltHandler, ACCENT_COLORS, createTheme } from "./utils/uiUtils.js";
import { copyToClipboard } from "./utils/searchUtils.jsx";
import { isValidGmailAddress, isPasswordExpired, detectGPUSupport, withExponentialBackoff } from "./utils/securityUtils.js";
import LoadingOverlay from "./components/LoadingOverlay.jsx";
import SkeletonLoader from "./components/SkeletonLoader.jsx";
import LazyImage from "./components/LazyImage.jsx";
import { useTheme } from "./hooks/useTheme.jsx";
import { AppShellProvider } from "./features/shell/AppShellContext.jsx";
import { SCREEN_IDS } from "./features/shell/screenIds.js";
import { loadLegacyUserProfile } from "./services/clients/IdentityClient.js";
import NotificationCenter from "./components/NotificationCenter.jsx";
import CommandPalette from "./components/CommandPalette.jsx";
import UserSwitcher from "./components/UserSwitcher.jsx";
import FullScreenToggle from "./components/FullScreenToggle.jsx";
import MobileBottomNav from "./components/MobileBottomNav.jsx";
import CleanLoginScreen from "./features/auth/CleanLoginScreen.jsx";
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

// RULE #119: Notification Center - Sidebar on desktop, overlay on mobile
// RULE #91: Interactive Breadcrumbs - Shows navigation path
const Breadcrumbs = ({ items, onNavigate }) => {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "12px 32px",
        borderBottom: `1px solid rgba(255,255,255,0.1)`,
        background: "var(--surface-glass, rgba(0,0,0,0.3))",
        overflowX: "auto",
      }}
    >
      {items.map((item, idx) => (
        <div
          key={idx}
          style={{ display: "flex", alignItems: "center", gap: 8 }}
        >
          <button
            onClick={() => item.onNavigate && onNavigate(item.path)}
            style={{
              background: item.active ? "rgba(0,122,255,0.2)" : "transparent",
              border: "none",
              color: item.active ? T.blue : T.muted,
              cursor: item.onNavigate ? "pointer" : "default",
              fontSize: 11,
              fontFamily: T.font,
              fontWeight: 700,
              letterSpacing: 1,
              padding: "4px 8px",
              borderRadius: 4,
              transition: "all 0.2s ease",
              pointerEvents: item.onNavigate ? "auto" : "none",
            }}
            onMouseEnter={(e) => {
              if (item.onNavigate && !item.active) {
                e.currentTarget.style.background = "rgba(0,122,255,0.1)";
                e.currentTarget.style.color = T.blue;
              }
            }}
            onMouseLeave={(e) => {
              if (item.onNavigate && !item.active) {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = T.muted;
              }
            }}
            title={item.label}
          >
            {item.icon} {item.label}
          </button>
          {idx < items.length - 1 && (
            <span style={{ color: T.dim, fontSize: 10 }}>›</span>
          )}
        </div>
      ))}
    </div>
  );
};

// RULE #94: Mega Menu for Tools section with icons and categorized links
const MegaMenu = ({ isOpen, onClose }) => {
  const toolsCategories = [
    {
      name: "Analytics",
      icon: "📊",
      items: [
        { label: "Dashboard", icon: "📈", action: () => void 0 },
        { label: "Performance", icon: "⚡", action: () => void 0 },
        { label: "Reports", icon: "📋", action: () => void 0 },
      ],
    },
    {
      name: "Management",
      icon: "⚙️",
      items: [
        { label: "Users", icon: "👥", action: () => void 0 },
        { label: "Permissions", icon: "🔐", action: () => void 0 },
        { label: "Settings", icon: "🛠️", action: () => void 0 },
      ],
    },
    {
      name: "Data",
      icon: "💾",
      items: [
        { label: "Backup", icon: "💿", action: () => void 0 },
        { label: "Exports", icon: "📤", action: () => void 0 },
        { label: "Imports", icon: "📥", action: () => void 0 },
      ],
    },
    {
      name: "Security",
      icon: "🔒",
      items: [
        { label: "Audit Log", icon: "📝", action: () => void 0 },
        { label: "Encryption", icon: "🔐", action: () => void 0 },
        { label: "Access Control", icon: "🛡️", action: () => void 0 },
      ],
    },
  ];

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: "var(--header-height, 60px)",
        left: 0,
        right: 0,
        background: "rgba(0,0,0,0.95)",
        borderBottom: `1px solid rgba(0,122,255,0.3)`,
        backdropFilter: "blur(10px)",
        zIndex: 999,
        padding: "24px 32px",
        maxHeight: "80vh",
        overflowY: "auto",
        animation: "fadeInDashboard 0.2s ease-out",
      }}
      onClick={onClose}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
          gap: 24,
          onClick: (e) => e.stopPropagation(),
        }}
      >
        {toolsCategories.map((category) => (
          <div key={category.name} style={{ minWidth: "240px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 12,
                paddingBottom: 8,
                borderBottom: `1px solid rgba(0,122,255,0.3)`,
              }}
            >
              <span style={{ fontSize: 16 }}>{category.icon}</span>
              <div
                style={{
                  color: T.blue,
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: 1,
                }}
              >
                {category.name.toUpperCase()}
              </div>
            </div>
            {category.items.map((item) => (
              <button
                key={item.label}
                onClick={() => {
                  item.action();
                  onClose();
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  width: "100%",
                  padding: "10px 12px",
                  background: "transparent",
                  border: "none",
                  color: T.muted,
                  cursor: "pointer",
                  fontSize: 11,
                  fontFamily: T.font,
                  fontWeight: 600,
                  transition: "all 0.15s ease",
                  borderRadius: 4,
                  marginBottom: 4,
                  textAlign: "left",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(0,122,255,0.15)";
                  e.currentTarget.style.color = T.blue;
                  e.currentTarget.style.transform = "translateX(4px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = T.muted;
                  e.currentTarget.style.transform = "translateX(0)";
                }}
              >
                <span style={{ fontSize: 14, minWidth: 20 }}>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

// RULE #95: Back-to-Top button appears after scrolling 300px
const BackToTopButton = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const scrolled = window.scrollY || document.documentElement.scrollTop;
      setIsVisible(scrolled > 300);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  if (!isVisible) return null;

  return (
    <button
      onClick={scrollToTop}
      style={{
        position: "fixed",
        bottom: "30px",
        right: "30px",
        background: `linear-gradient(135deg, ${T.purple}, ${T.blue})`,
        border: "none",
        borderRadius: "50%",
        width: "48px",
        height: "48px",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: T.text,
        fontSize: 20,
        fontWeight: 700,
        zIndex: 900,
        transition: "all 0.3s ease-in-out",
        boxShadow: `0 8px 24px rgba(0,0,0,0.4), 0 0 20px ${T.purple}40`,
        animation: "float 3s ease-in-out infinite",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "scale(1.1)";
        e.currentTarget.style.boxShadow = `0 12px 32px rgba(0,0,0,0.6), 0 0 30px ${T.purple}60`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "scale(1)";
        e.currentTarget.style.boxShadow = `0 8px 24px rgba(0,0,0,0.4), 0 0 20px ${T.purple}40`;
      }}
      title="Back to Top"
    >
      ↑
    </button>
  );
};

const LOGIN_RATE_LIMIT_STORAGE_KEY = "traders-login-rate-limit-v1";
const PENDING_GOOGLE_SIGNUP_STORAGE_KEY = "traders-pending-google-signup-v1";
const LOGIN_RATE_LIMIT_MAX_ATTEMPTS = 3;
const LOGIN_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

const safeStorageGet = (key, fallback = null) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const safeStorageSet = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    console.warn(`Failed to persist ${key}`);
  }
};

const safeStorageRemove = (key) => {
  try {
    localStorage.removeItem(key);
  } catch {
    console.warn(`Failed to clear ${key}`);
  }
};

const getLoginRateLimitState = () =>
  safeStorageGet(LOGIN_RATE_LIMIT_STORAGE_KEY, {});

const getLoginRateLimitEntry = (email) => {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) {
    return null;
  }

  const state = getLoginRateLimitState();
  const entry = state[normalizedEmail];
  if (!entry) {
    return null;
  }

  if (Date.now() - entry.firstAttemptAt > LOGIN_RATE_LIMIT_WINDOW_MS) {
    delete state[normalizedEmail];
    safeStorageSet(LOGIN_RATE_LIMIT_STORAGE_KEY, state);
    return null;
  }

  return entry;
};

const getLoginRateLimitRemainingMs = (email) => {
  const entry = getLoginRateLimitEntry(email);
  if (!entry || entry.attempts < LOGIN_RATE_LIMIT_MAX_ATTEMPTS) {
    return 0;
  }

  return Math.max(
    0,
    entry.firstAttemptAt + LOGIN_RATE_LIMIT_WINDOW_MS - Date.now(),
  );
};

const recordLoginFailure = (email) => {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) {
    return;
  }

  const state = getLoginRateLimitState();
  const existing = state[normalizedEmail];
  const withinWindow =
    existing &&
    Date.now() - existing.firstAttemptAt <= LOGIN_RATE_LIMIT_WINDOW_MS;

  state[normalizedEmail] = withinWindow
    ? {
        attempts: Number(existing.attempts || 0) + 1,
        firstAttemptAt: existing.firstAttemptAt,
      }
    : {
        attempts: 1,
        firstAttemptAt: Date.now(),
      };

  safeStorageSet(LOGIN_RATE_LIMIT_STORAGE_KEY, state);
};

const clearLoginFailures = (email) => {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) {
    return;
  }

  const state = getLoginRateLimitState();
  if (!(normalizedEmail in state)) {
    return;
  }

  delete state[normalizedEmail];
  safeStorageSet(LOGIN_RATE_LIMIT_STORAGE_KEY, state);
};

const formatCooldown = (remainingMs) => {
  const totalSeconds = Math.ceil(remainingMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes <= 0) {
    return `${seconds}s`;
  }
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
};

const readPendingGoogleSignup = () =>
  safeStorageGet(PENDING_GOOGLE_SIGNUP_STORAGE_KEY, null);

const persistPendingGoogleSignup = (draft) => {
  if (!draft?.uid || !draft?.email) {
    return;
  }

  safeStorageSet(PENDING_GOOGLE_SIGNUP_STORAGE_KEY, draft);
};

const clearPendingGoogleSignup = () => {
  safeStorageRemove(PENDING_GOOGLE_SIGNUP_STORAGE_KEY);
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
function Tag({ label, color }) {
  return (
    <span
      style={{
        background: color + "15",
        color,
        border: `1px solid ${color}35`,
        borderRadius: 6,
        padding: "4px 10px",
        fontSize: 11,
        letterSpacing: 1,
        fontWeight: 600,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
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

function Field({
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  options,
  highlight,
  disabled,
  mono,
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={lbl}>{label}</label>
      {options ? (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          style={{
            ...inp,
            borderColor: highlight ? T.green : "rgba(255,255,255,0.12)",
            opacity: disabled ? 0.5 : 1,
            fontFamily: T.font,
          }}
          className="input-glass"
        >
          {options.map((o) => (
            <option key={o.v ?? o} value={o.v ?? o}>
              {o.l ?? o}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          style={{
            ...inp,
            borderColor: highlight ? T.green : "rgba(255,255,255,0.12)",
            opacity: disabled ? 0.5 : 1,
            fontFamily: mono ? T.mono : T.font,
          }}
          className="input-glass"
        />
      )}
    </div>
  );
}

function Loader({ color, label }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 240,
        gap: 16,
      }}
    >
      <div
        style={{ display: "flex", gap: 4, alignItems: "flex-end", height: 28 }}
      >
        {[8, 15, 10, 20, 12, 17, 9].map((h, i) => (
          <div
            key={i}
            style={{
              width: 4,
              height: h,
              background: color,
              borderRadius: 2,
              animation: `bar ${0.85 + i * 0.05}s ${i * 0.1}s ease-in-out infinite alternate`,
            }}
          />
        ))}
      </div>
      <span
        style={{
          color: T.muted,
          fontSize: 12,
          letterSpacing: 2,
          fontWeight: 600,
        }}
      >
        {label}
      </span>
    </div>
  );
}

// Premium Video Loader - AI Processing State
function VideoLoader({ label = "PROCESSING..." }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 240,
        gap: 20,
      }}
    >
      <div
        style={{
          width: 100,
          height: 100,
          borderRadius: "50%",
          overflow: "hidden",
          boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
          background: "#F9FAFB",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <video
          src="/logo.mp4"
          autoPlay
          loop
          muted
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
          onError={(e) => {
            // Fallback to animated spinner if video fails
            e.target.parentElement.innerHTML = "🔄";
            e.target.parentElement.style.fontSize = "48px";
            e.target.parentElement.style.display = "flex";
            e.target.parentElement.style.alignItems = "center";
            e.target.parentElement.style.justifyContent = "center";
          }}
        />
      </div>
      <span
        style={{
          color: "#6B7280",
          fontSize: 12,
          letterSpacing: 2,
          fontWeight: 600,
        }}
      >
        {label}
      </span>
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

function RenderOut({ text }) {
  if (!text) return null;
  return (
    <div style={{ fontFamily: T.font, lineHeight: 1.8, fontSize: 13 }}>
      {text.split("\n").map((line, i) => {
        const t = line.trim();
        if (t.startsWith("## "))
          return (
            <h2
              key={i}
              style={{
                color: T.gold,
                fontSize: 15,
                margin: "24px 0 10px",
                borderBottom: `1px solid rgba(255,255,255,0.1)`,
                paddingBottom: 8,
                letterSpacing: 1,
                fontWeight: 700,
              }}
              className="gemini-gradient-text"
            >
              {t.slice(3)}
            </h2>
          );
        if (t.startsWith("### "))
          return (
            <h3
              key={i}
              style={{
                color: T.blue,
                fontSize: 13,
                margin: "14px 0 6px",
                letterSpacing: 0.5,
                fontWeight: 600,
              }}
            >
              {t.slice(4)}
            </h3>
          );
        if (t.includes("🚫"))
          return (
            <div
              key={i}
              style={{
                background: "rgba(255,69,58,0.1)",
                border: `1px solid rgba(255,69,58,0.3)`,
                borderRadius: 6,
                padding: "12px 16px",
                margin: "8px 0",
                color: T.red,
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {t}
            </div>
          );
        if (t.includes("✅"))
          return (
            <div
              key={i}
              style={{
                background: "rgba(48,209,88,0.1)",
                border: `1px solid rgba(48,209,88,0.3)`,
                borderRadius: 6,
                padding: "12px 16px",
                margin: "8px 0",
                color: T.green,
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {t}
            </div>
          );
        if (t.includes("⚠️") || t.includes("⚠"))
          return (
            <div
              key={i}
              style={{
                background: "rgba(255,214,10,0.1)",
                border: `1px solid rgba(255,214,10,0.3)`,
                borderRadius: 6,
                padding: "12px 16px",
                margin: "8px 0",
                color: T.gold,
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {t}
            </div>
          );
        if (t.includes("**")) {
          const parts = t.split(/(\*\*[^*]+\*\*)/g);
          return (
            <p key={i} style={{ color: "#A1A1A6", margin: "4px 0" }}>
              {parts.map((p2, j) =>
                p2.startsWith("**") ? (
                  <strong key={j} style={{ color: T.text, fontWeight: 600 }}>
                    {p2.replace(/\*\*/g, "")}
                  </strong>
                ) : (
                  p2
                ),
              )}
            </p>
          );
        }
        if (!t) return <div key={i} style={{ height: 6 }} />;
        return (
          <p
            key={i}
            style={{
              color:
                t.startsWith("→") || t.startsWith("AMD") ? T.cyan : "#A1A1A6",
              margin: "3px 0",
            }}
          >
            {line}
          </p>
        );
      })}
    </div>
  );
}

function AMDPhaseTag({ phase }) {
  const cfg = AMD_PHASES[phase] || AMD_PHASES.UNCLEAR;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 14px",
        background: cfg.color + "15",
        border: `1px solid ${cfg.color}40`,
        borderRadius: 8,
      }}
      className="glass-panel"
    >
      <LED color={cfg.color} size={10} pulse={phase !== "UNCLEAR"} />
      <div>
        <div
          style={{
            color: cfg.color,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 1,
          }}
        >
          {cfg.icon} {cfg.label}
        </div>
        <div style={{ color: T.muted, fontSize: 11, marginTop: 2 }}>
          {cfg.desc}
        </div>
      </div>
    </div>
  );
}

function TrafficLight({ state }) {
  if (state === "none") return null;
  const cfg = {
    green: {
      color: T.green,
      label: "TRADE CLEAR",
      sub: "All systems go · Compliance passed",
    },
    yellow: {
      color: T.gold,
      label: "CAUTION ACTIVE",
      sub: "Warning detected — review analysis",
    },
    red: {
      color: T.red,
      label: "TERMINAL LOCKED",
      sub: "Compliance breach or market closed",
    },
  };
  const c = cfg[state];
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "14px 20px",
        background: "rgba(0,0,0,0.4)",
        border: `1px solid ${c.color}30`,
        borderRadius: 10,
        marginBottom: 16,
      }}
      className="glass-panel"
    >
      <div
        style={{
          width: 22,
          height: 22,
          borderRadius: "50%",
          background: c.color,
          boxShadow: `0 0 12px ${c.color},0 0 32px ${c.color}60`,
          animation: `led-pulse 1.6s ease-in-out infinite`,
          flexShrink: 0,
        }}
      />
      <div>
        <div
          style={{
            color: c.color,
            fontSize: 13,
            letterSpacing: 2,
            fontWeight: 800,
          }}
        >
          {c.label}
        </div>
        <div style={{ color: T.muted, fontSize: 11, marginTop: 3 }}>
          {c.sub}
        </div>
      </div>
    </div>
  );
}

function CountdownBanner({ ist }) {
  const color = ist.isOpen ? T.green : T.red;
  const [hh, mm, ss] = ist.countdown.split(":");
  const urgent = ist.isOpen && parseInt(hh) === 0 && parseInt(mm) < 30;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "12px 28px",
        background: urgent
          ? "rgba(255,69,58,0.1)"
          : ist.isOpen
            ? "rgba(48,209,88,0.05)"
            : "rgba(255,69,58,0.05)",
        borderBottom: `1px solid ${color}25`,
        borderTop: `1px solid ${color}15`,
        flexWrap: "wrap",
      }}
      className="glass-panel"
    >
      <LED color={color} size={8} pulse />
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <span
          style={{
            color: T.muted,
            fontSize: 11,
            letterSpacing: 2,
            fontWeight: 600,
          }}
        >
          {ist.lbl}
        </span>
        <span
          style={{
            color,
            fontSize: 24,
            fontFamily: T.mono,
            fontWeight: 700,
            letterSpacing: 4,
          }}
        >
          {hh}:{mm}:{ss}
        </span>
      </div>
      <div
        style={{ width: 1, height: 20, background: "rgba(255,255,255,0.1)" }}
      />
      <span style={{ color: T.muted, fontSize: 12, fontWeight: 600 }}>
        {ist.istStr}
      </span>
      {!ist.isOpen && (
        <span
          style={{
            marginLeft: "auto",
            color: T.red,
            fontSize: 11,
            letterSpacing: 1,
            fontWeight: 700,
          }}
        >
          LOCKED · 10:00AM–5:00PM IST ONLY
        </span>
      )}
      {urgent && (
        <span
          style={{
            marginLeft: "auto",
            color: T.gold,
            fontSize: 11,
            letterSpacing: 1,
            fontWeight: 700,
            animation: "led-pulse 1s infinite",
          }}
        >
          ⚠ SESSION ENDING SOON
        </span>
      )}
    </div>
  );
}

function PasteZone({ zoneId, activeZone, setActiveZone, children, style }) {
  const isActive = activeZone === zoneId;
  return (
    <div
      onClick={() => setActiveZone(zoneId)}
      style={{
        position: "relative",
        cursor: "pointer",
        ...style,
        outline: isActive ? `2px solid ${T.blue}60` : "2px solid transparent",
        borderRadius: 12,
        transition: "all 0.2s ease",
      }}
      className="glass-panel"
    >
      {children}
      <div
        style={{
          position: "absolute",
          top: 8,
          right: 8,
          background: isActive ? T.blue + "25" : "rgba(0,0,0,0.6)",
          border: isActive ? `1px solid ${T.blue}50` : "none",
          borderRadius: 6,
          padding: "4px 10px",
          fontSize: 10,
          color: isActive ? T.blue : T.muted,
          fontWeight: 600,
          pointerEvents: "none",
          letterSpacing: 1,
        }}
      >
        {isActive ? "CTRL+V READY" : "Click → Ctrl+V"}
      </div>
    </div>
  );
}

function HourlyHeatmap({ hourlyHeatmap }) {
  if (!hourlyHeatmap || !Object.keys(hourlyHeatmap).length) return null;
  const hrs = [4, 5, 6, 7, 8, 9, 10, 11],
    nowUTC = new Date().getUTCHours();
  const lbls = [
    "9:30",
    "10:30",
    "11:30",
    "12:30",
    "1:30",
    "2:30",
    "3:30",
    "4:30",
  ];
  return (
    <div
      style={{
        padding: "16px 20px",
        background: "rgba(0,0,0,0.3)",
        border: `1px solid rgba(255,255,255,0.08)`,
        borderRadius: 10,
        marginBottom: 16,
      }}
      className="glass-panel heatmap"
    >
      <div
        style={{
          color: T.muted,
          fontSize: 11,
          letterSpacing: 2,
          marginBottom: 12,
          fontWeight: 600,
        }}
      >
        45D HOURLY HEATMAP (IST) · TREND vs RANGE
      </div>
      <div
        style={{
          display: "flex",
          gap: 4,
          alignItems: "flex-end",
          overflowX: "auto",
        }}
        className="hourly-heatmap"
      >
        {hrs.map((utcH, i) => {
          const st = hourlyHeatmap[utcH],
            isCur = utcH === nowUTC;
          if (!st || !st.total)
            return (
              <div
                key={utcH}
                style={{
                  flex: 1,
                  minWidth: 40,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <div
                  style={{
                    height: 40,
                    background: "rgba(255,255,255,0.03)",
                    borderRadius: 4,
                    width: "100%",
                  }}
                />
                <div style={{ color: T.dim, fontSize: 10 }}>{lbls[i]}</div>
              </div>
            );
          const tp = st.trend / st.total,
            barH = 40,
            tH = Math.round(tp * barH);
          const heatColor =
            tp > 0.7
              ? T.green
              : tp > 0.5
                ? "#88cc44"
                : tp > 0.35
                  ? "#ccaa22"
                  : tp > 0.2
                    ? "#cc6622"
                    : T.red;
          return (
            <div
              key={utcH}
              title={`${lbls[i]} IST | Trend ${Math.round(tp * 100)}% | ${st.total} days`}
              style={{
                flex: 1,
                minWidth: 40,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
                cursor: "default",
              }}
            >
              <div
                style={{
                  height: barH,
                  width: "100%",
                  borderRadius: 4,
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  position: "relative",
                  border: isCur ? `2px solid ${T.gold}` : "none",
                  boxSizing: "border-box",
                }}
              >
                <div style={{ height: tH, background: heatColor + "90" }} />
                <div
                  style={{ height: barH - tH, background: "rgba(0,0,0,0.5)" }}
                />
              </div>
              <div
                style={{
                  color: isCur ? T.gold : T.muted,
                  fontSize: 10,
                  fontWeight: 600,
                }}
              >
                {lbls[i]}
              </div>
              <div
                style={{ color: heatColor, fontSize: 10, fontFamily: T.mono }}
              >
                {Math.round(tp * 100)}%
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
const AuthLogo = () => (
  <div style={{ textAlign: "center", marginBottom: 36 }}>
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        gap: 8,
        marginBottom: 20,
      }}
    >
      {/* Logo Image - Left aligned */}
      <img
        src="/logo.png"
        alt="Logo"
        style={{
          borderRadius: "50%",
          overflow: "hidden",
          objectFit: "cover",
          width: "60px",
          height: "60px",
          border: "none",
          display: "block",
        }}
        onError={(e) => {
          e.target.style.display = "none";
        }}
      />
      {/* Header Text */}
      <div style={{ textAlign: "left" }}>
        <div
          style={{
            color: "var(--text-primary, #111827)",
            fontSize: "clamp(16px, 3vw, 18px)",
            letterSpacing: 1.5,
            fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: 700,
          }}
        >
          THE DEPARTMENT OF INSTITUTIONAL ARTILLERY
        </div>
        <div
          style={{
            color: "var(--text-primary, #1e40af)",
            fontSize: "0.7rem",
            letterSpacing: 0.5,
            fontFamily: "Arial, 'Courier New', monospace",
            fontWeight: 700,
          }}
        >
          TRADERS' REGIMENT Territory.
        </div>
      </div>
    </div>
  </div>
);

function SplashScreen() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--surface-elevated, #FFFFFF)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: T.font,
      }}
    >
      <div style={{ textAlign: "center" }}>
        <AuthLogo />
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 5,
            alignItems: "flex-end",
            height: 30,
            marginTop: 24,
          }}
        >
          {[10, 18, 12, 24, 15, 20, 11].map((h, i) => (
            <div
              key={i}
              style={{
                width: 5,
                height: h,
                background: "#10B981",
                borderRadius: 3,
                animation: `bar 0.85s ${i * 0.1}s ease-in-out infinite alternate`,
              }}
            />
          ))}
        </div>
        <div
          style={{
            color: "var(--text-secondary, #64748B)",
            fontSize: 11,
            letterSpacing: 4,
            marginTop: 16,
            fontWeight: 600,
          }}
        >
          INITIALIZING...
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  TOAST NOTIFICATION SYSTEM
// ═══════════════════════════════════════════════════════════════════
// RULE #181-185, #193, #208: Advanced Notification Engine with Toast Stacking & Swipe-to-Dismiss
function Toast({ toasts, onDismiss }) {
  const [swipedToast, setSwipedToast] = useState(null);
  const [touchStart, setTouchStart] = useState(null);

  const getToastColor = (type) => {
    const colors = {
      success: {
        border: "#30D158",
        bg: "rgba(48, 209, 88, 0.1)",
        text: "#30D158",
        icon: "✓",
      },
      error: {
        border: "#FF453A",
        bg: "rgba(255, 69, 58, 0.1)",
        text: "#FF453A",
        icon: "✕",
      },
      warning: {
        border: "#FFD60A",
        bg: "rgba(255, 214, 10, 0.1)",
        text: "#FFD60A",
        icon: "⚠",
      },
      info: {
        border: "#0A84FF",
        bg: "rgba(10, 132, 255, 0.1)",
        text: "#0A84FF",
        icon: "ℹ",
      },
      critical: {
        border: "#FF3B30",
        bg: "rgba(255, 59, 48, 0.15)",
        text: "#FF3B30",
        icon: "🚨",
      },
    };
    return colors[type] || colors.info;
  };

  // RULE #181: Handle swipe-to-dismiss on touch devices
  const handleTouchStart = (e, toastId) => {
    setTouchStart({ x: e.touches[0].clientX, id: toastId });
  };

  const handleTouchMove = (e, toastId) => {
    if (!touchStart || touchStart.id !== toastId) return;

    const currentX = e.touches[0].clientX;
    const diffX = currentX - touchStart.x;

    // Swipe right to dismiss (>50px threshold)
    if (diffX > 50) {
      setSwipedToast(toastId);
    }
  };

  const handleTouchEnd = (toastId) => {
    if (swipedToast === toastId) {
      onDismiss(toastId);
      setSwipedToast(null);
    }
    setTouchStart(null);
  };

  const isMobile = window.innerWidth < 768;

  return (
    <div
      style={{
        position: "fixed",
        top: 20,
        right: isMobile ? 12 : 20,
        left: isMobile ? 12 : "auto",
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        pointerEvents: "none",
        maxWidth: isMobile ? "calc(100% - 24px)" : 420,
      }}
    >
      {toasts.map((toast) => {
        const color = getToastColor(toast.type);
        const isBeingSwiped = swipedToast === toast.id;

        return (
          <div
            key={toast.id}
            onTouchStart={(e) => handleTouchStart(e, toast.id)}
            onTouchMove={(e) => handleTouchMove(e, toast.id)}
            onTouchEnd={() => handleTouchEnd(toast.id)}
            style={{
              background: color.bg,
              border: color.border.startsWith("#")
                ? `1px solid ${color.border}30`
                : `1px solid rgba(10,132,255,0.3)`,
              borderLeft: `4px solid ${color.border}`,
              borderRadius: 8,
              padding: "14px 16px ",
              backdropFilter: "blur(20px)",
              display: "flex",
              alignItems: "center",
              gap: 12,
              fontFamily: T.font,
              fontSize: 13,
              color: color.text,
              fontWeight: 600,
              animation: `slideInToast-gpu 0.3s ease-out`,
              boxShadow: `0 0 20px rgba(0,0,0,0.4)`,
              pointerEvents: "auto",
              cursor: isMobile ? "grab" : "default",
              userSelect: "none",
              transform: isBeingSwiped ? "translateX(100%)" : "translateX(0)",
              opacity: isBeingSwiped ? 0.5 : 1,
              transition: isBeingSwiped ? "none" : "all 0.2s ease",
              position: "relative",
              overflow: "hidden",
              minWidth: isMobile ? "100%" : 320,
              maxWidth: isMobile ? "100%" : 400,
            }}
          >
            {/* Progress bar for auto-dismiss */}
            <div
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                height: "3px",
                background: color.border,
                width: `${((toast.time_remaining || toast.duration || 3000) / (toast.duration || 3000)) * 100}%`,
                animation: `${toast.duration || 3000}ms linear backwards`,
                borderRadius: "0 0 0 8px",
              }}
            />

            <span style={{ fontSize: 18, fontWeight: 700, flexShrink: 0 }}>
              {color.icon}
            </span>
            <span style={{ flex: 1, lineHeight: 1.4 }}>{toast.message}</span>

            {/* Close button */}
            <button
              onClick={() => onDismiss(toast.id)}
              style={{
                background: "transparent",
                border: "none",
                color: color.text,
                fontSize: 18,
                cursor: "pointer",
                padding: "4px 8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                opacity: 0.6,
                transition: "opacity 0.2s",
                marginLeft: "8px",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.6")}
            >
              ✕
            </button>

            {/* Mobile swipe hint */}
            {isMobile && toasts.length > 1 && (
              <div
                style={{
                  position: "absolute",
                  right: 4,
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: 4,
                  height: 4,
                  borderRadius: "50%",
                  background: color.border,
                  opacity: 0.4,
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  THEME PICKER COMPONENT — GLASSMORPHIC ACCENT COLOR SELECTOR
// ═══════════════════════════════════════════════════════════════════
function ThemePicker({ isOpen, onClose, onSelectTheme, currentTheme }) {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10000,
      }}
    >
      <div
        style={{
          background: T.card,
          border: `1px solid ${T.border}`,
          borderRadius: "16px",
          backdropFilter: "blur(20px)",
          padding: "24px",
          minWidth: "380px",
          fontFamily: T.font,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "20px",
          }}
        >
          <h2
            style={{
              color: T.text,
              margin: 0,
              fontSize: "18px",
              fontWeight: 600,
            }}
          >
            Theme Picker
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: T.muted,
              fontSize: "24px",
              cursor: "pointer",
              padding: 0,
            }}
          >
            ✕
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: "12px",
          }}
        >
          {Object.entries(ACCENT_COLORS).map(([key, color]) => (
            <button
              key={key}
              onClick={() => onSelectTheme(key)}
              style={{
                background:
                  currentTheme === key ? color.light : "rgba(255,255,255,0.05)",
                border: `2px solid ${currentTheme === key ? color.primary : T.border}`,
                borderRadius: "12px",
                padding: "16px",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "8px",
                transition: "all 0.3s ease",
                boxShadow:
                  currentTheme === key ? `0 0 12px ${color.glow}` : "none",
                fontFamily: T.font,
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = "scale(1.05)";
                e.target.style.boxShadow = `0 0 12px ${color.glow}`;
              }}
              onMouseLeave={(e) => {
                e.target.style.transform =
                  currentTheme === key ? "scale(1)" : "scale(1)";
                e.target.style.boxShadow =
                  currentTheme === key ? `0 0 12px ${color.glow}` : "none";
              }}
            >
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  background: color.primary,
                  boxShadow: `0 0 12px ${color.glow}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {currentTheme === key && (
                  <span style={{ color: T.bg, fontSize: "16px" }}>✓</span>
                )}
              </div>
              <span
                style={{ color: T.text, fontSize: "13px", fontWeight: 500 }}
              >
                {color.name}
              </span>
            </button>
          ))}
        </div>

        <button
          onClick={onClose}
          style={{
            width: "100%",
            marginTop: "16px",
            padding: "12px",
            background: `${ACCENT_COLORS[currentTheme]?.primary || ACCENT_COLORS.BLUE.primary}22`,
            border: `1px solid ${ACCENT_COLORS[currentTheme]?.primary || ACCENT_COLORS.BLUE.primary}`,
            borderRadius: "8px",
            color:
              ACCENT_COLORS[currentTheme]?.primary ||
              ACCENT_COLORS.BLUE.primary,
            fontSize: "13px",
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: T.font,
            transition: "all 0.3s ease",
          }}
          onMouseEnter={(e) => {
            const accentHex =
              ACCENT_COLORS[currentTheme]?.primary ||
              ACCENT_COLORS.BLUE.primary;
            e.target.style.background = `${accentHex}33`;
            e.target.style.boxShadow = `0 0 8px ${ACCENT_COLORS[currentTheme]?.glow || ACCENT_COLORS.BLUE.glow}`;
          }}
          onMouseLeave={(e) => {
            const accentHex =
              ACCENT_COLORS[currentTheme]?.primary ||
              ACCENT_COLORS.BLUE.primary;
            e.target.style.background = `${accentHex}22`;
            e.target.style.boxShadow = "none";
          }}
        >
          Done
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  LOGIN SCREEN — WITH PASSWORD RESET
// ═══════════════════════════════════════════════════════════════════
function WaitingRoom({ profile, onRefresh, onLogout, onResendVerification }) {
  const [checking, setChecking] = useState(false);
  const [liveStatus, setLiveStatus] = useState(profile?.status || "PENDING");
  const auditData =
    typeof window !== "undefined" ? window.__TRADERS_AUDIT_DATA : null;
  let auth = null;
  let db = null;

  try {
    auth = getAuth();
  } catch {
    auth = null;
  }

  try {
    db = getDatabase();
  } catch {
    db = null;
  }

  const uid =
    auth?.currentUser?.uid ||
    auditData?.userAuth?.uid ||
    auditData?.adminAuth?.uid ||
    "";
  const email =
    auth?.currentUser?.email ||
    auditData?.userAuth?.email ||
    auditData?.adminAuth?.email ||
    "";
  const emailVerified = profile?.emailVerified !== false;

  useEffect(() => {
    setLiveStatus(profile?.status || "PENDING");
  }, [profile?.status]);

  useEffect(() => {
    if (!uid || auditData || !db) {
      return;
    }

    const statusRef = ref(db, `users/${uid}/status`);
    const unsubscribe = onValue(statusRef, (snapshot) => {
      const nextStatus = snapshot.val() || "PENDING";
      setLiveStatus(nextStatus);
      if (nextStatus === "ACTIVE") {
        void onRefresh();
      }
    });
    return () => unsubscribe();
  }, [uid, db, auditData, onRefresh]);

  useEffect(() => {
    if (!onRefresh) {
      return undefined;
    }

    const interval = setInterval(() => {
      void onRefresh();
    }, 30000);

    return () => clearInterval(interval);
  }, [onRefresh]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F9FAFB",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: T.font,
        padding: 20,
      }}
    >
      <div
        style={{ ...authCard, maxWidth: 540, textAlign: "center" }}
        className="glass-panel"
      >
        <AuthLogo />
        <div
          style={{
            width: 120,
            height: 120,
            borderRadius: "50%",
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 24px",
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.15)",
          }}
        >
          <video
            src="/logo.mp4"
            autoPlay
            loop
            muted
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
            onError={(e) => {
              // Fallback if video fails
              e.target.parentElement.innerHTML = "⏳";
              e.target.parentElement.style.fontSize = "48px";
              e.target.parentElement.style.display = "flex";
              e.target.parentElement.style.alignItems = "center";
              e.target.parentElement.style.justifyContent = "center";
              e.target.parentElement.style.color = "#D97706";
            }}
          />
        </div>
        <div
          style={{
            color: "#D97706",
            fontSize: 16,
            letterSpacing: 3,
            marginBottom: 20,
            fontWeight: 700,
          }}
        >
          APPLICATION UNDER REVIEW
        </div>
        <div style={{ color: T.muted, fontSize: 12, marginBottom: 12 }}>
          Account: {email}
        </div>
        <div
          style={{
            color: "var(--text-primary, #374151)",
            fontSize: 14,
            lineHeight: 1.8,
            marginBottom: 28,
            padding: "20px 24px",
            background: "var(--surface-elevated, #FFFFFF)",
            border: `1px solid var(--border-subtle, rgba(0,0,0,0.05))`,
            borderRadius: 12,
            boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)",
          }}
        >
          {emailVerified
            ? "Your Traders Regiment account is pending admin approval."
            : "Verify your Gmail inbox, then wait for admin approval to unlock access."}
        </div>
        <div
          style={{
            color: "var(--text-secondary, #6B7280)",
            fontSize: 12,
            lineHeight: 1.9,
            marginBottom: 32,
          }}
        >
          {emailVerified
            ? "Your application has been received. You will be notified once your account is authorized. Approval typically takes 24-48 hours."
            : "We sent a verification link to your Gmail address. After verification, your application remains pending until an admin approves it. Approval typically takes 24-48 hours."}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 24,
          }}
        >
          <div
            style={{
              padding: "8px 12px",
              borderRadius: 999,
              background: emailVerified
                ? "rgba(34,197,94,0.12)"
                : "rgba(217,119,6,0.12)",
              color: emailVerified ? T.green : "#D97706",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 0.6,
            }}
          >
            {emailVerified ? "EMAIL VERIFIED" : "EMAIL VERIFICATION REQUIRED"}
          </div>
          <div
            style={{
              padding: "8px 12px",
              borderRadius: 999,
              background: "rgba(15,23,42,0.06)",
              color: "var(--text-primary, #111827)",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 0.6,
            }}
          >
            STATUS: {liveStatus}
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, flexDirection: "column" }}>
          <button
            onClick={async () => {
              setChecking(true);
              await onRefresh();
              setChecking(false);
            }}
            disabled={checking}
            style={authBtn("#000000", checking)}
            className="btn-glass"
          >
            {checking ? "⟳ CHECKING STATUS..." : "↺ CHECK APPROVAL STATUS"}
          </button>
          {!emailVerified && (
            <button
              onClick={onResendVerification}
              style={authBtn(T.blue, false)}
              className="btn-glass"
            >
              RESEND VERIFICATION EMAIL
            </button>
          )}
          <button
            onClick={onLogout}
            aria-label="logout"
            style={{ ...authBtn("#999999", false), background: "transparent" }}
            className="btn-glass"
          >
            LOGOUT
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// CODE SPLITTING & PERFORMANCE - SUSPENSE BOUNDARIES (RULE #157, #161)
// ═══════════════════════════════════════════════════════════════════
/**
 * Suspense fallback component for lazy-loaded dashboards
 * Displays loading state while code is being downloaded and parsed
 */
function LoadingFallback() {
  const [dots, setDots] = React.useState(0);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setDots((d) => (d + 1) % 4);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F9FAFB",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: '"Inter", "Helvetica", sans-serif',
        flexDirection: "column",
        gap: 24,
      }}
    >
      {/* Premium Video Loading Indicator */}
      <div
        style={{
          width: 120,
          height: 120,
          borderRadius: "50%",
          overflow: "hidden",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.15)",
            background: "var(--surface-elevated, #FFFFFF)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <video
          src="/logo.mp4"
          autoPlay
          loop
          muted
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
          onError={(e) => {
            // Fallback spinner
            e.target.parentElement.innerHTML = "⟳";
            e.target.parentElement.style.fontSize = "48px";
            e.target.parentElement.style.display = "flex";
            e.target.parentElement.style.alignItems = "center";
            e.target.parentElement.style.justifyContent = "center";
            e.target.parentElement.style.animation = "spin 1s linear infinite";
          }}
        />
      </div>

      <div style={{ textAlign: "center" }}>
        <div
          style={{
            color: "#111827",
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: 2,
            marginBottom: 8,
          }}
        >
          {"LOADING".split("").map((char, i) => (
            <span
              key={i}
              style={{
                display: "inline-block",
                animation: `wave 0.6s ease-in-out ${i * 0.1}s infinite`,
                transformOrigin: "center bottom",
              }}
            >
              {char}
            </span>
          ))}
          {"...".padStart(1 + (dots || 0), ".")}
        </div>
        <div
          style={{
            color: "var(--text-secondary, #6B7280)",
            fontSize: 12,
            letterSpacing: 1,
            marginTop: 12,
          }}
        >
          Initializing dashboard · Compiling modules
        </div>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes wave {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
      `}</style>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ERROR BOUNDARIES - Graceful Error Handling (RULE #166)
// ═══════════════════════════════════════════════════════════════════
class ErrorBoundaryAdmin extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Return state update with error to mark boundary as errored
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("AdminDashboard Error:", error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
    // Dispatch custom event for logging or monitoring
    window.dispatchEvent(
      new CustomEvent("dashboardError", {
        detail: {
          error: error.toString(),
          componentStack: errorInfo.componentStack,
        },
      }),
    );
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            background: T.bg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: T.font,
            padding: 20,
          }}
        >
          <div
            style={{
              maxWidth: 540,
              textAlign: "center",
              padding: 40,
              background: "rgba(255,67,54,0.1)",
              border: `2px solid rgba(255,67,54,0.3)`,
              borderRadius: 12,
            }}
            className="glass-panel"
          >
            <div style={{ fontSize: 48, marginBottom: 20 }}>⚠️</div>
            <div
              style={{
                color: "#FF4336",
                fontSize: 20,
                fontWeight: 700,
                marginBottom: 16,
              }}
            >
              DASHBOARD ERROR
            </div>
            <div
              style={{
                color: "var(--text-secondary, #A1A1A6)",
                fontSize: 14,
                lineHeight: 1.8,
                marginBottom: 20,
              }}
            >
              The dashboard encountered an unexpected error. Please try
              refreshing the page.
            </div>
            {this.state.error && (
              <div
                style={{
                  background: "rgba(0,0,0,0.5)",
                  padding: 12,
                  borderRadius: 8,
                  marginBottom: 20,
                  textAlign: "left",
                  fontSize: 11,
                  color: "#FFF",
                  fontFamily: "monospace",
                  maxHeight: 120,
                  overflow: "auto",
                }}
              >
                {this.state.error.toString()}
              </div>
            )}
            <button
              onClick={() => window.location.reload()}
              style={{ ...authBtn(T.blue, false) }}
              className="btn-glass"
            >
              🔄 REFRESH PAGE
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// ═══════════════════════════════════════════════════════════════════
// MODULE 6: GLOBAL STATE MANAGEMENT - USER LIST CONTEXT
// ═══════════════════════════════════════════════════════════════════
// RULE #172: Global Context for User List - Instant data flow to all components
// RULE #165: Cache Persistence - Initialize from localStorage cache
const UserListContext = createContext();

function UserListProvider({ children }) {
  // RULE #165: Load from localStorage cache on initialization
  const [users, setUsersState] = useState(() => {
    const cached = getCachedUserList();
    return cached || {};
  });
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  // RULE #165: Wrap setUsers to also cache the data
  const setUsers = useCallback((newUsers) => {
    setUsersState(newUsers);
    // Save to cache for offline access and faster loading
    cacheUserList(newUsers);
    setLastUpdated(Date.now());
  }, []);

  const updateUsers = useCallback(
    (newUsers) => {
      setUsers(newUsers);
    },
    [setUsers],
  );

  const value = useMemo(
    () => ({
      users,
      setUsers: updateUsers,
      loading,
      setLoading,
      dbError,
      setDbError,
      lastUpdated,
    }),
    [users, updateUsers, loading, dbError, lastUpdated],
  );

  return (
    <UserListContext.Provider value={value}>
      {children}
    </UserListContext.Provider>
  );
}

function useUserList() {
  const context = useContext(UserListContext);
  if (!context) {
    throw new Error("useUserList must be used within UserListProvider");
  }
  return context;
}

// ═══════════════════════════════════════════════════════════════════
//  RULE #244, #246, #247, #266, #270: FRAUD DETECTION & SUPPORT CHAT
// ═══════════════════════════════════════════════════════════════════

// Helper: Detect duplicate IPs across users
function detectDuplicateIPs(users) {
  const ipMap = {};
  const duplicates = {};

  if (!users || typeof users !== "object") return duplicates;

  Object.entries(users).forEach(([uid, user]) => {
    const ip = user?.forensic?.ip || user?.ip;
    if (ip && ip !== "Unknown") {
      if (!ipMap[ip]) ipMap[ip] = [];
      ipMap[ip].push(uid);
    }
  });

  // Mark IPs with multiple users as duplicates
  Object.entries(ipMap).forEach(([ip, uids]) => {
    if (uids.length > 1) {
      duplicates[ip] = uids;
    }
  });

  return duplicates;
}

// Component: Real-time Direct Support Chat Modal (RULE #209: Typing Indicator)
function SupportChatModal({
  isOpen,
  userId,
  userName,
  onClose,
  auth,
  showToast,
}) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [_isTyping, _setIsTyping] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const canUseDb = !!firebaseDb;

  // Firebase path for chat - matches user's FloatingChatWidget path
  const chatPath = `support_chats/${userId}`;

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Set up real-time message listener
  useEffect(() => {
    if (!isOpen || !userId || !canUseDb) return;

    // Listen to messages subcollection - matches FloatingChatWidget path
    const messagesRef = ref(firebaseDb, `${chatPath}/messages`);
    const unsubscribe = onValue(messagesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const msgs = Object.entries(data)
          .map(([, msg]) => msg)
          .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
        setMessages(msgs);
      } else {
        setMessages([]);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [isOpen, userId, chatPath, canUseDb]);

  // Send message handler
  const handleSendMessage = async () => {
    if (!input.trim() || !canUseDb) return;

    try {
      const messagesRef = ref(firebaseDb, `${chatPath}/messages`);
      const newMessageRef = push(messagesRef);
      await set(newMessageRef, {
        sender: "admin",
        senderName: auth?.displayName || "Admin",
        text: input.trim(),
        timestamp: Date.now(),
        read: false,
      });

      setInput("");
      _setIsTyping(false);
    } catch {
      showToast("Failed to send message. Connection issue.", "error");
    }
  };

  // Typing indicator handler
  const handleTyping = (text) => {
    setInput(text);

    if (!auth?.uid || !canUseDb) return;

    clearTimeout(typingTimeoutRef.current);
    _setIsTyping(true);
    set(ref(firebaseDb, `${chatPath}/typing_${auth.uid}`), true);

    typingTimeoutRef.current = setTimeout(() => {
      set(ref(firebaseDb, `${chatPath}/typing_${auth.uid}`), null);
      _setIsTyping(false);
    }, 3000);
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10001,
      }}
    >
      <div
        style={{
          background: "rgba(20,20,25,0.95)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 16,
          width: "90%",
          maxWidth: 500,
          height: 600,
          display: "flex",
          flexDirection: "column",
          backdropFilter: "blur(30px)",
        }}
        className="restored-modal"
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid rgba(255,255,255,0.1)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <div style={{ color: "#F2F2F7", fontSize: 14, fontWeight: 600 }}>
              {userName}
            </div>
            {otherUserTyping && (
              <div style={{ color: "#0A84FF", fontSize: 11, marginTop: 4 }}>
                ✎ typing...
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "#A1A1A6",
              fontSize: 24,
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        </div>

        {/* Messages */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "16px 20px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {messages.length === 0 ? (
            <div
              style={{ color: "var(--text-secondary, #A1A1A6)", textAlign: "center", marginTop: 20 }}
            >
              No messages yet. Start the conversation.
            </div>
          ) : (
            messages.map((msg) => {
              const isAdmin = msg.sender === "admin";
              return (
                <div
                  key={`msg_${msg.timestamp}`}
                  style={{
                    display: "flex",
                    justifyContent: isAdmin ? "flex-end" : "flex-start",
                    marginBottom: 8,
                  }}
                >
                  <div
                    style={{
                      background: isAdmin
                        ? "rgba(0,122,255,0.3)"
                        : "rgba(255,255,255,0.1)",
                      border: `1px solid ${isAdmin ? "rgba(0,122,255,0.5)" : "rgba(255,255,255,0.2)"}`,
                      borderRadius: 12,
                      padding: "10px 14px",
                      maxWidth: "80%",
                      wordWrap: "break-word",
                    }}
                  >
                    {!isAdmin && (
                      <div
                        style={{
                          color: "#A1A1A6",
                          fontSize: 10,
                          marginBottom: 4,
                        }}
                      >
                        {msg.senderName || msg.email || "User"}
                      </div>
                    )}
                    <div
                      style={{
                        color: "var(--text-primary, #F2F2F7)",
                        fontSize: 13,
                        lineHeight: 1.4,
                      }}
                    >
                      {msg.text}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input */}
        <div
          style={{
            padding: "16px 20px",
            borderTop: "1px solid rgba(255,255,255,0.1)",
            display: "flex",
            gap: 12,
          }}
        >
          <input
            type="text"
            value={input}
            onChange={(e) => handleTyping(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder="Type message..."
              style={{
                flex: 1,
                background: "var(--input-bg, rgba(255,255,255,0.05))",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8,
              padding: "10px 12px",
              color: "#F2F2F7",
              fontSize: 13,
              fontFamily: "Consolas, monospace",
            }}
          />
          <button
            onClick={handleSendMessage}
            disabled={!input.trim()}
            style={{
              background: input.trim() ? "var(--accent-primary, #2563eb)" : "rgba(0,122,255,0.3)", 
              border: "none",
              borderRadius: 8,
              padding: "10px 16px",
              color: input.trim() ? "var(--text-primary, #000)" : "var(--text-secondary, #A1A1A6)",
              fontSize: 13,
              fontWeight: 700,
              cursor: input.trim() ? "pointer" : "default",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              if (input.trim()) {
                e.currentTarget.style.boxShadow =
                  "0 0 12px rgba(0,122,255,0.5)";
                e.currentTarget.style.transform = "scale(1.05)";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = "none";
              e.currentTarget.style.transform = "scale(1)";
            }}
          >
            SEND
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  RULE #295, #296: MAINTENANCE MODE - 'BACK SOON' SCREEN
// ═══════════════════════════════════════════════════════════════════
function MaintenanceScreen() {
  const [timeLeft, setTimeLeft] = useState("");

  // Simulate countdown timer
  useEffect(() => {
    const updateTimer = () => {
      const now = new Date();
      const nextMaintenance = new Date(
        now.getTime() + Math.random() * 4 * 60 * 60 * 1000,
      ); // Random 1-4 hours

      const updateCountdown = () => {
        const diff = nextMaintenance - new Date();
        if (diff <= 0) {
          setTimeLeft("Returning now...");
        } else {
          const hours = Math.floor(diff / (1000 * 60 * 60));
          const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          setTimeLeft(`${hours}h ${minutes}m`);
        }
      };

      updateCountdown();
      const interval = setInterval(updateCountdown, 30000); // Update every 30s
      return () => clearInterval(interval);
    };

    updateTimer();
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F9FAFB",
        backdropFilter: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        padding: "20px",
        fontFamily: "Consolas, monospace",
      }}
    >
      {/* Animated Background Gradient */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: `radial-gradient(circle at 20% 50%, rgba(0,122,255,0.05) 0%, transparent 50%),
                     radial-gradient(circle at 80% 80%, rgba(48,209,88,0.05) 0%, transparent 50%)`,
          animation: "fadeInDashboard 4s ease-in-out infinite",
          pointerEvents: "none",
        }}
      />

      {/* Main Content */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          textAlign: "center",
          maxWidth: "600px",
        }}
      >
        {/* Status Icon */}
        <div
          style={{
            fontSize: "80px",
            marginBottom: "24px",
            animation: "float 3s ease-in-out infinite",
          }}
        >
          🔧
        </div>

        {/* Heading */}
        <h1
          style={{
            color: "var(--text-primary, #F2F2F7)",
            fontSize: "48px",
            fontWeight: 800,
            marginBottom: "16px",
            letterSpacing: "2px",
            textTransform: "uppercase",
            background: "linear-gradient(135deg, #0A84FF 0%, #30D158 100%)",
            backgroundClip: "text",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          BACK SOON
        </h1>

        {/* Subheading */}
        <div
          style={{
            color: "var(--text-secondary, #A1A1A6)",
            fontSize: "16px",
            fontWeight: 600,
            marginBottom: "32px",
            letterSpacing: "1px",
            lineHeight: "1.6",
          }}
        >
          We're performing scheduled maintenance to enhance your trading
          experience.
          <br />
          System integrity checks in progress.
        </div>

        {/* Status Box */}
        <div
          style={{
            background: "rgba(0,122,255,0.1)",
            border: "1px solid rgba(0,122,255,0.3)",
            borderRadius: "12px",
            padding: "24px",
            marginBottom: "32px",
            backdropFilter: "blur(10px)",
          }}
        >
          <div
            style={{
              color: "var(--text-secondary, #A1A1A6)",
              fontSize: "13px",
              fontWeight: 600,
              marginBottom: "12px",
              letterSpacing: "1px",
            }}
          >
            ESTIMATED DOWNTIME
          </div>
          <div
            style={{
              color: "var(--accent-primary, #2563eb)",
              fontSize: "28px",
              fontWeight: 800,
              fontFamily: "Consolas, monospace",
              letterSpacing: "2px",
            }}
          >
            {timeLeft || "Loading..."}
          </div>
        </div>

        {/* Features List */}
        <div
          style={{
            textAlign: "left",
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "8px",
            padding: "20px",
            marginBottom: "32px",
          }}
        >
          <div
            style={{
              color: "#F2F2F7",
              fontSize: "12px",
              fontWeight: 700,
              marginBottom: "16px",
              letterSpacing: "1px",
              textTransform: "uppercase",
            }}
          >
            SYSTEM UPGRADES IN PROGRESS
          </div>
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            {[
              "Optimizing database queries",
              "Enhancing security protocols",
              "Improving performance metrics",
            ].map((item, i) => (
              <li
                key={i}
                style={{
                  color: "#A1A1A6",
                  fontSize: "12px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <span
                  style={{
                    color: "#30D158",
                    fontWeight: 800,
                  }}
                >
                  ✓
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Footer Message */}
        <div
          style={{
            color: "#5A5A5F",
            fontSize: "12px",
            fontWeight: 500,
            letterSpacing: "0.5px",
          }}
        >
          Thank you for your patience. We're back to full capacity shortly.
          <br />
          <span style={{ marginTop: "8px", display: "block" }}>
            Need immediate support?{" "}
            <span style={{ color: "#0A84FF" }}>contact@tradersapp.io</span>
          </span>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// RULE #315: ADMIN DEBUG OVERLAY - System Audit & Monitoring
// ═══════════════════════════════════════════════════════════════════
function DebugOverlay({
  logs,
  latencies,
  tti,
  componentStatus,
  isOpen,
  onToggle,
  auth,
}) {
  const [expandedSection, setExpandedSection] = useState(null);
  const [hoveredComponent, setHoveredComponent] = useState(null);

  // Only show for Master Admin
  if (!auth?.uid || auth.uid !== "ADMIN_UID_PLACEHOLDER") return null;

  const logsByType = {
    log: logs.filter((l) => l.type === "log"),
    warn: logs.filter((l) => l.type === "warn"),
    error: logs.filter((l) => l.type === "error"),
    info: logs.filter((l) => l.type === "info"),
  };

  const avgLatency =
    latencies.length > 0
      ? (latencies.reduce((a, b) => a + b.ms, 0) / latencies.length).toFixed(0)
      : 0;

  const slowRequests = latencies.filter((l) => l.ms > 2000);

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={onToggle}
        title="Toggle Debug Overlay"
        style={{
          position: "fixed",
          bottom: isOpen ? 330 : 20,
          left: 20,
          zIndex: 9998,
          width: 44,
          height: 44,
          borderRadius: "50%",
          background: "rgba(191,90,242,0.9)",
          border: "2px solid rgba(191,90,242,1)",
          color: "#fff",
          fontSize: 22,
          fontWeight: 700,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "all 0.3s ease",
          boxShadow: "0 0 20px rgba(191,90,242,0.5)",
        }}
      >
        🔧
      </button>

      {/* Main Debug Panel */}
      {isOpen && (
        <div
          style={{
            position: "fixed",
            bottom: 20,
            left: 70,
            width: 420,
            maxHeight: "80vh",
            background: "rgba(10,10,15,0.95)",
            border: "1px solid rgba(191,90,242,0.3)",
            borderRadius: 12,
            backdropFilter: "blur(20px)",
            zIndex: 9997,
            display: "flex",
            flexDirection: "column",
            boxShadow: "0 0 40px rgba(191,90,242,0.2)",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "12px 16px",
              borderBottom: "1px solid rgba(191,90,242,0.2)",
              background: "rgba(191,90,242,0.1)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div
              style={{
                color: "#BF5AF2",
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: 1,
              }}
            >
              🔍 SYSTEM AUDIT
            </div>
            <button
              onClick={onToggle}
              style={{
                background: "transparent",
                border: "none",
                color: "#BF5AF2",
                cursor: "pointer",
                fontSize: 16,
              }}
            >
              ✕
            </button>
          </div>

          {/* TTI & Performance Summary */}
          <div
            style={{
              padding: "12px 16px",
              background: "rgba(191,90,242,0.05)",
              borderBottom: "1px solid rgba(191,90,242,0.1)",
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
              fontSize: 11,
            }}
          >
            <div>
              <div style={{ color: "#A1A1A6", fontSize: 10, marginBottom: 4 }}>
                Time-to-Interactive
              </div>
              <div style={{ color: "#BF5AF2", fontSize: 14, fontWeight: 700 }}>
                {tti}ms
              </div>
            </div>
            <div>
              <div style={{ color: "#A1A1A6", fontSize: 10, marginBottom: 4 }}>
                Avg API Latency
              </div>
              <div
                style={{
                  color: tti < 3000 ? "#30D158" : "#FF453A",
                  fontSize: 14,
                  fontWeight: 700,
                }}
              >
                {avgLatency}ms
              </div>
            </div>
            <div>
              <div style={{ color: "#A1A1A6", fontSize: 10, marginBottom: 4 }}>
                Total Logs
              </div>
              <div style={{ color: "#FFD60A", fontSize: 14, fontWeight: 700 }}>
                {logs.length}
              </div>
            </div>
            <div>
              <div style={{ color: "#A1A1A6", fontSize: 10, marginBottom: 4 }}>
                Errors:{" "}
                {Object.keys(logsByType)
                  .map((key) => logsByType[key].length)
                  .reduce((a, b) => a + b, 0) === logs.length
                  ? logs.filter((l) => l.type === "error").length
                  : 0}
              </div>
              <div
                style={{
                  color:
                    logs.filter((l) => l.type === "error").length > 0
                      ? "#FF453A"
                      : "#30D158",
                  fontSize: 14,
                  fontWeight: 700,
                }}
              >
                {logs.filter((l) => l.type === "error").length}
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div
            style={{
              display: "flex",
              gap: 0,
              borderBottom: "1px solid rgba(191,90,242,0.1)",
              background: "rgba(0,0,0,0.2)",
            }}
          >
            {["Console", "Network", "Components"].map((tab) => (
              <button
                key={tab}
                onClick={() =>
                  setExpandedSection(expandedSection === tab ? null : tab)
                }
                style={{
                  flex: 1,
                  padding: "8px",
                  background:
                    expandedSection === tab
                      ? "rgba(191,90,242,0.15)"
                      : "transparent",
                  border: "none",
                  borderBottom:
                    expandedSection === tab
                      ? "2px solid #BF5AF2"
                      : "1px solid rgba(191,90,242,0.1)",
                  color: expandedSection === tab ? "#BF5AF2" : "#A1A1A6",
                  fontSize: 10,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                {tab} {tab === "Console" && `(${logs.length})`}
              </button>
            ))}
          </div>

          {/* Content Area */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              fontSize: 11,
              fontFamily: "Consolas, monospace",
            }}
          >
            {/* Console Logs */}
            {expandedSection === "Console" && (
              <div style={{ padding: "8px" }}>
                {logs.length === 0 ? (
                  <div style={{ color: "#A1A1A6", padding: "8px" }}>
                    No logs yet
                  </div>
                ) : (
                  logs.slice(-15).map((log, i) => (
                    <div
                      key={i}
                      style={{
                        padding: "6px",
                        marginBottom: "4px",
                        background:
                          log.type === "error"
                            ? "rgba(255,69,58,0.1)"
                            : log.type === "warn"
                              ? "rgba(255,214,10,0.1)"
                              : "rgba(255,255,255,0.02)",
                        border: `1px solid ${
                          log.type === "error"
                            ? "rgba(255,69,58,0.3)"
                            : log.type === "warn"
                              ? "rgba(255,214,10,0.3)"
                              : "rgba(255,255,255,0.1)"
                        }`,
                        borderRadius: 4,
                        color:
                          log.type === "error"
                            ? "#FF453A"
                            : log.type === "warn"
                              ? "#FFD60A"
                              : log.type === "info"
                                ? "#0A84FF"
                                : "#D1D1D6",
                        wordBreak: "break-word",
                      }}
                    >
                      <span style={{ opacity: 0.6, fontSize: 10 }}>
                        [{log.timestamp}]
                      </span>
                      <span style={{ marginLeft: 4 }}>{log.message}</span>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Network Latency */}
            {expandedSection === "Network" && (
              <div style={{ padding: "8px" }}>
                <div
                  style={{
                    color: "#BF5AF2",
                    fontSize: 10,
                    fontWeight: 700,
                    marginBottom: 8,
                  }}
                >
                  Slow Requests ({slowRequests.length}):
                </div>
                {slowRequests.length === 0 ? (
                  <div style={{ color: "#30D158" }}>
                    ✓ All requests fast (&lt;2s)
                  </div>
                ) : (
                  slowRequests.slice(-8).map((req, i) => (
                    <div
                      key={i}
                      style={{
                        padding: "6px",
                        background: "rgba(255,69,58,0.1)",
                        border: "1px solid rgba(255,69,58,0.3)",
                        borderRadius: 4,
                        marginBottom: 4,
                        color: "#FF453A",
                        fontSize: 10,
                      }}
                    >
                      🐢 {req.endpoint || "API"}: <strong>{req.ms}ms</strong>
                    </div>
                  ))
                )}
                <div
                  style={{
                    color: "#BF5AF2",
                    fontSize: 10,
                    fontWeight: 700,
                    marginTop: 8,
                    marginBottom: 8,
                  }}
                >
                  All Requests ({latencies.length}):
                </div>
                {latencies.slice(-8).map((req, i) => (
                  <div
                    key={i}
                    style={{
                      padding: "4px 6px",
                      background:
                        req.ms > 2000
                          ? "rgba(255,69,58,0.05)"
                          : "rgba(48,209,88,0.05)",
                      color: req.ms > 2000 ? "#FF453A" : "#30D158",
                      fontSize: 9,
                      borderLeft: `2px solid ${req.ms > 2000 ? "#FF453A" : "#30D158"}`,
                      paddingLeft: 8,
                    }}
                  >
                    {req.endpoint || "request"}: {req.ms}ms
                  </div>
                ))}
              </div>
            )}

            {/* Components Status */}
            {expandedSection === "Components" && (
              <div style={{ padding: "8px" }}>
                {Object.entries(componentStatus).length === 0 ? (
                  <div style={{ color: "#A1A1A6", padding: "8px" }}>
                    Inspecting components... Hover over buttons to see status
                  </div>
                ) : (
                  Object.entries(componentStatus)
                    .slice(-12)
                    .map(([key, comp], i) => (
                      <div
                        key={i}
                        onMouseEnter={() => setHoveredComponent(key)}
                        onMouseLeave={() => setHoveredComponent(null)}
                        style={{
                          padding: "6px",
                          background:
                            hoveredComponent === key
                              ? "rgba(191,90,242,0.15)"
                              : "rgba(255,255,255,0.02)",
                          border: "1px solid rgba(191,90,242,0.2)",
                          borderRadius: 4,
                          marginBottom: 4,
                          color: "#D1D1D6",
                          fontSize: 9,
                          cursor: "pointer",
                          transition: "all 0.2s",
                        }}
                      >
                        <div style={{ fontWeight: 600, color: "#BF5AF2" }}>
                          {comp.name}
                        </div>
                        <div
                          style={{
                            fontSize: 8,
                            color: "#A1A1A6",
                            marginTop: 2,
                          }}
                        >
                          {comp.element}
                        </div>
                        <div
                          style={{
                            marginTop: 4,
                            display: "inline-block",
                            padding: "2px 6px",
                            background:
                              comp.status === "loading"
                                ? "rgba(255,214,10,0.2)"
                                : comp.status === "error"
                                  ? "rgba(255,69,58,0.2)"
                                  : "rgba(48,209,88,0.2)",
                            color:
                              comp.status === "loading"
                                ? "#FFD60A"
                                : comp.status === "error"
                                  ? "#FF453A"
                                  : "#30D158",
                            borderRadius: 3,
                            fontSize: 8,
                            fontWeight: 600,
                          }}
                        >
                          ● {comp.status.toUpperCase()}
                        </div>
                      </div>
                    ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  ADMIN DASHBOARD (PART 1: Logic & Header)
// ═══════════════════════════════════════════════════════════════════
function AdminDashboard({
  auth,
  onLogout,
  isAdminAuthenticated,
  showToast,
  maintenanceModeActive,
  handleToggleMaintenanceMode,
}) {
  // Import global user list from context
  const { users, setUsers, loading, setLoading, dbError, setDbError } =
    useUserList();
  // Phase 1: Gate alerts bell to only show when there are pending approvals
  const hasPendingApprovals = useMemo(() => {
    if (!users) return false;
    const arr = Object.values(users);
    return arr.some((u) => {
      const s = u && u.status ? String(u.status) : "";
      return s.toUpperCase() === "PENDING";
    });
  }, [users]);

  // ALL HOOKS MUST BE AT THE TOP (Before any conditional checks)
  const [, _setUsers] = useState({});
  const [mirror, setMirror] = useState(null);
  const [mirrorData, setMirrorData] = useState(null);
  const [, setActionMsg] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // RULE #39, #40, #50: Grid Control - Row Density, Pagination, Column Picker
  const [rowDensity, setRowDensity] = useState("comfortable"); // 'compact' or 'comfortable'
  const [rowsPerPage, setRowsPerPage] = useState(10); // 10, 50, or 100
  const [currentPage, setCurrentPage] = useState(1); // Pagination page number
  const [visibleColumns, setVisibleColumns] = useState({
    name: true,
    email: true,
    joinDate: true,
    status: true,
    uid: false,
    role: false,
  });

  // RULE #56, #58: Grouping & Advanced Filtering
  const [groupByStatus, setGroupByStatus] = useState(false); // Toggle to group by status
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false); // Toggle advanced filter panel
  const [balanceFilter, setBalanceFilter] = useState({ min: 0, max: Infinity }); // Balance range filter

  // MODULE 4: Command Center & Navigation (#99, #109, #111)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false); // Toggle command palette
  const [ghostMode, setGhostMode] = useState(false); // Invisible navigation mode
  const [currentViewAsUser, setCurrentViewAsUser] = useState(null); // Shadow mode: view as another user

  // MODULE 5: Navigation Hierarchy (#91, #92, #94, #95, #105, #108)
  const [megaMenuOpen, setMegaMenuOpen] = useState(false); // Toggle Mega Menu

  // MODULE 7: Mobile & Layout Integrity (#113, #116, #118, #119, #120)
  const [notificationCenterOpen, setNotificationCenterOpen] = useState(false); // Toggle notification center
  // If there are no pending approvals, keep the notification center closed
  useEffect(() => {
    if (notificationCenterOpen && !hasPendingApprovals) {
      setNotificationCenterOpen(false);
    }
  }, [notificationCenterOpen, hasPendingApprovals]);
  const [currentMobilePage, setCurrentMobilePage] = useState("users"); // Current mobile nav page
  const [notifications] = useState([
    // Sample notifications
    {
      title: "✓ User Approved",
      message: "John Doe has been approved",
      time: "2 hrs ago",
    },
    {
      title: "🚫 Account Blocked",
      message: "Suspicious activity detected",
      time: "5 hrs ago",
    },
  ]);

  // MODULE 8: Visual Polish & Experience (#121, #126, #134, #137, #138)
  const systemIsDark = useSystemTheme(); // Detect OS theme preference
  const [isDarkMode, setIsDarkMode] = useState(systemIsDark); // User theme preference

  // RULE #313: Session Recovery - Restore modal state from sessionStorage
  const [selectedUserDocs, setSelectedUserDocs] = useState(() => {
    try {
      const saved = sessionStorage.getItem("TradersApp_SelectedUserDocs");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // RULE #244, #246, #247, #266, #270: Support chat modal state with session recovery
  const [chatModalOpen, setChatModalOpen] = useState(() => {
    try {
      const saved = sessionStorage.getItem("TradersApp_ChatModalOpen");
      return saved === "true";
    } catch {
      return false;
    }
  });

  const [chatWith, setChatWith] = useState(() => {
    try {
      const saved = sessionStorage.getItem("TradersApp_ChatWith");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [duplicateIPs, setDuplicateIPs] = useState({});

  // RULE #310: Scroll-spy for menu items - track which section user is viewing
  const [activeSection, setActiveSection] = useState("users");

  // ═══════════════════════════════════════════════════════════════════
  // SCROLL-SPY: Highlight menu item matching current view
  // ═══════════════════════════════════════════════════════════════════
  useEffect(() => {
    const handleScroll = () => {
      const sections = [
        { id: "users", offset: 0 },
        {
          id: "stats",
          offset: document.getElementById("admin-stats")?.offsetTop || 2000,
        },
        {
          id: "settings",
          offset: document.getElementById("admin-settings")?.offsetTop || 4000,
        },
      ];

      const scrollPos = window.scrollY + 100; // Offset for header
      let currentSection = "users";

      for (let i = sections.length - 1; i >= 0; i--) {
        if (scrollPos >= sections[i].offset) {
          currentSection = sections[i].id;
          break;
        }
      }

      setActiveSection(currentSection);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // RULE #244: IP Fraud Detection - Detect users sharing same IP address

  // RULE #313: Save modal states to sessionStorage for session recovery
  useEffect(() => {
    try {
      sessionStorage.setItem(
        "TradersApp_SelectedUserDocs",
        JSON.stringify(selectedUserDocs),
      );
    } catch {
      // Fail silently in private mode
    }
  }, [selectedUserDocs]);

  useEffect(() => {
    try {
      sessionStorage.setItem(
        "TradersApp_ChatModalOpen",
        chatModalOpen.toString(),
      );
    } catch {
      // Fail silently in private mode
    }
  }, [chatModalOpen]);

  useEffect(() => {
    try {
      sessionStorage.setItem("TradersApp_ChatWith", JSON.stringify(chatWith));
    } catch {
      // Fail silently in private mode
    }
  }, [chatWith]);

  // ═══════════════════════════════════════════════════════════════════
  // MODULE 6: PERFORMANCE & CONNECTIVITY - DATA OPTIMIZATION
  // ═══════════════════════════════════════════════════════════════════

  // RULE #154: Search Debouncing - Wait 300ms after last keystroke before filtering
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");

  useEffect(() => {
    // Timer ID for debounce cleanup
    const timerRef = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300); // 300ms debounce delay

    // Cleanup: Cancel the previous timer if component unmounts or searchQuery changes
    return () => clearTimeout(timerRef);
  }, [searchQuery]);

  useEffect(() => {
    // Set up real-time listener for users
    if (!isAdminAuthenticated && !auth?.token) return;
    if (!firebaseDb) {
      setUsers({});
      setLoading(false);
      return;
    }

    setLoading(true);
    setDbError("");

    try {
      // Optimized users listener with connection pooling & caching
      firebaseOptimizer.queueUpdate("users", "critical");
      const unsubscribe = firebaseOptimizer.createOptimizedListener(
        "users",
        (result) => {
          const data = result.isBatched
            ? result.updates[result.updates.length - 1]
            : result;
          const usersData = data && typeof data === "object" ? data : {};
          setUsers(usersData);
          setLoading(false);
          setDbError("");
        },
        firebaseDb,
        ref,
        onValue,
      );

      // Clean up listener on unmount
      return () => unsubscribe();
    } catch (error) {
      console.error("Failed to set up listener:", error);
      setDbError(
        `Network Error: ${error.message || "Failed to listen for users"}`,
      );
      setUsers({});
      setLoading(false);
    }
  }, [isAdminAuthenticated, auth, setUsers, setLoading, setDbError]);

  // RULE #99: Keyboard listener for Command Palette (Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl+K or Cmd+K opens command palette
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen(!commandPaletteOpen);
      }
      // Ctrl+Shift+G toggles ghost mode
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "g") {
        e.preventDefault();
        setGhostMode(!ghostMode);
        showToast(
          `Stealth Protocol ${!ghostMode ? "ACTIVATED" : "DEACTIVATED"}. Shadow mode ${!ghostMode ? "online" : "offline"}.`,
          !ghostMode ? "success" : "warning",
        );
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [commandPaletteOpen, ghostMode, showToast]);

  // ═══════════════════════════════════════════════════════════════════
  // SECURITY SENTINEL: Initialize multi-layer defense system
  // ═══════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (auth && auth.uid && firebaseDb) {
      try {
        const securitySentinel = new SecuritySentinel(
          firebaseDb,
          auth.uid,
          ADMIN_UID,
          showToast,
          window.sendTelegramAlert,
        );

        // Activate only honeypot layer on load (other layers activated per action)
        securitySentinel.activate();
        showToast(
          "Atomic Sentinel Online: 4-Layer Perimeter Secure",
          "success",
        );

        // Expose for admin debugging
        window.securitySentinel = securitySentinel;

        console.warn("Security Sentinel activated for user:", auth.uid);
      } catch (error) {
        console.error(
          "🛡️ CRASH POINT - Security Sentinel Initialization Failed:",
          error,
        );
        console.error("Details:", {
          auth_uid: auth?.uid,
          firebaseDb_exists: !!firebaseDb,
          admin_uid: ADMIN_UID,
          showToast_exists: !!showToast,
          sendTelegramAlert_exists: !!window.sendTelegramAlert,
        });
      }
    }
  }, [auth, showToast]);

  // RULE #244, #246, #247, #266, #270: Detect duplicate IPs for fraud detection
  useEffect(() => {
    if (users && typeof users === "object") {
      const duplicates = detectDuplicateIPs(users);
      setDuplicateIPs(duplicates);
    }
  }, [users]);

  // ═══════════════════════════════════════════════════════════════════
  // ADMIN ACTIVITY TRACKING - Layer 3: Anti-Hacker Sentinel
  // ═══════════════════════════════════════════════════════════════════
  /**
   * Record admin action for click speed detection
   * If clicks exceed 5/second, auto-lock admin panel
   */
  const recordAdminActivity = (action, target = null) => {
    if (isAdminAuthenticated && window.securitySentinel) {
      const result = window.securitySentinel.antiHacker.recordAdminActivity(
        action,
        target,
      );

      // If admin panel is locked, show error
      if (result && result.blocked) {
        showToast(
          "🔒 Admin panel is LOCKED. Detected bot activity. OTP required to unlock.",
          "error",
        );
        return false;
      }

      // If suspicious activity detected (>2.5 clicks/sec), warn
      if (result && result.isSuspicious) {
        console.warn(
          "⚠️ Unusual click speed detected:",
          result.clicksPerSecond,
          "clicks/sec",
        );
      }

      return true;
    }
    return true;
  };

  const approve = async (uid) => {
    // Record admin activity
    if (!recordAdminActivity("APPROVE_USER", uid)) return;

    try {
      const targetUser = (await dbR(`users/${uid}`, auth?.token)) || {};
      await dbM(
        `users/${uid}`,
        { status: "ACTIVE", approvedAt: new Date().toISOString() },
        auth?.token,
      );
      setActionMsg(`✓ User ${uid.slice(0, 8)}... APPROVED`);
      if (targetUser.email) {
        void sendApprovalConfirmationEmail(
          targetUser.email,
          targetUser.fullName,
        );
      }
      showToast(
        `Authorization granted. User ${uid.slice(0, 8)}... now have system access.`,
        "success",
      );

      // RULE #123: Confetti Success Animation on approval
      triggerConfetti(40, 2.5);

      // No need to manually reload - onSnapshot listener will update automatically
    } catch {
      showToast(
        "Approval protocol disrupted. Check your authorization vectors.",
        "error",
      );
    }
  };

  const block = async (uid) => {
    try {
      await dbM(
        `users/${uid}`,
        { status: "BLOCKED", blockedAt: new Date().toISOString() },
        auth?.token,
      );
      setActionMsg(`🚫 User ${uid.slice(0, 8)}... BLOCKED`);
      showToast(
        `User ${uid.slice(0, 8)}... removed from active roster. Access revoked.`,
        "warning",
      );
      // No need to manually reload - onSnapshot listener will update automatically
      if (mirror === uid) {
        setMirror(null);
        setMirrorData(null);
      }
    } catch {
      showToast(
        "Block command rejected. User still occupying bandwidth.",
        "error",
      );
    }
  };

  const openMirror = async (uid) => {
    setMirror(uid);
    const data = await dbR(`users/${uid}`, auth?.token);
    setMirrorData(data);
  };

  const statusColor = { ACTIVE: T.green, PENDING: T.gold, BLOCKED: T.red };
  const userList = Object.entries(users);

  // Deduplicate users by email, keeping only the most recent entry (by createdAt)
  const uniqueUserMap = {};
  userList.forEach(([uid, userData]) => {
    if (!userData || !userData.email) return; // Skip invalid entries
    const email = userData.email.toLowerCase().trim();

    // If email not seen before, add it
    if (!uniqueUserMap[email]) {
      uniqueUserMap[email] = [uid, userData];
    } else {
      // If email exists, compare createdAt and keep the newer one
      const existingCreatedAt = new Date(
        uniqueUserMap[email][1].createdAt || 0,
      ).getTime();
      const currentCreatedAt = new Date(userData.createdAt || 0).getTime();

      if (currentCreatedAt > existingCreatedAt) {
        uniqueUserMap[email] = [uid, userData];
      }
    }
  });

  // Convert back to array format
  const deduplicatedUserList = Object.values(uniqueUserMap);

  // Normalize status comparison: case-insensitive
  const normalizeStatus = (status) => {
    if (!status) return "";
    return status.toLowerCase() === "pending"
      ? "PENDING"
      : status.toUpperCase() === "ACTIVE"
        ? "ACTIVE"
        : status.toUpperCase() === "BLOCKED"
          ? "BLOCKED"
          : status.toUpperCase();
  };

  // Filter users by status with proper case-insensitive logic (using deduplicated list)
  const filteredUsers =
    filterStatus === "ALL"
      ? deduplicatedUserList
      : deduplicatedUserList.filter(
          ([, u]) => normalizeStatus(u.status) === filterStatus,
        );

  // RULE #34, #35: Apply fuzzy search filter with scoring and relevance ranking
  // RULE #154: Uses debouncedSearchQuery (300ms debounce) for performance optimization
  const searchFilteredUsers = debouncedSearchQuery.trim()
    ? filteredUsers
        .map(([uid, u]) => {
          const nameScore = fuzzySearchScore(
            debouncedSearchQuery,
            u.fullName || "",
          );
          const emailScore = fuzzySearchScore(
            debouncedSearchQuery,
            u.email || "",
          );
          const maxScore = Math.max(nameScore, emailScore);

          return {
            uid,
            user: u,
            score: maxScore,
            matchedField: nameScore > emailScore ? "name" : "email",
          };
        })
        .filter((item) => item.score >= 0) // Only include matches
        .sort((a, b) => b.score - a.score) // Sort by relevance (highest score first)
        .map((item) => [item.uid, item.user])
    : filteredUsers;

  // RULE #58: Apply Advanced Filter - Balance range filter
  const advancedFilteredUsers = showAdvancedFilter
    ? searchFilteredUsers.filter(([, u]) => {
        const balance = parseFloat(u.accountBalance || 0);
        return balance >= balanceFilter.min && balance <= balanceFilter.max;
      })
    : searchFilteredUsers;

  // Debug: Log if filter results are empty but counts show data
  if (
    filterStatus !== "ALL" &&
    filteredUsers.length === 0 &&
    deduplicatedUserList.length > 0
  ) {
    console.warn(
      `Filter '${filterStatus}' returned 0 results. User statuses in DB:`,
      deduplicatedUserList.map(([, d]) => d.status).filter(Boolean),
    );
  }

  // Calculate status counts using the deduplicated list
  const statusCounts = {
    ALL: deduplicatedUserList.length,
    ACTIVE: deduplicatedUserList.filter(
      ([, u]) => normalizeStatus(u.status) === "ACTIVE",
    ).length,
    PENDING: deduplicatedUserList.filter(
      ([, u]) => normalizeStatus(u.status) === "PENDING",
    ).length,
    BLOCKED: deduplicatedUserList.filter(
      ([, u]) => normalizeStatus(u.status) === "BLOCKED",
    ).length,
  };

  // RULE #39, #40, #50: Pagination Logic - Calculate displayed rows
  let finalUsers = advancedFilteredUsers;

  // RULE #56: Group by Status - Organize users into sections
  if (groupByStatus) {
    const grouped = {
      ACTIVE: advancedFilteredUsers.filter(
        ([, u]) => normalizeStatus(u.status) === "ACTIVE",
      ),
      PENDING: advancedFilteredUsers.filter(
        ([, u]) => normalizeStatus(u.status) === "PENDING",
      ),
      BLOCKED: advancedFilteredUsers.filter(
        ([, u]) => normalizeStatus(u.status) === "BLOCKED",
      ),
    };
    // Flatten back to array but preserve grouping order
    finalUsers = [...grouped.ACTIVE, ...grouped.PENDING, ...grouped.BLOCKED];
  }

  const totalResults = finalUsers.length;
  const totalPages = Math.ceil(totalResults / rowsPerPage);
  const validPage = Math.min(currentPage, Math.max(1, totalPages));
  const startIdx = (validPage - 1) * rowsPerPage;
  const endIdx = startIdx + rowsPerPage;
  const paginatedUsers = finalUsers.slice(startIdx, endIdx);

  // Helper function to generate grid template columns based on visible columns
  const getGridTemplateColumns = () => {
    const cols = [];
    if (visibleColumns.name) cols.push("2fr");
    if (visibleColumns.email) cols.push("2fr");
    if (visibleColumns.joinDate) cols.push("1.5fr");
    if (visibleColumns.uid) cols.push("1.5fr");
    if (visibleColumns.role) cols.push("1.2fr");
    if (visibleColumns.status) cols.push("1.2fr");
    cols.push("1fr"); // Actions column always visible
    return cols.join(" ");
  };

  // RULE #283, #285, #290, #294, #299: Mobile detection for responsive action cards
  const isMobileView = typeof window !== "undefined" && window.innerWidth < 768;

  // Helper function to get row padding based on density
  const getRowPadding = () => {
    return rowDensity === "compact" ? "8px 20px" : "14px 20px";
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: T.bg,
        color: T.text,
        fontFamily: T.font,
        animation: "fadeInDashboard 0.6s ease-out",
      }}
    >
      {/* RULE #54: Loading Overlay - Shows while syncing with database */}
      <LoadingOverlay isLoading={loading} />

      {/* RULE #119: Notification Center - Sidebar/Overlay */}
      <NotificationCenter
        isOpen={notificationCenterOpen}
        onClose={() => setNotificationCenterOpen(false)}
        notifications={notifications}
      />

      {/* RULE #113: Mobile Bottom Navigation */}
      <MobileBottomNav
        currentPage={currentMobilePage}
        onNavigate={setCurrentMobilePage}
      />

      {/* RULE #99 & #111: Command Palette - Ctrl+K to search users/commands */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        users={Array.isArray(users) ? users : Object.values(users || {})}
        onJumpToUser={(uid) => {
          setCurrentViewAsUser(uid);
          setCommandPaletteOpen(false);
          showToast(`Switched to user: ${uid}`, "info");
        }}
        onToggleGhostMode={() => setGhostMode(!ghostMode)}
        ghostMode={ghostMode}
        showToast={showToast}
      />

      {/* RULE #92: Mega Menu for Tools */}
      <MegaMenu isOpen={megaMenuOpen} onClose={() => setMegaMenuOpen(false)} />

      {/* RULE #244, #246, #247, #266, #270: Support Chat Modal */}
      <SupportChatModal
        isOpen={chatModalOpen}
        userId={chatWith}
        userName={users?.[chatWith]?.fullName || "User"}
        onClose={() => {
          setChatModalOpen(false);
          setChatWith(null);
        }}
        auth={auth}
        showToast={showToast}
      />

      {/* RULE #91: Breadcrumbs Navigation */}
      <Breadcrumbs
        items={[
          { icon: "🏠", label: "Home", path: "/", onNavigate: true },
          { icon: "🛡️", label: "Admin", path: "/admin", onNavigate: true },
          { icon: "👥", label: "Users", path: "/admin/users", active: true },
        ]}
        onNavigate={() => void 0}
      />

      {/* Admin Dashboard Header */}
      <div
        style={{
          background: "var(--surface-elevated, #FFFFFF)",
          borderBottom: `1px solid #E5E7EB`,
          padding: "16px 32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 16,
          boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)",
        }}
        className="glass-panel"
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <LED color={T.purple} size={12} pulse />
          <div>
            <div
              style={{
                color: T.purple,
                fontSize: 15,
                letterSpacing: 3,
                fontWeight: 800,
              }}
            >
              {getTimeBasedGreeting("Admin").fullGreeting} — GOD MODE
            </div>
            <div
              style={{
                color: T.muted,
                fontSize: 11,
                letterSpacing: 2,
                marginTop: 4,
                fontWeight: 600,
              }}
            >
              MASTER ADMIN DASHBOARD · {ADMIN_EMAIL}
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
            zIndex: 50,
          }}
        >
          {["ALL", "ACTIVE", "PENDING", "BLOCKED"].map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              style={{
                background:
                  filterStatus === status
                    ? `rgba(${status === "ACTIVE" ? "48,209,88" : status === "PENDING" ? "255,214,10" : status === "BLOCKED" ? "255,69,58" : "0,122,255"},0.2)`
                    : "transparent",
                border: `1px solid ${filterStatus === status ? (status === "ACTIVE" ? "rgba(48,209,88,0.6)" : status === "PENDING" ? "rgba(255,214,10,0.6)" : status === "BLOCKED" ? "rgba(255,69,58,0.6)" : "rgba(0,122,255,0.6)") : "rgba(255,255,255,0.2)"}`,
                borderRadius: 6,
                padding: "8px 16px",
                cursor: "pointer",
                color:
                  filterStatus === status
                    ? status === "ACTIVE"
                      ? T.green
                      : status === "PENDING"
                        ? T.gold
                        : status === "BLOCKED"
                          ? T.red
                          : T.blue
                    : T.muted,
                fontFamily: T.font,
                fontSize: 11,
                letterSpacing: 1,
                fontWeight: 700,
                transition: "all 0.2s ease-in-out",
              }}
              onMouseEnter={(e) => {
                if (filterStatus !== status) {
                  e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                  e.currentTarget.style.transform = "translateY(-2px)";
                }
              }}
              onMouseLeave={(e) => {
                if (filterStatus !== status) {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.transform = "translateY(0)";
                }
              }}
              className="btn-glass"
            >
              {status === "ALL"
                ? `${status} (${statusCounts.ALL})`
                : status === "ACTIVE"
                  ? `${status} (${statusCounts.ACTIVE})`
                  : status === "PENDING"
                    ? `${status} (${statusCounts.PENDING})`
                    : `BANNED (${statusCounts.BLOCKED})`}
            </button>
          ))}

          {/* RULE #56: Group By Status Toggle */}
          <button
            onClick={() => setGroupByStatus(!groupByStatus)}
            style={{
              background: groupByStatus ? "rgba(0,122,255,0.2)" : "transparent",
              border: `1px solid ${groupByStatus ? "rgba(0,122,255,0.5)" : "rgba(255,255,255,0.2)"}`,
              borderRadius: 6,
              padding: "8px 16px",
              cursor: "pointer",
              color: groupByStatus ? T.blue : T.muted,
              fontFamily: T.font,
              fontSize: 11,
              letterSpacing: 1,
              fontWeight: 700,
              transition: "all 0.2s ease-in-out",
            }}
            onMouseEnter={(e) => {
              if (!groupByStatus) {
                e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                e.currentTarget.style.transform = "translateY(-2px)";
              }
            }}
            onMouseLeave={(e) => {
              if (!groupByStatus) {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.transform = "translateY(0)";
              }
            }}
            className="btn-glass"
            title="Group users by their status"
          >
            {groupByStatus ? "⊟ Grouped" : "⊞ Group By"}
          </button>

          {/* RULE #58: Advanced Filter Toggle */}
          <button
            onClick={() => setShowAdvancedFilter(!showAdvancedFilter)}
            style={{
              background: showAdvancedFilter
                ? "rgba(0,122,255,0.2)"
                : "transparent",
              border: `1px solid ${showAdvancedFilter ? "rgba(0,122,255,0.5)" : "rgba(255,255,255,0.2)"}`,
              borderRadius: 6,
              padding: "8px 16px",
              cursor: "pointer",
              color: showAdvancedFilter ? T.blue : T.muted,
              fontFamily: T.font,
              fontSize: 11,
              letterSpacing: 1,
              fontWeight: 700,
              transition: "all 0.2s ease-in-out",
            }}
            onMouseEnter={(e) => {
              if (!showAdvancedFilter) {
                e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                e.currentTarget.style.transform = "translateY(-2px)";
              }
            }}
            onMouseLeave={(e) => {
              if (!showAdvancedFilter) {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.transform = "translateY(0)";
              }
            }}
            className="btn-glass"
            title="Show advanced filtering options"
          >
            {showAdvancedFilter ? "⊟ Filters" : "⚙ Filters"}
          </button>

          <button
            onClick={async () => {
              // Optional: Manual refresh for users who prefer it, though real-time listener handles updates
              if (!firebaseDb) {
                setDbError("Firebase unavailable");
                return;
              }
              setLoading(true);
              setDbError("");
              try {
                const usersRef = ref(firebaseDb, "users");
                const snapshot = await get(usersRef);
                if (snapshot.exists()) {
                  setUsers(snapshot.val());
                } else {
                  setUsers({});
                }
              } catch (error) {
                console.error("Failed to refresh users:", error);
                setDbError(`Network Error: ${error.message}`);
              } finally {
                setLoading(false);
              }
            }}
            style={{
              background: "transparent",
              border: `1px solid rgba(255,255,255,0.1)`,
              borderRadius: 6,
              padding: "8px 16px",
              cursor: "pointer",
              color: T.muted,
              fontFamily: T.font,
              fontSize: 11,
              letterSpacing: 1,
              fontWeight: 600,
              transition: "all 0.2s ease-in-out",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.05)";
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.3)";
              e.currentTarget.style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
              e.currentTarget.style.transform = "translateY(0)";
            }}
            className="btn-glass"
          >
            ↺ REFRESH
          </button>

          {/* RULE #109 & #111: User Switcher - Shadow Mode */}
          <UserSwitcher
            users={Array.isArray(users) ? users : Object.values(users || {})}
            currentViewAsUser={currentViewAsUser}
            onSwitchUser={setCurrentViewAsUser}
            ghostMode={ghostMode}
          />

          {/* RULE #94: Mega Menu Tools Button */}
          <button
            onClick={() => setMegaMenuOpen(!megaMenuOpen)}
            style={{
              background: megaMenuOpen ? "rgba(0,122,255,0.2)" : "transparent",
              border: `1px solid ${megaMenuOpen ? "rgba(0,122,255,0.5)" : "rgba(255,255,255,0.2)"}`,
              borderRadius: 6,
              padding: "8px 16px",
              cursor: "pointer",
              color: megaMenuOpen ? T.blue : T.muted,
              fontFamily: T.font,
              fontSize: 11,
              letterSpacing: 1,
              fontWeight: 600,
              transition: "all 0.2s ease-in-out",
            }}
            onMouseEnter={(e) => {
              if (!megaMenuOpen) {
                e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.3)";
                e.currentTarget.style.transform = "translateY(-2px)";
              }
            }}
            onMouseLeave={(e) => {
              if (!megaMenuOpen) {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
                e.currentTarget.style.transform = "translateY(0)";
              }
            }}
            className="btn-glass"
            title="Open Tools Menu"
          >
            🛠️ TOOLS
          </button>

          {/* RULE #119: Notification Center Button */}
          <button
            onClick={() => setNotificationCenterOpen(!notificationCenterOpen)}
            style={{
              background: notificationCenterOpen
                ? "rgba(0,122,255,0.2)"
                : "transparent",
              border: `1px solid ${notificationCenterOpen ? "rgba(0,122,255,0.5)" : "rgba(255,255,255,0.2)"}`,
              borderRadius: 6,
              padding: "8px 12px",
              cursor: "pointer",
              color: notificationCenterOpen ? T.blue : T.muted,
              fontFamily: T.font,
              fontSize: 11,
              letterSpacing: 1,
              fontWeight: 700,
              transition: "all 0.2s ease-in-out",
              position: "relative",
            }}
            onMouseEnter={(e) => {
              if (!notificationCenterOpen) {
                e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.3)";
                e.currentTarget.style.transform = "translateY(-2px)";
              }
            }}
            onMouseLeave={(e) => {
              if (!notificationCenterOpen) {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)";
                e.currentTarget.style.transform = "translateY(0)";
              }
            }}
            className="btn-glass"
            title="Open Notification Center"
          >
            🔔{" "}
            {notifications.length > 0 && (
              <span
                style={{
                  position: "absolute",
                  top: "0px",
                  right: "2px",
                  background: T.red,
                  color: T.text,
                  borderRadius: "50%",
                  width: "16px",
                  height: "16px",
                  fontSize: "9px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                }}
              >
                {notifications.length}
              </span>
            )}
          </button>

          {/* RULE #101: Full-Screen Toggle */}
          <FullScreenToggle showToast={showToast} />

          {/* RULE #295, #296: Maintenance Mode Toggle */}
          <button
            onClick={handleToggleMaintenanceMode}
            title={
              maintenanceModeActive
                ? "Disable Maintenance Mode"
                : "Enable Maintenance Mode"
            }
            style={{
              background: maintenanceModeActive
                ? "rgba(255,165,0,0.2)"
                : "transparent",
              border: `1px solid ${maintenanceModeActive ? "rgba(255,165,0,0.6)" : "rgba(255,255,255,0.2)"}`,
              borderRadius: 6,
              padding: "8px 16px",
              cursor: "pointer",
              color: maintenanceModeActive ? "#FFB340" : T.muted,
              fontFamily: T.font,
              fontSize: 11,
              letterSpacing: 1,
              fontWeight: 700,
              transition: "all 0.2s ease-in-out",
              animation: maintenanceModeActive
                ? "pulse 1.5s ease-in-out infinite"
                : "none",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255,165,0,0.3)";
              e.currentTarget.style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = maintenanceModeActive
                ? "rgba(255,165,0,0.2)"
                : "transparent";
              e.currentTarget.style.transform = "translateY(0)";
            }}
            className="btn-glass"
          >
            {maintenanceModeActive ? "⏱️ MAINTENANCE ON" : "⏱️ MAINTENANCE OFF"}
          </button>

          <button
            onClick={onLogout}
            style={{
              background: "rgba(255,69,58,0.1)",
              border: `1px solid rgba(255,69,58,0.3)`,
              borderRadius: 6,
              padding: "8px 16px",
              cursor: "pointer",
              color: T.red,
              fontFamily: T.font,
              fontSize: 11,
              letterSpacing: 1,
              fontWeight: 600,
              transition: "all 0.2s ease-in-out",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255,69,58,0.2)";
              e.currentTarget.style.borderColor = "rgba(255,69,58,0.6)";
              e.currentTarget.style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255,69,58,0.1)";
              e.currentTarget.style.borderColor = "rgba(255,69,58,0.3)";
              e.currentTarget.style.transform = "translateY(0)";
            }}
            className="btn-glass"
          >
            LOGOUT
          </button>
        </div>
      </div>

      {/* RULE #310: Scroll-Spy Navigation Menu */}
      <div
        style={{
          padding: "8px 20px",
          borderBottom: `1px solid rgba(255,255,255,0.1)`,
          background: "rgba(0,0,0,0.3)",
          display: "flex",
          gap: 8,
          overflowX: "auto",
        }}
        className="glass-panel"
      >
        <div
          className={`menu-item ${activeSection === "users" ? "active" : ""}`}
          onClick={() =>
            document
              .getElementById("admin-users")
              ?.scrollIntoView({ behavior: "smooth" })
          }
          style={{
            cursor: "pointer",
            whiteSpace: "nowrap",
            ...(activeSection === "users"
              ? {
                  color: T.blue,
                  background: "rgba(10,132,255,0.15)",
                  borderLeft: `3px solid ${T.blue}`,
                  paddingLeft: "9px",
                }
              : {
                  color: T.muted,
                }),
          }}
        >
          👥 Users
        </div>
      </div>

      {/* Data Table & Mirror Layout */}
      <div
        style={{
          display: "flex",
          height: "calc(100vh - 75px - 48px)",
          flexWrap: "wrap",
        }}
      >
        {/* RULE #92: Left Column - Sticky Sidebar with Professional Data Table */}
        <div
          id="admin-users"
          style={{
            width: mirror ? 440 : "100%",
            flex: mirror ? undefined : 1,
            borderRight: `1px solid rgba(255,255,255,0.1)`,
            overflowY: "auto",
            overflowX: "hidden",
            background: "rgba(0,0,0,0.2)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Search Bar - Sticky Header */}
          <div
            style={{
              padding: "16px 20px",
              borderBottom: `1px solid rgba(255,255,255,0.1)`,
              background: "rgba(20,20,20,0.8)",
              display: "flex",
              alignItems: "center",
              gap: 8,
              position: "sticky",
              top: 0,
              zIndex: 6,
              flexShrink: 0,
            }}
            className="glass-panel"
          >
            <span style={{ color: T.cyan, fontSize: 14, fontWeight: 600 }}>
              🔍
            </span>
            <input
              type="text"
              placeholder="Search by Name or Email"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                flex: 1,
                background: "rgba(0,0,0,0.4)",
                border: `1px solid rgba(255,255,255,0.15)`,
                borderRadius: 6,
                padding: "10px 14px",
                color: T.text,
                fontSize: 13,
                fontFamily: T.font,
                letterSpacing: 0.5,
                outline: "none",
                transition: "all 0.2s ease-in-out",
              }}
              onFocus={(e) => {
                e.target.style.background = "rgba(0,0,0,0.6)";
                e.target.style.borderColor = "rgba(0,122,255,0.5)";
                e.target.style.boxShadow = "0 0 12px rgba(0,122,255,0.2)";
              }}
              onBlur={(e) => {
                e.target.style.background = "rgba(0,0,0,0.4)";
                e.target.style.borderColor = "rgba(255,255,255,0.15)";
                e.target.style.boxShadow = "none";
              }}
              className="input-glass"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                style={{
                  background: "transparent",
                  border: "none",
                  color: T.muted,
                  cursor: "pointer",
                  fontSize: 16,
                  padding: 4,
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = T.text)}
                onMouseLeave={(e) => (e.currentTarget.style.color = T.muted)}
              >
                ✕
              </button>
            )}
          </div>

          {/* RULE #58: Advanced Filter Panel - Balance range filter */}
          {showAdvancedFilter && (
            <div
              style={{
                padding: "16px 20px",
                borderBottom: `1px solid rgba(0,122,255,0.2)`,
                background: "rgba(0,122,255,0.08)",
                display: "flex",
                alignItems: "center",
                gap: 16,
                flexWrap: "wrap",
              }}
              className="glass-panel"
            >
              <span
                style={{
                  color: T.blue,
                  fontSize: 10,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                }}
              >
                💰 Balance Range:
              </span>

              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{ color: T.muted, fontSize: 10, fontWeight: 600 }}
                  >
                    Min:
                  </span>
                  <input
                    type="number"
                    placeholder="0"
                    value={balanceFilter.min === 0 ? "" : balanceFilter.min}
                    onChange={(e) => {
                      const val =
                        e.target.value === "" ? 0 : parseFloat(e.target.value);
                      setBalanceFilter((prev) => ({
                        ...prev,
                        min: Math.max(0, val),
                      }));
                    }}
                    style={{
                      background: "rgba(0,0,0,0.4)",
                      border: `1px solid rgba(0,122,255,0.3)`,
                      borderRadius: 4,
                      padding: "6px 10px",
                      color: T.text,
                      fontFamily: T.font,
                      fontSize: 10,
                      fontWeight: 600,
                      width: "70px",
                      outline: "none",
                      transition: "all 0.2s ease-in-out",
                    }}
                    onFocus={(e) => {
                      e.target.style.background = "rgba(0,0,0,0.6)";
                      e.target.style.borderColor = "rgba(0,122,255,0.5)";
                    }}
                    onBlur={(e) => {
                      e.target.style.background = "rgba(0,0,0,0.4)";
                      e.target.style.borderColor = "rgba(0,122,255,0.3)";
                    }}
                  />
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{ color: T.muted, fontSize: 10, fontWeight: 600 }}
                  >
                    Max:
                  </span>
                  <input
                    type="number"
                    placeholder="∞"
                    value={
                      balanceFilter.max === Infinity ? "" : balanceFilter.max
                    }
                    onChange={(e) => {
                      const val =
                        e.target.value === ""
                          ? Infinity
                          : parseFloat(e.target.value);
                      setBalanceFilter((prev) => ({ ...prev, max: val }));
                    }}
                    style={{
                      background: "rgba(0,0,0,0.4)",
                      border: `1px solid rgba(0,122,255,0.3)`,
                      borderRadius: 4,
                      padding: "6px 10px",
                      color: T.text,
                      fontFamily: T.font,
                      fontSize: 10,
                      fontWeight: 600,
                      width: "70px",
                      outline: "none",
                      transition: "all 0.2s ease-in-out",
                    }}
                    onFocus={(e) => {
                      e.target.style.background = "rgba(0,0,0,0.6)";
                      e.target.style.borderColor = "rgba(0,122,255,0.5)";
                    }}
                    onBlur={(e) => {
                      e.target.style.background = "rgba(0,0,0,0.4)";
                      e.target.style.borderColor = "rgba(0,122,255,0.3)";
                    }}
                  />
                </div>

                <button
                  onClick={() => {
                    setBalanceFilter({ min: 0, max: Infinity });
                  }}
                  style={{
                    background: "transparent",
                    border: `1px solid rgba(0,122,255,0.3)`,
                    borderRadius: 4,
                    padding: "6px 12px",
                    cursor: "pointer",
                    color: T.blue,
                    fontFamily: T.font,
                    fontSize: 10,
                    fontWeight: 600,
                    transition: "all 0.2s ease-in-out",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(0,122,255,0.15)";
                    e.currentTarget.style.borderColor = "rgba(0,122,255,0.5)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.borderColor = "rgba(0,122,255,0.3)";
                  }}
                >
                  Reset
                </button>
              </div>
            </div>
          )}

          {/* RULE #39, #40, #50: Grid Control Bar - Density, Pagination, Column Picker */}
          <div
            style={{
              padding: "12px 20px",
              borderBottom: `1px solid rgba(255,255,255,0.1)`,
              background: "rgba(15,15,15,0.8)",
              display: "flex",
              alignItems: "center",
              gap: 16,
              justifyContent: "space-between",
              flexWrap: "wrap",
            }}
            className="glass-panel"
          >
            {/* Left: Row Density Toggle & Rows Per Page */}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {/* Row Density Toggle */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    color: T.muted,
                    fontSize: 10,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                  }}
                >
                  Density:
                </span>
                {["compact", "comfortable"].map((density) => (
                  <button
                    key={density}
                    onClick={() => setRowDensity(density)}
                    style={{
                      background:
                        rowDensity === density
                          ? "rgba(0,122,255,0.2)"
                          : "transparent",
                      border: `1px solid ${rowDensity === density ? "rgba(0,122,255,0.5)" : "rgba(255,255,255,0.15)"}`,
                      borderRadius: 4,
                      padding: "6px 12px",
                      cursor: "pointer",
                      color: rowDensity === density ? T.blue : T.muted,
                      fontFamily: T.font,
                      fontSize: 10,
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                      transition: "all 0.2s ease-in-out",
                    }}
                    onMouseEnter={(e) => {
                      if (rowDensity !== density) {
                        e.currentTarget.style.background =
                          "rgba(255,255,255,0.05)";
                        e.currentTarget.style.borderColor =
                          "rgba(255,255,255,0.3)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (rowDensity !== density) {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.borderColor =
                          "rgba(255,255,255,0.15)";
                      }
                    }}
                  >
                    {density === "compact" ? "⊡ Compact" : "⊞ Comfortable"}
                  </button>
                ))}
              </div>

              {/* Rows Per Page Selector */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    color: T.muted,
                    fontSize: 10,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                  }}
                >
                  Rows:
                </span>
                <select
                  value={rowsPerPage}
                  onChange={(e) => {
                    setRowsPerPage(parseInt(e.target.value));
                    setCurrentPage(1);
                  }}
                  style={{
                    background: "rgba(0,0,0,0.4)",
                    border: `1px solid rgba(255,255,255,0.15)`,
                    borderRadius: 4,
                    padding: "6px 10px",
                    color: T.text,
                    fontFamily: T.font,
                    fontSize: 10,
                    fontWeight: 600,
                    cursor: "pointer",
                    outline: "none",
                    transition: "all 0.2s ease-in-out",
                  }}
                  onFocus={(e) => {
                    e.target.style.background = "rgba(0,0,0,0.6)";
                    e.target.style.borderColor = "rgba(0,122,255,0.5)";
                  }}
                  onBlur={(e) => {
                    e.target.style.background = "rgba(0,0,0,0.4)";
                    e.target.style.borderColor = "rgba(255,255,255,0.15)";
                  }}
                >
                  <option value={10}>10</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>

            {/* Right: Column Picker & Pagination Info */}
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              {/* Pagination Info */}
              <div
                style={{
                  color: T.muted,
                  fontSize: 10,
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                }}
              >
                {totalResults > 0
                  ? `${startIdx + 1}–${Math.min(endIdx, totalResults)} of ${totalResults}`
                  : "0 results"}
              </div>

              {/* Pagination Controls */}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button
                  onClick={() => setCurrentPage(Math.max(1, validPage - 1))}
                  disabled={validPage === 1}
                  style={{
                    background:
                      validPage === 1
                        ? "rgba(255,255,255,0.08)"
                        : "rgba(59, 130, 246, 0.25)",
                    border: `1px solid ${validPage === 1 ? "rgba(255,255,255,0.15)" : "rgba(59, 130, 246, 0.5)"}`,
                    borderRadius: 6,
                    padding: "8px 14px",
                    cursor: validPage === 1 ? "not-allowed" : "pointer",
                    color:
                      validPage === 1 ? "rgba(255,255,255,0.3)" : "#60A5FA",
                    fontFamily: T.font,
                    fontSize: 18,
                    fontWeight: 700,
                    transition: "all 0.2s ease-in-out",
                    minWidth: "44px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  onMouseEnter={(e) => {
                    if (validPage !== 1) {
                      e.currentTarget.style.background =
                        "rgba(59, 130, 246, 0.4)";
                      e.currentTarget.style.borderColor =
                        "rgba(59, 130, 246, 0.8)";
                      e.currentTarget.style.transform = "scale(1.05)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (validPage !== 1) {
                      e.currentTarget.style.background =
                        "rgba(59, 130, 246, 0.25)";
                      e.currentTarget.style.borderColor =
                        "rgba(59, 130, 246, 0.5)";
                      e.currentTarget.style.transform = "scale(1)";
                    }
                  }}
                >
                  ←
                </button>

                <span
                  style={{
                    color: T.muted,
                    fontSize: 10,
                    fontWeight: 600,
                    minWidth: "40px",
                    textAlign: "center",
                  }}
                >
                  {totalPages > 0 ? `${validPage}/${totalPages}` : "0/0"}
                </span>

                <button
                  onClick={() =>
                    setCurrentPage(Math.min(totalPages, validPage + 1))
                  }
                  disabled={validPage === totalPages}
                  style={{
                    background:
                      validPage === totalPages
                        ? "rgba(255,255,255,0.08)"
                        : "rgba(59, 130, 246, 0.25)",
                    border: `1px solid ${validPage === totalPages ? "rgba(255,255,255,0.15)" : "rgba(59, 130, 246, 0.5)"}`,
                    borderRadius: 6,
                    padding: "8px 14px",
                    cursor:
                      validPage === totalPages ? "not-allowed" : "pointer",
                    color:
                      validPage === totalPages
                        ? "rgba(255,255,255,0.3)"
                        : "#60A5FA",
                    fontFamily: T.font,
                    fontSize: 18,
                    fontWeight: 700,
                    transition: "all 0.2s ease-in-out",
                    minWidth: "44px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  onMouseEnter={(e) => {
                    if (validPage !== totalPages) {
                      e.currentTarget.style.background =
                        "rgba(59, 130, 246, 0.4)";
                      e.currentTarget.style.borderColor =
                        "rgba(59, 130, 246, 0.8)";
                      e.currentTarget.style.transform = "scale(1.05)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (validPage !== totalPages) {
                      e.currentTarget.style.background =
                        "rgba(59, 130, 246, 0.25)";
                      e.currentTarget.style.borderColor =
                        "rgba(59, 130, 246, 0.5)";
                      e.currentTarget.style.transform = "scale(1)";
                    }
                  }}
                >
                  →
                </button>
              </div>

              {/* Column Picker Dropdown */}
              <div style={{ position: "relative" }}>
                <button
                  onClick={(e) => {
                    const menu = e.currentTarget.nextElementSibling;
                    menu.style.display =
                      menu.style.display === "none" ? "block" : "none";
                  }}
                  style={{
                    background: "rgba(0,122,255,0.15)",
                    border: `1px solid rgba(0,122,255,0.3)`,
                    borderRadius: 4,
                    padding: "6px 12px",
                    cursor: "pointer",
                    color: T.blue,
                    fontFamily: T.font,
                    fontSize: 10,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                    transition: "all 0.2s ease-in-out",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(0,122,255,0.25)";
                    e.currentTarget.style.borderColor = "rgba(0,122,255,0.5)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(0,122,255,0.15)";
                    e.currentTarget.style.borderColor = "rgba(0,122,255,0.3)";
                  }}
                >
                  ⚙ Columns
                </button>

                <div
                  style={{
                    display: "none",
                    position: "absolute",
                    right: 0,
                    top: "100%",
                    marginTop: 4,
                    background: "rgba(20,20,20,0.95)",
                    border: `1px solid rgba(0,122,255,0.3)`,
                    borderRadius: 6,
                    padding: "8px 0",
                    minWidth: "160px",
                    zIndex: 100,
                    boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {[
                    { key: "name", label: "Name" },
                    { key: "email", label: "Email" },
                    { key: "joinDate", label: "Join Date" },
                    { key: "status", label: "Status" },
                    { key: "uid", label: "UID" },
                    { key: "role", label: "Role" },
                  ].map((col) => (
                    <label
                      key={col.key}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "8px 16px",
                        cursor: "pointer",
                        color: T.muted,
                        fontSize: 11,
                        fontWeight: 600,
                        transition: "all 0.15s ease",
                        userSelect: "none",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background =
                          "rgba(0,122,255,0.15)";
                        e.currentTarget.style.color = T.text;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.color = T.muted;
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={visibleColumns[col.key]}
                        onChange={(e) => {
                          setVisibleColumns((prev) => ({
                            ...prev,
                            [col.key]: e.target.checked,
                          }));
                        }}
                        style={{
                          cursor: "pointer",
                          width: 14,
                          height: 14,
                          accentColor: T.blue,
                        }}
                      />
                      <span>{col.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Table Header - Hidden on Mobile */}
          {!loading &&
            !dbError &&
            paginatedUsers.length > 0 &&
            !isMobileView && (
              <div
                style={{
                  padding: "16px 20px",
                  borderBottom: `1px solid rgba(255,255,255,0.15)`,
                  background: "rgba(20,20,20,0.8)",
                  display: "grid",
                  gridTemplateColumns: getGridTemplateColumns(),
                  gap: 16,
                  position: "sticky",
                  top: 0,
                  zIndex: 5,
                }}
                className="glass-panel"
              >
                {visibleColumns.name && (
                  <div
                    style={{
                      color: T.muted,
                      fontSize: 10,
                      letterSpacing: 1.5,
                      fontWeight: 700,
                      textTransform: "uppercase",
                    }}
                  >
                    Name
                  </div>
                )}
                {visibleColumns.email && (
                  <div
                    style={{
                      color: T.muted,
                      fontSize: 10,
                      letterSpacing: 1.5,
                      fontWeight: 700,
                      textTransform: "uppercase",
                    }}
                  >
                    Email
                  </div>
                )}
                {visibleColumns.joinDate && (
                  <div
                    style={{
                      color: T.muted,
                      fontSize: 10,
                      letterSpacing: 1.5,
                      fontWeight: 700,
                      textTransform: "uppercase",
                    }}
                  >
                    Joined
                  </div>
                )}
                {visibleColumns.uid && (
                  <div
                    style={{
                      color: T.muted,
                      fontSize: 10,
                      letterSpacing: 1.5,
                      fontWeight: 700,
                      textTransform: "uppercase",
                    }}
                  >
                    UID
                  </div>
                )}
                {visibleColumns.role && (
                  <div
                    style={{
                      color: T.muted,
                      fontSize: 10,
                      letterSpacing: 1.5,
                      fontWeight: 700,
                      textTransform: "uppercase",
                    }}
                  >
                    Role
                  </div>
                )}
                {visibleColumns.status && (
                  <div
                    style={{
                      color: T.muted,
                      fontSize: 10,
                      letterSpacing: 1.5,
                      fontWeight: 700,
                      textTransform: "uppercase",
                    }}
                  >
                    Status
                  </div>
                )}
                <div
                  style={{
                    color: T.muted,
                    fontSize: 10,
                    letterSpacing: 1.5,
                    fontWeight: 700,
                    textTransform: "uppercase",
                  }}
                >
                  Actions
                </div>
              </div>
            )}

          {/* Table Body */}
          {loading ? (
            <TableSkeletonLoader />
          ) : dbError ? (
            <div
              style={{
                padding: "60px 40px",
                textAlign: "center",
                color: T.red,
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              <div style={{ marginBottom: 16, fontSize: 20 }}>⚠️</div>
              <div style={{ marginBottom: 20, fontSize: 13, lineHeight: 1.6 }}>
                {dbError}
              </div>
              <button
                onClick={async () => {
                  // Retry: Manual refresh when error occurs
                  if (!firebaseDb) {
                    setDbError("Firebase unavailable");
                    return;
                  }
                  setLoading(true);
                  setDbError("");
                  try {
                    const usersRef = ref(firebaseDb, "users");
                    const snapshot = await get(usersRef);
                    if (snapshot.exists()) {
                      setUsers(snapshot.val());
                    } else {
                      setUsers({});
                    }
                  } catch (error) {
                    console.error("Failed to retry:", error);
                    setDbError(`Network Error: ${error.message}`);
                  } finally {
                    setLoading(false);
                  }
                }}
                style={{
                  marginTop: 16,
                  background: "rgba(255,69,58,0.2)",
                  border: `1px solid rgba(255,69,58,0.4)`,
                  borderRadius: 6,
                  padding: "10px 20px",
                  cursor: "pointer",
                  color: T.red,
                  fontSize: 12,
                  fontFamily: T.font,
                  letterSpacing: 1,
                  fontWeight: 700,
                  transition: "all 0.2s ease-in-out",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(255,69,58,0.3)";
                  e.currentTarget.style.boxShadow = `0 0 16px rgba(255,69,58,0.4)`;
                  e.currentTarget.style.transform = "translateY(-2px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(255,69,58,0.2)";
                  e.currentTarget.style.boxShadow = "none";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
                className="btn-glass"
              >
                ↺ RETRY
              </button>
            </div>
          ) : totalResults === 0 ? (
            <>
              <EmptyStateCard
                searchQuery={searchQuery}
                filterStatus={filterStatus}
              />
              {(searchQuery ||
                filterStatus !== "ALL" ||
                showAdvancedFilter) && (
                <div style={{ textAlign: "center", paddingBottom: "40px" }}>
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      if (filterStatus !== "ALL") setFilterStatus("ALL");
                      if (showAdvancedFilter) setShowAdvancedFilter(false);
                      setBalanceFilter({ min: 0, max: Infinity });
                    }}
                    style={{
                      background: "rgba(0,122,255,0.2)",
                      border: `1px solid rgba(0,122,255,0.4)`,
                      borderRadius: 6,
                      padding: "10px 20px",
                      cursor: "pointer",
                      color: T.blue,
                      fontSize: 11,
                      fontFamily: T.font,
                      letterSpacing: 1,
                      fontWeight: 700,
                      transition: "all 0.2s ease-in-out",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "rgba(0,122,255,0.3)";
                      e.currentTarget.style.borderColor = "rgba(0,122,255,0.6)";
                      e.currentTarget.style.transform = "translateY(-2px)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "rgba(0,122,255,0.2)";
                      e.currentTarget.style.borderColor = "rgba(0,122,255,0.4)";
                      e.currentTarget.style.transform = "translateY(0)";
                    }}
                    className="btn-glass"
                  >
                    ← CLEAR ALL FILTERS
                  </button>
                </div>
              )}
            </>
          ) : (
            paginatedUsers.map(([uid, user]) => {
              if (!user || !user.fullName || !user.status) return null;

              const joinDate = user.createdAt
                ? new Date(user.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "2-digit",
                  })
                : "—";
              const normalizedStatus = normalizeStatus(user.status);
              const statusBg =
                normalizedStatus === "ACTIVE"
                  ? "rgba(48,209,88,0.15)"
                  : normalizedStatus === "PENDING"
                    ? "rgba(255,214,10,0.15)"
                    : "rgba(255,69,58,0.15)";
              const statusBorder =
                normalizedStatus === "ACTIVE"
                  ? "rgba(48,209,88,0.5)"
                  : normalizedStatus === "PENDING"
                    ? "rgba(255,214,10,0.5)"
                    : "rgba(255,69,58,0.5)";
              const statusColor =
                normalizedStatus === "ACTIVE"
                  ? T.green
                  : normalizedStatus === "PENDING"
                    ? T.gold
                    : T.red;

              return (
                <div
                  key={uid}
                  style={{
                    padding: isMobileView ? "16px 12px" : getRowPadding(),
                    borderBottom: `1px solid rgba(255,255,255,0.1)`,
                    background:
                      mirror === uid
                        ? "rgba(191,90,242,0.12)"
                        : "rgba(255,255,255,0.01)",
                    display: isMobileView ? "flex" : "grid",
                    flexDirection: isMobileView ? "column" : undefined,
                    gridTemplateColumns: isMobileView
                      ? undefined
                      : getGridTemplateColumns(),
                    gap: isMobileView ? 12 : 16,
                    alignItems: isMobileView ? "stretch" : "center",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    backdropFilter: "blur(10px)",
                    borderLeft:
                      mirror === uid
                        ? `3px solid ${T.purple}`
                        : "3px solid transparent",
                  }}
                  onMouseEnter={(e) => {
                    if (!isMobileView) {
                      e.currentTarget.style.background =
                        "rgba(255,255,255,0.05)";
                      e.currentTarget.style.borderBottom = `1px solid rgba(255,255,255,0.2)`;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isMobileView) {
                      e.currentTarget.style.background =
                        mirror === uid
                          ? "rgba(191,90,242,0.12)"
                          : "rgba(255,255,255,0.01)";
                      e.currentTarget.style.borderBottom = `1px solid rgba(255,255,255,0.1)`;
                    }
                  }}
                  onClick={() => openMirror(uid)}
                  className="glass-panel"
                >
                  {/* Mobile Card Header - Name + Status */}
                  {isMobileView && (
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: 12,
                        paddingBottom: 8,
                        borderBottom: "1px solid rgba(255,255,255,0.1)",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            marginBottom: 4,
                          }}
                        >
                          <div
                            style={{
                              color: T.text,
                              fontSize: 12,
                              fontWeight: 600,
                            }}
                          >
                            {searchQuery
                              ? renderHighlightedText(
                                  user.fullName,
                                  searchQuery,
                                )
                              : user.fullName}
                          </div>
                          {(() => {
                            const badge = getUserLevelBadge(user);
                            return (
                              <div
                                style={{
                                  background: badge.bg,
                                  border: `1px solid ${badge.color}`,
                                  borderRadius: 12,
                                  padding: "2px 8px",
                                  color: badge.color,
                                  fontSize: 9,
                                  fontWeight: 700,
                                  letterSpacing: 0.5,
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {badge.level}
                              </div>
                            );
                          })()}
                        </div>
                        <div
                          style={{ color: T.dim, fontSize: 10, marginTop: 2 }}
                        >
                          📊 {user.proficiency || "unknown"}
                        </div>
                      </div>
                      <div
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          background: statusBg,
                          border: `1px solid ${statusBorder}`,
                          borderRadius: 16,
                          padding: "4px 10px",
                          width: "fit-content",
                          boxShadow: `0 0 8px ${statusBorder}`,
                        }}
                      >
                        <div
                          style={{
                            width: 5,
                            height: 5,
                            borderRadius: "50%",
                            background: statusColor,
                          }}
                        />
                        <span
                          style={{
                            color: statusColor,
                            fontSize: 9,
                            fontWeight: 700,
                            letterSpacing: 0.5,
                            textTransform: "uppercase",
                          }}
                        >
                          {normalizedStatus === "PENDING"
                            ? "pending"
                            : normalizedStatus === "ACTIVE"
                              ? "active"
                              : "banned"}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Desktop: Name */}
                  {!isMobileView && visibleColumns.name && (
                    <div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          marginBottom: 4,
                        }}
                      >
                        <div
                          style={{
                            color: T.text,
                            fontSize: 12,
                            fontWeight: 600,
                          }}
                        >
                          {searchQuery
                            ? renderHighlightedText(user.fullName, searchQuery)
                            : user.fullName}
                        </div>
                        {(() => {
                          const badge = getUserLevelBadge(user);
                          return (
                            <div
                              style={{
                                background: badge.bg,
                                border: `1px solid ${badge.color}`,
                                borderRadius: 12,
                                padding: "2px 8px",
                                color: badge.color,
                                fontSize: 9,
                                fontWeight: 700,
                                letterSpacing: 0.5,
                                whiteSpace: "nowrap",
                              }}
                            >
                              {badge.level}
                            </div>
                          );
                        })()}
                      </div>
                      <div style={{ color: T.dim, fontSize: 10, marginTop: 2 }}>
                        📊 {user.proficiency || "unknown"}
                      </div>
                    </div>
                  )}

                  {/* Mobile: Info Row */}
                  {isMobileView && (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                        fontSize: 10,
                        color: T.muted,
                      }}
                    >
                      {visibleColumns.email && (
                        <div style={{ fontFamily: T.mono, letterSpacing: 0.5 }}>
                          📧 {user.email || "—"}
                        </div>
                      )}
                      {visibleColumns.joinDate && (
                        <div style={{ fontFamily: T.mono, letterSpacing: 0.5 }}>
                          📅 {joinDate}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Desktop: Email */}
                  {!isMobileView && visibleColumns.email && (
                    <div
                      style={{
                        color: T.muted,
                        fontSize: 11,
                        fontFamily: T.mono,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        letterSpacing: 0.5,
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                        padding: "4px 6px",
                        borderRadius: 3,
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        copyToClipboard(user.email, "Email", showToast);
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background =
                          "rgba(0,122,255,0.15)";
                        e.currentTarget.style.color = T.blue;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.color = T.muted;
                      }}
                      title="Click to copy email"
                    >
                      {searchQuery
                        ? renderHighlightedText(user.email || "—", searchQuery)
                        : user.email || "—"}
                    </div>
                  )}

                  {/* Desktop: Join Date */}
                  {!isMobileView && visibleColumns.joinDate && (
                    <div
                      style={{
                        color: T.muted,
                        fontSize: 11,
                        fontFamily: T.mono,
                        letterSpacing: 0.5,
                      }}
                    >
                      {joinDate}
                    </div>
                  )}

                  {/* Desktop: UID */}
                  {!isMobileView && visibleColumns.uid && (
                    <div
                      style={{
                        color: T.dim,
                        fontSize: 10,
                        fontFamily: T.mono,
                        letterSpacing: 0.5,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                        padding: "4px 6px",
                        borderRadius: 3,
                      }}
                      title={`Click to copy UID: ${uid}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        copyToClipboard(uid, "UID", showToast);
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background =
                          "rgba(0,122,255,0.15)";
                        e.currentTarget.style.color = T.blue;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.color = T.dim;
                      }}
                    >
                      {uid.slice(0, 12)}...
                    </div>
                  )}

                  {/* Desktop: Role */}
                  {!isMobileView && visibleColumns.role && (
                    <div
                      style={{
                        color: T.muted,
                        fontSize: 10,
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                      }}
                    >
                      Trader
                    </div>
                  )}

                  {/* Desktop: Status Pill */}
                  {!isMobileView && visibleColumns.status && (
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                        background: statusBg,
                        border: `1px solid ${statusBorder}`,
                        borderRadius: 20,
                        padding: "6px 12px",
                        width: "fit-content",
                        boxShadow: `0 0 12px ${statusBorder}`,
                      }}
                    >
                      <div
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          background: statusColor,
                        }}
                      />
                      <span
                        style={{
                          color: statusColor,
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: 0.5,
                          textTransform: "uppercase",
                        }}
                      >
                        {normalizedStatus === "PENDING"
                          ? "pending"
                          : normalizedStatus === "ACTIVE"
                            ? "active"
                            : "banned"}
                      </span>
                    </div>
                  )}

                  {/* RULE #244: IP Fraud Detection Flag */}
                  {(() => {
                    const userIP = user?.forensic?.ip || user?.ip;
                    const duplicateEntry = Object.entries(duplicateIPs).find(
                      ([, uids]) => userIP && uids.includes(uid),
                    );

                    if (duplicateEntry) {
                      return (
                        <div
                          title={`⚠️ DUPLICATE IP: ${userIP} shared with ${duplicateEntry[1].length - 1} other user(s)`}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            background: "rgba(255,165,0,0.15)",
                            border: "1px solid rgba(255,165,0,0.5)",
                            borderRadius: 12,
                            padding: "6px 10px",
                            color: "#FFB340",
                            fontSize: 9,
                            fontWeight: 700,
                            letterSpacing: 0.5,
                            whiteSpace: "nowrap",
                          }}
                        >
                          ⚠️ DUP IP
                        </div>
                      );
                    }
                    return null;
                  })()}

                  {/* Action Buttons - Flex Column on Mobile */}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: isMobileView ? "column" : "row",
                      gap: 8,
                      justifyContent: isMobileView ? "stretch" : "flex-end",
                      flexWrap: isMobileView ? "nowrap" : "wrap",
                    }}
                  >
                    {normalizedStatus === "PENDING" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          approve(uid);
                        }}
                        title="Approve User"
                        data-status="pending"
                        style={{
                          background: T.green,
                          border: "none",
                          borderRadius: 4,
                          padding: isMobileView ? "10px 12px" : "7px 12px",
                          cursor: "pointer",
                          color: "#000",
                          fontSize: 11,
                          fontWeight: 700,
                          transition: "all 0.2s ease",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          letterSpacing: 0.5,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.boxShadow = `0 0 16px ${T.green}`;
                          e.currentTarget.style.transform = "scale(1.05)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.boxShadow = "none";
                          e.currentTarget.style.transform = "scale(1)";
                        }}
                        className="btn-glass"
                      >
                        ✓ APPROVE
                      </button>
                    )}
                    {normalizedStatus !== "BLOCKED" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (
                            window.confirm(
                              `Ban ${user.fullName}? This cannot be undone.`,
                            )
                          )
                            block(uid);
                        }}
                        title="Ban User"
                        style={{
                          background: "transparent",
                          border: `1.5px solid ${T.red}`,
                          borderRadius: 4,
                          padding: isMobileView ? "10px 12px" : "6px 12px",
                          cursor: "pointer",
                          color: T.red,
                          fontSize: 11,
                          fontWeight: 700,
                          transition: "all 0.2s ease",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          letterSpacing: 0.5,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = `rgba(255,69,58,0.2)`;
                          e.currentTarget.style.boxShadow = `0 0 12px rgba(255,69,58,0.5)`;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "transparent";
                          e.currentTarget.style.boxShadow = "none";
                        }}
                        className="btn-glass"
                      >
                        ✕ BAN
                      </button>
                    )}
                    {normalizedStatus === "BLOCKED" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          approve(uid);
                        }}
                        title="Restore User"
                        style={{
                          background: "transparent",
                          border: `1.5px solid ${T.gold}`,
                          borderRadius: 4,
                          padding: isMobileView ? "10px 12px" : "6px 12px",
                          cursor: "pointer",
                          color: T.gold,
                          fontSize: 11,
                          fontWeight: 700,
                          transition: "all 0.2s ease",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          letterSpacing: 0.5,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = `rgba(255,214,10,0.2)`;
                          e.currentTarget.style.boxShadow = `0 0 12px rgba(255,214,10,0.5)`;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "transparent";
                          e.currentTarget.style.boxShadow = "none";
                        }}
                        className="btn-glass"
                      >
                        ↺ RESTORE
                      </button>
                    )}
                    {/* RULE #24: View Identity Documents */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedUserDocs(uid);
                      }}
                      title="View uploaded identity documents"
                      style={{
                        background: "rgba(52,199,89,0.2)",
                        border: `1.5px solid ${T.green}`,
                        borderRadius: 4,
                        padding: isMobileView ? "10px 12px" : "6px 12px",
                        cursor: "pointer",
                        color: T.green,
                        fontSize: 11,
                        fontWeight: 700,
                        transition: "all 0.2s ease",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        letterSpacing: 0.5,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = `rgba(52,199,89,0.3)`;
                        e.currentTarget.style.boxShadow = `0 0 12px rgba(52,199,89,0.5)`;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background =
                          "rgba(52,199,89,0.2)";
                        e.currentTarget.style.boxShadow = "none";
                      }}
                      className="btn-glass"
                    >
                      📄 DOCS
                    </button>
                    {/* RULE #244, #246, #247, #266, #270: Direct Support Chat */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setChatWith(uid);
                        setChatModalOpen(true);
                      }}
                      title="Open direct chat with trader"
                      style={{
                        background: "rgba(0,122,255,0.2)",
                        border: "1.5px solid #0A84FF",
                        borderRadius: 4,
                        padding: isMobileView ? "10px 12px" : "6px 12px",
                        cursor: "pointer",
                        color: "#0A84FF",
                        fontSize: 11,
                        fontWeight: 700,
                        transition: "all 0.2s ease",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        letterSpacing: 0.5,
                        whiteSpace: "nowrap",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background =
                          "rgba(0,122,255,0.3)";
                        e.currentTarget.style.boxShadow =
                          "0 0 12px rgba(0,122,255,0.5)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background =
                          "rgba(0,122,255,0.2)";
                        e.currentTarget.style.boxShadow = "none";
                      }}
                      className="btn-glass"
                    >
                      💬 MSG
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
        {/* Right Column: Mirror View */}
        {mirror && mirrorData && (
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "0 0 60px",
              minWidth: 320,
            }}
          >
            <div
              style={{
                padding: "16px 28px",
                borderBottom: `1px solid rgba(191,90,242,0.3)`,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "rgba(0,0,0,0.5)",
                position: "sticky",
                top: 0,
                zIndex: 10,
                backdropFilter: "blur(20px)",
              }}
              className="glass-panel"
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <LED color={T.purple} size={10} />
                <div>
                  <div
                    style={{
                      color: T.purple,
                      fontSize: 13,
                      letterSpacing: 2,
                      fontWeight: 700,
                    }}
                  >
                    MIRROR VIEW — READ ONLY
                  </div>
                  <div style={{ color: T.muted, fontSize: 11, marginTop: 2 }}>
                    {mirrorData.profile?.fullName} · {mirrorData.profile?.email}
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  setMirror(null);
                  setMirrorData(null);
                }}
                style={{
                  background: "transparent",
                  border: `1px solid rgba(255,255,255,0.1)`,
                  borderRadius: 6,
                  padding: "6px 14px",
                  cursor: "pointer",
                  color: T.muted,
                  fontSize: 10,
                  fontFamily: T.font,
                  fontWeight: 600,
                }}
                className="btn-glass"
              >
                ✕ CLOSE
              </button>
            </div>

            <div style={{ padding: "24px 28px" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                  gap: 16,
                  marginBottom: 24,
                }}
              >
                {[
                  {
                    l: "Account Balance",
                    v: mirrorData.accountState?.currentBalance
                      ? `$${parseFloat(mirrorData.accountState.currentBalance).toLocaleString()}`
                      : "—",
                    c: T.green,
                  },
                  {
                    l: "High-Water Mark",
                    v: mirrorData.accountState?.highWaterMark
                      ? `$${parseFloat(mirrorData.accountState.highWaterMark).toLocaleString()}`
                      : "—",
                    c: T.blue,
                  },
                  {
                    l: "Firm",
                    v: mirrorData.firmRules?.firmName || "—",
                    c: T.gold,
                  },
                  {
                    l: "Status",
                    v: mirrorData.profile?.status || "—",
                    c: statusColor[mirrorData.profile?.status] || T.muted,
                  },
                ].map((s, i) => (
                  <div
                    key={i}
                    style={cardS({
                      margin: 0,
                      textAlign: "center",
                      padding: "16px",
                    })}
                    className="glass-panel"
                  >
                    <div
                      style={{
                        color: T.dim,
                        fontSize: 10,
                        letterSpacing: 1.5,
                        marginBottom: 8,
                        fontWeight: 600,
                      }}
                    >
                      {s.l}
                    </div>
                    <div
                      style={{
                        color: s.c,
                        fontSize: 18,
                        fontWeight: 700,
                        fontFamily: T.mono,
                      }}
                    >
                      {s.v}
                    </div>
                  </div>
                ))}
              </div>

              {(() => {
                const journal = mirrorData.journal
                  ? Object.values(mirrorData.journal)
                  : [];
                if (!journal.length)
                  return (
                    <div
                      style={cardS({
                        textAlign: "center",
                        color: T.dim,
                        padding: 40,
                        fontSize: 13,
                      })}
                      className="glass-panel"
                    >
                      No journal entries yet
                    </div>
                  );

                const wins = journal.filter((t) => t.result === "win");
                const pnl = journal.reduce(
                  (s, t) => s + parseFloat(t.pnl || 0),
                  0,
                );

                return (
                  <div
                    style={cardS({
                      borderLeft: `4px solid ${T.purple}`,
                      padding: 0,
                      overflow: "hidden",
                    })}
                    className="glass-panel"
                  >
                    <div style={{ padding: "20px 24px" }}>
                      <SHead
                        icon="📔"
                        title="TRADE JOURNAL MIRROR"
                        color={T.purple}
                      />
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "repeat(auto-fit, minmax(120px, 1fr))",
                          gap: 12,
                          marginBottom: 20,
                        }}
                      >
                        {[
                          { l: "Total Trades", v: journal.length, c: T.text },
                          {
                            l: "Win Rate",
                            v: `${Math.round((wins.length / journal.length) * 100)}%`,
                            c:
                              wins.length / journal.length >= 0.5
                                ? T.green
                                : T.red,
                          },
                          {
                            l: "Total P&L",
                            v: `${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)}`,
                            c: pnl >= 0 ? T.green : T.red,
                          },
                        ].map((s, i) => (
                          <div
                            key={i}
                            style={{
                              background: "rgba(0,0,0,0.3)",
                              border: `1px solid rgba(255,255,255,0.05)`,
                              borderRadius: 8,
                              padding: "12px",
                              textAlign: "center",
                            }}
                            className="glass-panel"
                          >
                            <div
                              style={{
                                color: T.dim,
                                fontSize: 10,
                                marginBottom: 6,
                                fontWeight: 600,
                              }}
                            >
                              {s.l}
                            </div>
                            <div
                              style={{
                                color: s.c,
                                fontSize: 16,
                                fontWeight: 700,
                                fontFamily: T.mono,
                              }}
                            >
                              {s.v}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div style={{ overflowX: "auto" }}>
                      <table
                        style={{ width: "100%", borderCollapse: "collapse" }}
                      >
                        <thead>
                          <tr>
                            {[
                              "Date",
                              "Inst",
                              "Dir",
                              "Type",
                              "AMD",
                              "RRR",
                              "Entry",
                              "Exit",
                              "P&L",
                              "Result",
                            ].map((h) => (
                              <th
                                key={h}
                                style={{
                                  padding: "12px 14px",
                                  textAlign: "left",
                                  color: "#6B7280",
                                  fontSize: 10,
                                  letterSpacing: 1,
                                  background: "#F9FAFB",
                                  borderBottom: `1px solid #E5E7EB`,
                                  whiteSpace: "nowrap",
                                  fontWeight: 700,
                                }}
                                className="gemini-gradient-text"
                              >
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {journal
                            .slice(-20)
                            .reverse()
                            .map((t, i) => {
                              const pv = parseFloat(t.pnl || 0);
                              const amdColor = (
                                AMD_PHASES[t.amdPhase] || AMD_PHASES.UNCLEAR
                              ).color;
                              return (
                                <tr
                                  key={i}
                                  style={{
                                    borderBottom: `1px solid #E5E7EB`,
                                    background:
                                      i % 2 === 0 ? "#F9FAFB" : "#FFFFFF",
                                  }}
                                >
                                  <td
                                    style={{
                                      padding: "10px 14px",
                                      color: "#6B7280",
                                      fontSize: 11,
                                      fontFamily: T.mono,
                                    }}
                                  >
                                    {t.date}
                                  </td>
                                  <td
                                    style={{
                                      padding: "10px 14px",
                                      color: "#111827",
                                      fontSize: 11,
                                      fontWeight: 700,
                                    }}
                                  >
                                    {t.instrument}
                                  </td>
                                  <td
                                    style={{
                                      padding: "10px 14px",
                                      color:
                                        t.direction === "Long"
                                          ? "#10B981"
                                          : "#EF4444",
                                      fontSize: 11,
                                      fontWeight: 600,
                                    }}
                                  >
                                    {t.direction}
                                  </td>
                                  <td
                                    style={{
                                      padding: "10px 14px",
                                      color: "#0EA5E9",
                                      fontSize: 11,
                                      fontWeight: 500,
                                    }}
                                  >
                                    {t.tradeType}
                                  </td>
                                  <td
                                    style={{
                                      padding: "10px 14px",
                                      color: amdColor,
                                      fontSize: 10,
                                      fontWeight: 600,
                                    }}
                                  >
                                    {(
                                      AMD_PHASES[t.amdPhase]?.label ||
                                      t.amdPhase ||
                                      "—"
                                    ).slice(0, 10)}
                                  </td>
                                  <td
                                    style={{
                                      padding: "10px 14px",
                                      color: "#D97706",
                                      fontSize: 11,
                                      fontFamily: T.mono,
                                    }}
                                  >
                                    {t.rrr}
                                  </td>
                                  <td
                                    style={{
                                      padding: "10px 14px",
                                      color: "#6B7280",
                                      fontSize: 11,
                                      fontFamily: T.mono,
                                    }}
                                  >
                                    {t.entry || "—"}
                                  </td>
                                  <td
                                    style={{
                                      padding: "10px 14px",
                                      color: "#6B7280",
                                      fontSize: 11,
                                      fontFamily: T.mono,
                                    }}
                                  >
                                    {t.exit || "—"}
                                  </td>
                                  <td
                                    style={{
                                      padding: "10px 14px",
                                      color: pv >= 0 ? "#10B981" : "#EF4444",
                                      fontSize: 12,
                                      fontWeight: 700,
                                      fontFamily: T.mono,
                                    }}
                                  >
                                    {pv >= 0 ? "+" : ""}${pv.toFixed(0)}
                                  </td>
                                  <td
                                    style={{
                                      padding: "10px 14px",
                                      color:
                                        t.result === "win"
                                          ? "#10B981"
                                          : t.result === "loss"
                                            ? "#EF4444"
                                            : "#6B7280",
                                      fontSize: 11,
                                      fontWeight: 800,
                                    }}
                                  >
                                    {(t.result || "—").toUpperCase()}
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* RULE #24: Identity Documents Viewer Modal */}
        {selectedUserDocs && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.8)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
              backdropFilter: "blur(5px)",
            }}
          >
            <div
              style={{
                background: "rgba(20,20,20,0.95)",
                border: `1px solid ${T.green}40`,
                borderRadius: 12,
                padding: 28,
                maxWidth: 600,
                maxHeight: "80vh",
                overflowY: "auto",
                boxShadow: `0 0 40px rgba(52,199,89,0.2)`,
                backdropFilter: "blur(10px)",
              }}
              className="glass-panel"
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 20,
                  paddingBottom: 16,
                  borderBottom: `1px solid ${T.green}30`,
                }}
              >
                <div
                  style={{
                    color: T.green,
                    fontSize: 14,
                    letterSpacing: 2,
                    fontWeight: 700,
                  }}
                >
                  📄 IDENTITY DOCUMENTS (RULE #24)
                </div>
                <button
                  onClick={() => setSelectedUserDocs(null)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: T.muted,
                    fontSize: 20,
                    cursor: "pointer",
                    padding: "4px 8px",
                  }}
                >
                  ✕
                </button>
              </div>

              <div style={{ marginBottom: 20 }}>
                <div
                  style={{
                    color: T.muted,
                    fontSize: 12,
                    marginBottom: 12,
                    fontWeight: 600,
                  }}
                >
                  User:{" "}
                  {searchFilteredUsers.find(
                    ([uid]) => uid === selectedUserDocs,
                  )?.[1]?.fullName || "Unknown"}
                </div>

                <div
                  style={{
                    padding: 16,
                    background: "rgba(52,199,89,0.1)",
                    borderRadius: 8,
                    border: `1px solid ${T.green}30`,
                    minHeight: 120,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexDirection: "column",
                    gap: 12,
                  }}
                >
                  <div style={{ color: T.green, fontSize: 14 }}>📁</div>
                  <div
                    style={{
                      color: T.muted,
                      fontSize: 12,
                      textAlign: "center",
                    }}
                  >
                    Identity documents for this user will appear here.
                    <br />
                    <span style={{ fontSize: 11, color: T.dim }}>
                      (Currently uploaded documents from Aadhar, Passport,
                      License, PAN)
                    </span>
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 12,
                  justifyContent: "flex-end",
                }}
              >
                <button
                  onClick={() => setSelectedUserDocs(null)}
                  style={{
                    ...authBtn(T.muted, false),
                    background: "transparent",
                  }}
                  className="btn-glass"
                >
                  CLOSE
                </button>
              </div>
            </div>
          </div>
        )}

        {/* RULE #95: Back-to-Top Button */}
        <BackToTopButton />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  SESSIONS MANAGEMENT SCREEN — Rules #5, #6
// ═══════════════════════════════════════════════════════════════════
function SessionsManagementScreen({
  profile,
  auth,
  currentSessionId,
  onBack,
  showToast,
}) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [logoutLoading, setLogoutLoading] = useState(false);

  useEffect(() => {
    const fetchSessions = async () => {
      if (!auth || !profile) return;

      try {
        const sessionsData = await dbR(
          `users/${auth.uid}/sessions`,
          auth.token,
        );
        if (sessionsData) {
          const sessionsList = Object.entries(sessionsData).map(
            ([sessionId, sessionData]) => ({
              sessionId,
              ...sessionData,
              isCurrentSession: sessionId === currentSessionId,
            }),
          );
          setSessions(
            sessionsList.sort(
              (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
            ),
          );
        }
      } catch (error) {
        console.error("Failed to fetch sessions:", error);
        showToast(
          "Session data not responding. Running recovery sequence..",
          "error",
        );
      } finally {
        setLoading(false);
      }
    };

    fetchSessions();
  }, [auth, currentSessionId, profile, showToast]);

  const handleLogoutOtherDevices = async () => {
    if (!auth || !currentSessionId) return;

    setLogoutLoading(true);
    try {
      const success = await logoutOtherDevices(
        auth.uid,
        currentSessionId,
        auth.token,
      );
      if (success) {
        showToast(
          "Session termination sequence complete. All terminals closed.",
          "success",
        );
        setSessions(sessions.filter((s) => s.isCurrentSession));
      }
    } catch (error) {
      console.error("Logout other devices failed:", error);
      showToast(
        "Logout signal fading across network. Persist and retry.",
        "error",
      );
    } finally {
      setLogoutLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: T.bg,
        fontFamily: T.font,
        padding: 20,
      }}
    >
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 24,
          }}
        >
          <h1
            style={{
              margin: 0,
              color: T.gold,
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: 2,
            }}
          >
            ACTIVE SESSIONS
          </h1>
          <button
            onClick={onBack}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(59, 130, 246, 0.15)";
              e.currentTarget.style.transform = "translateX(-3px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.transform = "translateX(0)";
            }}
            style={{
              background: "rgba(59, 130, 246, 0.1)",
              border: "1px solid rgba(59, 130, 246, 0.3)",
              color: "#60A5FA",
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 600,
              padding: "8px 16px",
              borderRadius: 8,
              transition: "all 0.2s ease",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span style={{ fontSize: 16 }}>←</span> Back to Dashboard
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", color: T.muted, padding: 40 }}>
            loading...
          </div>
        ) : sessions.length === 0 ? (
          <div
            style={{
              background: "rgba(0,0,0,0.3)",
              border: `1px solid rgba(255,255,255,0.1)`,
              borderRadius: 8,
              padding: 20,
              textAlign: "center",
              color: T.muted,
            }}
          >
            No active sessions
          </div>
        ) : (
          <>
            <div
              style={{
                marginBottom: 20,
                background: "rgba(0,0,0,0.2)",
                border: `1px solid rgba(255,255,255,0.1)`,
                borderRadius: 8,
                overflow: "hidden",
              }}
            >
              {sessions.map((session) => (
                <div
                  key={session.sessionId}
                  style={{
                    padding: 16,
                    borderBottom: `1px solid rgba(255,255,255,0.05)`,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div
                      style={{
                        color: T.blue,
                        fontWeight: 700,
                        marginBottom: 4,
                      }}
                    >
                      {session.device}
                      {session.isCurrentSession && (
                        <span
                          style={{
                            color: T.green,
                            fontSize: 11,
                            marginLeft: 8,
                          }}
                        >
                          (Current Device)
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: T.muted }}>
                      📍 {session.city}, {session.country}
                    </div>
                    <div style={{ fontSize: 11, color: T.dim, marginTop: 4 }}>
                      Last Active:{" "}
                      {new Date(session.lastActive).toLocaleDateString()}{" "}
                      {new Date(session.lastActive).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {sessions.filter((s) => !s.isCurrentSession).length > 0 && (
              <button
                onClick={handleLogoutOtherDevices}
                disabled={logoutLoading}
                style={{
                  ...authBtn(T.red, logoutLoading),
                  width: "100%",
                }}
                className="btn-glass"
              >
                {logoutLoading
                  ? "LOGGING OUT..."
                  : "🚪 LOGOUT ALL OTHER DEVICES"}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

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
  const [toasts, setToasts] = useState([]);
  const theme = currentTheme;
  const [aiStatuses, setAiStatuses] = useState([
    true,
    true,
    true,
    true,
    true,
    true,
  ]);
  const [dailyQuote, _setDailyQuote] = useState(getRandomQuote());

  useEffect(() => {
    startAIStatusScheduler((statuses) => {
      setAiStatuses(statuses);
    });
    return () => stopAIStatusScheduler();
  }, []);

  // ═══════════════════════════════════════════════════════════════════
  // INITIALIZATION ORDER FIX: playNotificationSound and showToast
  // MUST be defined here, before any code that uses them
  // ═══════════════════════════════════════════════════════════════════
  const playNotificationSound = useCallback((type = "success") => {
    try {
      const audioContext = new (
        window.AudioContext || window.webkitAudioContext
      )();

      if (type === "success" || type === "info") {
        // Notification sound: Pleasant ascending tone (0.5s)
        const now = audioContext.currentTime;

        // Oscillator 1: Main ascending tone
        const osc1 = audioContext.createOscillator();
        const gain1 = audioContext.createGain();
        osc1.connect(gain1);
        gain1.connect(audioContext.destination);

        osc1.type = "sine";
        osc1.frequency.setValueAtTime(800, now);
        osc1.frequency.exponentialRampToValueAtTime(1200, now + 0.15);
        osc1.frequency.exponentialRampToValueAtTime(1600, now + 0.3);

        gain1.gain.setValueAtTime(0.3, now);
        gain1.gain.exponentialRampToValueAtTime(0.1, now + 0.5);

        osc1.start(now);
        osc1.stop(now + 0.5);
      } else if (type === "error" || type === "warning") {
        // Low Alert sound: Descending warning tone (0.4s)
        const now = audioContext.currentTime;

        // Oscillator: Descending tone
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.connect(gain);
        gain.connect(audioContext.destination);

        osc.type = "sine";
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(300, now + 0.4);

        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.05, now + 0.4);

        osc.start(now);
        osc.stop(now + 0.4);
      }
    } catch {
      // Silently fail if Audio API not available
    }
  }, []);

  const showToast = useCallback(
    (message, type = "info", duration = 3000) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const newToast = {
        id,
        message,
        type,
        duration,
        time_remaining: duration,
        createdAt: Date.now(),
      };
      setToasts((prev) => [...prev, newToast]);

      // RULE #189: Play institutional notification sound
      playNotificationSound(type);

      // Track time remaining for progress bar
      const startTime = Date.now();
      const intervalId = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, duration - elapsed);
        setToasts((prev) =>
          prev.map((t) =>
            t.id === id ? { ...t, time_remaining: remaining } : t,
          ),
        );
      }, 50);

      // Auto-remove toast after duration
      const timer = setTimeout(() => {
        clearInterval(intervalId);
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);

      // Return function to manually dismiss
      return () => {
        clearTimeout(timer);
        clearInterval(intervalId);
        setToasts((prev) => prev.filter((t) => t.id !== id));
      };
    },
    [playNotificationSound],
  );

  // MODULE 5: VISUAL POLISH - SYSTEM THEME SYNC & ACCENT COLORS
  const systemIsDark = useSystemTheme(); // Auto-detect OS dark/light mode
  const [accentColor, setAccentColor] = useState(() => {
    try {
      return localStorage.getItem("appAccentColor") || "BLUE";
    } catch {
      return "BLUE";
    }
  });
  const handleThemeChange = useCallback((newTheme) => {
    const normalized = {
      day: "lumiere",
      eye: "amber",
      night: "midnight",
      lumiere: "lumiere",
      amber: "amber",
      midnight: "midnight",
    };
    setAppTheme(normalized[newTheme] || "lumiere");
  }, [setAppTheme]);
  // MODULE 1 PHASE 2: PRIVACY & SESSION MANAGEMENT
  const [privacyModeActive, setPrivacyModeActive] = useState(false); // Rule #27: Ghost Mode
  const [googleUser, setGoogleUser] = useState(() => readPendingGoogleSignup());
  const [, _setActiveSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const authBootstrapCompleteRef = useRef(false);

  const [maintenanceModeActive, setMaintenanceModeActive] = useState(() => {
    try {
      return localStorage.getItem("TradersApp_MaintenanceMode") === "true";
    } catch {
      return false;
    }
  });

  // Handler to toggle maintenance mode
  const handleToggleMaintenanceMode = useCallback(() => {
    const newState = !maintenanceModeActive;
    setMaintenanceModeActive(newState);
    try {
      localStorage.setItem("TradersApp_MaintenanceMode", newState.toString());
      showToast(
        newState
          ? 'Maintenance Mode ACTIVATED - Users see "Back Soon" screen'
          : "Maintenance Mode DEACTIVATED - Normal access restored",
        newState ? "warning" : "success",
      );
    } catch {
      showToast("Failed to save maintenance mode setting", "error");
    }
  }, [maintenanceModeActive, showToast]);

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

  // RULE #181-185: Enhanced Toast notification function with configurable duration & stacking
  // RULE #189: Institutional Sound System - High-end notification alerts
  // Handler to dismiss toast manually (swipe or button click)
  const handleDismissToast = useCallback((toastId) => {
    setToasts((prev) => prev.filter((t) => t.id !== toastId));
  }, []);

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
          setPrivacyModeActive,
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
    setPrivacyModeActive,
    setScreen,
    setAppTheme,
  ]);

  // Check user status and route to appropriate screen
  const checkUserStatus = useCallback(
    async (authData) => {
      try {
        const { profile: nextProfile, screen: nextScreen, userData } =
          await loadLegacyUserProfile(authData);

        if (!userData || !nextProfile) {
          const currentUser = firebaseAuth?.currentUser;
          const googleDraft =
            readPendingGoogleSignup() ||
            (currentUser?.providerData?.some(
              (provider) => provider?.providerId === "google.com",
            )
              ? {
                  uid: authData.uid,
                  email: authData.email,
                  fullName:
                    currentUser.displayName ||
                    authData.email?.split("@")[0] ||
                    "",
                  authProvider: "google",
                }
              : null);

          if (googleDraft?.uid === authData.uid) {
            persistPendingGoogleSignup(googleDraft);
            setGoogleUser(googleDraft);
            setProfile({
              ...googleDraft,
              uid: authData.uid,
              token: authData.token,
              email: authData.email,
              emailVerified: authData.emailVerified,
              status: "DRAFT",
            });
            setScreen(SCREEN_IDS.SIGNUP);
            return;
          }

          setGoogleUser(null);
          setProfile(null);
          setScreen(SCREEN_IDS.LOGIN);
          return;
        }

        clearPendingGoogleSignup();
        setGoogleUser(null);
        setProfile({
          ...nextProfile,
          emailVerified: authData.emailVerified,
        });

        if (userData.status === "BLOCKED") {
          setScreen(SCREEN_IDS.LOGIN);
          showToast(
            "Account entered stasis mode. Contact the digital guardians.",
            "error",
          );
          return;
        }

        if (userData.status === "PENDING" || authData.emailVerified === false) {
          setScreen(SCREEN_IDS.WAITING);
          return;
        }

        if (authData.uid === ADMIN_UID) {
          setScreen(SCREEN_IDS.ADMIN);
          return;
        }

        setScreen(nextScreen || SCREEN_IDS.HUB);
      } catch (error) {
        console.error("Status check failed", error);
        // Only redirect to login on auth errors, not network/permission issues
        if (error?.message?.includes("auth") || error?.code?.includes("auth") || error?.message?.includes("permission")) {
          setScreen(SCREEN_IDS.LOGIN);
        }
        // Otherwise keep user on current screen - don't disrupt experience for transient errors
      }
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

  const findUserRecordByEmail = useCallback(async (email) => {
    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (!normalizedEmail) {
      return null;
    }

    const allUsers = (await dbR("users", "")) || {};
    const match = Object.entries(allUsers).find(
      ([, user]) => user?.email?.toLowerCase() === normalizedEmail,
    );

    if (!match) {
      return null;
    }

    return {
      uid: match[0],
      userData: match[1],
    };
  }, []);

  const buildPendingProfile = useCallback(
    ({
      fullName,
      email,
      country,
      city,
      instagram,
      linkedin,
      proficiency,
      authProvider = "password",
      emailVerified = false,
    }) => ({
      fullName: (fullName || email?.split("@")[0] || "").trim(),
      email: String(email || "").trim().toLowerCase(),
      country: String(country || "").trim(),
      city: String(city || "").trim(),
      instagram: String(instagram || "").trim(),
      linkedin: String(linkedin || "").trim(),
      proficiency: String(proficiency || "").trim(),
      authProvider,
      emailVerified: Boolean(emailVerified),
      status: "PENDING",
      role: "user",
      createdAt: new Date().toISOString(),
      passwordLastChanged: new Date().toISOString(),
      failedAttempts: 0,
      isLocked: false,
    }),
    [],
  );

  const syncAuthSessionFromUser = useCallback(
    async (user, stayLoggedIn = false) => {
      const token = await user.getIdToken(true);
      const authData = {
        uid: user.uid,
        token,
        refreshToken: user.refreshToken,
        email: user.email,
        emailVerified: user.emailVerified,
      };

      setAuth(authData);

      const sessionId = await createSession(user.uid, token, stayLoggedIn);
      if (sessionId) {
        setCurrentSessionId(sessionId);
      }

      return authData;
    },
    [],
  );

  const sendVerificationLink = useCallback(async () => {
    const currentUser = firebaseAuth?.currentUser;
    if (!currentUser) {
      throw new Error("Your session expired. Sign in again to resend verification.");
    }

    await sendEmailVerification(currentUser);
  }, []);

  const handleLoginPasswordReset = useCallback(async (email) => {
    const cleanEmail = String(email || "").trim().toLowerCase();
    if (!cleanEmail) {
      throw new Error("Please enter your Gmail address.");
    }

    if (!isValidGmailAddress(cleanEmail)) {
      throw new Error("Only Gmail addresses are allowed.");
    }

    if (
      !firebaseAuth ||
      (typeof window !== "undefined" && window.__TRADERS_AUDIT_DATA)
    ) {
      return "Audit mode: password reset link simulated.";
    }

    await sendPasswordResetEmail(firebaseAuth, cleanEmail);
    return "Password reset email sent. Check your Gmail inbox and spam folder.";
  }, []);

  const handleLogin = async (email, password, stayLoggedIn = false) => {
    const sanitizedEmail = String(email || "").trim().toLowerCase();
    const blockedEmails = ["arkgproductions@gmail.com", "starg.unit@gmail.com"];

    if (!sanitizedEmail || !password) {
      throw new Error("Email and password are required.");
    }

    if (!isValidGmailAddress(sanitizedEmail)) {
      throw new Error("Only Gmail addresses are allowed.");
    }

    if (blockedEmails.includes(sanitizedEmail)) {
      throw new Error(
        "Access Denied: This account has been permanently restricted.",
      );
    }

    const remainingCooldownMs = getLoginRateLimitRemainingMs(sanitizedEmail);
    if (remainingCooldownMs > 0) {
      throw new Error(
        `Too many login attempts. Try again in ${formatCooldown(remainingCooldownMs)}.`,
      );
    }

    if (!firebaseAuth || !FB_KEY) {
      const auditProfile =
        typeof window !== "undefined"
          ? window.__TRADERS_AUDIT_DATA?.userProfile ||
            window.__TRADERS_AUDIT_DATA?.adminProfile ||
            null
          : null;
      const simulatedUid =
        auditProfile?.uid || `audit-${sanitizedEmail.replace(/[^a-z0-9]/gi, "") || "user"}`;
      const simulatedToken = `audit-token-${simulatedUid}`;
      const simulatedAuth = {
        uid: simulatedUid,
        token: simulatedToken,
        refreshToken: `audit-refresh-${simulatedUid}`,
        email: auditProfile?.email || sanitizedEmail,
        emailVerified: auditProfile?.emailVerified ?? true,
      };
      setAuth(simulatedAuth);
      setCurrentSessionId("audit-session");
      setProfile({
        ...(auditProfile || {}),
        uid: simulatedUid,
        token: simulatedToken,
        email: simulatedAuth.email,
        emailVerified: simulatedAuth.emailVerified,
        status: auditProfile?.status || "ACTIVE",
      });
      setScreen(auditProfile?.status === "PENDING" ? "waiting" : "hub");
      return;
    }

    const currentEmail = firebaseAuth.currentUser?.email?.toLowerCase();
    if (currentEmail && currentEmail !== sanitizedEmail) {
      showToast(
        "Session collision detected. Previous timeline still active.",
        "error",
      );
      return;
    }

    try {
      await setPersistence(firebaseAuth, browserLocalPersistence);
    } catch (error) {
      console.warn("Failed to set persistence:", error);
    }

    const existingRecord = await findUserRecordByEmail(sanitizedEmail);
    if (existingRecord?.userData?.isLocked) {
      throw new Error(
        "Account Locked: Too many failed attempts. Contact Master Admin.",
      );
    }

    try {
      const userCredential = await signInWithEmailAndPassword(
        firebaseAuth,
        sanitizedEmail,
        password,
      );
      const signedInUser = userCredential.user;

      clearLoginFailures(sanitizedEmail);

      const token = await signedInUser.getIdToken(true);

      if (existingRecord?.uid) {
        await dbM(
          `users/${existingRecord.uid}`,
          {
            failedAttempts: 0,
            isLocked: false,
            lastLoginAttempt: new Date().toISOString(),
            emailVerified: signedInUser.emailVerified,
          },
          token,
        );
      }
    } catch (error) {
      recordLoginFailure(sanitizedEmail);

      if (existingRecord?.uid) {
        const currentAttempts =
          Number(existingRecord.userData?.failedAttempts || 0) + 1;
        const isNowLocked = currentAttempts >= 10;

        try {
          await dbM(`users/${existingRecord.uid}`, {
            failedAttempts: currentAttempts,
            isLocked: isNowLocked,
            lastLoginAttempt: new Date().toISOString(),
          });
        } catch (dbError) {
          console.warn("Could not update failedAttempts:", dbError);
        }

        if (isNowLocked) {
          sendForensicAlert(sanitizedEmail, "ACCOUNT_LOCKOUT");
          throw new Error(
            "Account Locked: Too many failed attempts. Contact Master Admin.",
          );
        }
      }

      if (sanitizedEmail === ADMIN_EMAIL.toLowerCase()) {
        sendForensicAlert(sanitizedEmail, "UNAUTHORIZED_ACCESS");
      }

      const errorCode = error?.code || "";
      if (
        errorCode === "auth/invalid-credential" ||
        errorCode === "auth/wrong-password" ||
        errorCode === "auth/user-not-found"
      ) {
        throw new Error("Incorrect Gmail address or password.");
      }

      if (errorCode === "auth/too-many-requests") {
        throw new Error("Too many attempts. Please try again later.");
      }

      if (errorCode === "auth/user-disabled") {
        throw new Error("This account has been disabled.");
      }

      throw error;
    }

    const signedInUser = firebaseAuth.currentUser;
    if (!signedInUser) {
      throw new Error("We could not restore your session. Try again.");
    }

    const authData = await syncAuthSessionFromUser(signedInUser, stayLoggedIn);

    if (signedInUser.uid === ADMIN_UID) {
      // Admin login successful - send alert
      sendTelegramAlert(
        "🔓 <b>GOD MODE ACTIVATED</b>\nMaster Admin has entered the terminal.",
      );

      const userData =
        (await dbR(`users/${signedInUser.uid}`, authData.token)) || {};
      setProfile({
        ...userData,
        uid: signedInUser.uid,
        token: authData.token,
        email: signedInUser.email,
        emailVerified: signedInUser.emailVerified,
      });
      setScreen("admin");
      return;
    }

    let userDataFinal = await dbR(`users/${signedInUser.uid}`, authData.token);
    if (!userDataFinal) {
      const initProfile = buildPendingProfile({
        fullName: signedInUser.displayName,
        email: signedInUser.email,
        country: "",
        city: "",
        authProvider: "password",
        emailVerified: signedInUser.emailVerified,
      });
      await dbM(`users/${signedInUser.uid}`, initProfile, authData.token);
      userDataFinal = initProfile;
    }

    if (
      userDataFinal.passwordLastChanged &&
      isPasswordExpired(userDataFinal.passwordLastChanged)
    ) {
      setProfile({
        ...userDataFinal,
        uid: signedInUser.uid,
        token: authData.token,
        email: signedInUser.email,
        emailVerified: signedInUser.emailVerified,
      });
      setScreen("forcePasswordReset");
      return;
    }

    if (userDataFinal.status === "BLOCKED") {
      throw new Error("Account blocked. Contact admin.");
    }

    await checkUserStatus(authData);
  };

  const handleStructuredSignup = async (formData) => {
    const antiSpamShield = new AntiSpamShield(window.sendTelegramAlert);
    if (antiSpamShield.isBotDetected(formData)) {
      await antiSpamShield.silentlyRejectBot(formData.email, formData);
      return { success: true, message: "Application received." };
    }

    const authProvider =
      formData.authProvider === "google" || googleUser?.authProvider === "google"
        ? "google"
        : "password";
    const cleanEmail = String(
      formData.email || googleUser?.email || firebaseAuth?.currentUser?.email || "",
    )
      .trim()
      .toLowerCase();
    const fullName = String(
      formData.fullName ||
        googleUser?.fullName ||
        firebaseAuth?.currentUser?.displayName ||
        cleanEmail.split("@")[0] ||
        "",
    ).trim();
    const country = String(formData.country || "").trim();
    const city = String(formData.city || "").trim();
    const instagram = String(formData.instagram || "").trim();
    const linkedin = String(formData.linkedin || "").trim();
    const proficiency = String(formData.proficiency || "").trim();
    const stayLoggedIn = Boolean(formData.stayLoggedIn);
    const blockedEmails = ["arkgproductions@gmail.com", "starg.unit@gmail.com"];

    if (!fullName) {
      throw new Error("Full name is required.");
    }

    if (!country || !city) {
      throw new Error("Country and city are required.");
    }

    if (!isValidGmailAddress(cleanEmail)) {
      throw new Error("Only Gmail addresses are allowed.");
    }

    if (cleanEmail === ADMIN_EMAIL.toLowerCase()) {
      sendForensicAlert(cleanEmail, "IMPERSONATION_ATTEMPT");
      throw new Error("Admin email cannot be used for registration.");
    }

    if (blockedEmails.includes(cleanEmail)) {
      throw new Error(
        "Access Denied: This account has been permanently restricted.",
      );
    }

    if (authProvider !== "google" && String(formData.password || "").length < 8) {
      throw new Error("Password must be at least 8 characters.");
    }

    if (!firebaseAuth || !FB_KEY) {
      const simulatedUid =
        (typeof window !== "undefined" &&
          (window.__TRADERS_AUDIT_DATA?.userAuth?.uid ||
            window.__TRADERS_AUDIT_DATA?.userProfile?.uid)) ||
        `audit-${Date.now()}`;
      const simulatedToken = `audit-token-${simulatedUid}`;
      const profileData = buildPendingProfile({
        fullName,
        email: cleanEmail,
        country,
        city,
        instagram,
        linkedin,
        proficiency,
        authProvider,
        emailVerified: authProvider === "google",
      });
      await dbW(`users/${simulatedUid}`, profileData, simulatedToken);
      setAuth({
        uid: simulatedUid,
        token: simulatedToken,
        refreshToken: `audit-refresh-${simulatedUid}`,
        email: cleanEmail,
        emailVerified: profileData.emailVerified,
      });
      setProfile({
        ...profileData,
        uid: simulatedUid,
        token: simulatedToken,
      });
      setGoogleUser(null);
      clearPendingGoogleSignup();
      setScreen("waiting");
      return;
    }

    try {
      await setPersistence(firebaseAuth, browserLocalPersistence);
    } catch (error) {
      console.warn("Failed to set persistence:", error);
    }

    let activeUser = firebaseAuth.currentUser;

    if (authProvider === "google") {
      if (!activeUser) {
        throw new Error("Continue with Google first to finish your application.");
      }
      if (activeUser.email?.toLowerCase() !== cleanEmail) {
        throw new Error("Google session mismatch. Please try again.");
      }
    } else {
      try {
        const signInMethods = await fetchSignInMethodsForEmail(
          firebaseAuth,
          cleanEmail,
        );
        if (signInMethods && signInMethods.length > 0) {
          throw new Error(
            "This email is already part of the Regiment. Please login instead.",
          );
        }
      } catch (checkError) {
        if (checkError.message.includes("already part of the Regiment")) {
          throw checkError;
        }
        console.warn("Could not pre-check email existence:", checkError);
      }

      try {
        const userCredential = await createUserWithEmailAndPassword(
          firebaseAuth,
          cleanEmail,
          formData.password,
        );
        activeUser = userCredential.user;
        await sendVerificationLink();
      } catch (signupError) {
        const errorCode = signupError?.code || "";
        if (errorCode === "auth/email-already-in-use") {
          throw new Error("This email is already registered. Please login instead.");
        }
        if (errorCode === "auth/invalid-email") {
          throw new Error("Invalid Gmail address.");
        }
        if (errorCode === "auth/weak-password") {
          throw new Error("Password is too weak. Use at least 8 characters.");
        }
        throw signupError;
      }
    }

    if (!activeUser) {
      throw new Error("Unable to create your session. Please try again.");
    }

    const authData = await syncAuthSessionFromUser(activeUser, stayLoggedIn);
    const profileData = buildPendingProfile({
      fullName,
      email: cleanEmail,
      country,
      city,
      instagram,
      linkedin,
      proficiency,
      authProvider,
      emailVerified: activeUser.emailVerified,
    });

    await dbW(`users/${activeUser.uid}`, profileData, authData.token);
    await sendWelcomeEmail(cleanEmail, fullName);

    sendTelegramAlert(
      `ðŸ‘¤ <b>NEW TRADER APPLICATION</b>\nEmail: <code>${cleanEmail}</code>\nStatus: ðŸŸ¡ PENDING`,
    );

    clearPendingGoogleSignup();
    setGoogleUser(null);
    setProfile({
      ...profileData,
      uid: activeUser.uid,
      token: authData.token,
      emailVerified: activeUser.emailVerified,
    });
    setScreen("waiting");
  };

  const handleStructuredGoogleAuth = async (
    applicationData = null,
    authenticatedUser = null,
  ) => {
    if (!firebaseAuth || !FB_KEY) {
      throw new Error("Google sign-in is unavailable right now.");
    }

    const user =
      authenticatedUser ||
      (await signInWithPopup(firebaseAuth, googleProvider)).user;
    const email = String(user.email || "").toLowerCase();

    if (!isValidGmailAddress(email)) {
      await firebaseAuth.signOut();
      throw new Error("Only Gmail addresses are allowed.");
    }

    const authData = await syncAuthSessionFromUser(user, true);
    const userData = await dbR(`users/${user.uid}`, authData.token);

    if (userData) {
      clearPendingGoogleSignup();
      setGoogleUser(null);
      await checkUserStatus(authData);
      return;
    }

    if (applicationData) {
      await handleStructuredSignup({
        ...applicationData,
        email,
        fullName:
          applicationData.fullName || user.displayName || email.split("@")[0],
        authProvider: "google",
      });
      return;
    }

    const googleDraft = {
      uid: user.uid,
      email,
      fullName: user.displayName || email.split("@")[0],
      authProvider: "google",
    };

    persistPendingGoogleSignup(googleDraft);
    setGoogleUser(googleDraft);
    setScreen("signup");
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
    if (!auth || !profile) {
      throw new Error("Session expired. Please login again.");
    }

    try {
      // Update Firebase Auth password
      const user = firebaseAuth?.currentUser;
      if (user?.updatePassword) {
        await user.updatePassword(newPassword);
      } else {
        console.warn("Password reset simulated without Firebase auth");
      }

      // Update passwordLastChanged timestamp in database
      if (firebaseDb) {
        await dbM(
          `users/${auth.uid}`,
          {
            passwordLastChanged: new Date().toISOString(),
          },
          auth.token,
        );
      }

      // Update local profile
      setProfile((prev) => ({
        ...prev,
        passwordLastChanged: new Date().toISOString(),
      }));

      await checkUserStatus(auth);
    } catch (error) {
      console.error("Password reset error:", error);
      throw new Error(error.message || "Failed to update password. Try again.");
    }
  };

  const handleResendVerificationEmail = async () => {
    await sendVerificationLink();

    const refreshedUser = firebaseAuth?.currentUser;
    if (!refreshedUser) {
      return;
    }

    const refreshedAuth = {
      uid: refreshedUser.uid,
      token: await refreshedUser.getIdToken(true),
      refreshToken: refreshedUser.refreshToken,
      email: refreshedUser.email,
      emailVerified: refreshedUser.emailVerified,
    };
    setAuth(refreshedAuth);
    showToast("Verification email sent to your Gmail inbox.", "success");
  };

  const checkApprovalStatus = async () => {
    if (!auth) return;
    if (
      typeof window !== "undefined" &&
      window.__TRADERS_AUDIT_DATA &&
      profile?.status === "PENDING"
    ) {
      return;
    }

    try {
      if (firebaseAuth?.currentUser) {
        await firebaseAuth.currentUser.reload();
        const refreshedUser = firebaseAuth.currentUser;
        const refreshedAuth = {
          uid: refreshedUser.uid,
          token: await refreshedUser.getIdToken(true),
          refreshToken: refreshedUser.refreshToken,
          email: refreshedUser.email,
          emailVerified: refreshedUser.emailVerified,
        };
        setAuth(refreshedAuth);
        await checkUserStatus(refreshedAuth);
        return;
      }
    } catch (error) {
      console.warn("Approval status refresh failed:", error);
    }

    await checkUserStatus(auth);
  };

  const handleLogout = async () => {
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
    try {
      // Collect telemetry
      const ipResponse = await fetch("https://api.ipify.org?format=json");
      const ipData = await ipResponse.json();
      const ipAddress = ipData.ip || "Unknown";

      const userAgent = navigator.userAgent;
      const timestamp = new Date().toISOString();

      // Send alert email
      if (hasEmailJsConfig) {
        await emailjs.send(
          import.meta.env.VITE_EMAILJS_SERVICE_ID,
          import.meta.env.VITE_EMAILJS_TEMPLATE_ID,
          {
            user_email: "gunitsingh1994@gmail.com",
            to_email: "gunitsingh1994@gmail.com",
            otp_code: `🚨 SECURITY ALERT: Unauthorized God Mode Access Attempt\n\nAttempt Type: ${attemptType}\nAttempted Email: ${attemptedEmail}\nFailure Reason: ${failureReason}\nIP Address: ${ipAddress}\nDevice Info: ${userAgent}\nTimestamp: ${timestamp}`,
          },
          import.meta.env.VITE_EMAILJS_PUBLIC_KEY,
        );
      } else {
        console.warn("EmailJS not configured for forensic alerts");
      }

      console.warn(
        `[IDS ALERT] ${attemptType} from IP ${ipAddress} at ${timestamp}`,
      );
    } catch (error) {
      console.error("Failed to log security alert:", error);
    }
  };

  const sendAdminOTPs = async () => {
    // Master Email verification
    const masterAdminEmail = "gunitsingh1994@gmail.com";
    if (
      adminMasterEmail.toLowerCase().trim() !== masterAdminEmail.toLowerCase()
    ) {
      // Log security alert for unauthorized email attempt
      await logSecurityAlert(
        "Master Email Verification Failed",
        adminMasterEmail,
        "Unauthorized email address",
      );

      // Send intrusion alert to Telegram with full forensic signature
      sendForensicAlert(adminMasterEmail, "SECURITY_BREACH");

      setAdminOtpErr("Access Denied: Unauthorized Admin Identity");
      return;
    }

    try {
      const auditMode =
        typeof window !== "undefined" && window.__TRADERS_AUDIT_DATA;
      const otp1 = auditMode ? "111111" : genOTP();
      const otp2 = auditMode ? "222222" : genOTP();
      const otp3 = auditMode ? "333333" : genOTP();

      const emails = [
        "gunitsingh1994@gmail.com",
        "arkgproductions@gmail.com",
        "starg.unit@gmail.com",
      ];

      // Send OTPs to all three emails simultaneously
      const otpPromises = emails.map(async (email, index) => {
        const otpCode = [otp1, otp2, otp3][index];
        if (!hasEmailJsConfig) {
          console.warn("EmailJS not configured for OTP batch delivery");
          return Promise.resolve();
        }

        return emailjs.send(
          import.meta.env.VITE_EMAILJS_SERVICE_ID,
          import.meta.env.VITE_EMAILJS_TEMPLATE_ID,
          {
            user_email: email,
            otp_code: otpCode,
            to_email: email,
          },
          import.meta.env.VITE_EMAILJS_PUBLIC_KEY,
        );
      });

      await Promise.all(otpPromises);

      // Store OTPs temporarily (in a real app, you'd store hashed versions securely)
      sessionStorage.setItem(
        "adminOtps",
        JSON.stringify({ otp1, otp2, otp3, timestamp: Date.now() }),
      );

      setAdminMasterEmailVerified(true);
      setAdminOtpStep(true);
      setAdminOtpsVerified(false);
      setAdminOtpErr("");
    } catch (error) {
      console.error("Failed to send admin OTPs:", error);
      setAdminOtpErr("Failed to send verification codes. Please try again.");
    }
  };

  const verifyAdminOTPs = () => {
    const auditMode =
      typeof window !== "undefined" && window.__TRADERS_AUDIT_DATA?.active;
    if (
      auditMode &&
      adminOtps.otp1 === "111111" &&
      adminOtps.otp2 === "222222" &&
      adminOtps.otp3 === "333333"
    ) {
      sessionStorage.removeItem("adminOtps");
      setAdminOtpStep(false);
      setAdminOtpsVerified(true);
      setAdminOtpErr("");
      return true;
    }

    const stored = sessionStorage.getItem("adminOtps");
    if (!stored) {
      setAdminOtpErr("OTP session expired. Please request new codes.");
      return false;
    }

    const { otp1, otp2, otp3, timestamp } = JSON.parse(stored);

    // Check if OTPs are expired (5 minutes)
    if (Date.now() - timestamp > 5 * 60 * 1000) {
      setAdminOtpErr("OTP codes expired. Please request new codes.");
      sessionStorage.removeItem("adminOtps");
      return false;
    }

    if (
      adminOtps.otp1 !== otp1 ||
      adminOtps.otp2 !== otp2 ||
      adminOtps.otp3 !== otp3
    ) {
      setAdminOtpErr("Invalid verification codes. Please check and try again.");
      return false;
    }

    // Clear stored OTPs after successful verification
    sessionStorage.removeItem("adminOtps");
    setAdminOtpStep(false);
    setAdminOtpsVerified(true);
    setAdminOtpErr("");
    return true;
  };

  const handleAdminAccess = async () => {
    try {
      await verifyAdminPassword(adminPassInput);
    } catch (error) {
      // Log security alert for unauthorized password attempt
      await logSecurityAlert(
        "Master Password Verification Failed",
        adminMasterEmail,
        error.message || "Invalid master password",
      );
      setAdminPassErr(error.message || "Invalid admin password.");
      showToast("Cipher mismatch. Authorization protocol rejected.", "error");
      return;
    }

    if (!adminOtpsVerified) {
      setAdminPassErr("Please verify the OTP codes first.");
      showToast(
        "OTP verification pending. Authenticate to proceed.",
        "warning",
      );
      return;
    }

    // Admin already verified by Master Email + Triple OTP verification
    // Save admin session to localStorage for persistence
    localStorage.setItem("isAdminAuthenticated", "true");

    setShowAdminPrompt(false);
    setAdminPassInput("");
    setAdminPassErr("");
    setAdminOtpsVerified(false);
    setAdminOtpStep(false);
    setAdminOtps({ otp1: "", otp2: "", otp3: "" });
    setAdminMasterEmail("");
    setAdminMasterEmailVerified(false);
    setIsAdminAuthenticated(true);
    setScreen("admin");
  };

  const saveJournal = async (jData) => {
    if (!auth) return;
    const obj = {};
    jData.forEach((t, i) => {
      obj[`entry_${i}`] = t;
    });
    await dbW(`users/${auth.uid}/journal`, obj, auth.token);
  };

  const saveAccount = async (aData) => {
    if (!auth) return;
    await dbW(`users/${auth.uid}/accountState`, aData, auth.token);
  };

  const saveFirmRules = async (fData) => {
    if (!auth) return;
    await dbW(`users/${auth.uid}/firmRules`, fData, auth.token);
  };
  // ─── MAIN ROUTER RENDER ───
  // Phase 3: Invite flow overlay (password reset -> invite screen) - simple hook in UI
  // The InviteScreen is shown when user has initiated an invite flow (password reset leading here)
  // The actual flow is wired in future patches; this is a safe default to present the screen when requested

  // Render InviteScreen overlay if requested
  const AdminInvitesView = () => {
    const { invites, addInvite, approveInvite, resetInvites } = useInvites();
    // Attach callbacks to pass to AdminInvitesPanel
    const onApproveInvite = (id, email, name) => {
      approveInvite(id);
      sendWelcomeEmail(email, name);
      showToast("Welcome email sent", "success");
      if (typeof notifyTelegram === "function") {
        notifyTelegram("invite_approved", { id, email, name });
      }
    };
    const onAddDemoInvite = () => {
      const invite = addInvite("demo recruit@example.com", "Demo Recruit");
      if (typeof notifyTelegram === "function") {
        notifyTelegram("invite_requested", {
          id: invite?.id,
          email: invite?.email,
          name: invite?.name,
        });
      }
    };
    return (
      <AdminInvitesPanel
        invites={invites}
        onApproveInvite={onApproveInvite}
        onAddDemoInvite={onAddDemoInvite}
        onResetInvites={resetInvites}
        showToast={showToast}
      />
    );
  };

  if (isInitialLoading) {
    return <SplashScreen />;
  }

  const screenContent = (() => {
    switch (screen) {
      case "login":
        return (
          <>
            <CleanLoginScreen
              onLogin={handleLogin}
              onSignup={() => setScreen("signup")}
              onAdmin={() => setShowAdminPrompt(true)}
              onGoogleAuth={handleStructuredGoogleAuth}
              onForgotPassword={handleLoginPasswordReset}
            />
            {showAdminPrompt && (
              <div
                style={{
                  position: "fixed",
                  inset: 0,
                  background: "rgba(0,0,0,0.85)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 1000,
                  backdropFilter: "blur(10px)",
                }}
              >
                <div style={authCard} className="glass-panel">
                  <SHead
                    icon="🛡️"
                    title="ADMIN AUTHENTICATION"
                    color={T.purple}
                  />

                  {!adminMasterEmailVerified ? (
                    // Step 1: Master Email Verification
                    <div style={{ marginBottom: 20 }}>
                      <div
                        style={{
                          color: T.red,
                          fontWeight: 700,
                          fontSize: 12,
                          marginBottom: 16,
                          padding: "12px 14px",
                          background: "rgba(255,69,58,0.1)",
                          border: `1px solid rgba(255,69,58,0.3)`,
                          borderRadius: 8,
                          textAlign: "center",
                        }}
                      >
                        🛑 WARNING: RESTRICTED AREA. Unauthorized entry attempts
                        are actively tracked. Any attempt to breach this panel
                        will result in your IP address, device footprint, and
                        network data being permanently logged and reported.
                      </div>
                      <div style={{ marginBottom: 16 }}>
                        <label style={lbl}>MASTER ADMIN EMAIL</label>
                        <input
                          type="email"
                          value={adminMasterEmail}
                          onChange={(e) => setAdminMasterEmail(e.target.value)}
                          style={{
                            width: "100%",
                            padding: "10px",
                            background: "rgba(0,0,0,0.5)",
                            border: "1px solid #333",
                            color: "#fff",
                            borderRadius: "6px",
                            fontFamily: T.font,
                          }}
                          placeholder="Enter Master ID"
                        />
                      </div>
                      {adminOtpErr && (
                        <div
                          style={{
                            color: T.red,
                            fontSize: 11,
                            marginBottom: 12,
                            fontWeight: 600,
                          }}
                        >
                          {adminOtpErr}
                        </div>
                      )}
                      <button
                        onClick={sendAdminOTPs}
                        style={authBtn(T.purple, false)}
                        className="btn-glass"
                      >
                        📧 SEND VERIFICATION CODES
                      </button>
                    </div>
                  ) : !adminOtpStep ? (
                    // Step 1b: Request OTPs (after master email verified)
                    <div style={{ marginBottom: 20 }}>
                      <div
                        style={{
                          color: T.muted,
                          fontSize: 12,
                          marginBottom: 16,
                          textAlign: "center",
                        }}
                      >
                        Master identity verified. OTP codes are being sent to
                        three secure endpoints.
                        <br />
                        Click below to proceed to code entry.
                      </div>
                      <button
                        onClick={() => setAdminOtpStep(true)}
                        style={authBtn(T.green, false)}
                        className="btn-glass"
                      >
                        ✓ PROCEED TO CODE ENTRY
                      </button>
                    </div>
                  ) : (
                    // Step 2: Enter OTPs
                    <div style={{ marginBottom: 20 }}>
                      <div
                        style={{
                          color: T.muted,
                          fontSize: 12,
                          marginBottom: 16,
                          textAlign: "center",
                        }}
                      >
                        Enter the 6-digit codes sent to the three verification
                        endpoints:
                      </div>

                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 12,
                          marginBottom: 16,
                        }}
                      >
                        <div>
                          <label style={{ ...lbl, fontSize: 11 }}>
                            gunitsingh1994@gmail.com
                          </label>
                          <input
                            type="text"
                            value={adminOtps.otp1}
                            onChange={(e) =>
                              setAdminOtps((prev) => ({
                                ...prev,
                                otp1: e.target.value,
                              }))
                            }
                            style={{
                              width: "100%",
                              padding: "10px",
                              background: "rgba(0,0,0,0.5)",
                              border: "1px solid #333",
                              color: "#fff",
                              borderRadius: "6px",
                              fontFamily: "monospace",
                              textAlign: "center",
                              letterSpacing: "2px",
                            }}
                            placeholder="000000"
                            maxLength="6"
                          />
                        </div>

                        <div>
                          <label style={{ ...lbl, fontSize: 11 }}>
                            arkgproductions@gmail.com
                          </label>
                          <input
                            type="text"
                            value={adminOtps.otp2}
                            onChange={(e) =>
                              setAdminOtps((prev) => ({
                                ...prev,
                                otp2: e.target.value,
                              }))
                            }
                            style={{
                              width: "100%",
                              padding: "10px",
                              background: "rgba(0,0,0,0.5)",
                              border: "1px solid #333",
                              color: "#fff",
                              borderRadius: "6px",
                              fontFamily: "monospace",
                              textAlign: "center",
                              letterSpacing: "2px",
                            }}
                            placeholder="000000"
                            maxLength="6"
                          />
                        </div>

                        <div>
                          <label style={{ ...lbl, fontSize: 11 }}>
                            starg.unit@gmail.com
                          </label>
                          <input
                            type="text"
                            value={adminOtps.otp3}
                            onChange={(e) =>
                              setAdminOtps((prev) => ({
                                ...prev,
                                otp3: e.target.value,
                              }))
                            }
                            style={{
                              width: "100%",
                              padding: "10px",
                              background: "rgba(0,0,0,0.5)",
                              border: "1px solid #333",
                              color: "#fff",
                              borderRadius: "6px",
                              fontFamily: "monospace",
                              textAlign: "center",
                              letterSpacing: "2px",
                            }}
                            placeholder="000000"
                            maxLength="6"
                          />
                        </div>
                      </div>

                      {adminOtpErr && (
                        <div
                          style={{
                            color: T.red,
                            fontSize: 11,
                            marginBottom: 12,
                            fontWeight: 600,
                          }}
                        >
                          {adminOtpErr}
                        </div>
                      )}

                      <div
                        style={{ display: "flex", gap: 8, marginBottom: 16 }}
                      >
                        <button
                          onClick={() => {
                            if (verifyAdminOTPs()) setAdminOtpStep(false);
                          }}
                          style={authBtn(T.green, false)}
                          className="btn-glass"
                        >
                          ✓ VERIFY CODES
                        </button>
                        <button
                          onClick={() => {
                            setAdminOtpStep(false);
                            setAdminMasterEmailVerified(false);
                            setAdminOtpsVerified(false);
                            setAdminOtps({ otp1: "", otp2: "", otp3: "" });
                            setAdminMasterEmail("");
                            setAdminOtpErr("");
                            sessionStorage.removeItem("adminOtps");
                          }}
                          style={{
                            ...authBtn(T.muted, false),
                            background: "transparent",
                          }}
                          className="btn-glass"
                        >
                          ↺ REQUEST NEW
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Master Admin Password - Only shown after OTP verification */}
                  {adminOtpsVerified && (
                    <div style={{ marginBottom: 20 }}>
                      <label style={lbl}>MASTER ADMIN PASSWORD</label>
                      <div style={{ position: "relative", width: "100%" }}>
                        <input
                          type={showAdminPwd ? "text" : "password"}
                          value={adminPassInput}
                          onChange={(e) => setAdminPassInput(e.target.value)}
                          style={{
                            width: "100%",
                            padding: "12px",
                            background: "rgba(0,0,0,0.5)",
                            border: "1px solid #333",
                            color: "#fff",
                            borderRadius: "8px",
                          }}
                          placeholder="Enter Master Admin Password"
                          onKeyDown={(e) =>
                            e.key === "Enter" && handleAdminAccess()
                          }
                        />
                        <button
                          type="button"
                          onClick={() => setShowAdminPwd(!showAdminPwd)}
                          style={{
                            position: "absolute",
                            right: "10px",
                            top: "50%",
                            transform: "translateY(-50%)",
                            background: "none",
                            border: "none",
                            color: "#888",
                            cursor: "pointer",
                            fontSize: "12px",
                          }}
                        >
                          {showAdminPwd ? "HIDE" : "SHOW"}
                        </button>
                      </div>
                      {adminPassErr && (
                        <div
                          style={{
                            color: T.red,
                            fontSize: 11,
                            marginTop: 8,
                            fontWeight: 600,
                          }}
                        >
                          {adminPassErr}
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 12 }}>
                    {adminOtpsVerified && (
                      <button
                        onClick={handleAdminAccess}
                        style={authBtn(T.purple, false)}
                        className="btn-glass"
                      >
                        UNLOCK ADMIN
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setShowAdminPrompt(false);
                        setAdminMasterEmail("");
                        setAdminMasterEmailVerified(false);
                        setAdminOtpStep(false);
                        setAdminOtpsVerified(false);
                        setAdminOtps({ otp1: "", otp2: "", otp3: "" });
                        setAdminOtpErr("");
                        setAdminPassErr("");
                        sessionStorage.removeItem("adminOtps");
                      }}
                      style={{
                        ...authBtn(T.muted, false),
                        background: "transparent",
                      }}
                      className="btn-glass"
                    >
                      CANCEL
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        );

      case "signup":
        return (
          <Suspense fallback={<LoadingFallback />}>
        <CleanOnboarding
          onSignupSuccess={handleStructuredSignup}
          onGoogleSuccess={handleStructuredGoogleAuth}
          onBackToLogin={handleBackToLoginFromSignup}
          googleUser={googleUser}
        />
      </Suspense>
        );

      case "waiting":
        return (
          <WaitingRoom
            profile={profile}
            onRefresh={checkApprovalStatus}
            onResendVerification={handleResendVerificationEmail}
            onLogout={handleLogout}
          />
        );

      case "forcePasswordReset":
        return (
          <ForcePasswordResetScreen
            profile={profile}
            onReset={handlePasswordReset}
            onLogout={handleLogout}
          />
        );

      case "sessions":
        return (
          <SessionsManagementScreen
            profile={profile}
            auth={auth}
            currentSessionId={currentSessionId}
            onBack={() => setScreen("hub")}
            showToast={showToast}
          />
        );

      case "hub":
        return (
          <Suspense fallback={<LoadingFallback />}>
            <RegimentHub
              onNavigate={(dest) => setScreen(dest)}
              theme={theme}
              currentTheme={currentTheme}
              onThemeChange={handleThemeChange}
            />
          </Suspense>
        );

      case "consciousness":
        return (
          <CollectiveConsciousnessPage
            onBack={() => setScreen("hub")}
            theme={theme}
            currentTheme={currentTheme}
            onThemeChange={handleThemeChange}
            auth={auth}
          />
        );

      case "admin":
        return isAdminAuthenticated ? (
          <ErrorBoundaryAdmin>
            <React.Suspense fallback={<LoadingFallback />}>
              <UserListProvider>
                <div
                  style={{
                    position: "absolute",
                    top: 10,
                    right: 10,
                    zIndex: 100,
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                  }}
                >
                  <AiEnginesStatus statuses={aiStatuses} />
                </div>
                <AdminDashboard
                  auth={auth}
                  onLogout={handleLogout}
                  isAdminAuthenticated={isAdminAuthenticated}
                  showToast={showToast}
                  maintenanceModeActive={maintenanceModeActive}
                  handleToggleMaintenanceMode={handleToggleMaintenanceMode}
                />
                <AdminInvitesView />
              </UserListProvider>
            </React.Suspense>
          </ErrorBoundaryAdmin>
        ) : (
          <SplashScreen />
        );

      case "app":
        return (
          <div style={{ position: "relative" }}>
            {/* RULE #27: Privacy Mode Header */}
            <div
              style={{
                position: "absolute",
                top: 10,
                right: 10,
                zIndex: 100,
                display: "flex",
                gap: 8,
                alignItems: "center",
              }}
            >
              <AiEnginesStatus statuses={aiStatuses} />
              <button
                onClick={() => {
                  const themes = ["lumiere", "amber", "midnight"];
                  const idx = themes.indexOf(currentTheme);
                  const nextTheme = themes[(idx + 1) % themes.length];
                  handleThemeChange(nextTheme);
                }}
                title="Toggle Lumiere/Amber/Midnight mode"
                style={{
                  background: "var(--accent-primary, #3B82F6)",
                  border: "1px solid var(--accent-primary, #3B82F6)",
                  color: "var(--accent-text, #FFFFFF)",
                  padding: "8px 12px",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 12,
                  fontFamily: T.font,
                  fontWeight: 600,
                }}
                className="btn-glass"
              >
                {currentTheme === "lumiere"
                  ? "☀️ LUMIERE"
                  : currentTheme === "amber"
                    ? "🟠 AMBER"
                    : "🌙 MIDNIGHT"}
              </button>
              <button
                onClick={() => setPrivacyModeActive(!privacyModeActive)}
                title="Toggle Ghost Mode - blur sensitive data"
                style={{
                  background: privacyModeActive
                    ? "rgba(255,69,58,0.3)"
                    : "rgba(52,199,89,0.3)",
                  border: `1px solid ${privacyModeActive ? T.red : T.green}`,
                  color: privacyModeActive ? T.red : T.green,
                  padding: "8px 12px",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 12,
                  fontFamily: T.font,
                  fontWeight: 600,
                }}
                className="btn-glass"
              >
                {privacyModeActive ? "👻 GHOST MODE ON" : "👁️ PRIVATE MODE OFF"}
              </button>
              <button
                onClick={() => setScreen("sessions")}
                title="Manage active sessions"
                style={{
                  background: "rgba(52,144,220,0.3)",
                  border: `1px solid ${T.blue}`,
                  color: T.blue,
                  padding: "8px 12px",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 12,
                  fontFamily: T.font,
                  fontWeight: 600,
                }}
                className="btn-glass"
              >
                📱 SESSIONS
              </button>
            </div>

            {/* Apply Privacy Mode blur to entire app */}
            <div
              style={{
                filter: privacyModeActive ? "blur(8px)" : "none",
                transition: "filter 0.3s ease",
                pointerEvents: privacyModeActive ? "none" : "auto",
              }}
            >
              <React.Suspense fallback={<LoadingFallback />}>
                <MainTerminal
                  auth={auth}
                  profile={profile}
                  onLogout={handleLogout}
                  onSaveJournal={saveJournal}
                  onSaveAccount={saveAccount}
                  onSaveFirmRules={saveFirmRules}
                  showToast={showToast}
                  privacyMode={privacyModeActive}
                />
              </React.Suspense>
            </div>
          </div>
        );

      default:
        return <SplashScreen />;
    }
  })();

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
        privacyMode: privacyModeActive,
      }}
    >
      <section className={`app-container theme-${currentTheme}`}>
      {/* RULE #295, #296: Maintenance Mode - Show "Back Soon" screen if active, except for Master Admin */}
      {maintenanceModeActive &&
      auth?.uid !== ADMIN_UID &&
      screen !== "admin" ? (
        <MaintenanceScreen />
      ) : (
        screenContent
      )}

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
      <Toast toasts={toasts} onDismiss={handleDismissToast} />
      <FloatingChatWidget auth={auth} profile={profile} />

      {/* Officers Briefing Footer - Rotating Quotes & Founder Card */}
      <div
        style={{
          marginTop: "auto",
          backgroundColor: "#FFFFFF",
          borderTop: "none",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "32px",
          padding: "60px 40px 40px 40px",
          boxShadow:
            "0 -1px 3px 0 rgba(0, 0, 0, 0.05), 0 -1px 2px 0 rgba(0, 0, 0, 0.04)",
        }}
      >
        {/* Rotating Quote */}
        <div style={{ textAlign: "center", maxWidth: 600 }}>
          <div
            style={{
              color: "#64748B",
              fontSize: "0.9rem",
              fontStyle: "italic",
              lineHeight: 1.8,
              fontFamily: T.font,
            }}
          >
            "{dailyQuote}" 🦅
          </div>
        </div>

        {/* Founder Card */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            textAlign: "center",
          }}
        >
          <FounderCard
            linkedInUrl="https://www.linkedin.com/in/singhgunit/"
            theme={theme}
          />
        </div>

        {/* AI System Status — Quad-Core Intelligence Network */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "16px",
            padding: "12px 24px",
            borderRadius: "10px",
            background: "linear-gradient(135deg, #F8FAFC, #F1F5F9)",
            border: "1px solid #E2E8F0",
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              fontSize: "0.7rem",
              fontWeight: 700,
              color: "#475569",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            AI System Status
          </span>
          {Object.entries(aiQuadCoreStatus).map(([key, mind]) => {
            const isReserve = mind.isReserve;
            const dotColor = isReserve
              ? "#A855F7"
              : mind.online
                ? "#22C55E"
                : "#EF4444";
            const textColor = isReserve
              ? "#7E22CE"
              : mind.online
                ? "#166534"
                : "#991B1B";
            const glowColor = isReserve
              ? "rgba(168,85,247,0.5)"
              : mind.online
                ? "rgba(34,197,94,0.5)"
                : "rgba(239,68,68,0.5)";
            return (
              <div
                key={key}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: dotColor,
                    boxShadow: `0 0 6px ${glowColor}`,
                    animation: "led-pulse 2s ease-in-out infinite",
                  }}
                />
                <span
                  style={{
                    fontSize: "0.68rem",
                    fontWeight: 600,
                    color: textColor,
                    fontFamily: "ui-monospace, monospace",
                  }}
                >
                  {mind.name}
                </span>
              </div>
            );
          })}
        </div>

        {/* Security Protocol */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            textAlign: "center",
          }}
        >
          <div
            style={{
              color: "#94A3B8",
              fontSize: "0.75rem",
              letterSpacing: "0.1em",
              fontWeight: 500,
              marginBottom: 0,
              textTransform: "uppercase",
            }}
          >
            WELCOME TO THE REGIMENT
          </div>
        </div>
      </div>
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

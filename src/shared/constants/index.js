// Shared constants layer - Application-wide constants and configuration
// This module exports all constants used across the application

// AURA Theme Engine Constants
export const AURA_THEME_STATES = {
  LUMIERE: "lumiere",
  AMBER: "amber",
  MIDNIGHT: "midnight",
};

export const AURA_THEME_SYMBOLS = {
  LUMIERE: "◉",
  AMBER: "◍",
  MIDNIGHT: "◐",
};

export const AURA_THEME_LABELS = {
  LUMIERE: "LUMIÈRE",
  AMBER: "AMBER",
  MIDNIGHT: "MIDNIGHT",
};

export const AURA_THEME_COLORS = {
  LUMIERE: {
    primary: "#FBFBFC",
    secondary: "#F4EBD0",
    accent: "#2563EB",
  },
  AMBER: {
    primary: "#F4EBD0",
    secondary: "#05070A",
    accent: "#F59E0B",
  },
  MIDNIGHT: {
    primary: "#05070A",
    secondary: "#0A0F1A",
    accent: "#8B5CF6",
  },
};

// Legacy theme mapping for backward compatibility
export const LEGACY_THEME_MAP = {
  day: AURA_THEME_STATES.LUMIERE,
  night: AURA_THEME_STATES.MIDNIGHT,
  eye: AURA_THEME_STATES.AMBER,
  comfort: AURA_THEME_STATES.AMBER,
};

// User status constants
export const USER_STATUS = {
  PENDING: "PENDING",
  ACTIVE: "ACTIVE",
  SUSPENDED: "SUSPENDED",
  BLOCKED: "BLOCKED",
  ARCHIVED: "ARCHIVED",
};

// User level constants
export const USER_LEVEL = {
  NEWBIE: "NEWBIE",
  TRADER: "TRADER",
  VETERAN: "VETERAN",
  ELITE: "ELITE",
  FOUNDER: "FOUNDER",
};

// AI Provider constants
export const AI_PROVIDERS = {
  GEMINI: "gemini",
  MISTRAL: "mistral",
  GROQ: "groq",
  OPENROUTER: "openrouter",
  CEREBRAS: "cerebras",
  DEEPSEEK: "deepseek",
  SAMBANOVA: "sambanova",
};

// AI Provider fallback hierarchy
export const AI_FALLBACK_HIERARCHY = [
  AI_PROVIDERS.GEMINI,
  AI_PROVIDERS.MISTRAL,
  AI_PROVIDERS.GROQ,
  AI_PROVIDERS.OPENROUTER,
  AI_PROVIDERS.CEREBRAS,
  AI_PROVIDERS.DEEPSEEK,
  AI_PROVIDERS.SAMBANOVA,
];

// Security alert types
export const SECURITY_ALERT_TYPES = {
  BREACH: "BREACH",
  SUSPICIOUS_LOGIN: "SUSPICIOUS_LOGIN",
  MULTIPLE_FAILED_ATTEMPTS: "MULTIPLE_FAILED_ATTEMPTS",
  UNUSUAL_ACTIVITY: "UNUSUAL_ACTIVITY",
  ADMIN_ACTION: "ADMIN_ACTION",
};

// Trading constants
export const TRADING_DIRECTIONS = {
  LONG: "LONG",
  SHORT: "SHORT",
};

export const TRADING_SYMBOLS = [
  "NIFTY",
  "BANKNIFTY",
  "FINNIFTY",
  "SENSEX",
  "USDINR",
  "EURINR",
  "GBPINR",
  "JPYINR",
];

// Time constants
export const TRADING_SESSIONS = {
  PREMARKET: "PREMARKET",
  MARKET: "MARKET",
  POSTMARKET: "POSTMARKET",
  CLOSED: "CLOSED",
};

// Application constants
export const APP_CONSTANTS = {
  APP_NAME: "TradersApp",
  APP_VERSION: "0.0.0",
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  MAX_IMAGE_DIMENSIONS: { width: 1920, height: 1080 },
  SESSION_TIMEOUT: 30 * 60 * 1000, // 30 minutes
  HEARTBEAT_INTERVAL: 60 * 1000, // 1 minute
};

// Firebase constants
export const FIREBASE_CONSTANTS = {
  MAX_RETRIES: 3,
  INITIAL_RETRY_DELAY: 100,
  MAX_RETRY_DELAY: 5000,
  CONNECTION_POOL_SIZE: 5,
  CACHE_TTL: 5 * 60 * 1000, // 5 minutes
};

// Color constants for UI
export const COLOR_PALETTE = {
  PRIMARY: {
    BLUE: "#2563EB",
    GREEN: "#22C55E",
    RED: "#EF4444",
    YELLOW: "#F59E0B",
    PURPLE: "#8B5CF6",
    PINK: "#EC4899",
    CYAN: "#06B6D4",
  },
  NEUTRAL: {
    50: "#F8FAFC",
    100: "#F1F5F9",
    200: "#E2E8F0",
    300: "#CBD5E1",
    400: "#94A3B8",
    500: "#64748B",
    600: "#475569",
    700: "#334155",
    800: "#1E293B",
    900: "#0F172A",
  },
};

// Breakpoint constants for responsive design
export const BREAKPOINTS = {
  MOBILE: 640,
  TABLET: 768,
  DESKTOP: 1024,
  WIDE: 1280,
  ULTRA_WIDE: 1536,
};

// Export all constants as a single object for easy import
export default {
  AURA_THEME_STATES,
  AURA_THEME_SYMBOLS,
  AURA_THEME_LABELS,
  AURA_THEME_COLORS,
  LEGACY_THEME_MAP,
  USER_STATUS,
  USER_LEVEL,
  AI_PROVIDERS,
  AI_FALLBACK_HIERARCHY,
  SECURITY_ALERT_TYPES,
  TRADING_DIRECTIONS,
  TRADING_SYMBOLS,
  TRADING_SESSIONS,
  APP_CONSTANTS,
  FIREBASE_CONSTANTS,
  COLOR_PALETTE,
  BREAKPOINTS,
};

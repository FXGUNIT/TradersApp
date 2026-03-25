// Shared types layer - TypeScript type definitions and PropTypes
// This module exports type definitions for the application

// Note: Since this is a JavaScript project, we'll use JSDoc comments
// and export PropTypes for runtime type checking

// User types
/**
 * @typedef {Object} User
 * @property {string} uid - Unique user ID
 * @property {string} email - User email address
 * @property {string} [displayName] - User display name
 * @property {string} [photoURL] - Profile photo URL
 * @property {'PENDING'|'ACTIVE'|'SUSPENDED'|'BLOCKED'|'ARCHIVED'} status - User status
 * @property {'NEWBIE'|'TRADER'|'VETERAN'|'ELITE'|'FOUNDER'} level - User level
 * @property {string} createdAt - Creation timestamp
 * @property {string} [lastLogin] - Last login timestamp
 * @property {string} [lastActive] - Last active timestamp
 * @property {Object} [metadata] - Additional user metadata
 */

/**
 * @typedef {Object} UserProfile
 * @property {string} uid - User ID
 * @property {string} email - User email
 * @property {string} [displayName] - Display name
 * @property {string} [photoURL] - Profile photo URL
 * @property {boolean} [emailVerified] - Email verification status
 * @property {Object} [preferences] - User preferences
 * @property {Object} [stats] - User statistics
 */

// Session types
/**
 * @typedef {Object} Session
 * @property {string} sessionId - Unique session ID
 * @property {string} uid - User ID
 * @property {Object} deviceInfo - Device information
 * @property {Object} [geoData] - Geographical data
 * @property {string} createdAt - Session creation timestamp
 * @property {string} lastActive - Last activity timestamp
 * @property {boolean} isCurrent - Whether this is the current session
 */

// Trade types
/**
 * @typedef {Object} Trade
 * @property {string} id - Trade ID
 * @property {string} userId - User ID
 * @property {string} symbol - Trading symbol (e.g., 'NIFTY', 'BANKNIFTY')
 * @property {'LONG'|'SHORT'} direction - Trade direction
 * @property {number} entry - Entry price
 * @property {number} [exit] - Exit price (if closed)
 * @property {number} size - Position size
 * @property {number} [pnl] - Profit/Loss
 * @property {string} timestamp - Trade timestamp
 * @property {string} [notes] - Trade notes
 * @property {Object} [metadata] - Additional trade metadata
 */

// Account types
/**
 * @typedef {Object} Account
 * @property {string} userId - User ID
 * @property {number} balance - Account balance
 * @property {number} equity - Account equity
 * @property {number} marginUsed - Margin used
 * @property {number} marginAvailable - Margin available
 * @property {number} leverage - Account leverage
 * @property {number} riskPerTrade - Risk per trade percentage
 * @property {number} maxDrawdown - Maximum drawdown
 * @property {string} lastUpdated - Last update timestamp
 */

// AI types
/**
 * @typedef {Object} AIProvider
 * @property {string} name - Provider name
 * @property {string} key - Provider key
 * @property {boolean} enabled - Whether provider is enabled
 * @property {number} priority - Priority in fallback hierarchy
 * @property {Object} config - Provider configuration
 */

/**
 * @typedef {Object} AIResponse
 * @property {string} provider - AI provider used
 * @property {string} response - AI response text
 * @property {number} latency - Response latency in ms
 * @property {Object} [metadata] - Additional metadata
 * @property {Error} [error] - Error if any
 */

// Theme types
/**
 * @typedef {Object} Theme
 * @property {string} bg - Background color
 * @property {string} card - Card background color
 * @property {string} text - Text color
 * @property {string} accent - Accent color
 * @property {string} muted - Muted text color
 * @property {string} border - Border color
 * @property {string} success - Success color
 * @property {string} danger - Danger color
 * @property {string} warning - Warning color
 * @property {Object} glassmorphism - Glassmorphism effect styles
 */

/**
 * @typedef {'lumiere'|'amber'|'midnight'} AuraThemeState
 */

// Security types
/**
 * @typedef {Object} SecurityAlert
 * @property {string} id - Alert ID
 * @property {'BREACH'|'SUSPICIOUS_LOGIN'|'MULTIPLE_FAILED_ATTEMPTS'|'UNUSUAL_ACTIVITY'|'ADMIN_ACTION'} type - Alert type
 * @property {string} userId - User ID (if applicable)
 * @property {string} timestamp - Alert timestamp
 * @property {string} message - Alert message
 * @property {Object} [data] - Additional alert data
 * @property {boolean} [resolved] - Whether alert is resolved
 */

// Component prop types (for runtime validation)
export const PropTypes = {
  user: {
    uid: "string",
    email: "string",
    displayName: "string?",
    photoURL: "string?",
    status: ["PENDING", "ACTIVE", "SUSPENDED", "BLOCKED", "ARCHIVED"],
    level: ["NEWBIE", "TRADER", "VETERAN", "ELITE", "FOUNDER"],
    createdAt: "string",
    lastLogin: "string?",
    lastActive: "string?",
  },

  trade: {
    id: "string",
    userId: "string",
    symbol: "string",
    direction: ["LONG", "SHORT"],
    entry: "number",
    exit: "number?",
    size: "number",
    pnl: "number?",
    timestamp: "string",
    notes: "string?",
  },

  theme: {
    bg: "string",
    card: "string",
    text: "string",
    accent: "string",
    muted: "string",
    border: "string",
    success: "string",
    danger: "string",
    warning: "string",
    glassmorphism: "object",
  },

  aiResponse: {
    provider: "string",
    response: "string",
    latency: "number",
    metadata: "object?",
    error: "object?",
  },
};

// Type validation utilities
export const TypeUtils = {
  /**
   * Validate an object against a type definition
   * @param {Object} obj - Object to validate
   * @param {Object} typeDef - Type definition from PropTypes
   * @returns {boolean} Whether object matches type definition
   */
  validate: (obj, typeDef) => {
    if (!obj || typeof obj !== "object") return false;

    for (const [key, expectedType] of Object.entries(typeDef)) {
      const value = obj[key];

      // Handle optional fields (marked with ?)
      const isOptional = expectedType.endsWith("?");
      const cleanType = isOptional ? expectedType.slice(0, -1) : expectedType;

      if (value === undefined || value === null) {
        if (!isOptional) return false;
        continue;
      }

      // Handle array of allowed values
      if (Array.isArray(cleanType)) {
        if (!cleanType.includes(value)) return false;
        continue;
      }

      // Handle basic type checking
      switch (cleanType) {
        case "string":
          if (typeof value !== "string") return false;
          break;
        case "number":
          if (typeof value !== "number") return false;
          break;
        case "boolean":
          if (typeof value !== "boolean") return false;
          break;
        case "object":
          if (typeof value !== "object" || value === null) return false;
          break;
        case "array":
          if (!Array.isArray(value)) return false;
          break;
        default:
          // Unknown type
          break;
      }
    }

    return true;
  },

  /**
   * Create a type-safe object factory
   * @param {Object} typeDef - Type definition
   * @returns {Function} Factory function
   */
  createFactory: (typeDef) => {
    return (data) => {
      const result = {};
      for (const [key, expectedType] of Object.entries(typeDef)) {
        const isOptional = expectedType.endsWith("?");
        const cleanType = isOptional ? expectedType.slice(0, -1) : expectedType;

        if (data[key] === undefined || data[key] === null) {
          if (!isOptional) {
            throw new Error(`Missing required field: ${key}`);
          }
          continue;
        }

        result[key] = data[key];
      }
      return result;
    };
  },
};

// Export type definitions for JSDoc usage
export const Types = {
  User: /** @type {User} */ ({}),
  UserProfile: /** @type {UserProfile} */ ({}),
  Session: /** @type {Session} */ ({}),
  Trade: /** @type {Trade} */ ({}),
  Account: /** @type {Account} */ ({}),
  AIProvider: /** @type {AIProvider} */ ({}),
  AIResponse: /** @type {AIResponse} */ ({}),
  Theme: /** @type {Theme} */ ({}),
  SecurityAlert: /** @type {SecurityAlert} */ ({}),
};

// Export everything
export default {
  PropTypes,
  TypeUtils,
  Types,
};

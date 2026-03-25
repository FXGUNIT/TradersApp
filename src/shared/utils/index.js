// Shared utilities layer - Reusable utility functions
// This module exports utility functions used across the application

// Import existing utilities from src/utils
export { calculatePasswordStrength } from "../../utils/securityUtils.js";
export { getStrengthLabel } from "../../utils/securityUtils.js";
export { isValidGmailAddress } from "../../utils/securityUtils.js";
export { isPasswordExpired } from "../../utils/securityUtils.js";
export { copyToClipboardSecure } from "../../utils/securityUtils.js";
export { hashAdminPasswordWithSalt } from "../../utils/securityUtils.js";
export { detectGPUSupport } from "../../utils/securityUtils.js";
export { withExponentialBackoff } from "../../utils/securityUtils.js";

// Import other utilities
export { default as searchUtils } from "../../utils/searchUtils.js";
export { default as uiUtils } from "../../utils/uiUtils.js";
export { default as businessLogicUtils } from "../../utils/businessLogicUtils.jsx";
export { default as mathEngine } from "../../utils/math-engine.js";
export { default as performanceBenchmark } from "../../utils/performanceBenchmark.js";

// Date and time utilities
export const dateTimeUtils = {
  /**
   * Format date to IST string
   * @param {Date|string} date - Date to format
   * @returns {string} Formatted IST date string
   */
  formatIST: (date) => {
    const d = new Date(date);
    return d.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  },

  /**
   * Get current IST time
   * @returns {string} Current IST time string
   */
  getCurrentIST: () => {
    return new Date().toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour12: false,
    });
  },

  /**
   * Get trading session based on IST time
   * @returns {string} Trading session ('PREMARKET', 'MARKET', 'POSTMARKET', 'CLOSED')
   */
  getTradingSession: () => {
    const now = new Date();
    const istHour = now.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      hour12: false,
    });
    const hour = parseInt(istHour, 10);

    if (hour >= 9 && hour < 15) return "MARKET";
    if (hour >= 15 && hour < 16) return "POSTMARKET";
    if (hour >= 16 || hour < 9) return "CLOSED";
    return "PREMARKET";
  },

  /**
   * Calculate time difference in human-readable format
   * @param {Date|string} start - Start date
   * @param {Date|string} end - End date (defaults to now)
   * @returns {string} Human-readable time difference
   */
  timeDifference: (start, end = new Date()) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffMs = endDate - startDate;

    const seconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  },
};

// String utilities
export const stringUtils = {
  /**
   * Truncate string with ellipsis
   * @param {string} str - String to truncate
   * @param {number} length - Maximum length
   * @param {string} suffix - Suffix to add (default: '...')
   * @returns {string} Truncated string
   */
  truncate: (str, length = 50, suffix = "...") => {
    if (str.length <= length) return str;
    return str.substring(0, length - suffix.length) + suffix;
  },

  /**
   * Capitalize first letter of each word
   * @param {string} str - String to capitalize
   * @returns {string} Capitalized string
   */
  capitalize: (str) => {
    return str
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  },

  /**
   * Convert camelCase to Title Case
   * @param {string} str - CamelCase string
   * @returns {string} Title Case string
   */
  camelToTitle: (str) => {
    return str
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (s) => s.toUpperCase())
      .trim();
  },

  /**
   * Generate random string
   * @param {number} length - Length of random string
   * @returns {string} Random string
   */
  randomString: (length = 8) => {
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  },

  /**
   * Remove special characters from string
   * @param {string} str - String to clean
   * @returns {string} Cleaned string
   */
  removeSpecialChars: (str) => {
    return str.replace(/[^\w\s]/gi, "");
  },
};

// Number utilities
export const numberUtils = {
  /**
   * Format number with commas
   * @param {number} num - Number to format
   * @returns {string} Formatted number
   */
  formatWithCommas: (num) => {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  },

  /**
   * Format currency (INR)
   * @param {number} amount - Amount to format
   * @returns {string} Formatted currency
   */
  formatCurrency: (amount) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  },

  /**
   * Format percentage
   * @param {number} value - Percentage value
   * @param {number} decimals - Decimal places
   * @returns {string} Formatted percentage
   */
  formatPercentage: (value, decimals = 2) => {
    return `${value.toFixed(decimals)}%`;
  },

  /**
   * Round number to specified decimals
   * @param {number} value - Value to round
   * @param {number} decimals - Decimal places
   * @returns {number} Rounded value
   */
  round: (value, decimals = 2) => {
    const multiplier = Math.pow(10, decimals);
    return Math.round(value * multiplier) / multiplier;
  },

  /**
   * Clamp value between min and max
   * @param {number} value - Value to clamp
   * @param {number} min - Minimum value
   * @param {number} max - Maximum value
   * @returns {number} Clamped value
   */
  clamp: (value, min, max) => {
    return Math.min(Math.max(value, min), max);
  },

  /**
   * Calculate percentage
   * @param {number} part - Part value
   * @param {number} total - Total value
   * @returns {number} Percentage
   */
  percentage: (part, total) => {
    if (total === 0) return 0;
    return (part / total) * 100;
  },
};

// Array utilities
export const arrayUtils = {
  /**
   * Remove duplicates from array
   * @param {Array} array - Array to deduplicate
   * @returns {Array} Deduplicated array
   */
  unique: (array) => {
    return [...new Set(array)];
  },

  /**
   * Group array by key
   * @param {Array} array - Array to group
   * @param {string} key - Key to group by
   * @returns {Object} Grouped object
   */
  groupBy: (array, key) => {
    return array.reduce((groups, item) => {
      const groupKey = item[key];
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(item);
      return groups;
    }, {});
  },

  /**
   * Sort array by key
   * @param {Array} array - Array to sort
   * @param {string} key - Key to sort by
   * @param {boolean} ascending - Sort order
   * @returns {Array} Sorted array
   */
  sortBy: (array, key, ascending = true) => {
    return array.sort((a, b) => {
      const aVal = a[key];
      const bVal = b[key];

      if (aVal < bVal) return ascending ? -1 : 1;
      if (aVal > bVal) return ascending ? 1 : -1;
      return 0;
    });
  },

  /**
   * Chunk array into smaller arrays
   * @param {Array} array - Array to chunk
   * @param {number} size - Chunk size
   * @returns {Array} Chunked array
   */
  chunk: (array, size) => {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  },

  /**
   * Flatten nested array
   * @param {Array} array - Array to flatten
   * @returns {Array} Flattened array
   */
  flatten: (array) => {
    return array.reduce((flat, item) => {
      return flat.concat(Array.isArray(item) ? arrayUtils.flatten(item) : item);
    }, []);
  },
};

// Object utilities
export const objectUtils = {
  /**
   * Deep clone object
   * @param {Object} obj - Object to clone
   * @returns {Object} Cloned object
   */
  deepClone: (obj) => {
    return JSON.parse(JSON.stringify(obj));
  },

  /**
   * Merge objects deeply
   * @param {...Object} objects - Objects to merge
   * @returns {Object} Merged object
   */
  deepMerge: (...objects) => {
    const result = {};

    objects.forEach((obj) => {
      if (!obj) return;

      Object.keys(obj).forEach((key) => {
        if (
          typeof obj[key] === "object" &&
          obj[key] !== null &&
          !Array.isArray(obj[key])
        ) {
          result[key] = objectUtils.deepMerge(result[key] || {}, obj[key]);
        } else {
          result[key] = obj[key];
        }
      });
    });

    return result;
  },

  /**
   * Pick specific keys from object
   * @param {Object} obj - Source object
   * @param {Array} keys - Keys to pick
   * @returns {Object} Object with picked keys
   */
  pick: (obj, keys) => {
    const result = {};
    keys.forEach((key) => {
      if (obj.hasOwnProperty(key)) {
        result[key] = obj[key];
      }
    });
    return result;
  },

  /**
   * Omit specific keys from object
   * @param {Object} obj - Source object
   * @param {Array} keys - Keys to omit
   * @returns {Object} Object without omitted keys
   */
  omit: (obj, keys) => {
    const result = { ...obj };
    keys.forEach((key) => {
      delete result[key];
    });
    return result;
  },

  /**
   * Check if object is empty
   * @param {Object} obj - Object to check
   * @returns {boolean} True if object is empty
   */
  isEmpty: (obj) => {
    return Object.keys(obj).length === 0;
  },
};

// Validation utilities
export const validationUtils = {
  /**
   * Validate email address
   * @param {string} email - Email to validate
   * @returns {boolean} True if email is valid
   */
  isEmail: (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  /**
   * Validate URL
   * @param {string} url - URL to validate
   * @returns {boolean} True if URL is valid
   */
  isUrl: (url) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Validate phone number (Indian format)
   * @param {string} phone - Phone number to validate
   * @returns {boolean} True if phone number is valid
   */
  isPhoneNumber: (phone) => {
    const phoneRegex = /^[6-9]\d{9}$/;
    return phoneRegex.test(phone);
  },

  /**
   * Validate strong password
   * @param {string} password - Password to validate
   * @returns {boolean} True if password is strong
   */
  isStrongPassword: (password) => {
    // At least 8 characters, one uppercase, one lowercase, one number, one special character
    const strongRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return strongRegex.test(password);
  },

  /**
   * Validate file type
   * @param {File} file - File to validate
   * @param {Array} allowedTypes - Allowed MIME types
   * @returns {boolean} True if file type is allowed
   */
  isValidFileType: (file, allowedTypes) => {
    return allowedTypes.includes(file.type);
  },

  /**
   * Validate file size
   * @param {File} file - File to validate
   * @param {number} maxSize - Maximum size in bytes
   * @returns {boolean} True if file size is within limit
   */
  isValidFileSize: (file, maxSize) => {
    return file.size <= maxSize;
  },
};

// Export all utilities
export default {
  dateTimeUtils,
  stringUtils,
  numberUtils,
  arrayUtils,
  objectUtils,
  validationUtils,
};

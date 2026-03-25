// Shared libraries layer - Third-party libraries and custom utilities
// This module exports library wrappers and utility functions

// Date manipulation library (using native Date with extensions)
export const dateLib = {
  format: (date, format = "YYYY-MM-DD HH:mm:ss") => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    const seconds = String(d.getSeconds()).padStart(2, "0");

    return format
      .replace("YYYY", year)
      .replace("MM", month)
      .replace("DD", day)
      .replace("HH", hours)
      .replace("mm", minutes)
      .replace("ss", seconds);
  },

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

  addDays: (date, days) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  },

  diffInDays: (date1, date2) => {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    const diffTime = Math.abs(d2 - d1);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  },

  isToday: (date) => {
    const today = new Date();
    const d = new Date(date);
    return (
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear()
    );
  },
};

// Number formatting library
export const numberLib = {
  formatCurrency: (amount, currency = "INR") => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  },

  formatPercentage: (value, decimals = 2) => {
    return `${value.toFixed(decimals)}%`;
  },

  formatWithCommas: (number) => {
    return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  },

  round: (value, decimals = 2) => {
    const multiplier = Math.pow(10, decimals);
    return Math.round(value * multiplier) / multiplier;
  },

  clamp: (value, min, max) => {
    return Math.min(Math.max(value, min), max);
  },
};

// String manipulation library
export const stringLib = {
  truncate: (str, length = 50, suffix = "...") => {
    if (str.length <= length) return str;
    return str.substring(0, length - suffix.length) + suffix;
  },

  capitalize: (str) => {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  },

  camelToTitle: (str) => {
    return str
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (s) => s.toUpperCase())
      .trim();
  },

  slugify: (str) => {
    return str
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  },

  generateId: (length = 8) => {
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  },
};

// Validation library
export const validationLib = {
  isEmail: (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  isGmail: (email) => {
    return /@gmail\.com$/i.test(email);
  },

  isStrongPassword: (password) => {
    // At least 8 characters, one uppercase, one lowercase, one number, one special character
    const strongRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return strongRegex.test(password);
  },

  isPhoneNumber: (phone) => {
    // Basic phone validation (10 digits)
    const phoneRegex = /^\d{10}$/;
    return phoneRegex.test(phone);
  },

  isUrl: (url) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  },
};

// Storage library (localStorage/sessionStorage wrapper)
export const storageLib = {
  set: (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error("Storage set error:", error);
      return false;
    }
  },

  get: (key, defaultValue = null) => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error("Storage get error:", error);
      return defaultValue;
    }
  },

  remove: (key) => {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error("Storage remove error:", error);
      return false;
    }
  },

  clear: () => {
    try {
      localStorage.clear();
      return true;
    } catch (error) {
      console.error("Storage clear error:", error);
      return false;
    }
  },
};

// Device detection library
export const deviceLib = {
  isMobile: () => {
    return window.innerWidth <= 768;
  },

  isTablet: () => {
    return window.innerWidth > 768 && window.innerWidth <= 1024;
  },

  isDesktop: () => {
    return window.innerWidth > 1024;
  },

  isTouchDevice: () => {
    return "ontouchstart" in window || navigator.maxTouchPoints > 0;
  },

  getOS: () => {
    const userAgent = navigator.userAgent;
    if (/Windows/i.test(userAgent)) return "Windows";
    if (/Mac/i.test(userAgent)) return "MacOS";
    if (/Linux/i.test(userAgent)) return "Linux";
    if (/Android/i.test(userAgent)) return "Android";
    if (/iOS|iPhone|iPad|iPod/i.test(userAgent)) return "iOS";
    return "Unknown";
  },

  getBrowser: () => {
    const userAgent = navigator.userAgent;
    if (/Chrome/i.test(userAgent) && !/Edg/i.test(userAgent)) return "Chrome";
    if (/Firefox/i.test(userAgent)) return "Firefox";
    if (/Safari/i.test(userAgent) && !/Chrome/i.test(userAgent))
      return "Safari";
    if (/Edg/i.test(userAgent)) return "Edge";
    return "Unknown";
  },
};

// Export all libraries as a single object
export default {
  date: dateLib,
  number: numberLib,
  string: stringLib,
  validation: validationLib,
  storage: storageLib,
  device: deviceLib,
};

// RULE #165: Cache Persistence - Local storage utilities for user grid data

const CACHE_KEY = 'TradersApp_UserListCache';
const CACHE_VERSION = 1;
const DEFAULT_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Save user list to localStorage for offline access and faster loading
 * @param {Object} users - User data dictionary
 * @returns {boolean} Success status
 */
export const cacheUserList = (users) => {
  try {
    const cacheData = { users, timestamp: Date.now(), version: CACHE_VERSION };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
    return true;
  } catch (error) {
    console.warn('Failed to cache user list:', error);
    return false;
  }
};

/**
 * Retrieve cached user list from localStorage
 * @param {number} maxAgeMs - Maximum age of cache in milliseconds (default: 5 minutes)
 * @returns {Object|null} Cached users or null if expired/missing
 */
export const getCachedUserList = (maxAgeMs = DEFAULT_MAX_AGE_MS) => {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    const cacheData = JSON.parse(cached);

    if (Date.now() - cacheData.timestamp > maxAgeMs) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }

    if (cacheData.version !== CACHE_VERSION || !cacheData.users || typeof cacheData.users !== 'object') {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }

    return cacheData.users;
  } catch (error) {
    console.warn('Failed to retrieve cached user list:', error);
    return null;
  }
};

/**
 * Clear cached user list from localStorage
 * @returns {boolean} Success status
 */
export const clearUserListCache = () => {
  try {
    localStorage.removeItem(CACHE_KEY);
    return true;
  } catch (error) {
    console.warn('Failed to clear user list cache:', error);
    return false;
  }
};

/**
 * Get cache metadata — useful for diagnostics and cache status display
 * @returns {Object} Cache metadata with size, age, and validity info
 */
export const getUserListCacheMetadata = () => {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) {
      return { exists: false, size: 0, age: null, isExpired: true, userCount: 0 };
    }

    const cacheData = JSON.parse(cached);
    const age = Date.now() - cacheData.timestamp;
    const isExpired = age > DEFAULT_MAX_AGE_MS;

    return {
      exists: true,
      size: cached.length,
      age,
      isExpired,
      userCount: Object.keys(cacheData.users || {}).length,
      createdAt: new Date(cacheData.timestamp).toLocaleString()
    };
  } catch (error) {
    console.warn('Failed to get cache metadata:', error);
    return { exists: false, size: 0, age: null, isExpired: true, userCount: 0 };
  }
};

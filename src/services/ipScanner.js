/**
 * Duplicate IP Scanner - AI Watch Tower Module
 * 
 * Detects users sharing the same IP address for fraud prevention.
 * Returns duplicate UIDs grouped by IP for admin badge rendering.
 */

/**
 * Detect duplicate IPs in users object
 * @param {Object} users - Users object from Firebase { uid: { ...userData } }
 * @returns {Object} - { ip: [uid1, uid2, ...], ... }
 */
export function detectDuplicateIPs(users) {
  if (!users || typeof users !== 'object') {
    return {};
  }

  const ipMap = {};

  Object.entries(users).forEach(([uid, userData]) => {
    if (!userData) return;
    
    const ip = userData?.forensic?.ip || userData?.ip;
    
    if (ip && typeof ip === 'string') {
      if (!ipMap[ip]) {
        ipMap[ip] = [];
      }
      ipMap[ip].push({
        uid,
        email: userData.email || 'Unknown',
        fullName: userData.fullName || 'Unknown'
      });
    }
  });

  const duplicates = {};
  
  Object.entries(ipMap).forEach(([ip, users]) => {
    if (users.length > 1) {
      duplicates[ip] = users;
    }
  });

  return duplicates;
}

/**
 * Get list of duplicate UIDs
 * @param {Object} users - Users object from Firebase
 * @returns {Set} - Set of UIDs that share IPs with other users
 */
export function getDuplicateUIDs(users) {
  const duplicates = detectDuplicateIPs(users);
  const uids = new Set();
  
  Object.values(duplicates).forEach(users => {
    users.forEach(user => {
      if (users.length > 1) {
        uids.add(user.uid);
      }
    });
  });
  
  return uids;
}

/**
 * Check if a specific UID has duplicate IP
 * @param {string} uid - User UID to check
 * @param {Object} users - Users object from Firebase
 * @returns {boolean}
 */
export function hasDuplicateIP(uid, users) {
  const duplicateUIDs = getDuplicateUIDs(users);
  return duplicateUIDs.has(uid);
}

/**
 * Get duplicate info for a specific user
 * @param {string} uid - User UID
 * @param {Object} users - Users object from Firebase
 * @returns {Object|null} - { ip, otherUsers } or null
 */
export function getUserDuplicateInfo(uid, users) {
  if (!users || typeof users !== 'object') {
    return null;
  }

  const userData = users[uid];
  if (!userData) return null;

  const ip = userData?.forensic?.ip || userData?.ip;
  if (!ip) return null;

  const duplicates = detectDuplicateIPs(users);
  
  if (duplicates[ip]) {
    const otherUsers = duplicates[ip].filter(u => u.uid !== uid);
    if (otherUsers.length > 0) {
      return {
        ip,
        otherUsers,
        totalUsers: duplicates[ip].length
      };
    }
  }

  return null;
}

/**
 * Format duplicate count for display
 * @param {number} count - Number of duplicate users
 * @returns {string}
 */
export function formatDuplicateCount(count) {
  if (count === 2) return '2 users';
  return `${count} users`;
}

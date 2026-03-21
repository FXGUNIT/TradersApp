// Security utilities — cryptographic helpers

/**
 * Hash an admin password with the app salt using SHA-256 (Web Crypto API).
 * Salt is read from VITE_MASTER_SALT at build time — never hardcoded.
 * @param {string} password
 * @returns {Promise<string>} hex digest
 */
export const hashAdminPasswordWithSalt = async (password) => {
  const salt = import.meta.env.VITE_MASTER_SALT;
  const saltedPassword = password + salt;
  const encoder = new TextEncoder();
  const data = encoder.encode(saltedPassword);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

// Auth input validation utilities

export const calculatePasswordStrength = (password) => {
  if (!password) return 0;
  let strength = 0;

  if (password.length >= 8) strength++;
  if (password.length >= 12) strength++;

  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
  if (/\d/.test(password)) strength++;
  if (/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) strength++;

  return Math.min(strength, 3); // 0-3 scale
};

export const getStrengthLabel = (strength) => {
  if (strength === 0) return { label: 'Weak', color: '#FF453A' };
  if (strength === 1) return { label: 'Weak', color: '#FF453A' };
  if (strength === 2) return { label: 'Medium', color: '#FF9500' };
  return { label: 'Strong', color: '#34C759' };
};

// Gmail validation
export const isValidGmailAddress = (email) => {
  const trimmed = email.trim().toLowerCase();
  return trimmed.endsWith('@gmail.com') && trimmed.split('@')[0].length > 0;
};

// Check if password is expired (older than 120 days)
export const isPasswordExpired = (lastChangedTimestamp) => {
  if (!lastChangedTimestamp) return true;
  const lastChanged = new Date(lastChangedTimestamp);
  const now = new Date();
  const daysDiff = Math.floor((now - lastChanged) / (1000 * 60 * 60 * 24));
  return daysDiff > 120;
};

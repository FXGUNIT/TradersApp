// RULE #149: User Level Badge Helper - Determine user level based on status/role
export const getUserLevelBadge = (user) => {
  if (!user) return { level: 'User', color: '#A1A1A6', bg: 'rgba(161,161,166,0.15)' };

  // Admin takes priority
  if (user.role === 'admin') {
    return { level: '⭐ Admin', color: '#FFD60A', bg: 'rgba(255,214,10,0.15)' };
  }

  // Determine level based on status and activity
  if (user.status === 'ACTIVE') {
    const hasActiveTrading = user.journal && Object.keys(user.journal || {}).length >= 10;
    if (hasActiveTrading) {
      return { level: '💎 Elite', color: '#30B0C0', bg: 'rgba(48,176,192,0.15)' };
    }
    return { level: '⬆️ Pro', color: '#30D158', bg: 'rgba(48,209,88,0.15)' };
  }

  if (user.status === 'PENDING') {
    return { level: '🔄 Pending', color: '#FFD60A', bg: 'rgba(255,214,10,0.15)' };
  }

  if (user.status === 'BLOCKED') {
    return { level: '⛔ Blocked', color: '#FF453A', bg: 'rgba(255,69,58,0.15)' };
  }

  return { level: 'Member', color: '#0A84FF', bg: 'rgba(10,132,255,0.15)' };
};

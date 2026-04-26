export const triggerConfetti = (count = 30, duration = 2.5) => {
  const colors = ['#30D158', '#FFD60A', '#0A84FF', '#BF5AF2', '#64D2FF', '#FF375F'];
  
  for (let i = 0; i < count; i++) {
    const confetti = document.createElement('div');
    confetti.className = 'confetti-piece';
    
    const color = colors[Math.floor(Math.random() * colors.length)];
    const size = Math.random() * 8 + 4;
    const duration_ms = duration * 1000;
    const delay = Math.random() * 100;
    
    confetti.style.cssText = `
      left: ${Math.random() * 100}%;
      top: 0;
      width: ${size}px;
      height: ${size}px;
      background: ${color};
      border-radius: ${Math.random() > 0.5 ? '50%' : '0'};
      animation: confetti-fall ${duration}s cubic-bezier(0.25, 0.46, 0.45, 0.94) ${delay}ms forwards;
      opacity: ${Math.random() * 0.5 + 0.5};
    `;
    
    document.body.appendChild(confetti);
    setTimeout(() => confetti.remove(), duration_ms + delay);
  }
};

export const createCardTiltHandler = (element) => {
  if (!element) return;
  
  element.addEventListener('mousemove', (e) => {
    const rect = element.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    const rotateY = (x - centerX) * 0.02;
    const rotateX = (centerY - y) * 0.02;
    
    element.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`;
  });
  
  element.addEventListener('mouseleave', () => {
    element.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1)';
  });
  
  element.style.transition = 'transform 0.1s ease-out';
};

export const getTimeBasedGreeting = (userName = '') => {
  const hour = new Date().getHours();
  const firstName = userName ? userName.split(' ')[0] : 'Trader';
  
  let greeting = '';
  let emoji = '';
  
  if (hour < 5) {
    greeting = 'Night Owl';
    emoji = '🌙';
  } else if (hour < 12) {
    greeting = 'Good Morning';
    emoji = '☀️';
  } else if (hour < 17) {
    greeting = 'Good Afternoon';
    emoji = '🌤️';
  } else if (hour < 21) {
    greeting = 'Good Evening';
    emoji = '🌅';
  } else {
    greeting = 'Night Trading';
    emoji = '🌙';
  }
  
  return { greeting, emoji, fullGreeting: `${emoji} ${greeting}, ${firstName}` };
};

export const getUserLevelBadge = (user) => {
  if (!user) return { level: 'User', color: '#A1A1A6', bg: 'rgba(161,161,166,0.15)' };
  
  if (user.role === 'admin') {
    return { level: '⭐ Admin', color: '#FFD60A', bg: 'rgba(255,214,10,0.15)' };
  }
  
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

export const ACCENT_COLORS = {
  TRADING_GREEN: { name: 'Trading Green', hex: '#30D158', primary: '#30D158', light: 'rgba(48,209,88,0.2)', glow: 'rgba(48,209,88,0.6)' },
  GOLD: { name: 'Gold', hex: '#FFD60A', primary: '#FFD60A', light: 'rgba(255,214,10,0.2)', glow: 'rgba(255,214,10,0.6)' },
  BLUE: { name: 'Electric Blue', hex: '#0A84FF', primary: '#0A84FF', light: 'rgba(10,132,255,0.2)', glow: 'rgba(10,132,255,0.6)' },
  PURPLE: { name: 'Purple', hex: '#BF5AF2', primary: '#BF5AF2', light: 'rgba(191,90,242,0.2)', glow: 'rgba(191,90,242,0.6)' },
  CYAN: { name: 'Cyan', hex: '#64D2FF', primary: '#64D2FF', light: 'rgba(100,210,255,0.2)', glow: 'rgba(100,210,255,0.6)' },
  PINK: { name: 'Pink', hex: '#FF375F', primary: '#FF375F', light: 'rgba(255,55,95,0.2)', glow: 'rgba(255,55,95,0.6)' }
};

const THEME_PALETTES = {
  lumiere: {
    bg: "#FBFBFC",
    card: "rgba(255,255,255,0.88)",
    cardGlass: "rgba(255,255,255,0.76)",
    border: "rgba(15,23,42,0.08)",
    border2: "rgba(15,23,42,0.05)",
    muted: "#64748B",
    dim: "#94A3B8",
    text: "#111827",
    textSecondary: "#64748B",
    accent: {
      primary: "#2563EB",
      light: "rgba(37,99,235,0.14)",
      glow: "rgba(37,99,235,0.3)",
    },
  },
  amber: {
    bg: "#F4EBD0",
    card: "rgba(253,246,227,0.9)",
    cardGlass: "rgba(253,246,227,0.8)",
    border: "rgba(139,92,24,0.14)",
    border2: "rgba(139,92,24,0.08)",
    muted: "#7C6A53",
    dim: "#A89680",
    text: "#3D2B1F",
    textSecondary: "#7C6A53",
    accent: {
      primary: "#D97706",
      light: "rgba(217,119,6,0.16)",
      glow: "rgba(217,119,6,0.3)",
    },
  },
  midnight: {
    bg: "#05070A",
    card: "rgba(18,20,28,0.84)",
    cardGlass: "rgba(18,20,28,0.72)",
    border: "rgba(255,255,255,0.08)",
    border2: "rgba(255,255,255,0.05)",
    muted: "#94A3B8",
    dim: "#64748B",
    text: "#E2E8F0",
    textSecondary: "#94A3B8",
    accent: {
      primary: "#B8860B",
      light: "rgba(184,134,11,0.18)",
      glow: "rgba(184,134,11,0.28)",
    },
  },
};

export const createTheme = (isDark = true, accentKey = 'BLUE', themeName = null) => {
  const resolvedTheme = themeName || (isDark ? "midnight" : "lumiere");
  const palette = THEME_PALETTES[resolvedTheme] || THEME_PALETTES.lumiere;
  const requestedAccent = ACCENT_COLORS[accentKey] || ACCENT_COLORS.BLUE;
  const accent =
    resolvedTheme === "amber" || resolvedTheme === "midnight"
      ? palette.accent
      : requestedAccent;

  return {
    bg: palette.bg,
    card: palette.card,
    cardGlass: palette.cardGlass,
    border: palette.border,
    border2: palette.border2,
    borderGlass: accent.light,
    green: "#30D158",
    red: "#FF453A",
    gold: resolvedTheme === "amber" ? "#D97706" : "#FFD60A",
    blue: accent.primary,
    purple: resolvedTheme === "amber" ? "#9D5FA5" : "#BF5AF2",
    orange: resolvedTheme === "midnight" ? "#B8860B" : "#FF9F0A",
    cyan: "#64D2FF",
    pink: "#FF375F",
    accent: accent.primary,
    accentLight: accent.light,
    accentGlow: accent.glow,
    muted: palette.muted,
    dim: palette.dim,
    text: palette.text,
    textSecondary: palette.textSecondary,
    font: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    mono: '"SF Mono", "ui-monospace", "Cascadia Mono", "Roboto Mono", "IBM Plex Mono", monospace',
    amdA: accent.primary,
    amdM: resolvedTheme === "amber" ? "#A855F7" : "#BF5AF2",
    amdD: resolvedTheme === "amber" ? "#2F855A" : "#30D158",
    amdDB: "#FF453A",
    amdT: palette.dim,
    glassmorphism: {
      backdropFilter: 'blur(12px)',
      backgroundColor: palette.cardGlass,
      border: `1px solid ${accent.light}`,
      borderRadius: '12px'
    }
  };
};

export const cacheUserList = (users) => {
  try {
    const cacheData = {
      users,
      timestamp: Date.now(),
      version: 1
    };
    localStorage.setItem('TradersApp_UserListCache', JSON.stringify(cacheData));
    return true;
  } catch (error) {
    console.warn('Failed to cache user list:', error);
    return false;
  }
};

export const getCachedUserList = (maxAgeMs = 5 * 60 * 1000) => {
  try {
    const cached = localStorage.getItem('TradersApp_UserListCache');
    if (!cached) return null;
    
    const cacheData = JSON.parse(cached);
    
    if (Date.now() - cacheData.timestamp > maxAgeMs) {
      localStorage.removeItem('TradersApp_UserListCache');
      return null;
    }
    
    if (cacheData.version !== 1 || !cacheData.users || typeof cacheData.users !== 'object') {
      localStorage.removeItem('TradersApp_UserListCache');
      return null;
    }
    
    return cacheData.users;
  } catch (error) {
    console.warn('Failed to retrieve cached user list:', error);
    return null;
  }
};

export const clearUserListCache = () => {
  try {
    localStorage.removeItem('TradersApp_UserListCache');
    return true;
  } catch (error) {
    console.warn('Failed to clear user list cache:', error);
    return false;
  }
};

export const getISTState = () => {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  const ist = new Date(utcMs + 5.5 * 3600 * 1000);
  
  const h = ist.getHours();
  const m = ist.getMinutes();
  const s = ist.getSeconds();
  
  const tot = h * 60 + m;
  const OPEN = 10 * 60;
  const CLOSE = 17 * 60;
  
  const isOpen = tot >= OPEN && tot < CLOSE;
  let sec, lbl;
  
  if (tot < OPEN) {
    sec = (OPEN - tot) * 60 - s;
    lbl = 'OPENS IN';
  } else if (tot < CLOSE) {
    sec = (CLOSE - tot) * 60 - s;
    lbl = 'CLOSES IN';
  } else {
    sec = (24 * 60 - tot + OPEN) * 60 - s;
    lbl = 'OPENS IN';
  }
  
  const ch = String(Math.floor(sec / 3600)).padStart(2, '0');
  const cm = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
  const cs = String(sec % 60).padStart(2, '0');
  
  return {
    isOpen, h, m, s, lbl,
    countdown: `${ch}:${cm}:${cs}`,
    istStr: `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')} IST`
  };
};

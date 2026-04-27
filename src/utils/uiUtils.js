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
  if (!user) return { level: 'User', color: 'var(--aura-text-tertiary, #A1A1A6)', bg: 'color-mix(in srgb, var(--aura-text-tertiary, #A1A1A6) 15%, transparent)' };
  if (user.role === 'admin') return { level: '⭐ Admin', color: 'var(--aura-accent-primary, #FFD60A)', bg: 'color-mix(in srgb, var(--aura-accent-primary, #FFD60A) 15%, transparent)' };
  if (user.status === 'ACTIVE') {
    const hasActiveTrading = user.journal && Object.keys(user.journal || {}).length >= 10;
    if (hasActiveTrading) return { level: '💎 Elite', color: 'var(--aura-accent-primary, #30B0C0)', bg: 'color-mix(in srgb, var(--aura-accent-primary, #30B0C0) 15%, transparent)' };
    return { level: '⬆️ Pro', color: 'var(--aura-status-success, #30D158)', bg: 'color-mix(in srgb, var(--aura-status-success, #30D158) 15%, transparent)' };
  }
  if (user.status === 'PENDING') return { level: '🔄 Pending', color: 'var(--aura-accent-primary, #FFD60A)', bg: 'color-mix(in srgb, var(--aura-accent-primary, #FFD60A) 15%, transparent)' };
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

// THEME_PALETTES — All colors now reference CSS variables from index.css
// CSS vars cascade per theme (LUMIERE / AMBER / MIDNIGHT / OBSIDIAN)
const THEME_PALETTES = {
  lumiere: {
    bg:          "var(--aura-base-layer,          #fbfbfc)",
    card:         "var(--aura-surface-elevated,   #ffffff)",
    cardGlass:    "var(--aura-surface-glass,      rgba(255,255,255,0.76))",
    border:       "var(--aura-border-strong,      rgba(0,0,0,0.12))",
    border2:      "var(--aura-border-subtle,      rgba(0,0,0,0.05))",
    muted:        "var(--aura-text-secondary,      #6b7280)",
    dim:          "var(--aura-text-tertiary,       #9ca3af)",
    text:         "var(--aura-text-primary,       #121212)",
    textSecondary:"var(--aura-text-secondary,      #6b7280)",
    accent: {
      primary: "var(--aura-accent-primary,   #2563eb)",
      light:   "var(--aura-accent-glow,       rgba(37,99,235,0.14))",
      glow:    "rgba(37,99,235,0.3)",
    },
  },
  amber: {
    bg:          "var(--aura-base-layer,          #f4ebd0)",
    card:         "var(--aura-surface-elevated,   #fdf6e3)",
    cardGlass:    "var(--aura-surface-glass,      rgba(253,246,227,0.8))",
    border:       "var(--aura-border-strong,      rgba(139,92,24,0.2))",
    border2:      "var(--aura-border-subtle,      rgba(139,92,24,0.1))",
    muted:        "var(--aura-text-secondary,      #7c6a53)",
    dim:          "var(--aura-text-tertiary,       #a89680)",
    text:         "var(--aura-text-primary,       #3d2b1f)",
    textSecondary:"var(--aura-text-secondary,      #7c6a53)",
    accent: {
      primary: "var(--aura-accent-primary,   #d97706)",
      light:   "var(--aura-accent-glow,       rgba(217,119,6,0.16))",
      glow:    "rgba(217,119,6,0.3)",
    },
  },
  midnight: {
    bg:          "var(--aura-base-layer,          #05070a)",
    card:         "var(--aura-surface-elevated,   #12141c)",
    cardGlass:    "var(--aura-surface-glass,      rgba(18,20,28,0.72))",
    border:       "var(--aura-border-strong,      rgba(255,255,255,0.1))",
    border2:      "var(--aura-border-subtle,      rgba(255,255,255,0.05))",
    muted:        "var(--aura-text-secondary,      #94a3b8)",
    dim:          "var(--aura-text-tertiary,       #64748b)",
    text:         "var(--aura-text-primary,       #e1e1e1)",
    textSecondary:"var(--aura-text-secondary,      #94a3b8)",
    accent: {
      primary: "var(--aura-accent-primary,   #b8860b)",
      light:   "var(--aura-accent-glow,       rgba(56,189,248,0.1))",
      glow:    "rgba(184,134,11,0.28)",
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
    font: "'DM Sans', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Helvetica, Arial, sans-serif",
    mono: "'IBM Plex Mono', 'SF Mono', 'Menlo', 'Monaco', 'Courier New', monospace",
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

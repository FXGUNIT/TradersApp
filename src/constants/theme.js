// Design system: theme factory and color tokens

// ACCENT COLOR DEFINITIONS FOR THEME PICKER
export const ACCENT_COLORS = {
  TRADING_GREEN: { name: 'Trading Green', hex: '#30D158', primary: '#30D158', light: 'rgba(48,209,88,0.2)', glow: 'rgba(48,209,88,0.6)' },
  GOLD: { name: 'Gold', hex: '#FFD60A', primary: '#FFD60A', light: 'rgba(255,214,10,0.2)', glow: 'rgba(255,214,10,0.6)' },
  BLUE: { name: 'Electric Blue', hex: '#0A84FF', primary: '#0A84FF', light: 'rgba(10,132,255,0.2)', glow: 'rgba(10,132,255,0.6)' },
  PURPLE: { name: 'Purple', hex: '#BF5AF2', primary: '#BF5AF2', light: 'rgba(191,90,242,0.2)', glow: 'rgba(191,90,242,0.6)' },
  CYAN: { name: 'Cyan', hex: '#64D2FF', primary: '#64D2FF', light: 'rgba(100,210,255,0.2)', glow: 'rgba(100,210,255,0.6)' },
  PINK: { name: 'Pink', hex: '#FF375F', primary: '#FF375F', light: 'rgba(255,55,95,0.2)', glow: 'rgba(255,55,95,0.6)' },
};

// RULE #126: Glassmorphism Effect - Premium institutional terminal aesthetic
export const createTheme = (isDark = true, accentKey = 'BLUE') => {
  const accent = ACCENT_COLORS[accentKey] || ACCENT_COLORS.BLUE;
  return {
    // Core backgrounds
    bg: isDark ? "#0A0E27" : "#FFFFFF",
    card: isDark ? "rgba(20,24,50,0.5)" : "rgba(255,255,255,0.6)",
    cardGlass: isDark ? "rgba(20,24,50,0.4)" : "rgba(255,255,255,0.5)",

    // Borders - use accent color
    border: isDark ? `${accent.light}` : "rgba(0,0,0,0.1)",
    border2: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)",
    borderGlass: isDark ? `${accent.light}` : "rgba(0,0,0,0.1)",

    // Accent colors
    green: "#30D158",
    red: "#FF453A",
    gold: "#FFD60A",
    blue: "#0A84FF",
    purple: "#BF5AF2",
    orange: "#FF9F0A",
    cyan: "#64D2FF",
    pink: "#FF375F",

    // Primary accent color from picker
    accent: accent.primary,
    accentLight: accent.light,
    accentGlow: accent.glow,

    // Text colors
    muted: isDark ? "#8E8E93" : "#9CA3AF",
    dim: isDark ? "#3A3A3C" : "#D1D1D6",
    text: isDark ? "#F2F2F7" : "#111827",
    textSecondary: isDark ? "#A1A1A6" : "#64748B",

    // Fonts
    font: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    mono: '"SF Mono", "ui-monospace", "Cascadia Mono", "Roboto Mono", "IBM Plex Mono", monospace',

    // AMD colors
    amdA: "#0A84FF",
    amdM: "#BF5AF2",
    amdD: "#30D158",
    amdDB: "#FF453A",
    amdT: "#8E8E93",

    // Glassmorphism
    glassmorphism: {
      backdropFilter: 'blur(12px)',
      backgroundColor: isDark ? 'rgba(20,24,50,0.4)' : 'rgba(255,255,255,0.5)',
      border: `1px solid ${accent.light}`,
      borderRadius: '12px',
    },
  };
};

// Default theme instance - Pure White SaaS Aesthetic
export const T = createTheme(false, 'BLUE');

// AMD phase config — depends on T for colors
export const AMD_PHASES = {
  ACCUMULATION: { color: T.amdA, icon: "◎", label: "Accumulation (Mean Reversion)", desc: "Smart money building long positions" },
  MANIPULATION: { color: T.amdM, icon: "⚡", label: "Manipulation (Reversal)", desc: "Stop hunt / false breakout" },
  DISTRIBUTION: { color: T.amdD, icon: "◈", label: "Distribution (Trend)", desc: "Smart money offloading into strength" },
  TRANSITION: { color: T.amdT, icon: "⟳", label: "Transition (No Trade)", desc: "Phase shifting — stay flat" },
  UNCLEAR: { color: T.muted, icon: "?", label: "Phase Unclear", desc: "No clear institutional signature" },
};

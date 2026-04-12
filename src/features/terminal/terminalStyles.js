/**
 * Terminal Style Constants - extracted from terminalHelperComponents.jsx
 * Part of the terminal feature refactor (file size compliance).
 */
import { CSS_VARS } from "../../styles/cssVars.js";
import {
  Crosshair,
  Zap,
  TrendingUp,
  RefreshCw,
  HelpCircle,
} from "lucide-react";

const getCSSVar = (varName, fallback) => {
  if (typeof document === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || fallback;
};

export const getThemeColors = () => ({
  text: getCSSVar("--aura-text-primary", CSS_VARS.textPrimary),
  muted: getCSSVar("--aura-text-secondary", CSS_VARS.textSecondary),
  bg: getCSSVar("--aura-base-layer", CSS_VARS.baseLayer),
  card: getCSSVar("--aura-surface-elevated", CSS_VARS.surfaceElevated),
  border: getCSSVar("--aura-border-subtle", CSS_VARS.borderSubtle),
  accent: getCSSVar("--aura-accent-primary", CSS_VARS.accentPrimary),
});

export const T = {
  text: CSS_VARS.textPrimary,
  muted: CSS_VARS.textSecondary,
  dim: CSS_VARS.textTertiary,
  blue: CSS_VARS.statusInfo,
  orange: CSS_VARS.statusWarning,
  purple: CSS_VARS.amdManipulation,
  green: CSS_VARS.statusSuccess,
  red: CSS_VARS.statusDanger,
  gold: CSS_VARS.statusWarning,
  cyan: CSS_VARS.statusInfo,
  amdA: CSS_VARS.amdAccumulation,
  amdM: CSS_VARS.amdManipulation,
  amdD: CSS_VARS.amdDistribution,
  amdT: CSS_VARS.amdTransition,
  font: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif",
  mono: "'SF Mono', 'Menlo', 'Monaco', 'Courier New', monospace",
};

export const SOFT = {
  dangerBg: "var(--status-danger-soft, rgba(255,69,58,0.1))",
  dangerBorder: "var(--status-danger-border-soft, rgba(255,69,58,0.3))",
  successBg: "var(--status-success-soft, rgba(48,209,88,0.1))",
  successBorder: "var(--status-success-border-soft, rgba(48,209,88,0.3))",
  successBgQuiet: "var(--status-success-soft-quiet, rgba(48,209,88,0.05))",
  dangerBgQuiet: "var(--status-danger-soft-quiet, rgba(255,69,58,0.05))",
  warningBg: "var(--status-warning-soft, rgba(255,214,10,0.1))",
  warningBorder: "var(--status-warning-border-soft, rgba(255,214,10,0.3))",
  overlay: "var(--surface-overlay, rgba(0,0,0,0.4))",
  overlaySoft: "var(--surface-overlay-soft, rgba(0,0,0,0.3))",
  overlayMuted: "var(--surface-overlay-muted, rgba(0,0,0,0.6))",
  divider: "var(--border-strong, rgba(255,255,255,0.1))",
  borderSubtle: "var(--border-subtle, rgba(255,255,255,0.08))",
  emptyBar: "var(--surface-ghost, rgba(255,255,255,0.03))",
  inverseText: "var(--text-inverse, #FFFFFF)",
  shadowCard: "var(--shadow-card-subtle, 0 1px 3px 0 rgba(0, 0, 0, 0.05))",
};

// Time options for IST timezone
export const TIME_OPTIONS = (() => {
  const opts = [{ v: '', l: '— time IST —' }];
  for (let h = 10; h <= 17; h++) {
    for (let m = 0; m < 60; m += 5) {
      if (h === 17 && m > 0) continue;
      const hh = h > 12 ? h - 12 : (h === 0 ? 12 : h);
      const ampm = h >= 12 ? 'PM' : 'AM';
      opts.push({ v: `${hh}:${String(m).padStart(2, '0')} ${ampm}`, l: `${hh}:${String(m).padStart(2, '0')} ${ampm} IST` });
    }
  }
  return opts;
})();

export const AMD_PHASES = {
  ACCUMULATION: { color: T.amdA, Icon: Crosshair,    iconSize: 16, label: "Accumulation (Mean Reversion)", desc: "Smart money building long positions" },
  MANIPULATION: { color: T.amdM, Icon: Zap,          iconSize: 16, label: "Manipulation (Reversal)", desc: "Stop hunt / false breakout" },
  DISTRIBUTION: { color: T.amdD, Icon: TrendingUp,   iconSize: 16, label: "Distribution (Trend)", desc: "Smart money offloading into strength" },
  TRANSITION:   { color: T.amdT, Icon: RefreshCw,    iconSize: 16, label: "Transition (No Trade)", desc: "Phase shifting — stay flat" },
  UNCLEAR:      { color: T.muted, Icon: HelpCircle,  iconSize: 16, label: "Phase Unclear", desc: "No clear institutional signature" },
};

// Style constants matching backup exactly
export const getInputStyle = () => {
  const colors = getThemeColors();
  return {
    background: colors.card,
    border: `1px solid ${colors.border}`,
    borderRadius: 8,
    padding: "12px 14px",
    color: colors.text,
    fontFamily: T.mono,
    fontSize: 14,
    width: "100%",
    boxSizing: "border-box",
    outline: "none",
    transition: "all 0.2s ease",
  };
};

export const inp = {
  background: CSS_VARS.baseLayer,
  border: `1px solid ${CSS_VARS.borderSubtle}`,
  borderRadius: 8,
  padding: "12px 14px",
  color: T.text,
  fontFamily: T.mono,
  fontSize: 14,
  width: "100%",
  boxSizing: "border-box",
  outline: "none",
  transition: "all 0.2s ease",
  backdropFilter: "none",
  WebkitBackdropFilter: "none"
};

export const cardS = (e = {}) => {
  const colors = getThemeColors();
  return {
    background: colors.card,
    border: "none",
    borderRadius: 12,
    padding: "24px 32px",
    marginBottom: 16,
    boxShadow: SOFT.shadowCard,
    ...e
  };
};

export const glowBtn = (color, disabled) => ({
  background: disabled ? CSS_VARS.baseLayer : CSS_VARS.surfaceElevated,
  border: `1px solid ${CSS_VARS.borderSubtle}`,
  borderRadius: 6,
  padding: "12px 24px",
  cursor: disabled ? "not-allowed" : "pointer",
  color: disabled ? CSS_VARS.textTertiary : CSS_VARS.textPrimary,
  fontFamily: T.font,
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: 1.5,
  transition: "all 0.2s ease",
  opacity: disabled ? 0.6 : 1,
});

export const lbl = {
  color: CSS_VARS.textSecondary,
  fontSize: 11,
  letterSpacing: 1.5,
  marginBottom: 6,
  display: "block",
  textTransform: "uppercase",
  fontWeight: 600,
  fontFamily: T.font
};
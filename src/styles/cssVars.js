// Centralized CSS variable references for the AURA theme.
// Keeps JSX aligned with the token system and preserves legacy fallbacks.

export const CSS_VARS = {
  baseLayer: "var(--base-layer, var(--aura-base-layer, #fbfbfc))",
  surfaceElevated:
    "var(--surface-elevated, var(--aura-surface-elevated, #ffffff))",
  surfaceGlass:
    "var(--surface-glass, var(--aura-surface-glass, rgba(255,255,255,0.8)))",
  textPrimary: "var(--text-primary, var(--aura-text-primary, #121212))",
  textSecondary:
    "var(--text-secondary, var(--aura-text-secondary, #6b7280))",
  textTertiary:
    "var(--text-tertiary, var(--aura-text-tertiary, #9ca3af))",
  borderSubtle:
    "var(--border-subtle, var(--aura-border-subtle, rgba(0,0,0,0.05))",
  borderStrong:
    "var(--border-strong, var(--aura-border-strong, rgba(0,0,0,0.12))",
  accentPrimary:
    "var(--accent-primary, var(--aura-accent-primary, #2563eb))",
  accentGlow: "var(--accent-glow, var(--aura-accent-glow, rgba(37,99,235,0.1)))",
  statusSuccess:
    "var(--status-success, var(--aura-status-success, #10B981))",
  statusWarning:
    "var(--status-warning, var(--aura-status-warning, #F59E0B))",
  statusDanger:
    "var(--status-danger, var(--aura-status-danger, #EF4444))",
  statusInfo: "var(--status-info, var(--aura-status-info, #3B82F6))",
  amdAccumulation:
    "var(--amd-accumulation, var(--aura-amd-accumulation, #0A84FF))",
  amdManipulation:
    "var(--amd-manipulation, var(--aura-amd-manipulation, #BF5AF2))",
  amdDistribution:
    "var(--amd-distribution, var(--aura-amd-distribution, #30D158))",
  amdTransition:
    "var(--amd-transition, var(--aura-amd-transition, #8E8E93))",
  text: "var(--text-primary, var(--aura-text-primary, #121212))",
  bg: "var(--base-layer, var(--aura-base-layer, #fbfbfc))",
  card: "var(--surface-elevated, var(--aura-surface-elevated, #ffffff))",
  border:
    "var(--border-subtle, var(--aura-border-subtle, rgba(0,0,0,0.05))",
  accent: "var(--accent-primary, var(--aura-accent-primary, #2563eb))",
  surface: "var(--surface-elevated, var(--aura-surface-elevated, #ffffff))",
};

export default { CSS_VARS };

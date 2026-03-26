// Centralized CSS variable references for AURA theme
// Provides safe fallbacks for light/dark themes via CSS variables

export const CSS_VARS = {
  text: "var(--aura-text-primary, #121212)",
  textSecondary: "var(--aura-text-secondary, #6b7280)",
  bg: "var(--aura-base-layer, #fbfbfc)",
  card: "var(--aura-surface-elevated, #ffffff)",
  border: "var(--aura-border-subtle, rgba(0,0,0,0.05))",
  accent: "var(--aura-accent-primary, #2563eb)",
  surface: "var(--aura-surface-elevated, #ffffff)",
};

export default { CSS_VARS };

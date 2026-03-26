import React from "react";

/**
 * ThemeSwitcher Component - World-Class Design
 * Lumiere / Amber / Midnight mode selector
 * 
 * Features:
 * - Three-state orb selector
 * - Smooth transitions and active state clarity
 * - Works seamlessly with app theme system
 */
const ThemeSwitcher = ({ currentTheme = "lumiere", onThemeChange = () => {} }) => {
  const themes = [
    { 
      id: "lumiere", 
      label: "L", 
      description: "Lumière - Day mode"
    },
    { 
      id: "amber", 
      label: "A", 
      description: "Amber - Eye Comfort"
    },
    { 
      id: "midnight", 
      label: "M", 
      description: "Midnight - Night mode"
    },
  ];

  return (
    <div style={styles.container}>
      <div style={styles.switcherGroup}>
        {themes.map((theme) => {
          const isActive = currentTheme === theme.id;
          
          return (
            <button
              key={theme.id}
              onClick={() => onThemeChange(theme.id)}
              style={{
                ...styles.pillButton,
                ...(isActive ? styles.pillButtonActive : styles.pillButtonInactive),
              }}
              title={theme.description}
              aria-pressed={isActive}
            >
              <span style={{
                ...styles.label,
                ...(isActive ? styles.labelActive : styles.labelInactive)
              }}>
                {theme.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

const styles = {
  container: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  switcherGroup: {
    display: "flex",
    gap: "6px",
    alignItems: "center",
    backgroundColor: "var(--surface-glass, rgba(0, 0, 0, 0.08))",
    padding: "6px",
    borderRadius: "999px",
    border: "1px solid var(--border-subtle, rgba(0, 0, 0, 0.06))",
    boxShadow: "var(--aura-shadow, 0 4px 24px rgba(0, 0, 0, 0.08))",
  },

  pillButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "36px",
    height: "36px",
    borderRadius: "50%",
    border: "1px solid transparent",
    cursor: "pointer",
    fontFamily: "'IBM Plex Mono', 'SF Mono', monospace",
    fontSize: "11px",
    fontWeight: "700",
    transition: "transform 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease",
    outline: "none",
  },

  pillButtonActive: {
    background: "var(--accent-primary, #2563eb)",
    color: "var(--accent-text, #ffffff)",
    borderColor: "var(--accent-primary, #2563eb)",
    boxShadow: "0 0 0 6px var(--accent-glow, rgba(37,99,235,0.1))",
    transform: "translateY(-1px)",
  },

  pillButtonInactive: {
    backgroundColor: "transparent",
    color: "var(--text-secondary, rgba(0, 0, 0, 0.4))",
    borderColor: "var(--border-subtle, rgba(0, 0, 0, 0.06))",
  },

  label: {
    userSelect: "none",
    letterSpacing: "0.5px",
  },

  labelActive: {
    color: "var(--accent-text, #ffffff)",
  },

  labelInactive: {
    color: "var(--text-secondary, rgba(0, 0, 0, 0.4))",
  },
};

export default ThemeSwitcher;

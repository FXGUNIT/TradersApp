import React from "react";

/**
 * ThemeSwitcher Component - World-Class Design
 * Day / Night / Eye Comfort mode selector
 * 
 * Features:
 * - Beautiful 3-button pill selector
 * - Smooth transitions and hover effects
 * - Active state clearly visible
 * - Works seamlessly with app theme system
 */
const ThemeSwitcher = ({ currentTheme = "day", onThemeChange = () => {} }) => {
  const themes = [
    { 
      id: "day", 
      label: "L", 
      description: "Lumière - Day mode"
    },
    { 
      id: "eye", 
      label: "W", 
      description: "Amber - Eye Comfort"
    },
    { 
      id: "night", 
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
    gap: "2px",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.08)",
    padding: "3px",
    borderRadius: "6px",
    border: "1px solid rgba(0, 0, 0, 0.06)",
  },

  pillButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "28px",
    height: "24px",
    borderRadius: "4px",
    border: "none",
    cursor: "pointer",
    fontFamily: "'IBM Plex Mono', 'SF Mono', monospace",
    fontSize: "11px",
    fontWeight: "700",
    transition: "all 0.2s ease",
    outline: "none",
  },

  pillButtonActive: {
    background: "#1a1a1a",
    color: "#ffffff",
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.2)",
  },

  pillButtonInactive: {
    backgroundColor: "transparent",
    color: "rgba(0, 0, 0, 0.4)",
  },

  label: {
    userSelect: "none",
    letterSpacing: "0.5px",
  },

  labelActive: {
    color: "#ffffff",
  },

  labelInactive: {
    color: "rgba(0, 0, 0, 0.4)",
  },
};

export default ThemeSwitcher;
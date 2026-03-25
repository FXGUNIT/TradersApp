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
      label: "Day", 
      icon: "☀️",
      description: "Bright & clear"
    },
    { 
      id: "night", 
      label: "Night", 
      icon: "🌙",
      description: "Dark mode"
    },
    { 
      id: "eye", 
      label: "Eye Comfort", 
      icon: "👓",
      description: "Warm tones"
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
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.opacity = "1";
                  e.currentTarget.style.transform = "scale(1.02)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.opacity = "0.75";
                  e.currentTarget.style.transform = "scale(1)";
                }
              }}
              title={theme.description}
              aria-pressed={isActive}
            >
              <span style={{
                ...styles.icon,
                ...(isActive ? styles.iconActive : {})
              }}>
                {theme.icon}
              </span>
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
    gap: "4px",
    alignItems: "center",
    backgroundColor: "rgba(128, 128, 128, 0.15)",
    padding: "4px",
    borderRadius: "28px",
    border: "1px solid rgba(128, 128, 128, 0.2)",
  },

  pillButton: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    padding: "8px 14px",
    borderRadius: "22px",
    border: "none",
    cursor: "pointer",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    fontSize: "12px",
    fontWeight: "600",
    transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
    outline: "none",
    whiteSpace: "nowrap",
  },

  pillButtonActive: {
    background: "linear-gradient(135deg, #0A84FF 0%, #0066CC 100%)",
    color: "#FFFFFF",
    boxShadow: "0 4px 15px rgba(10, 132, 255, 0.4), 0 2px 8px rgba(0, 0, 0, 0.2)",
    transform: "scale(1.03)",
    border: "1px solid rgba(255, 255, 255, 0.2)",
  },

  pillButtonInactive: {
    backgroundColor: "transparent",
    color: "rgba(255, 255, 255, 0.6)",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    opacity: 0.75,
  },

  icon: {
    fontSize: "14px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "transform 0.2s ease",
  },

  iconActive: {
    transform: "scale(1.1)",
  },

  label: {
    userSelect: "none",
    letterSpacing: "0.3px",
  },

  labelActive: {
    color: "#FFFFFF",
    textShadow: "0 1px 2px rgba(0, 0, 0, 0.3)",
  },

  labelInactive: {
    color: "rgba(255, 255, 255, 0.6)",
  },
};

export default ThemeSwitcher;
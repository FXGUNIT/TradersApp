import React from 'react';

/**
 * ThemeSwitcher Component
 * Modern pill-button theme selector for Day/Night/Eye Comfort modes
 * 
 * Features:
 * - Three theme options with icons
 * - Active state with accent color background
 * - Smooth 0.3s transitions between themes
 * - Accessibility-friendly button styling
 */
const ThemeSwitcher = ({ currentTheme = 'day', onThemeChange = () => {} }) => {
  const themes = [
    { id: 'day', label: 'Day', icon: '☀️' },
    { id: 'night', label: 'Night', icon: '🌙' },
    { id: 'comfort', label: 'Eye Comfort', icon: '👓' }
  ];

  const handleThemeChange = (themeId) => {
    onThemeChange(themeId);
  };

  return (
    <div style={styles.container}>
      <div style={styles.switcherGroup}>
        {themes.map((theme) => (
          <button
            key={theme.id}
            onClick={() => handleThemeChange(theme.id)}
            style={{
              ...styles.pillButton,
              ...(currentTheme === theme.id ? styles.pillButtonActive : styles.pillButtonInactive)
            }}
            title={`Switch to ${theme.label} mode`}
            aria-pressed={currentTheme === theme.id}
            className="theme-switcher-btn"
          >
            <span style={styles.icon}>{theme.icon}</span>
            <span style={styles.label}>{theme.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 16px'
  },

  switcherGroup: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: '6px 8px',
    borderRadius: '24px',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    transition: 'all 0.3s ease-in-out'
  },

  pillButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 16px',
    borderRadius: '20px',
    border: 'none',
    cursor: 'pointer',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif",
    fontSize: '13px',
    fontWeight: '500',
    transition: 'all 0.3s ease-in-out',
    whiteSpace: 'nowrap',
    outline: 'none'
  },

  pillButtonActive: {
    backgroundColor: 'var(--accent)',
    color: '#FFFFFF',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
    transform: 'scale(1.02)',
    border: '1px solid var(--accent)'
  },

  pillButtonInactive: {
    backgroundColor: 'transparent',
    color: 'var(--text)',
    border: '1px solid var(--border)',
    opacity: 0.7
  },

  icon: {
    fontSize: '16px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center'
  },

  label: {
    userSelect: 'none'
  }
};

// Hover state - add via inline event handlers for better control
const _addHoverStyles = (element) => {
  if (element) {
    element.addEventListener('mouseenter', function() {
      if (!this.style.backgroundColor.includes('var(--accent)')) {
        this.style.opacity = '1';
        this.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
      }
    });
    element.addEventListener('mouseleave', function() {
      if (!this.style.backgroundColor.includes('var(--accent)')) {
        this.style.opacity = '0.7';
        this.style.backgroundColor = 'transparent';
      }
    });
  }
};

// Export component
export default ThemeSwitcher;

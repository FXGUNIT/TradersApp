import React from 'react';

const SystemThemeSync = ({ isDarkMode, onThemeChange }) => {
  return (
    <button
      onClick={() => onThemeChange(!isDarkMode)}
      style={{
        background: isDarkMode ? 'rgba(0,122,255,0.15)' : 'rgba(255,193,7,0.15)',
        border: `1px solid ${isDarkMode ? 'rgba(0,122,255,0.3)' : 'rgba(255,193,7,0.3)'}`,
        borderRadius: 6,
        padding: '8px 12px',
        cursor: 'pointer',
        color: isDarkMode ? '#0A84FF' : '#FFD60A',
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto',
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 1,
        transition: 'all 0.2s ease-in-out',
        display: 'flex',
        alignItems: 'center',
        gap: 6
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = isDarkMode ? 'rgba(0,122,255,0.2)' : 'rgba(255,193,7,0.2)';
        e.currentTarget.style.boxShadow = isDarkMode ? '0 0 15px rgba(0,122,255,0.2)' : '0 0 15px rgba(255,193,7,0.2)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = isDarkMode ? 'rgba(0,122,255,0.15)' : 'rgba(255,193,7,0.15)';
        e.currentTarget.style.boxShadow = 'none';
      }}
      title={isDarkMode ? 'Light Mode' : 'Dark Mode'}
    >
      {isDarkMode ? '🌙' : '☀️'}
    </button>
  );
};

export default SystemThemeSync;

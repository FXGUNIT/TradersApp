import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { createTheme, ACCENT_COLORS } from '../utils/uiUtils';

const ThemeContext = createContext(null);

export const ThemeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme_mode');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  const [accentKey, setAccentKey] = useState(() => {
    return localStorage.getItem('theme_accent') || 'BLUE';
  });

  const [currentTheme, setCurrentTheme] = useState('day');

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => {
      if (!localStorage.getItem('theme_mode')) {
        setIsDarkMode(e.matches);
      }
    };
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const toggleDarkMode = useCallback(() => {
    setIsDarkMode(prev => {
      const newValue = !prev;
      localStorage.setItem('theme_mode', newValue ? 'dark' : 'light');
      return newValue;
    });
  }, []);

  const cycleTheme = useCallback(() => {
    const cycle = { day: 'night', night: 'eye', eye: 'day' };
    setCurrentTheme(prev => {
      const next = cycle[prev] || 'day';
      localStorage.setItem('theme_mode_name', next);
      return next;
    });
  }, []);

  const setAccent = useCallback((key) => {
    if (ACCENT_COLORS[key]) {
      setAccentKey(key);
      localStorage.setItem('theme_accent', key);
    }
  }, []);

  const theme = createTheme(isDarkMode, accentKey);

  const value = {
    isDarkMode,
    toggleDarkMode,
    currentTheme,
    cycleTheme,
    accentKey,
    setAccent,
    accentColors: ACCENT_COLORS,
    theme
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export default useTheme;

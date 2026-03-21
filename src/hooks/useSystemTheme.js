import { useState, useEffect } from 'react';

// RULE #121: System Theme Sync - Auto-detect OS dark/light mode preference
const useSystemTheme = () => {
  // Initialize from OS preference
  const [isDarkMode, setIsDarkMode] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
  
  useEffect(() => {
    // Listen for OS theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => setIsDarkMode(e.matches);
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);
  
  return isDarkMode;
};

export default useSystemTheme;

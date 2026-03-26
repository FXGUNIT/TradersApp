import { useState, useEffect, useCallback, createContext, useContext } from "react";
import { createTheme, ACCENT_COLORS } from "../utils/uiUtils";

const ThemeContext = createContext(null);

const THEME_ORDER = ["lumiere", "amber", "midnight"];
const LEGACY_THEME_MAP = {
  day: "lumiere",
  eye: "amber",
  night: "midnight",
  lumiere: "lumiere",
  amber: "amber",
  midnight: "midnight",
};

const normalizeTheme = (value) => LEGACY_THEME_MAP[value] || "lumiere";

export const ThemeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem("theme_mode");
    if (saved) return saved === "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  const [accentKey, setAccentKey] = useState(() => {
    return localStorage.getItem("theme_accent") || "BLUE";
  });

  const [currentTheme, setCurrentTheme] = useState(() => {
    return normalizeTheme(
      localStorage.getItem("theme_mode_name") ||
        localStorage.getItem("appTheme") ||
        localStorage.getItem("aura-theme"),
    );
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e) => {
      if (!localStorage.getItem("theme_mode")) {
        setIsDarkMode(e.matches);
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const toggleDarkMode = useCallback(() => {
    setIsDarkMode((prev) => {
      const newValue = !prev;
      localStorage.setItem("theme_mode", newValue ? "dark" : "light");
      return newValue;
    });
  }, []);

  const cycleTheme = useCallback(() => {
    setCurrentTheme((prev) => {
      const current = normalizeTheme(prev);
      const next =
        THEME_ORDER[(THEME_ORDER.indexOf(current) + 1) % THEME_ORDER.length];
      localStorage.setItem("theme_mode_name", next);
      localStorage.setItem("theme_mode", next === "midnight" ? "dark" : "light");
      localStorage.setItem("appTheme", next);
      localStorage.setItem("aura-theme", next);
      return next;
    });
  }, []);

  const setAccent = useCallback((key) => {
    if (ACCENT_COLORS[key]) {
      setAccentKey(key);
      localStorage.setItem("theme_accent", key);
    }
  }, []);

  const theme = createTheme(isDarkMode, accentKey);

  useEffect(() => {
    const auraTheme = normalizeTheme(currentTheme);
    try {
      document.documentElement.setAttribute("data-aura-theme", auraTheme);
      document.documentElement.setAttribute("data-theme", auraTheme);
      document.body.classList.remove(
        "theme-day",
        "theme-night",
        "theme-eye",
        "theme-lumiere",
        "theme-amber",
        "theme-midnight",
      );
      document.body.classList.add(`theme-${auraTheme}`);
    } catch {
      // ignore SSR / sandbox contexts
    }
  }, [currentTheme]);

  const value = {
    isDarkMode,
    toggleDarkMode,
    currentTheme,
    cycleTheme,
    accentKey,
    setAccent,
    accentColors: ACCENT_COLORS,
    theme,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};

export default useTheme;

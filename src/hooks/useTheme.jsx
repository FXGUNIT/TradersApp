/* eslint-disable react-refresh/only-export-components */
import { useState, useEffect, useCallback, createContext, useContext } from "react";
import { createTheme, ACCENT_COLORS } from "../utils/uiUtils";

const ThemeContext = createContext(null);

const THEME_ORDER = ["lumiere", "amber", "obsidian", "midnight"];
const LEGACY_THEME_MAP = {
  day: "lumiere",
  eye: "amber",
  night: "midnight",
  lumiere: "lumiere",
  amber: "amber",
  obsidian: "obsidian",
  midnight: "midnight",
};

const normalizeTheme = (value) => LEGACY_THEME_MAP[value] || "lumiere";
const readInitialTheme = () => {
  try {
    const storedTheme =
      localStorage.getItem("theme_mode_name") ||
      localStorage.getItem("appTheme") ||
      localStorage.getItem("aura-theme");

    if (storedTheme) {
      return normalizeTheme(storedTheme);
    }

    const storedMode = localStorage.getItem("theme_mode");
    if (storedMode === "dark") {
      const storedName = localStorage.getItem("theme_mode_name");
      if (storedName === "obsidian") return "obsidian";
      return "midnight";
    }
    if (storedMode === "light") {
      return "lumiere";
    }

    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "midnight"
      : "lumiere";
  } catch {
    return "lumiere";
  }
};

export const ThemeProvider = ({ children }) => {
  const [currentTheme, setCurrentTheme] = useState(readInitialTheme);
  const [isDarkMode, setIsDarkMode] = useState(
    () => readInitialTheme() === "midnight",
  );

  const [accentKey, setAccentKey] = useState(() => {
    return localStorage.getItem("theme_accent") || "BLUE";
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e) => {
      const hasManualTheme =
        localStorage.getItem("theme_mode") ||
        localStorage.getItem("theme_mode_name") ||
        localStorage.getItem("appTheme") ||
        localStorage.getItem("aura-theme");

      if (!hasManualTheme) {
        setIsDarkMode(e.matches);
        setCurrentTheme(e.matches ? "midnight" : "lumiere");
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const setTheme = useCallback((value) => {
    const next = normalizeTheme(value);
    setCurrentTheme(next);
    localStorage.setItem("theme_mode_name", next);
    localStorage.setItem("theme_mode", next === "midnight" || next === "obsidian" ? "dark" : "light");
    localStorage.setItem("appTheme", next);
    localStorage.setItem("aura-theme", next);
    setIsDarkMode(next === "midnight" || next === "obsidian");
    return next;
  }, []);

  const toggleDarkMode = useCallback(() => {
    setTheme(currentTheme === "midnight" || currentTheme === "obsidian" ? "lumiere" : "midnight");
  }, [currentTheme, setTheme]);

  const cycleTheme = useCallback(() => {
    setCurrentTheme((prev) => {
      const current = normalizeTheme(prev);
      const next =
        THEME_ORDER[(THEME_ORDER.indexOf(current) + 1) % THEME_ORDER.length];
      localStorage.setItem("theme_mode_name", next);
      localStorage.setItem("theme_mode", next === "midnight" || next === "obsidian" ? "dark" : "light");
      localStorage.setItem("appTheme", next);
      localStorage.setItem("aura-theme", next);
      setIsDarkMode(next === "midnight" || next === "obsidian");
      return next;
    });
  }, []);

  const setAccent = useCallback((key) => {
    if (ACCENT_COLORS[key]) {
      setAccentKey(key);
      localStorage.setItem("theme_accent", key);
    }
  }, []);

  const theme = createTheme(isDarkMode, accentKey, currentTheme);

  useEffect(() => {
    const auraTheme = normalizeTheme(currentTheme);
    try {
      document.documentElement.setAttribute("data-aura-theme", auraTheme);
      document.documentElement.setAttribute("data-theme", auraTheme);
      document.documentElement.style.backgroundColor = "var(--base-layer)";
      document.body.classList.remove(
        "theme-day",
        "theme-night",
        "theme-eye",
        "theme-lumiere",
        "theme-amber",
        "theme-obsidian",
        "theme-midnight",
      );
      document.body.classList.add(`theme-${auraTheme}`);
      document.body.style.backgroundColor = "var(--base-layer)";
      document.body.style.color = "var(--text-primary)";
      document.body.style.transition =
        "background-color 300ms cubic-bezier(0.4, 0, 0.2, 1), color 300ms cubic-bezier(0.4, 0, 0.2, 1)";
    } catch {
      // ignore SSR / sandbox contexts
    }
  }, [currentTheme]);

  const value = {
    isDarkMode,
    toggleDarkMode,
    currentTheme,
    setTheme,
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

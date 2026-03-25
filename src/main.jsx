import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";

/* AURA ENGINE - PRE-RENDER THEME DETECTION
 * Zero-FOUC implementation for [LUMIERE], [AMBER], [MIDNIGHT] states
 * This script runs before React renders to prevent Flash of Unstyled Content
 */
(function () {
  // Map legacy theme names to AURA states for backward compatibility
  const legacyThemeMap = {
    day: "lumiere",
    night: "midnight",
    eye: "amber",
    comfort: "amber",
  };

  // Get stored theme with fallback logic
  const storedTheme = localStorage.getItem("currentTheme") || "day";
  const auraTheme = legacyThemeMap[storedTheme] || "lumiere";

  // Apply theme attribute to document root for CSS variable activation
  document.documentElement.setAttribute("data-aura-theme", auraTheme);

  // Apply immediate background color for contrast smoothing (prevents white flash)
  document.documentElement.style.backgroundColor =
    auraTheme === "midnight"
      ? "#05070A"
      : auraTheme === "amber"
        ? "#F4EBD0"
        : "#FBFBFC";

  // Also set legacy theme class for backward compatibility
  document.body.classList.add(`theme-${storedTheme}`);

  // Store AURA theme for future reference
  localStorage.setItem("aura-theme", auraTheme);
})();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

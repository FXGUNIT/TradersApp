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

/* AURA SMART LATTICE - INTELLIGENT NAVIGATION CONTROLLER
 * Logic: Context-Aware, Session-Protected, Self-Hiding Vectors.
 */
(function AuraNavigation() {
  // 1. SESSION GUARD: The "No-Return" Protocol
  // Prevents "Back" arrow from showing restricted pages after Logout.
  function checkAuthStatus() {
    const isAuthenticated = !!localStorage.getItem("auth_token"); // Or your specific auth key
    const currentPath = window.location.pathname;

    // If user is on Login/Signup, kill all navigation arrows
    if (
      currentPath === "/login" ||
      currentPath === "/logout" ||
      !isAuthenticated
    ) {
      toggleLatticeVisibility(false);
      return false;
    }
    toggleLatticeVisibility(true);
    return true;
  }

  // 2. THE "INTELLIGENT BACK" LOGIC
  // Smart reasoning: Does the previous page belong to the current session?
  function handleSmartBack() {
    if (!checkAuthStatus()) return;

    const historyStack = JSON.parse(
      sessionStorage.getItem("aura_history") || "[]",
    );

    // If history is empty or the previous page was "Logout", force redirect to Dashboard
    if (historyStack.length <= 1) {
      window.location.href = "/dashboard";
    } else {
      window.history.back();
    }
  }

  // 3. COLLISION & PROXIMITY SENSING (THE "OOPH" FACTOR)
  // Makes arrows move away from user's focus or hide near buttons.
  function initProximitySensors() {
    const arrows = document.querySelectorAll(".aura-smart-arrow");

    document.addEventListener("mousemove", (e) => {
      arrows.forEach((arrow) => {
        const rect = arrow.getBoundingClientRect();
        const distance = Math.hypot(
          e.clientX - (rect.left + rect.width / 2),
          e.clientY - (rect.top + rect.height / 2),
        );

        // Self-Learning Opacity: Dim when far, shine when near.
        if (distance > 300) {
          arrow.style.opacity = "0.1";
          arrow.style.filter = "blur(2px)";
        } else if (distance < 100) {
          arrow.style.opacity = "1";
          arrow.style.filter = "blur(0px)";
          arrow.style.transform = "scale(1.1) translateY(-2px)";
        } else {
          arrow.style.opacity = "0.4";
        }
      });
    });
  }

  // 4. THE "SMART HIDE" DURING INPUT
  // Arrows must never overlap with typing or critical data viewing.
  function bindUIVisibility() {
    const criticalElements = "input, textarea, .trading-chart, .execution-zone";

    document.querySelectorAll(criticalElements).forEach((el) => {
      el.addEventListener("focus", () => toggleLatticeVisibility(false, 0.1));
      el.addEventListener("blur", () => toggleLatticeVisibility(true, 0.4));
    });
  }

  // 5. THE "PATENT SHINE" ANIMATION LOGIC
  function toggleLatticeVisibility(show, opacityValue = 1) {
    const lattice = document.getElementById("aura-navigation-lattice");
    if (!lattice) return;

    if (show) {
      lattice.style.display = "block";
      setTimeout(() => {
        lattice.style.opacity = opacityValue;
        lattice.style.transform = "translateY(0)";
      }, 10);
    } else {
      lattice.style.opacity = "0";
      lattice.style.transform = "translateY(20px)";
      setTimeout(() => {
        lattice.style.display = "none";
      }, 500);
    }
  }

  // Initialize on DOM ready
  document.addEventListener("DOMContentLoaded", () => {
    checkAuthStatus();
    initProximitySensors();
    bindUIVisibility();
  });

  // Export for debugging
  window.AuraNavigation = {
    checkAuthStatus,
    handleSmartBack,
    initProximitySensors,
    bindUIVisibility,
    toggleLatticeVisibility,
  };
})();

/* AURA CHRONOS AUTOMATIC THEME ENGINE
 * Time-Based Circadian Theme Switching
 * Automatically transitions between [LUMIERE], [AMBER], [MIDNIGHT] based on time of day
 */
(function AuraChronos() {
  // Time-based theme mapping (24-hour format)
  const TIME_THEME_MAP = [
    { start: 6, end: 17, theme: "lumiere", legacy: "day" }, // Day: 6 AM - 5 PM
    { start: 17, end: 21, theme: "amber", legacy: "eye" }, // Evening: 5 PM - 9 PM
    { start: 21, end: 6, theme: "midnight", legacy: "night" }, // Night: 9 PM - 6 AM
  ];

  // Legacy theme names for backward compatibility
  const AURA_TO_LEGACY = {
    lumiere: "day",
    amber: "eye",
    midnight: "night",
  };

  // Get current hour in user's local time
  function getCurrentHour() {
    return new Date().getHours();
  }

  // Determine which theme should be active based on current time
  function getTimeBasedTheme() {
    const currentHour = getCurrentHour();

    for (const timeSlot of TIME_THEME_MAP) {
      if (timeSlot.start <= timeSlot.end) {
        // Normal time range (e.g., 6-17)
        if (currentHour >= timeSlot.start && currentHour < timeSlot.end) {
          return { aura: timeSlot.theme, legacy: timeSlot.legacy };
        }
      } else {
        // Wrapping time range (e.g., 21-6)
        if (currentHour >= timeSlot.start || currentHour < timeSlot.end) {
          return { aura: timeSlot.theme, legacy: timeSlot.legacy };
        }
      }
    }

    // Fallback to LUMIERE
    return { aura: "lumiere", legacy: "day" };
  }

  // Apply theme with smooth transition
  function applyChronosTheme(auraTheme, legacyTheme) {
    // Update document attributes
    document.documentElement.setAttribute("data-aura-theme", auraTheme);
    document.documentElement.setAttribute("data-chronos-active", "true");

    // Update legacy theme class
    document.body.classList.remove("theme-day", "theme-night", "theme-eye");
    document.body.classList.add(`theme-${legacyTheme}`);

    // Update localStorage for persistence
    localStorage.setItem("aura-theme", auraTheme);
    localStorage.setItem("currentTheme", legacyTheme);
    localStorage.setItem("chronos-last-applied", Date.now());

    // Apply immediate background color for zero-FOUC
    document.documentElement.style.backgroundColor =
      auraTheme === "midnight"
        ? "#05070A"
        : auraTheme === "amber"
          ? "#F4EBD0"
          : "#FBFBFC";

    // Dispatch custom event for React components to listen to
    const themeChangeEvent = new CustomEvent("aura-chronos-theme-change", {
      detail: { auraTheme, legacyTheme, source: "chronos" },
    });
    document.dispatchEvent(themeChangeEvent);

    console.log(
      `🕒 AURA Chronos: Applied ${auraTheme.toUpperCase()} theme (${legacyTheme})`,
    );
  }

  // Check if user has manually overridden the theme
  function hasManualOverride() {
    const manualTheme = localStorage.getItem("aura-manual-override");
    const overrideExpiry = localStorage.getItem("aura-override-expiry");

    if (!manualTheme || !overrideExpiry) return false;

    // Check if override has expired
    if (Date.now() > parseInt(overrideExpiry, 10)) {
      // Clear expired override
      localStorage.removeItem("aura-manual-override");
      localStorage.removeItem("aura-override-expiry");
      return false;
    }

    return true;
  }

  // Set manual override (called when user manually changes theme)
  function setManualOverride(auraTheme, legacyTheme, durationHours = 24) {
    localStorage.setItem("aura-manual-override", auraTheme);
    localStorage.setItem("aura-override-legacy", legacyTheme);
    localStorage.setItem(
      "aura-override-expiry",
      Date.now() + durationHours * 60 * 60 * 1000,
    );
    localStorage.setItem("chronos-manual-override-set", Date.now());

    console.log(
      `🎛️ AURA Chronos: Manual override set to ${auraTheme} for ${durationHours} hours`,
    );
  }

  // Clear manual override
  function clearManualOverride() {
    localStorage.removeItem("aura-manual-override");
    localStorage.removeItem("aura-override-legacy");
    localStorage.removeItem("aura-override-expiry");
    localStorage.removeItem("chronos-manual-override-set");

    console.log("🔄 AURA Chronos: Manual override cleared");
  }

  // Main initialization
  function initChronosEngine() {
    // Check for manual override first
    if (hasManualOverride()) {
      const manualTheme = localStorage.getItem("aura-manual-override");
      const legacyTheme =
        localStorage.getItem("aura-override-legacy") ||
        AURA_TO_LEGACY[manualTheme] ||
        "day";
      console.log(`🎛️ AURA Chronos: Using manual override (${manualTheme})`);
      return;
    }

    // Get time-based theme
    const { aura, legacy } = getTimeBasedTheme();

    // Check if we need to apply the theme (only if different from current)
    const currentAuraTheme = localStorage.getItem("aura-theme");
    const currentLegacyTheme = localStorage.getItem("currentTheme");

    if (currentAuraTheme !== aura || currentLegacyTheme !== legacy) {
      applyChronosTheme(aura, legacy);
    }

    // Schedule next check (every 5 minutes)
    setTimeout(initChronosEngine, 5 * 60 * 1000);
  }

  // Initialize on DOM ready
  document.addEventListener("DOMContentLoaded", () => {
    // Small delay to ensure other theme systems have initialized
    setTimeout(initChronosEngine, 1000);
  });

  // Export for external use
  window.AuraChronos = {
    getTimeBasedTheme,
    applyChronosTheme,
    setManualOverride,
    clearManualOverride,
    hasManualOverride,
    initChronosEngine,
  };

  // Listen for manual theme changes from the app
  document.addEventListener("aura-manual-theme-change", (event) => {
    const { auraTheme, legacyTheme } = event.detail || {};
    if (auraTheme && legacyTheme) {
      setManualOverride(auraTheme, legacyTheme);
      applyChronosTheme(auraTheme, legacyTheme);
    }
  });

  // Listen for requests to clear manual override
  document.addEventListener("aura-clear-manual-override", () => {
    clearManualOverride();
    initChronosEngine(); // Re-apply time-based theme
  });
})();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

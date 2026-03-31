import React from "react";
import { SCREEN_IDS } from "./screenIds.js";
import ThemeSwitcher from "../../components/ThemeSwitcher.jsx";

const HIDDEN_SCREENS = new Set([
  SCREEN_IDS.LOADING,
  SCREEN_IDS.HUB,
  SCREEN_IDS.CONSCIOUSNESS,
  SCREEN_IDS.APP,
]);

export default function ShellThemeOverlay({
  screen,
  currentTheme,
  onThemeChange,
}) {
  if (HIDDEN_SCREENS.has(screen)) {
    return null;
  }

  return (
    <div
      style={{
        position: "fixed",
        top: 20,
        right: 20,
        zIndex: 180,
      }}
    >
      <ThemeSwitcher currentTheme={currentTheme} onThemeChange={onThemeChange} />
    </div>
  );
}

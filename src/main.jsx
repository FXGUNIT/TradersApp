import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";

const LEGACY_THEME_MAP = {
  day: "lumiere",
  eye: "amber",
  night: "midnight",
  lumiere: "lumiere",
  amber: "amber",
  midnight: "midnight",
};

const readInitialAuraTheme = () => {
  try {
    const savedTheme =
      localStorage.getItem("aura-theme") ||
      localStorage.getItem("appTheme") ||
      localStorage.getItem("theme_mode_name") ||
      "lumiere";
    return LEGACY_THEME_MAP[savedTheme] || "lumiere";
  } catch {
    return "lumiere";
  }
};

const initialAuraTheme = readInitialAuraTheme();
document.documentElement.setAttribute("data-aura-theme", initialAuraTheme);
document.documentElement.setAttribute("data-theme", initialAuraTheme);
document.documentElement.style.backgroundColor = "var(--base-layer)";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

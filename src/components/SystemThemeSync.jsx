import React from "react";

export default function SystemThemeSync({ isDarkMode, onThemeChange }) {
  const background = isDarkMode
    ? "var(--accent-glow, rgba(0,122,255,0.15))"
    : "rgba(255,193,7,0.15)";
  const border = isDarkMode
    ? "var(--accent-primary, #0A84FF)"
    : "rgba(255,193,7,0.3)";
  const textColor = isDarkMode
    ? "var(--accent-primary, #0A84FF)"
    : "var(--status-warning, #F59E0B)";

  return (
    <button
      onClick={() => onThemeChange(!isDarkMode)}
      style={{
        background,
        border: `1px solid ${border}`,
        borderRadius: 6,
        padding: "8px 12px",
        cursor: "pointer",
        color: textColor,
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto',
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 1,
        transition: "all 0.2s ease-in-out",
        display: "flex",
        alignItems: "center",
        gap: 6,
      }}
      onMouseEnter={(event) => {
        event.currentTarget.style.background = isDarkMode
          ? "var(--accent-glow, rgba(0,122,255,0.2))"
          : "rgba(255,193,7,0.2)";
        event.currentTarget.style.boxShadow = isDarkMode
          ? "0 0 15px rgba(0,122,255,0.2)"
          : "0 0 15px rgba(255,193,7,0.2)";
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.background = background;
        event.currentTarget.style.boxShadow = "none";
      }}
      title={isDarkMode ? "Light Mode" : "Dark Mode"}
    >
      {isDarkMode ? "MIDNIGHT" : "LUMIERE"}
    </button>
  );
}

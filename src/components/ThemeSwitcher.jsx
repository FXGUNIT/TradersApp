import React from "react";

const THEMES = [
  { id: "lumiere", label: "L", description: "Lumiere - Day mode" },
  { id: "amber", label: "A", description: "Amber - Eye comfort" },
  { id: "midnight", label: "M", description: "Midnight - Night mode" },
];

const ThemeSwitcher = ({ currentTheme = "lumiere", onThemeChange = () => {} }) => {
  const activeIndex = Math.max(
    0,
    THEMES.findIndex((theme) => theme.id === currentTheme),
  );

  return (
    <div className="aura-theme-switcher" style={{ "--theme-index": activeIndex }}>
      <div className="aura-theme-switcher__track" role="group" aria-label="Theme selector">
        <span className="aura-theme-switcher__glider" aria-hidden="true" />
        {THEMES.map((theme) => {
          const isActive = currentTheme === theme.id;

          return (
            <button
              key={theme.id}
              type="button"
              className="aura-theme-switcher__button"
              data-active={isActive ? "true" : "false"}
              onClick={() => onThemeChange(theme.id)}
              aria-pressed={isActive}
              aria-label={theme.description}
              title={theme.description}
            >
              <span className="aura-theme-switcher__label">{theme.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ThemeSwitcher;

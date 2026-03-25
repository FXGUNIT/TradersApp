// Shared UI layer - Reusable UI components and primitives
// This module exports UI components that are used across the application

// UI primitives (style objects and utilities)
export const UI_PRIMITIVES = {
  // Spacing scale (based on 4px increment)
  spacing: {
    xs: "4px",
    sm: "8px",
    md: "12px",
    lg: "16px",
    xl: "24px",
    "2xl": "32px",
    "3xl": "48px",
    "4xl": "64px",
  },

  // Border radius scale
  borderRadius: {
    none: "0",
    sm: "4px",
    md: "8px",
    lg: "12px",
    xl: "16px",
    "2xl": "24px",
    full: "9999px",
  },

  // Typography scale
  typography: {
    fontFamily: {
      sans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      mono: "'JetBrains Mono', 'Courier New', monospace",
    },
    fontSize: {
      xs: "12px",
      sm: "14px",
      base: "16px",
      lg: "18px",
      xl: "20px",
      "2xl": "24px",
      "3xl": "30px",
      "4xl": "36px",
      "5xl": "48px",
    },
    fontWeight: {
      normal: "400",
      medium: "500",
      semibold: "600",
      bold: "700",
      extrabold: "800",
    },
    lineHeight: {
      tight: "1.25",
      normal: "1.5",
      relaxed: "1.75",
      loose: "2",
    },
  },

  // Shadow scale
  shadows: {
    sm: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
    md: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
    lg: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
    xl: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
    "2xl": "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
    inner: "inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)",
    none: "none",
  },

  // Z-index scale
  zIndex: {
    hide: -1,
    auto: "auto",
    base: 0,
    docked: 10,
    dropdown: 1000,
    sticky: 1100,
    banner: 1200,
    overlay: 1300,
    modal: 1400,
    popover: 1500,
    skipLink: 1600,
    toast: 1700,
    tooltip: 1800,
  },

  // Animation durations
  animation: {
    duration: {
      fastest: "75ms",
      fast: "150ms",
      normal: "250ms",
      slow: "350ms",
      slowest: "500ms",
    },
    easing: {
      linear: "linear",
      ease: "ease",
      easeIn: "ease-in",
      easeOut: "ease-out",
      easeInOut: "ease-in-out",
    },
  },
};

// UI utility functions
export const UI_UTILS = {
  /**
   * Generate responsive style object
   * @param {Object} styles - Style object with breakpoint keys
   * @returns {Object} Responsive style object
   */
  responsive: (styles) => {
    return styles;
  },

  /**
   * Create CSS class string from conditions
   * @param {...any} args - Class names or condition objects
   * @returns {string} CSS class string
   */
  classNames: (...args) => {
    const classes = [];

    args.forEach((arg) => {
      if (!arg) return;

      if (typeof arg === "string") {
        classes.push(arg);
      } else if (typeof arg === "object") {
        Object.entries(arg).forEach(([key, value]) => {
          if (value) classes.push(key);
        });
      }
    });

    return classes.join(" ");
  },

  /**
   * Merge style objects
   * @param {...Object} styleObjects - Style objects to merge
   * @returns {Object} Merged style object
   */
  mergeStyles: (...styleObjects) => {
    return Object.assign({}, ...styleObjects);
  },

  /**
   * Create AURA theme style object
   * @param {string} auraState - AURA theme state ('lumiere', 'amber', 'midnight')
   * @returns {Object} Theme style object
   */
  createAuraTheme: (auraState = "lumiere") => {
    const themes = {
      lumiere: {
        backgroundColor: "var(--aura-base-layer, #FBFBFC)",
        color: "var(--aura-text-primary, #121212)",
        borderColor: "var(--aura-border-subtle, #E2E8F0)",
        accentColor: "var(--aura-accent-primary, #2563EB)",
      },
      amber: {
        backgroundColor: "var(--aura-base-layer, #F4EBD0)",
        color: "var(--aura-text-primary, #1A202C)",
        borderColor: "var(--aura-border-subtle, #E2D5B8)",
        accentColor: "var(--aura-accent-primary, #F59E0B)",
      },
      midnight: {
        backgroundColor: "var(--aura-base-layer, #05070A)",
        color: "var(--aura-text-primary, #EDF2F7)",
        borderColor: "var(--aura-border-subtle, #2D3748)",
        accentColor: "var(--aura-accent-primary, #8B5CF6)",
      },
    };

    return themes[auraState] || themes.lumiere;
  },

  /**
   * Create glassmorphism effect style
   * @param {Object} options - Glassmorphism options
   * @returns {Object} Glassmorphism style object
   */
  glassmorphism: (options = {}) => {
    const {
      blur = "12px",
      opacity = 0.88,
      saturation = "180%",
      borderWidth = "1px",
      borderOpacity = 0.2,
    } = options;

    return {
      backdropFilter: `blur(${blur}) saturate(${saturation})`,
      backgroundColor: `rgba(255, 255, 255, ${opacity})`,
      border: `${borderWidth} solid rgba(255, 255, 255, ${borderOpacity})`,
      borderRadius: "var(--aura-radius-lg, 12px)",
      boxShadow: "var(--aura-shadow-elevated, 0 8px 32px rgba(0, 0, 0, 0.1))",
    };
  },

  /**
   * Create elevation style
   * @param {number} level - Elevation level (0-5)
   * @returns {Object} Elevation style object
   */
  elevation: (level = 1) => {
    const elevations = {
      0: {
        boxShadow: "none",
      },
      1: {
        boxShadow: "var(--aura-shadow-subtle, 0 1px 3px rgba(0, 0, 0, 0.12))",
      },
      2: {
        boxShadow: "var(--aura-shadow-medium, 0 3px 6px rgba(0, 0, 0, 0.16))",
      },
      3: {
        boxShadow:
          "var(--aura-shadow-elevated, 0 10px 20px rgba(0, 0, 0, 0.19))",
      },
      4: {
        boxShadow: "var(--aura-shadow-high, 0 14px 28px rgba(0, 0, 0, 0.25))",
      },
      5: {
        boxShadow: "var(--aura-shadow-ultra, 0 19px 38px rgba(0, 0, 0, 0.3))",
      },
    };

    return elevations[Math.min(Math.max(level, 0), 5)] || elevations[1];
  },
};

// Export UI constants and utilities
export const UI_CONSTANTS = {
  ...UI_PRIMITIVES,
  utils: UI_UTILS,
};

// Note: Individual component exports are handled by the shared/index.js file
// which re-exports from the components directory. This file focuses on
// UI primitives and utilities only.

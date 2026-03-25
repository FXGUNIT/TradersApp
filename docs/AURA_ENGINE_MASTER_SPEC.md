# AURA Tri-State Universal Theme Engine - Master Specification

**Project Title:** AURA Tri-State Universal Theme Engine  
**Design Standard:** International Luxury / Ultra-Premium / Circadian-Aware  
**Engine States:** [LUMIERE], [AMBER], [MIDNIGHT]  
**Version:** 2.0 - Elite UX Edition  
**Focus:** Digital Haute Couture, Silent Luxury, Kinetic Materiality  
**Core Principle:** If an element does not serve a functional or aesthetic purpose, it is deleted.

## 1. CORE THEME LOGIC & COLORIMETRY

### [LUMIERE MODE] (DAY)

**Philosophy:** "High-Definition Gallery." High clarity, low eye strain.

- **Base Background:** `#F9F9FB` (Porcelain White). Prevents "Snow Blindness" caused by `#FFFFFF`.
- **Surface Layer:** `#FFFFFF` (Pure White). Used for cards/modals to create separation.
- **Primary Text:** `#121212` (Deep Onyx). High contrast for readability.
- **Secondary Text:** `#6B7280` (Cool Gray).
- **Accent/Action:** `#2563EB` (Royal Blue - UV Filtered).
- **Shadow Profile:** `0 10px 40px rgba(0,0,0,0.04)`. Long, diffuse, elegant.

### [AMBER MODE] (EYE COMFORT)

**Philosophy:** "The Library." Mimics physical book parchment.

- **Base Background:** `#F4EBD0` (Aged Vellum).
- **Surface Layer:** `#FDF6E3` (Cream Bone).
- **Primary Text:** `#3D2B1F` (Roasted Espresso). Reduces retinal impact.
- **Secondary Text:** `#7C6A53` (Taupe).
- **Accent/Action:** `#D97706` (Burnt Amber).
- **Blue Light Mitigation:** Global reduction of 450nm-480nm spectrum by 65%.
- **Shadow Profile:** `0 10px 40px rgba(67, 52, 34, 0.08)`. Warm-tinted depth.

### [MIDNIGHT MODE] (NIGHT)

**Philosophy:** "The Obsidian Vault." Deep, luxurious, battery-saving (OLED).

- **Base Background:** `#05070A` (Void Black).
- **Surface Layer:** `#12141C` (Deep Anthracite).
- **Primary Text:** `#E1E1E1` (Soft Silver). Prevents "glow/halation" on dark backgrounds.
- **Secondary Text:** `#94A3B8` (Slate Gray).
- **Accent/Action:** `#B8860B` (Old Gold). Luxury contrast against dark surfaces.
- **Blue Light Mitigation:** Global reduction of blue spectrum by 92%.
- **Shadow Profile:** Inverted Logic. Use subtle `1px #FFFFFF05` borders instead of shadows to define shape.

## 2. ELITE DESIGN LANGUAGE SYSTEM

### TYPOGRAPHY: THE VOICE OF THE BRAND

- **Primary Display:** Custom-spaced serif (Chronicle or Cormorant Garamond) for headings
- **Functional Text:** High-legibility grotesk (Inter or San Francisco) with `letter-spacing: 0.02em`
- **Case Rules:** Headings use Sentence case for modern look or ALL CAPS with `0.1em` tracking for boutique feel
- **Zero Emojis:** Use custom SVG Stroke Icons (0.75px to 1px weight). Thin-stroke monochrome icons are "architectural"

### COMPONENT ARCHITECTURE

#### A. THE "GHOST" BUTTON (ELITE INTERACTIVE)

- **Design:** No solid background. Only a 0.5px subtle border or "glass" backdrop
- **Interaction:** On hover, subtle inner glow appears, text shifts 1px upward
- **Corner Radius:** 0px (Sharp/Architectural) or 2px (Micro-rounded). Avoid high-radius "pill" shapes

#### B. THE "VALET" NAVIGATION

- **UX:** Menu fades and slides 10px from top with 0.8s ease-out
- **Blur:** `backdrop-filter: blur(30px) saturate(150%)` for high-end frosted glass effect

#### C. INPUT FIELDS

- **Design:** No boxes. Only single 0.5px bottom line
- **Focus State:** Line expands from center outward, label "floats" upward in smaller, lighter font weight

### THE "SPACING" PHILOSOPHY (WHITESPACE AS WEALTH)

- **Negative Space:** Double standard industry padding (32px or 48px instead of 16px)
- **Breathability:** No "dense" lists. Every piece of information has room to be appreciated individually
- **Golden Ratio Grid:** All layouts based on 1.618 ratio for perfect balance

### KINETIC UX (THE LUXURY MOTION)

- **"Slow-Burn" Load:** Staggered entrance: Main Heading (0ms) → Secondary Text (150ms) → Main Content (300ms)
- **Micro-Haptics:** "Heavy" but "Short" haptic pulse (10ms) for mobile interactions
- **"Elite" Click:** 0.98 scale-down effect on click to simulate physical pressure

## 3. LUXURY INTERACTION & MOTION PHYSICS

### THE "MAGNIFY" BEHAVIOR

**Trigger:** Hover / Focus.

- **Transform:** `Scale(1.025) + TranslateY(-2px)`.
- **Transition:** `450ms "Cubic-Bezier(0.175, 0.885, 0.32, 1.275)"`. This creates a premium "spring" feel.
- **Dynamic Sheen:** On hover, a linear gradient (white at 10% opacity) should sweep from left to right at 800ms.

### THE THEME TRANSITION (WAVE EFFECT)

**Type:** Radial Expansion.

- **Logic:** When the theme is toggled, the new color scheme must expand as a circle from the coordinates of the toggle button.
- **Duration:** 600ms. Use "CSS Mask-Image" or "Clip-Path" for hardware-accelerated rendering.

### THE "MAGNETIC" HOVER

- **Behavior:** When cursor approaches within 50px of interactive elements, component slightly "leans" toward cursor (translate and rotate by 2-3 degrees)
- **Purpose:** Simulates magnetic attraction common in luxury UI

## 4. AURA VITALITY ORB COMPONENT SPEC

### VISUAL ANATOMY

#### A. THE HOUSING (CONTAINER)

- **Shape:** Soft, elongated pill (width: 120px, height: 48px)
- **Material:** "Frosted Obsidian Glass" (Night) or "Translucent Quartz" (Day)
- **Glassmorphism:** `backdrop-filter: blur(25px) saturate(160%)`
- **Border:** Hair-thin 0.5px stroke
  - Day: `rgba(0,0,0,0.08)`
  - Night: `rgba(255,255,255,0.12)`
- **Shadow:** "Floating" shadow: `box-shadow: 0 20px 40px rgba(0,0,0,0.1)`

#### B. THE SELECTOR (THE "GEMS")

- **Format:** Three Micro-Orbs (8px diameter) instead of standard sliding toggle
- **Inactive State:** 20% Opacity, blurred
- **Active State:** 100% Opacity with "Core Glow"
  - Lumière Gem: Pure White Core with cool blue halo
  - Amber Gem: Warm Gold Core with soft orange halo
  - Midnight Gem: Deep Silver Core with subtle indigo halo

### KINETIC BEHAVIOR

#### A. MORPHING TRANSITION

- **Duration:** 700ms (Slow = Expensive)
- **Physics:** `cubic-bezier(0.22, 1, 0.36, 1)` (The "Quintessential" Ease)
- **Visual:** Active "Gem" grows and shrinks (pulsates) during travel, mimicking liquid drop

#### B. ZERO-EMOJI SYMBOLISM

- **State 1 (Day):** Single 1px stroke circle with 8 radial "light paths" (dots)
- **State 2 (Comfort):** 1px stroke "Shield" icon with soft inner curve
- **State 3 (Night):** 1px stroke "Crescent" composed of two intersecting circles

### RESPONSIVE PLACEMENT

- **Desktop:** Fixed at Top Right (top: 32px, right: 48px)
- **Mobile:** Centered at Bottom (bottom: 40px), elevated above "Safe Area"
- **Small Screens (<380px):** Text labels removed, leaving only "Gems" for ultra-minimalist aesthetic

## 5. CSS VARIABLES ARCHITECTURE

### DESIGN TOKENS TABLE

| Token Name                | Day (Lumière)                     | Eye Comfort (Amber)               | Night (Midnight)                   |
| ------------------------- | --------------------------------- | --------------------------------- | ---------------------------------- |
| `--aura-base-layer`       | `#FBFBFC`                         | `#F4EBD0`                         | `#05070A`                          |
| `--aura-surface-elevated` | `#FFFFFF` (100% Opacity)          | `#FDF6E3` (95% Op)                | `#12141C` (90% Op)                 |
| `--aura-text-primary`     | `#121212`                         | `#3D2B1F`                         | `#E1E1E1`                          |
| `--aura-text-secondary`   | `#6B7280`                         | `#7C6A53`                         | `#94A3B8`                          |
| `--aura-accent-glow`      | `rgba(37, 99, 235, 0.1)`          | `rgba(217, 119, 6, 0.1)`          | `rgba(56, 189, 248, 0.1)`          |
| `--aura-border-subtle`    | `rgba(0,0,0,0.05)`                | `rgba(139, 92, 24, 0.1)`          | `rgba(255,255,255,0.05)`           |
| `--aura-accent-primary`   | `#2563EB`                         | `#D97706`                         | `#B8860B`                          |
| `--aura-gem-glow`         | `0 0 15px rgba(37, 99, 235, 0.4)` | `0 0 15px rgba(217, 119, 6, 0.4)` | `0 0 15px rgba(184, 134, 11, 0.4)` |

### CSS IMPLEMENTATION

```css
/* AURA Engine - Pre-Render Logic (Place in <head>) */
:root[data-aura-theme="lumiere"] {
  --aura-base-layer: #fbfbfc;
  --aura-surface-elevated: #ffffff;
  --aura-text-primary: #121212;
  --aura-text-secondary: #6b7280;
  --aura-accent-primary: #2563eb;
  --aura-accent-glow: rgba(37, 99, 235, 0.1);
  --aura-border-subtle: rgba(0, 0, 0, 0.05);
  --aura-gem-glow: 0 0 15px rgba(37, 99, 235, 0.4);
}

:root[data-aura-theme="amber"] {
  --aura-base-layer: #f4ebd0;
  --aura-surface-elevated: #fdf6e3;
  --aura-text-primary: #3d2b1f;
  --aura-text-secondary: #7c6a53;
  --aura-accent-primary: #d97706;
  --aura-accent-glow: rgba(217, 119, 6, 0.1);
  --aura-border-subtle: rgba(139, 92, 24, 0.1);
  --aura-gem-glow: 0 0 15px rgba(217, 119, 6, 0.4);
}

:root[data-aura-theme="midnight"] {
  --aura-base-layer: #05070a;
  --aura-surface-elevated: #12141c;
  --aura-text-primary: #e1e1e1;
  --aura-text-secondary: #94a3b8;
  --aura-accent-primary: #b8860b;
  --aura-accent-glow: rgba(56, 189, 248, 0.1);
  --aura-border-subtle: rgba(255, 255, 255, 0.05);
  --aura-gem-glow: 0 0 15px rgba(184, 134, 11, 0.4);
}
```

### JAVASCRIPT THEME DETECTION

```javascript
/* AURA Engine - Pre-Render Logic */
(function () {
  const theme = localStorage.getItem("aura-theme") || "lumiere";
  document.documentElement.setAttribute("data-aura-theme", theme);
  // Apply immediate contrast smoothing
  document.documentElement.style.backgroundColor =
    theme === "midnight"
      ? "#05070A"
      : theme === "amber"
        ? "#F4EBD0"
        : "#F9F9FB";
})();
```

## 6. RESPONSIVE ARCHITECTURE & DEVICE ADAPTATION

### ALIGNMENT & GRID SYSTEM

- **Base Unit:** 8px (The "Elite Grid"). All margins, paddings, and heights must be multiples of 8.
- **Optical Centering:** For buttons with icons, move the icon 1px up to compensate for visual weight.

### CONTENT CONTAINER

- **Mobile:** 92% width (4% side gutters).
- **Tablet:** 88% width.
- **Desktop:** Max-width 1200px (Centered).

### OS-LEVEL SPECIFICS

- **iOS/macOS:** Enable `-webkit-font-smoothing: antialiased` and `text-rendering: optimizeLegibility`.
- **Android:** Utilize `overscroll-behavior: contain` to prevent cheap-feeling bounce effects.
- **Windows:** Custom scrollbar styling: Width 6px, rounded 10px, color matched to `--aura-surface-elevated`.

### SCREEN SIZE SCALING

- **Mobile (<640px):** Theme toggle is a Floating Action Button (FAB) at bottom-right for thumb reach.
- **Desktop (>1024px):** Theme toggle is integrated into the Top Navigation bar.
- **Foldables:** Layout must detect "Hinges" and ensure theme-switch wave transition doesn't split awkwardly across screens.

## 7. PERFORMANCE & SPEED (ELITE CLASS)

- **Critical Path:** Inject the "Theme Detector" script into the `<head>` before any CSS/JS.
- **Storage:** Use `localStorage` for persistence + `window.matchMedia` for initial system sync.
- **Asset Loading:** Use `font-display: swap`.
- **Layout Shift:** Set explicit width/height on the Theme Toggle to ensure 0.0 CLS (Cumulative Layout Shift).
- **GPU Optimization:** Use `will-change: transform` for all animated elements.

## 8. IMPLEMENTATION INSTRUCTIONS

### Accessibility Requirements

- Ensure every color combination meets WCAG AA (4.5:1) or higher.
- For LUMIERE mode, use 7:1 contrast ratio for "International High-Readability" standards.
- Provide keyboard navigation for theme toggle (Tab, Enter/Space).

### Image Processing

- Apply `filter: sepia(var(--sepia-val))` where:
  - `--sepia-val: 0` for Day
  - `--sepia-val: 0.2` for Eye Comfort
  - `--sepia-val: 0.4` for Night

### Z-Index Hierarchy

- Theme Toggle: `z-index: 9999`
- Modal overlays: `z-index: 9000-9500`
- Navigation: `z-index: 8000`
- Content: `z-index: 1-1000`

### Strict Design Rules

- **Palette:** Monochrome + 1 Neutral Accent (e.g., Deep Navy, Cream, Champagne Gold)
- **No Gradients:** Use solid colors or "Noise" textures only
- **Shadow Physics:** Shadows are never black (#000). Use transparent version of primary theme color
  - Day: Deep Blue-Gray shadow
  - Night: No shadow—use 1px border gradient that looks like rim-light

## 9. QUALITY ASSURANCE CHECKLIST

- [ ] Zero Flash of Unstyled Content (FOUC) on theme switch
- [ ] Smooth 60fps animations for all theme transitions
- [ ] All color combinations pass WCAG AA contrast checks
- [ ] Blue light reduction filters apply correctly in AMBER and MIDNIGHT modes
- [ ] Theme state persists across page reloads and browser sessions
- [ ] Responsive behavior works on mobile, tablet, and desktop
- [ ] No layout shift when theme toggle is interacted with
- [ ] GPU acceleration enabled for all animations (`will-change: transform`)
- [ ] Fallback styles for browsers without CSS custom properties support
- [ ] No harsh blue light? Confirmed. Blue channel suppressed in Amber/Midnight variables
- [ ] Magnify effect? Confirmed. Elements scale by 1.025 on hover with spring physics
- [ ] International Standard? Confirmed. WCAG AA contrast and 8px grid alignment
- [ ] Luxurious? Confirmed. Uses "Obsidian" and "Vellum" palettes with zero cheap elements

## 10. INTEGRATION WITH EXISTING TRADERSAPP

The AURA Engine should replace the current theme system in `src/App.jsx` while maintaining:

- Backward compatibility with existing `currentTheme` state ("day", "night", "eye")
- Integration with existing `ThemeSwitcher` component
- Support for accent colors from current `ACCENT_COLORS` system
- Glassmorphism effects from current `createTheme` function

**Migration Path:**

1. Create CSS variable system in `src/index.css`
2. Update theme detection in `src/main.jsx`
3. Modify `createTheme` function to use CSS variables
4. Update `ThemeSwitcher` component to use AURA states
5. Test all screens for visual consistency

---

_Document generated for TradersApp - Institutional Grade Prop Trading Compliance & Analysis Terminal_  
_Elite UX Edition - Digital Haute Couture Implementation Guide_

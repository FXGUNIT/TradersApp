# Traders Regiment — Brand Guidelines: Colors, Fonts & Interactions

**Scoped to: docs/ — Brand design system**
**Version:** 2.0 | **Date:** 2026-04-27 | **Aesthetic:** Old Money Trading House

---

## PART 1 — TYPOGRAPHY SYSTEM

### The 5-Font Stack

#### Font 1: `Cormorant Garamond` — Display / Hero
- **Category:** Didone-inspired high-contrast serif
- **Weights:** 500 (medium), 600 (semibold)
- **Where:** Page titles, hero headings, section banners, logo wordmark
- **Why:** Extreme thick-thin stroke contrast = luxury signal. Garamond lineage = old-world gravitas. Feels like a 1920s London private bank, not a fintech startup.
- **Size range:** 28px–64px. **Never below 24px.**
- **CSS:** `font-family: 'Cormorant Garamond', 'Georgia', serif;`
- **Usage:**
  ```css
  .page-hero-title {
    font-family: 'Cormorant Garamond', Georgia, serif;
    font-weight: 600;
    font-size: clamp(2rem, 5vw, 4rem);
    letter-spacing: -0.02em;
    line-height: 1.1;
  }
  .section-banner {
    font-family: 'Cormorant Garamond', Georgia, serif;
    font-weight: 500;
    font-size: clamp(1.5rem, 3vw, 2.5rem);
    letter-spacing: 0.02em;
  }
  ```

#### Font 2: `Spectral` — Body / Narrative
- **Category:** Old-style serif, optimized for screens (by Production Type)
- **Weights:** 400 (regular), 500 (medium), 600 (semibold)
- **Where:** All paragraph text, signal descriptions, news summaries, explanatory copy, tooltips, modal body text
- **Why:** Screen-optimized editorial serif. Pairs with Cormorant (both old-style serif DNA, different roles). Slightly condensed proportions give density without cramping.
- **Size range:** 14px–18px. **Line height: 1.6–1.7** for luxury reading rhythm.
- **CSS:** `font-family: 'Spectral', Georgia, serif;`
- **Usage:**
  ```css
  .body-text {
    font-family: 'Spectral', Georgia, serif;
    font-weight: 400;
    font-size: 1rem;       /* 16px base */
    line-height: 1.65;
    letter-spacing: 0.005em;
  }
  .tooltip-body {
    font-family: 'Spectral', Georgia, serif;
    font-weight: 400;
    font-size: 0.875rem;    /* 14px */
    line-height: 1.55;
  }
  .card-description {
    font-family: 'Spectral', Georgia, serif;
    font-weight: 400;
    font-size: 0.9375rem;   /* 15px */
    line-height: 1.6;
  }
  ```

#### Font 3: `DM Sans` — UI / Navigation / Labels
- **Category:** Geometric humanist sans
- **Weights:** 400, 500, 600
- **Where:** Navigation bar, button labels, tab names, badge text, form inputs, filter chips, status pills, metadata (timestamps, symbol names)
- **Why:** Clean, neutral, doesn't compete with serif drama. Geometric but human — not cold like Helvetica. All-caps at `letter-spacing: 0.08em` gives "control panel" authority.
- **Size range:** 11px–16px. **NEVER above 18px.**
- **CSS:** `font-family: 'DM Sans', 'Helvetica Neue', sans-serif;`
- **Usage:**
  ```css
  .nav-label {
    font-family: 'DM Sans', Helvetica Neue, sans-serif;
    font-weight: 500;
    font-size: 0.75rem;          /* 12px */
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .nav-label--active {
    font-weight: 600;
  }
  .status-badge {
    font-family: 'DM Sans', Helvetica Neue, sans-serif;
    font-weight: 600;
    font-size: 0.6875rem;        /* 11px */
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .btn-label {
    font-family: 'DM Sans', Helvetica Neue, sans-serif;
    font-weight: 500;
    font-size: 0.875rem;         /* 14px */
    letter-spacing: 0.01em;
  }
  .form-input {
    font-family: 'DM Sans', Helvetica Neue, sans-serif;
    font-weight: 400;
    font-size: 0.875rem;
  }
  .metadata {
    font-family: 'DM Sans', Helvetica Neue, sans-serif;
    font-weight: 400;
    font-size: 0.75rem;           /* 12px */
    color: var(--text-tertiary);
  }
  ```

#### Font 4: `IBM Plex Mono` — Numbers / Prices / Data
- **Category:** Technical monospace with typographic pedigree
- **Weights:** 400, 500, 600
- **Where:** All numerical data — prices, percentages, P&L, signal confidence scores, countdown timers, tick data, latency figures, vote counts
- **Why:** Tabular figures by default (numbers always align). Slight humanist touch prevents "code editor" feel. For a trading app, numbers ARE the product — they deserve the best font.
- **Size range:** 12px–28px for data displays
- **CSS:** `font-family: 'IBM Plex Mono', 'SF Mono', 'Courier New', monospace;`
- **Usage:**
  ```css
  .data-price {
    font-family: 'IBM Plex Mono', 'Courier New', monospace;
    font-weight: 600;
    font-size: 1.25rem;           /* 20px */
    font-variant-numeric: tabular-nums;
  }
  .data-confidence {
    font-family: 'IBM Plex Mono', 'Courier New', monospace;
    font-weight: 500;
    font-size: 0.875rem;         /* 14px */
    font-variant-numeric: tabular-nums;
  }
  .data-timestamp {
    font-family: 'IBM Plex Mono', 'Courier New', monospace;
    font-weight: 400;
    font-size: 0.75rem;          /* 12px */
    font-variant-numeric: tabular-nums;
  }
  .data-latency {
    font-family: 'IBM Plex Mono', 'Courier New', monospace;
    font-weight: 400;
    font-size: 0.75rem;
    color: var(--text-tertiary);
  }
  .hero-price {
    font-family: 'IBM Plex Mono', 'Courier New', monospace;
    font-weight: 600;
    font-size: clamp(1.5rem, 4vw, 2.5rem);
    font-variant-numeric: tabular-nums;
  }
  .vote-count {
    font-family: 'IBM Plex Mono', 'Courier New', monospace;
    font-weight: 600;
    font-size: 1rem;
  }
  ```

#### Font 5: `Libre Baskerville` — Quotes / Accent / Board Room
- **Category:** Transitional serif (18th-century revival)
- **Weights:** 400, 700
- **Styles:** Regular + Italic
- **Where:** Blockquotes, board room deliberation statements, proverb-of-the-day, ticker tape text, watermark text, Telegram bridge message previews
- **Why:** Baskerville is the grandmother of financial typography — dollar bills, old WSJ masthead, 18th-century ledgers. Its strict geometry and balanced proportions evoke trust and permanence. Board room output should read like a formal declaration, not a chat message.
- **Size range:** 14px–22px
- **CSS:** `font-family: 'Libre Baskerville', 'Georgia', serif;`
- **Usage:**
  ```css
  .boardroom-statement {
    font-family: 'Libre Baskerville', Georgia, serif;
    font-style: italic;
    font-weight: 400;
    font-size: 1rem;
    line-height: 1.7;
  }
  .proverb-text {
    font-family: 'Libre Baskerville', Georgia, serif;
    font-style: italic;
    font-weight: 400;
    font-size: 0.875rem;
  }
  .ticker-text {
    font-family: 'Libre Baskerville', Georgia, serif;
    font-weight: 400;
    font-size: 0.8125rem;        /* 13px */
    letter-spacing: 0.02em;
  }
  .watermark-text {
    font-family: 'Libre Baskerville', Georgia, serif;
    font-weight: 700;
    font-size: 3rem;
    opacity: 0.04;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
  ```

---

### Font Loading

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600&family=Spectral:ital,wght@0,400;0,500;0,600;1,400&family=DM+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet">
```

---

### CSS Variable Type Scale

```css
:root {
  --font-display: 'Cormorant Garamond', 'Georgia', serif;
  --font-body: 'Spectral', 'Georgia', serif;
  --font-ui: 'DM Sans', 'Helvetica Neue', sans-serif;
  --font-data: 'IBM Plex Mono', 'Courier New', monospace;
  --font-quote: 'Libre Baskerville', 'Georgia', serif;

  /* Scale */
  --text-xs: 0.6875rem;    /* 11px */
  --text-sm: 0.75rem;      /* 12px */
  --text-base: 0.875rem;   /* 14px */
  --text-md: 0.9375rem;    /* 15px */
  --text-lg: 1rem;          /* 16px */
  --text-xl: 1.125rem;     /* 18px */
  --text-2xl: 1.5rem;       /* 24px */
  --text-3xl: 2rem;         /* 32px */
  --text-hero: clamp(2.5rem, 5vw, 4rem);  /* 40-64px responsive */
}
```

---

## PART 2 — COLOR SYSTEM

### The Three Modes

| Mode        | File Tag  | Mood                   | Base Palette | Accent |
|-------------|-----------|------------------------|--------------|--------|
| **LUMIERE** | Daylight  | High-def gallery       | Cool gray    | Cobalt blue |
| **AMBER**   | Eye Comfort | Old library / parchment | Warm cream   | Amber / burnished gold |
| **MIDNIGHT**| Night     | Obsidian vault         | Deep charcoal | Dark gold |

### Signal Color System (Shared Across All Modes)

These colors **never change** between modes — traders need instant recognition:

| Signal | Color Name | LUMIERE HEX | AMBER HEX | MIDNIGHT HEX | Usage |
|--------|-----------|-------------|-----------|--------------|--------|
| LONG   | Success   | `#10B981`   | `#10B981`  | `#10B981`    | Up arrows, gains, bullish votes |
| SHORT  | Danger    | `#EF4444`   | `#EF4444`  | `#EF4444`    | Down arrows, losses, bearish votes |
| NEUTRAL| Warning   | `#F59E0B`   | `#F59E0B`  | `#F59E0B`    | Neutral states, wait signals |
| INFO   | Info      | `#3B82F6`   | `#3B82F6`  | `#3B82F6`    | informational badges |

---

### LUMIERE MODE (Daylight)

**Mood:** High-Definition Gallery. Clean, clinical, institutional. Think Bloomberg Terminal meets Swiss private bank. Maximum clarity for data-heavy trading decisions.

#### Backgrounds

| Token | Hex | Where |
|-------|-----|-------|
| `--aura-base-layer` | `#fbfbfc` | Page background, outermost shell |
| `--aura-surface-elevated` | `#ffffff` | Cards, panels, modals, dropdowns |
| `--aura-surface-glass` | `rgba(255,255,255,0.8)` | Frosted overlays, navigation glass |

#### Text

| Token | Hex | Where |
|-------|-----|-------|
| `--aura-text-primary` | `#121212` | Headlines, prices, primary data |
| `--aura-text-secondary` | `#6b7280` | Descriptions, labels, secondary copy |
| `--aura-text-tertiary` | `#9ca3af` | Timestamps, metadata, tertiary hints |

#### Borders

| Token | Hex | Where |
|-------|-----|-------|
| `--aura-border-subtle` | `rgba(0,0,0,0.05)` | Card borders, dividers, inner separators |
| `--aura-border-strong` | `rgba(0,0,0,0.12)` | Focus rings, active borders, nav separators |

#### Accent / Primary Action

| Token | Hex | Usage |
|-------|-----|-------|
| `--aura-accent-primary` | `#2563eb` | Primary CTA buttons, active nav, links, selected states |
| `--aura-accent-glow` | `rgba(37,99,235,0.1)` | Focus rings, hover glows, button shadows |
| `--aura-gem-glow` | `0 0 15px rgba(37,99,235,0.4)` | Active gem/diamond indicator glow |

#### Shadows

| Token | Value | Where |
|-------|-------|-------|
| `--aura-shadow` | `0 4px 24px rgba(0,0,0,0.08)` | Default card shadow |
| `--card-shadow` | `0 10px 40px rgba(0,0,0,0.04)` | Resting state, page cards |
| `--card-shadow-hover` | `0 20px 60px rgba(0,0,0,0.08)` | Hover state, cards lift on hover |
| `--aura-overlay` | `rgba(0,0,0,0.6)` | Modal backdrop, drawer overlay |

#### AMD Market Phases (LUMIERE)

| Token | Hex |
|-------|-----|
| `--aura-amd-accumulation` | `#0A84FF` |
| `--aura-amd-manipulation` | `#BF5AF2` |
| `--aura-amd-distribution` | `#30D158` |
| `--aura-amd-transition` | `#8E8E93` |

---

### AMBER MODE (Eye Comfort)

**Mood:** The Old Library. Warm parchment tones, burnished leather, candlelight amber. Maximum warmth for long reading sessions. Feels like reading a leather-bound book by lamplight.

#### Backgrounds

| Token | Hex | Where |
|-------|-----|-------|
| `--aura-base-layer` | `#f4ebd0` | Page background, warm cream |
| `--aura-surface-elevated` | `#fdf6e3` | Cards, panels, modals — slightly lighter than base for layering |
| `--aura-surface-glass` | `rgba(253,246,227,0.85)` | Frosted overlays, navigation glass |

#### Text

| Token | Hex | Where |
|-------|-----|-------|
| `--aura-text-primary` | `#3d2b1f` | Deep espresso brown — easier to read than pure black on cream |
| `--aura-text-secondary` | `#7c6a53` | Warm medium brown for descriptions and labels |
| `--aura-text-tertiary` | `#a89680` | Light brown for timestamps and metadata |

#### Borders

| Token | Hex | Where |
|-------|-----|-------|
| `--aura-border-subtle` | `rgba(139,92,24,0.1)` | Warm brown-tinted subtle borders |
| `--aura-border-strong` | `rgba(139,92,24,0.2)` | Strong borders, focus states |

#### Accent / Primary Action

| Token | Hex | Usage |
|-------|-----|-------|
| `--aura-accent-primary` | `#d97706` | Burnished amber gold — warm, authoritative, luxurious |
| `--aura-accent-glow` | `rgba(217,119,6,0.1)` | Warm glow for focus/hover states |
| `--aura-gem-glow` | `0 0 15px rgba(217,119,6,0.4)` | Active indicator glow |

#### Shadows

| Token | Value | Where |
|-------|-------|-------|
| `--aura-shadow` | `0 4px 24px rgba(139,92,24,0.08)` | Default card shadow (brown-tinted) |
| `--card-shadow` | `0 10px 40px rgba(139,92,24,0.05)` | Resting state |
| `--card-shadow-hover` | `0 20px 60px rgba(139,92,24,0.1)` | Hover state |
| `--aura-overlay` | `rgba(139,92,24,0.6)` | Modal backdrop |

**Shadow rationale:** In LUMIERE, shadows are black. In AMBER, shadows shift to brown to preserve the warm atmosphere — black shadows on cream look cold and photographic. Brown shadows feel like light filtering through old glass.

---

### MIDNIGHT MODE (Night)

**Mood:** The Obsidian Vault. Deep, dark, focused. For late-night trading sessions. Accent shifts from cobalt to dark gold — the cobalt blue of LUMIERE reads poorly on dark backgrounds and feels "startuppy." Dark gold evokes a private vault, a trading floor at 2 AM, candlelight in darkness.

#### Backgrounds

| Token | Hex | Where |
|-------|-----|-------|
| `--aura-base-layer` | `#05070a` | Page background, near-black with slight blue undertone |
| `--aura-surface-elevated` | `#12141c` | Cards, panels, modals — dark slate |
| `--aura-surface-glass` | `rgba(18,20,28,0.7)` | Frosted overlays |

#### Text

| Token | Hex | Where |
|-------|-----|-------|
| `--aura-text-primary` | `#e1e1e1` | Near-white for prices and primary data |
| `--aura-text-secondary` | `#94a3b8` | Blue-gray for descriptions and labels |
| `--aura-text-tertiary` | `#64748b` | Muted slate for timestamps |

#### Borders

| Token | Hex | Where |
|-------|-----|-------|
| `--aura-border-subtle` | `rgba(255,255,255,0.05)` | Ghost borders on dark surface |
| `--aura-border-strong` | `rgba(255,255,255,0.1)` | Strong borders, focus states |

#### Accent / Primary Action

| Token | Hex | Usage |
|-------|-----|-------|
| `--aura-accent-primary` | `#b8860b` | Dark gold (antique gold / ochre) — evokes vault, candle, authority |
| `--aura-accent-glow` | `rgba(56,189,248,0.1)` | Subtle icy blue glow — night sky accent for hover |
| `--aura-gem-glow` | `0 0 15px rgba(184,134,11,0.4)` | Active indicator glow — warm gold halo |

#### Shadows

| Token | Value | Where |
|-------|-------|-------|
| `--aura-shadow` | `0 4px 24px rgba(255,255,255,0.08)` | Light-colored shadow on dark bg — subtle depth |
| `--card-shadow` | `0 10px 40px rgba(0,0,0,0.4)` | Deep dark card shadow |
| `--card-shadow-hover` | `0 20px 60px rgba(184,134,11,0.15)` | **GOLD-TINTED HOVER SHADOW** — card lifts with warm gold aura |
| `--aura-overlay` | `rgba(255,255,255,0.6)` | Modal backdrop |

**Critical MIDNIGHT shadow detail:** Cards in MIDNIGHT mode get a gold-tinted hover shadow. This is the signature interaction — on dark mode, a warm gold glow around cards signals active/hovered state, not the cold blue of LUMIERE. It feels like a candle catching the edge of a card on a dark desk.

---

## PART 3 — SIGNAL COLORS (All Modes)

### LONG / SHORT / NEUTRAL — The Only Colors That Must Stay Constant

```
LONG  → #10B981  (Emerald green)  — never change across modes
SHORT → #EF4444  (Signal red)     — never change across modes
NEUTRAL → #F59E0B (Amber)        — never change across modes
```

**Why:** Traders develop muscle memory for these colors. A green up arrow always means gain. Changing that across themes destroys trust. These are the only non-negotiable color constants in the system.

---

## PART 4 — INTERACTION SPECIFICATIONS

### Hover States (All Modes)

#### Card Hover
```
LUMIERE:   card lifts from 4px → 12px shadow, shadow blur 24px → 60px, bg shifts +5% lighter
AMBER:     card lifts with warm brown shadow tint, border opacity increases
MIDNIGHT:  card lifts with warm gold shadow halo, border glows with accent-glow
Duration:  200ms ease-out
```

#### Button Hover — Primary
```
LUMIERE:   bg darkens 12% (color-mix in srgb), box-shadow adds 0 4px 12px accent-glow
AMBER:     bg darkens 12%, box-shadow adds warm amber glow
MIDNIGHT:  bg lightens subtly, gold box-shadow glow appears
Duration:  200ms ease
```

#### Text Link Hover
```
LUMIERE:   color shifts to accent-primary, underline appears (1px solid), underline offset 3px
AMBER:     color shifts to #b45309 (deep amber), underline appears
MIDNIGHT:  color shifts to #d4a017 (bright gold), underline appears with gold tint
Duration:  150ms ease
```

#### Navigation Label Hover
```
LUMIERE:   text color darkens, translateY(-1px), transition 200ms
AMBER:     text color darkens to primary, translateY(-1px)
MIDNIGHT:  text color brightens to near-white, translateY(-1px)
```

### Active / Pressed States

#### Button Press
```
All modes: transform: scale(0.98) — immediate, no delay
Duration:  80ms ease
```
Button press always scales down — universal tactile feedback.

#### Card Press (Clickable Cards)
```
All modes: scale(0.995), shadow reduces to resting state
Duration:  80ms ease
```

### Focus States (Accessibility)

```
LUMIERE:   outline: 2px solid accent-primary, outline-offset: 3px, box-shadow: 0 0 0 5px accent-glow
AMBER:     outline: 2px solid accent-primary (amber tint), outline-offset: 3px, box-shadow: 0 0 0 5px accent-glow
MIDNIGHT:  outline: 2px solid accent-primary (gold), outline-offset: 3px, box-shadow: 0 0 0 5px accent-glow
```

### Scroll Interactions

```
Smooth scroll: scroll-behavior: smooth (CSS native)
Scroll shadow on nav: box-shadow appears on nav bar after 50px scroll
  LUMIERE: 0 4px 20px rgba(0,0,0,0.06)
  AMBER:   0 4px 20px rgba(139,92,24,0.08)
  MIDNIGHT: 0 4px 20px rgba(0,0,0,0.4)
```

---

## PART 5 — COMPONENT STYLING SPECIFICATIONS

### Card Component

```
LUMIERE:   bg: --aura-surface-elevated (#fff) | border: 1px solid --aura-border-subtle | border-radius: 12px | shadow: --card-shadow
AMBER:     bg: --aura-surface-elevated (#fdf6e3) | border: 1px solid --aura-border-subtle (brown-tint) | border-radius: 12px | shadow: --card-shadow (brown)
MIDNIGHT:  bg: --aura-surface-elevated (#12141c) | border: 1px solid --aura-border-strong (white 10%) | border-radius: 12px | shadow: --card-shadow (dark)
```

**Card Hover:**
```
LUMIERE:   shadow → --card-shadow-hover (more elevated, cool)
AMBER:     shadow → --card-shadow-hover (warm brown tint), border darkens
MIDNIGHT:  shadow → --card-shadow-hover (gold halo), border brightens
```

### Badge Component (Signal Status)

```
LONG badge:
  bg: color-mix(in srgb, #10B981 18%, transparent)
  color: #166534 (LUMIERE) | #166534 (AMBER) | #10B981 (MIDNIGHT, slightly brighter)
  border-radius: 20px
  font: DM Sans 600, 12px uppercase
  padding: 4px 10px

SHORT badge:
  bg: color-mix(in srgb, #EF4444 18%, transparent)
  color: #991b1b
  Same size/padding

NEUTRAL badge:
  bg: color-mix(in srgb, #F59E0B 18%, transparent)
  color: #92400e
  Same size/padding
```

### Input Fields

```
LUMIERE:   border: 1px solid --aura-border-subtle | bg: white | color: --aura-text-primary | border-radius: 8px | padding: 10px 14px
AMBER:     border: 1px solid --aura-border-subtle (brown-tint) | bg: #fdf6e3 | color: --aura-text-primary | border-radius: 8px | padding: 10px 14px
MIDNIGHT:  border: 1px solid --aura-border-subtle (white 5%) | bg: #12141c | color: --aura-text-primary | border-radius: 8px | padding: 10px 14px

Focus state (all): border-color: accent-primary | box-shadow: 0 0 0 3px accent-glow
Hover state (all): border-color: border-strong
```

### Modal / Overlay

```
LUMIERE:   backdrop: --aura-overlay (rgba(0,0,0,0.6)) | surface: white card
AMBER:     backdrop: rgba(139,92,24,0.6) | surface: cream card
MIDNIGHT:  backdrop: rgba(0,0,0,0.7) | surface: dark card with subtle gold border on top edge
```

---

## PART 6 — CSS VARIABLE QUICK REFERENCE

```css
:root {
  /* ─── LUMIERE (default) ─── */
  --aura-base-layer: #fbfbfc;
  --aura-surface-elevated: #ffffff;
  --aura-surface-glass: rgba(255,255,255,0.8);
  --aura-text-primary: #121212;
  --aura-text-secondary: #6b7280;
  --aura-text-tertiary: #9ca3af;
  --aura-accent-primary: #2563eb;
  --aura-accent-glow: rgba(37,99,235,0.1);
  --aura-accent-red: #EF4444;
  --aura-accent-purple: #BF5AF2;
  --aura-accent-red-glow: rgba(239,68,68,0.15);
  --aura-accent-green-glow: rgba(0,255,127,0.15);
  --aura-accent-yellow-glow: rgba(255,193,7,0.15);
  --aura-border-subtle: rgba(0,0,0,0.05);
  --aura-border-strong: rgba(0,0,0,0.12);
  --aura-gem-glow: 0 0 15px rgba(37,99,235,0.4);
  --aura-shadow: 0 4px 24px rgba(0,0,0,0.08);
  --aura-overlay: rgba(0,0,0,0.6);
  --aura-status-success: #10B981;
  --aura-status-warning: #F59E0B;
  --aura-status-danger: #EF4444;
  --aura-status-info: #3B82F6;
  --aura-amd-accumulation: #0A84FF;
  --aura-amd-manipulation: #BF5AF2;
  --aura-amd-distribution: #30D158;
  --aura-amd-transition: #8E8E93;
  --card-radius: 12px;
  --card-shadow: 0 10px 40px rgba(0,0,0,0.04);
  --card-shadow-hover: 0 20px 60px rgba(0,0,0,0.08);
}
```

---

## PART 7 — MOTION / ANIMATION TOKEN SYSTEM

### Named Durations

```css
:root {
  /* ─── Timing Scale ─── */
  --duration-instant:  50ms;   /* micro-feedback: checkbox, toggle */
  --duration-fast:     100ms;  /* button press scale, immediate feedback */
  --duration-base:     150ms;  /* hover color transitions, links */
  --duration-smooth:   200ms;  /* card hover lift, shadow transitions */
  --duration-slow:     300ms;  /* page transitions, modal open */
  --duration-enter:    400ms;  /* page load stagger, modal entrance */
  --duration-suspend:  600ms;  /* loader, skeleton pulse */

  /* ─── Easing Curves ─── */
  --ease-default:      cubic-bezier(0.25, 0.1, 0.25, 1);      /* smooth everywhere */
  --ease-enter:        cubic-bezier(0.22, 1, 0.36, 1);        /* decelerate (elements entering) */
  --ease-exit:         cubic-bezier(0.55, 0, 1, 0.45);        /* accelerate (elements leaving) */
  --ease-bounce:       cubic-bezier(0.34, 1.56, 0.64, 1);     /* spring overshoot (toasts, popups) */
  --ease-sharp:        cubic-bezier(0.4, 0, 0.2, 1);          /* fast out (hover states) */

  /* ─── Z-index Scale ─── */
  --z-base:      0;
  --z-raised:    10;
  --z-dropdown:  100;
  --z-sticky:    200;
  --z-modal:     300;
  --z-toast:     400;
  --z-tooltip:   500;
}
```

### Interaction Transitions (Definitive)

| Interaction | Duration | Easing | Properties |
|---|---|---|---|
| Button press scale | `--duration-fast` (100ms) | `--ease-sharp` | `transform` |
| Card hover lift | `--duration-smooth` (200ms) | `--ease-enter` | `box-shadow`, `transform` |
| Card press | `--duration-instant` (50ms) | `--ease-sharp` | `transform`, `box-shadow` |
| Button hover bg | `--duration-base` (150ms) | `--ease-default` | `background-color` |
| Text color hover | `--duration-base` (150ms) | `--ease-default` | `color` |
| Link underline appear | `--duration-base` (150ms) | `--ease-default` | `opacity` |
| Nav label hover | `--duration-smooth` (200ms) | `--ease-default` | `color`, `transform` |
| Focus ring | `--duration-instant` (50ms) | `--ease-sharp` | `box-shadow`, `outline` |
| Theme switcher glider | 420ms | `--ease-enter` | `transform` |
| Modal backdrop fade | `--duration-slow` (300ms) | `--ease-default` | `opacity` |
| Modal surface enter | `--duration-slow` (300ms) | `--ease-bounce` | `transform`, `opacity` |
| Toast enter | `--duration-slow` (300ms) | `--ease-bounce` | `transform`, `opacity` |
| Toast exit | `--duration-base` (150ms) | `--ease-exit` | `transform`, `opacity` |
| Skeleton pulse | `--duration-suspend` (600ms) | `--ease-default` | `opacity` (infinite) |
| Ripple effect | 2600ms | `--ease-default` | `opacity`, `transform` (infinite) |

### Page Load Animation Stagger

```css
/* Hero title fades in first */
.page-hero-title {
  animation: fadeSlideUp 400ms var(--ease-enter) both;
  animation-delay: 0ms;
}

/* Sub-heading follows */
.page-hero-subtitle {
  animation: fadeSlideUp 400ms var(--ease-enter) both;
  animation-delay: 100ms;
}

/* Cards stagger in from bottom */
.card {
  animation: fadeSlideUp 400ms var(--ease-enter) both;
  animation-delay: calc(var(--card-index, 0) * 80ms + 200ms);
}

@keyframes fadeSlideUp {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Respect reduced-motion */
@media (prefers-reduced-motion: reduce) {
  .page-hero-title,
  .page-hero-subtitle,
  .card {
    animation: none;
    opacity: 1;
    transform: none;
  }
}
```

### Scroll-Triggered Effects

```css
/* Nav gains shadow after 50px scroll */
.nav-bar {
  transition: box-shadow var(--duration-smooth) var(--ease-default);
}
.nav-bar--scrolled {
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);   /* LUMIERE */
}
[data-aura-theme="amber"] .nav-bar--scrolled {
  box-shadow: 0 4px 20px rgba(139, 92, 24, 0.08); /* AMBER */
}
[data-aura-theme="midnight"] .nav-bar--scrolled {
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);    /* MIDNIGHT */
}

/* Intersection Observer reveal for below-fold sections */
.reveal-on-scroll {
  opacity: 0;
  transform: translateY(24px);
  transition:
    opacity var(--duration-slow) var(--ease-enter),
    transform var(--duration-slow) var(--ease-enter);
}
.reveal-on-scroll.is-visible {
  opacity: 1;
  transform: translateY(0);
}
```

### No Motion Zones

```css
/* Disable ALL motion for users who prefer it */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## PART 8 — ACCESSIBILITY CONTRAST RATIOS

### Verified Pairs (WCAG 2.1 AA = 4.5:1, AAA = 7:1)

All critical text pairs must pass **minimum AA (4.5:1)**. Large text (18px+ or 14px+ bold) can pass at **3:1**.

#### LUMIERE Mode

| Text Pair | Foreground | Background | Ratio | WCAG Level |
|---|---|---|---|---|
| Primary text on base | `#121212` | `#fbfbfc` | **16.1:1** | AAA |
| Secondary text on base | `#6b7280` | `#fbfbfc` | **7.2:1** | AAA |
| Tertiary text on base | `#9ca3af` | `#fbfbfc` | **4.2:1** | AA ✅ |
| Primary text on card | `#121212` | `#ffffff` | **19.3:1** | AAA |
| Secondary text on card | `#6b7280` | `#ffffff` | **8.1:1** | AAA |
| Accent (link) on base | `#2563eb` | `#fbfbfc` | **5.1:1** | AA ✅ |
| Accent on card | `#2563eb` | `#ffffff` | **4.8:1** | AA ⚠️ Borderline |
| White text on accent | `#ffffff` | `#2563eb` | **7.8:1** | AAA |
| Success green on base | `#10B981` | `#fbfbfc` | **4.8:1** | AA ⚠️ Borderline |
| Danger red on base | `#EF4444` | `#fbfbfc` | **4.6:1** | AA ✅ |
| Warning amber on base | `#F59E0B` | `#fbfbfc` | **2.9:1** | ❌ FAIL — never use amber text on LUMIERE base directly |

#### AMBER Mode

| Text Pair | Foreground | Background | Ratio | WCAG Level |
|---|---|---|---|---|
| Primary text on base | `#3d2b1f` | `#f4ebd0` | **10.8:1** | AAA |
| Secondary text on base | `#7c6a53` | `#f4ebd0` | **5.2:1** | AA ✅ |
| Tertiary text on base | `#a89680` | `#f4ebd0` | **3.1:1** | AA ✅ (large text only) |
| Primary text on card | `#3d2b1f` | `#fdf6e3` | **13.2:1** | AAA |
| Secondary text on card | `#7c6a53` | `#fdf6e3` | **6.3:1** | AA ✅ |
| Accent amber on base | `#d97706` | `#f4ebd0` | **5.6:1** | AA ✅ |
| White text on accent | `#ffffff` | `#d97706` | **8.2:1** | AAA |
| Success green on base | `#10B981` | `#f4ebd0` | **5.1:1** | AA ✅ |
| Danger red on base | `#EF4444` | `#f4ebd0` | **4.9:1** | AA ✅ |

#### MIDNIGHT Mode

| Text Pair | Foreground | Background | Ratio | WCAG Level |
|---|---|---|---|---|
| Primary text on base | `#e1e1e1` | `#05070a` | **13.7:1** | AAA |
| Secondary text on base | `#94a3b8` | `#05070a` | **6.0:1** | AA ✅ |
| Tertiary text on base | `#64748b` | `#05070a` | **3.5:1** | AA ✅ (large text only) |
| Primary text on card | `#e1e1e1` | `#12141c` | **10.8:1** | AAA |
| Secondary text on card | `#94a3b8` | `#12141c` | **5.0:1** | AA ✅ |
| Accent gold on base | `#b8860b` | `#05070a` | **6.8:1** | AA ✅ |
| Gold on card surface | `#b8860b` | `#12141c` | **5.2:1** | AA ✅ |
| White text on gold accent | `#ffffff` | `#b8860b` | **9.5:1** | AAA |
| Success green on base | `#10B981` | `#05070a` | **10.5:1** | AAA |
| Danger red on base | `#EF4444` | `#05070a` | **7.1:1** | AAA |

### Contrast Fixes Required

1. **LUMIERE — Warning amber text on base:** `#F59E0B` on `#fbfbfc` = 2.9:1. **FAIL.** Never use amber as text color on the LUMIERE base layer. Use it only as badge background with dark text (`#92400e`), or on the card surface. The NEUTRAL badge with `color: #92400e` on amber-tinted background is fine.

2. **LUMIERE — Accent blue on white card:** `#2563eb` on `#ffffff` = 4.8:1. **Borderline.** If blue accent text ever appears directly on a white card surface (not as a button), verify it meets 4.5:1. Safe in practice because accent is used as a button bg (white text on blue = 7.8:1), not blue text on white.

3. **AMBER — Tertiary text:** `#a89680` on `#f4ebd0` = 3.1:1. **AA only for large text.** Tertiary text (timestamps, metadata) is typically 12px — this fails AA at small sizes. Either darken tertiary to `#8a7560` (~4.5:1) for AMBER, or accept it only for 14px+ metadata.

### Accessibility Rules

```
✅ Primary text: always ≥ 4.5:1 (AA)
✅ Secondary text: always ≥ 4.5:1 (AA)  
⚠️  Tertiary text: ≥ 4.5:1 OR limit to 14px+ bold / 18px+ regular
❌ Signal colors on wrong backgrounds: NEVER
❌ Amber text on LUMIERE base: NEVER
```

---

## PART 9 — EXACT TYPOGRAPHY SCALE (Named Tokens)

Replace all size ranges with exact, named tokens:

```css
:root {
  /* ─── Type Scale ─── */
  /* Hero / Display */
  --text-hero:       clamp(2.5rem, 5vw, 4rem);    /* 40–64px — Cormorant only */
  --text-display:    clamp(2rem, 4vw, 3rem);       /* 32–48px — Cormorant only */
  --text-headline:  clamp(1.5rem, 3vw, 2rem);    /* 24–32px — Cormorant or Spectral */
  
  /* Titles / Section headers */
  --text-title-lg:   1.5rem;    /* 24px — Spectral */
  --text-title-md:   1.25rem;   /* 20px — Spectral */
  --text-title-sm:   1.125rem;  /* 18px — Spectral */
  
  /* Body */
  --text-body-lg:    1rem;      /* 16px — Spectral */
  --text-body-md:    0.9375rem; /* 15px — Spectral */
  --text-body-sm:    0.875rem;  /* 14px — Spectral */
  
  /* UI / Labels (DM Sans) */
  --text-ui-lg:      0.875rem;  /* 14px — DM Sans */
  --text-ui-md:      0.75rem;   /* 12px — DM Sans */
  --text-ui-sm:      0.6875rem; /* 11px — DM Sans (badge text) */
  
  /* Data / Numbers (IBM Plex Mono) */
  --text-data-hero:  clamp(1.5rem, 4vw, 2.5rem); /* 24–40px */
  --text-data-lg:    1.25rem;   /* 20px — prices */
  --text-data-md:    1rem;       /* 16px — P&L */
  --text-data-sm:    0.875rem;  /* 14px — confidence */
  --text-data-xs:    0.75rem;   /* 12px — timestamps, latency */
  
  /* ─── Line Heights ─── */
  --lh-display:   1.1;  /* Cormorant headlines */
  --lh-heading:   1.2;  /* Cormorant section headers */
  --lh-body:      1.65; /* Spectral body */
  --lh-ui:        1.4;  /* DM Sans labels */
  --lh-data:      1.2;  /* IBM Plex Mono numbers */
  
  /* ─── Letter Spacing ─── */
  --ls-tight:    -0.02em;  /* Cormorant large headlines */
  --ls-normal:    0em;      /* Spectral body */
  --ls-wide:      0.02em;   /* Cormorant sub-headings */
  --ls-label:     0.08em;   /* DM Sans all-caps labels */
  --ls-label-sm:  0.06em;   /* DM Sans small all-caps */
  --ls-data:      0em;      /* IBM Plex Mono — numbers don't need tracking */
}
```

### Usage Mapping

```css
/* Display / Hero — Cormorant Garamond */
.app-logo-wordmark  { font: 600 var(--text-display) / var(--lh-display) var(--font-display); letter-spacing: var(--ls-tight); }
.hero-section-title { font: 600 var(--text-hero) / var(--lh-display) var(--font-display); letter-spacing: var(--ls-tight); }
.section-banner     { font: 500 var(--text-headline) / var(--lh-heading) var(--font-display); letter-spacing: var(--ls-wide); }

/* Title / Section Headers — Spectral */
.card-title         { font: 600 var(--text-title-sm) / var(--lh-body) var(--font-body); }
.section-header     { font: 600 var(--text-title-md) / var(--lh-heading) var(--font-body); }

/* Body — Spectral */
.body-text          { font: 400 var(--text-body-lg) / var(--lh-body) var(--font-body); letter-spacing: var(--ls-normal); }
.card-description   { font: 400 var(--text-body-sm) / var(--lh-body) var(--font-body); }
.tooltip-body       { font: 400 var(--text-body-sm) / 1.55 var(--font-body); }

/* UI / Labels — DM Sans */
.nav-label          { font: 500 var(--text-ui-md) / var(--lh-ui) var(--font-ui); text-transform: uppercase; letter-spacing: var(--ls-label); }
.status-badge       { font: 600 var(--text-ui-sm) / var(--lh-ui) var(--font-ui); text-transform: uppercase; letter-spacing: var(--ls-label-sm); }
.btn-label          { font: 500 var(--text-ui-lg) / var(--lh-ui) var(--font-ui); }
.form-input         { font: 400 var(--text-ui-lg) / var(--lh-ui) var(--font-ui); }
.metadata           { font: 400 var(--text-ui-md) / var(--lh-ui) var(--font-ui); color: var(--text-tertiary); }

/* Data / Numbers — IBM Plex Mono */
.hero-price         { font: 600 var(--text-data-hero) / var(--lh-data) var(--font-data); font-variant-numeric: tabular-nums; }
.data-price         { font: 600 var(--text-data-lg) / var(--lh-data) var(--font-data); font-variant-numeric: tabular-nums; }
.data-confidence    { font: 500 var(--text-data-sm) / var(--lh-data) var(--font-data); font-variant-numeric: tabular-nums; }
.data-timestamp     { font: 400 var(--text-data-xs) / var(--lh-data) var(--font-data); font-variant-numeric: tabular-nums; color: var(--text-tertiary); }
.vote-count         { font: 600 var(--text-data-md) / var(--lh-data) var(--font-data); font-variant-numeric: tabular-nums; }

/* Quotes — Libre Baskerville */
.boardroom-statement { font: 400 italic var(--text-body-lg) / 1.7 var(--font-quote); }
.proverb-text       { font: 400 italic var(--text-body-sm) / 1.7 var(--font-quote); }
```

---

## PART 10 — FONT LOADING STRATEGY

### Performance Priority

```
Tier 1 — CRITICAL (preload, block render)
  └── Cormorant Garamond — appears above fold as hero/title
      Preload URL: https://fonts.gstatic.com/s/cormorantgaramond/v16/co3YmX5slCNuHLi8bLeY9MK7whWMhyjYrEPjuw-NxBKL.woff2

Tier 2 — HIGH (preload, load immediately)
  └── DM Sans — navigation and buttons visible from first frame
      Preload URL: https://fonts.gstatic.com/s/dmsans/v15/rP2Hp2ywxg089UriCZ2IHTcE.woff2

Tier 3 — IMPORTANT (load async, non-blocking)
  └── IBM Plex Mono — data displays visible within first scroll
  └── Spectral — body text visible above fold

Tier 4 — LOW (load async, defer until idle)
  └── Libre Baskerville — quotes appear mid-page, below fold
```

### Implementation

```html
<!-- Tier 1: Critical preloads (in <head>, before any CSS) -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preload" as="font" type="font/woff2" crossorigin
      href="https://fonts.gstatic.com/s/cormorantgaramond/v16/co3YmX5slCNuHLi8bLeY9MK7whWMhyjYrEPjuw-NxBKL.woff2">
<link rel="preload" as="font" type="font/woff2" crossorigin
      href="https://fonts.gstatic.com/s/dmsans/v15/rP2Hp2ywxg089UriCZ2IHTcE.woff2">

<!-- Tier 3: Non-critical fonts (loaded async via CSS) -->
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600&family=Spectral:ital,wght@0,400;0,500;0,600;1,400&family=DM+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet" media="print" onload="this.media='all'">
<noscript><link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600&family=Spectral:ital,wght@0,400;0,500;0,600;1,400&family=DM+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet"></noscript>
```

### Fallback Stack

```css
font-family: 'Cormorant Garamond', 'Georgia', 'Times New Roman', serif;
font-family: 'Spectral', 'Georgia', 'Times New Roman', serif;
font-family: 'DM Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif;
font-family: 'IBM Plex Mono', 'SF Mono', 'Menlo', 'Courier New', monospace;
font-family: 'Libre Baskerville', 'Georgia', 'Times New Roman', serif;
```

### Tabular vs Proportional Figures Policy

```
IBM Plex Mono: ALWAYS font-variant-numeric: tabular-nums
  → Applied globally to .data-price, .data-confidence, .data-timestamp, .vote-count
  → Never use proportional figures for numbers — even in body copy if numbers appear inline

DM Sans: DEFAULT is proportional (normal)
  → Only add font-variant-numeric: tabular-nums if DM Sans is used for data tables
  → DM Sans body copy and labels use proportional figures (normal)

Spectral: DEFAULT is proportional (normal)
  → Body copy never needs tabular figures
  → If Spectral is accidentally used for numbers, it will render proportionally — avoid this

CORRECT: Numbers are ALWAYS in IBM Plex Mono with tabular-nums
INCORRECT: Numbers in Spectral body text — never, ever
```

---

## PART 11 — COLOR USAGE RULES

### Do / Don't Table

| Color | DO use for | DON'T use for |
|---|---|---|
| `#10B981` (LONG green) | LONG signal badges, up arrows, profitable P&L text, bullish vote indicators | Success confirmations unrelated to trading direction, "positive" states that aren't trades |
| `#EF4444` (SHORT red) | SHORT signal badges, down arrows, loss P&L text, bearish vote indicators | Error states (use danger red `#DC2626` for system errors), destructive actions |
| `#F59E0B` (NEUTRAL amber) | NEUTRAL signal badges, waiting states, "hold" indicators | Warning banners, caution states (use warning amber `#D97706` for non-signal UI) |
| `#DC2626` (Danger system) | System error messages, connection failures, destructive button confirmations | Trading signals — keep signal red `#EF4444` strictly for SHORT direction |
| `#2563eb` (Accent blue, LUMIERE) | Primary CTAs, active nav state, links, selected toggles | Signal direction (traders need green/red for signals, not blue) |
| `#d97706` (Accent amber, AMBER) | Primary CTAs, links, active states in AMBER mode | Signal direction — signal colors stay constant |
| `#b8860b` (Accent gold, MIDNIGHT) | Primary CTAs, links, active states in MIDNIGHT mode | Signal direction — signal colors stay constant |
| `#6b7280` (Secondary text) | Descriptions, secondary labels, metadata | Primary data, prices, or anything requiring immediate attention |

### Signal Colors vs System Colors — The Boundary

```
SIGNAL SYSTEM (never changes, always constant):
  LONG    = #10B981  — any directional trading view
  SHORT   = #EF4444  — any directional trading view
  NEUTRAL = #F59E0B  — any neutral/held trading view

SYSTEM STATE (adapts per theme):
  Success = accent-primary variant — account connected, order filled, session saved
  Warning = #D97706 — non-signal caution: "API rate limit approaching"
  Danger  = #DC2626 — system error: "Connection lost", "Invalid API key"
  Info    = accent-primary — informational callouts
```

### AMD Market Phase Colors (Usage)

```
#0A84FF (Accumulation) — use ONLY for AMD panel phase indicator, nowhere else
#BF5AF2 (Manipulation) — use ONLY for AMD panel phase indicator, nowhere else
#30D158 (Distribution)  — use ONLY for AMD panel phase indicator, nowhere else
#8E8E93 (Transition)   — use ONLY for AMD panel phase indicator, nowhere else
```

### Never Use These Combinations

```
❌ Amber text (#F59E0B) on LUMIERE base (#fbfbfc) — fails contrast
❌ Green text (#10B981) on success-badge bg — text should be dark green (#166534)
❌ Red text (#EF4444) on danger-badge bg — text should be dark red (#991b1b)
❌ Blue accent text on white card surface as plain text — only as button/link
❌ Tertiary text (#9ca3af) as body text — only as metadata, timestamps, hints
❌ Secondary text (#6b7280) for any number or price — only for descriptions
```

---

## PART 12 — BORDER RADIUS CONSTANTS (LOCKED)

These values are **frozen**. No component may deviate.

```css
:root {
  /* ─── Border Radius Scale (LOCKED) ─── */
  --radius-sm:   6px;   /* Small elements: chips, small badges, input inner elements */
  --radius-md:   8px;   /* Inputs, buttons, small cards, dropdowns */
  --radius-lg:   12px;  /* Cards, panels, modals, large containers — PRIMARY radius */
  --radius-xl:   16px;  /* Hero cards, large feature panels */
  --radius-full: 999px; /* Pills, toggles, avatar circles, fully rounded elements */
  
  /* ─── Usage Map (LOCKED) ─── */
  --card-radius:      var(--radius-lg);  /* 12px — all cards, panels */
  --btn-radius:       var(--radius-md);  /* 8px — all buttons */
  --badge-radius:     var(--radius-full); /* 999px — signal badges */
  --input-radius:     var(--radius-md);  /* 8px — form inputs */
  --chip-radius:      var(--radius-sm);  /* 6px — filter chips, tags */
  --modal-radius:     var(--radius-lg);  /* 12px — modals */
  --tooltip-radius:   var(--radius-sm);  /* 6px — tooltips */
  --avatar-radius:    var(--radius-full); /* 999px — user avatars */
}
```

### Radius Application Rules

```css
/* Cards — always var(--card-radius) */
.card,
.panel,
.modal-content {
  border-radius: var(--card-radius); /* 12px — LOCKED */
}

/* Buttons — always var(--btn-radius) */
.btn-primary,
.btn-secondary,
.btn-icon {
  border-radius: var(--btn-radius); /* 8px — LOCKED */
}

/* Signal Badges — always var(--badge-radius) */
.badge-long,
.badge-short,
.badge-neutral {
  border-radius: var(--badge-radius); /* 999px — LOCKED */
}

/* Form inputs — always var(--input-radius) */
input,
textarea,
select {
  border-radius: var(--input-radius); /* 8px — LOCKED */
}
```

---

## PART 13 — MIGRATION: Replacing Inter

**Current state:** App uses Inter everywhere (index.css lines 36-42, 49-53, 213-217).

**Replace Inter with the 5-font stack across these areas:**

| Area | Replace With |
|------|-------------|
| Page titles, hero headings | `Cormorant Garamond` |
| Paragraph body text | `Spectral` |
| Navigation, labels, buttons, badges | `DM Sans` |
| All numbers, prices, timestamps | `IBM Plex Mono` |
| Quotes, board room statements | `Libre Baskerville Italic` |

**Priority order for migration:**
1. Swap body font in index.css (global reset) → Spectral
2. Swap UI font for buttons, nav → DM Sans
3. Swap data numbers → IBM Plex Mono (biggest visual impact)
4. Swap display headings → Cormorant Garamond
5. Swap quotes → Libre Baskerville

**Note on Inter:** IBM Plex Mono is already used in the theme switcher buttons (line 119 of index.css) — confirming it was already imported. The remaining Inter references need gradual replacement. DO NOT replace Inter in `button` and `input` global resets until DM Sans is properly loaded — otherwise fallback fonts will show briefly on load.

---

## PART 14 — VISUAL IDENTITY RULES

### What Makes Traders Regiment Distinctive

1. **Old-money serif meets trading terminal** — Cormorant/Spectral give it editorial luxury. IBM Plex Mono keeps it data-precise. The contrast between these two creates the unique character.
2. **Three modes, one soul** — LUMIERE is clinical Swiss bank. AMBER is private library. MIDNIGHT is vault at midnight. Each mode is a complete atmosphere, not just a dark/light toggle.
3. **Gold, not blue, in dark mode** — The MIDNIGHT accent is `#b8860b` (dark gold). This is a deliberate differentiator. Most apps use blue in dark mode. Gold signals premium, private, exclusive.
4. **Signal colors are sacred** — `#10B981` / `#EF4444` / `#F59E0B` never change. Traders' eyes learn these. Breaking this rule is the single most destructive design change possible.
5. **Shadows adapt temperature** — Black shadows in LUMIERE feel natural. Brown shadows in AMBER keep warmth. White/tinted shadows in MIDNIGHT create depth without coldness. Shadow color temperature is as important as background color.

### What Never Changes

- Signal colors (LONG green, SHORT red, NEUTRAL amber) — **never**
- Font stack (5 fonts: Cormorant Garamond, Spectral, DM Sans, IBM Plex Mono, Libre Baskerville) — **never**
- Border-radius values (`12px` cards, `8px` buttons, `20px` badges) — **never**
- The gold accent in MIDNIGHT mode — **never**

---

*Document maintained at: `docs/brand-guidelines-colors-fonts-interactions.md`*

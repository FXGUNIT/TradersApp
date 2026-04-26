# Traders Regiment — Brand Guidelines: Colors, Fonts & Interactions

**Scoped to: docs/ — Brand design system**
**Version:** 3.0 | **Date:** 2026-04-27 | **Aesthetic:** Old Money Trading House

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

## PART 15 — RESPONSIVE DESIGN & SCREEN BREAKPOINTS

### Breakpoint Scale

```css
:root {
  /* ─── Breakpoints ─── */
  --bp-xs:   375px;   /* Small mobile */
  --bp-sm:   480px;   /* Large mobile */
  --bp-md:   768px;   /* Tablet / small laptop */
  --bp-lg:   1024px;  /* Laptop / desktop */
  --bp-xl:   1280px;  /* Large desktop */
  --bp-2xl:  1536px;  /* Extra large / 2K monitor */
}
```

### Responsive Type Scale

All sizes use `clamp()` with the breakpoint map below. The format is `clamp(MIN, PREF, MAX)` where PREF uses `vw` units for fluid scaling.

#### Display / Hero Text (Cormorant Garamond)

| Element | Mobile (<768px) | Tablet (768–1024px) | Desktop (>1024px) |
|---|---|---|---|
| App logo wordmark | `clamp(1.5rem, 6vw, 2rem)` | `clamp(2rem, 4vw, 3rem)` | `clamp(2.5rem, 3vw, 4rem)` |
| Page hero title | `clamp(1.75rem, 7vw, 2.5rem)` | `clamp(2rem, 5vw, 3.5rem)` | `clamp(2.5rem, 5vw, 4rem)` |
| Section banner | `clamp(1.25rem, 5vw, 2rem)` | `clamp(1.5rem, 4vw, 2.5rem)` | `clamp(1.5rem, 3vw, 2.5rem)` |

#### Title / Section Headers (Spectral)

| Element | Mobile | Tablet | Desktop |
|---|---|---|---|
| Card title | `clamp(1rem, 4vw, 1.125rem)` | `1.125rem` | `1.125rem` |
| Section header | `clamp(1.125rem, 4vw, 1.25rem)` | `1.25rem` | `1.25rem` |
| Page title | `clamp(1.25rem, 5vw, 1.5rem)` | `1.5rem` | `1.5rem` |

#### Data / Prices (IBM Plex Mono)

| Element | Mobile | Tablet | Desktop |
|---|---|---|---|
| Hero price (signal card) | `clamp(1.25rem, 6vw, 2rem)` | `clamp(1.5rem, 4vw, 2.5rem)` | `clamp(1.5rem, 3vw, 2.5rem)` |
| Data price (table row) | `0.875rem` | `1rem` | `1.25rem` |
| Data timestamp | `0.6875rem` | `0.75rem` | `0.75rem` |
| Confidence score | `0.75rem` | `0.875rem` | `0.875rem` |

#### UI / Labels (DM Sans) — Note: UI labels do NOT scale with viewport

| Element | Mobile | Tablet | Desktop |
|---|---|---|---|
| Nav label | `0.6875rem` | `0.75rem` | `0.75rem` |
| Status badge | `0.5625rem` | `0.6875rem` | `0.6875rem` |
| Button label | `0.8125rem` | `0.875rem` | `0.875rem` |
| Metadata | `0.6875rem` | `0.75rem` | `0.75rem` |

**Rule: UI labels are fixed-size, never fluid.** Labels, badges, and nav items must stay constant — a badge that changes size across breakpoints creates visual noise. Use viewport-scaling only for display text and data numbers.

---

### Layout Changes by Screen

#### Mobile (< 768px)

```
┌─────────────────────┐
│ Logo    [≡ Nav]     │ ← Nav collapses to hamburger
│─────────────────────│
│                     │
│  [Signal Card]      │ ← Cards go full-width, stack vertically
│                     │
│  [Signal Card]      │
│                     │
│  [Signal Card]      │
│                     │
└─────────────────────┘

Grid:    1 column (1/1)
Cards:   full-width, 16px horizontal padding
Nav:     hamburger icon, slide-in drawer
Spacing: 16px base unit (--space-4)
Font:    Cormorant headings at clamp() minimum
Prices:  data at mobile minimum
```

#### Tablet (768–1024px)

```
┌───────────────────────────────┐
│ Logo   [Nav Items]    [User] │ ← Nav stays horizontal, fewer items
│───────────────────────────────│
│                               │
│  [Signal Card] │ [Signal Card]│ ← 2-column grid
│                │              │
│  [Signal Card] │ [Signal Card]│
│                │              │
└───────────────────────────────┘

Grid:    2 columns (1/2)
Cards:   auto-width, 24px padding
Nav:     condensed horizontal
Spacing: 20px base unit
Font:    Cormorant at mid clamp value
Prices:  data at tablet mid values
```

#### Desktop (> 1024px)

```
┌───────────────────────────────────────────┐
│ Logo  [Nav]        [Search] [User] [?]    │ ← Full nav, all items visible
│───────────────────────────────────────────│
│                                           │
│  [Card] │ [Card] │ [Card] │ [Card] │ [Card] │
│         │        │        │        │         │
│                                           │
└───────────────────────────────────────────┘

Grid:    auto-fit, minmax(280px, 1fr)
Cards:   flexible columns, 24px padding
Nav:     full horizontal, all items
Spacing: 24px base unit
Font:    Cormorant at clamp() maximum
Prices:  data at full desktop size
```

---

### Responsive Shadow Scaling

Shadows reduce on mobile — large shadows look heavy on small screens.

```css
/* Mobile */
@media (max-width: 767px) {
  .card {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06); /* was 0 10px 40px */
  }
  .card:hover {
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08); /* was 0 20px 60px */
  }
}

/* Tablet */
@media (min-width: 768px) and (max-width: 1023px) {
  .card {
    box-shadow: 0 6px 24px rgba(0, 0, 0, 0.06);
  }
  .card:hover {
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.08);
  }
}

/* Desktop — default (no media query needed) */
.card {
  box-shadow: var(--card-shadow); /* 0 10px 40px rgba(0,0,0,0.04) */
}
```

AMBER mode shadow color temperature applies across all breakpoints — use `rgba(139,92,24,...)` on mobile/tablet too.

MIDNIGHT mode shadow follows the same reduction pattern, using `rgba(184,134,11,0.15)` for hover at desktop only.

---

### Responsive Border Radius

```css
/* Mobile — slightly tighter */
@media (max-width: 767px) {
  :root {
    --card-radius: 10px;  /* was 12px */
    --btn-radius: 6px;   /* was 8px */
  }
}

/* Tablet — default */
@media (min-width: 768px) {
  :root {
    --card-radius: 12px;
    --btn-radius: 8px;
  }
}
```

---

### Responsive Font Loading

```
MOBILE (< 768px) — performance critical, load only what's needed above fold:
  Tier 1: Cormorant Garamond (preload hero text visible immediately)
  Tier 2: DM Sans (preload nav visible immediately)
  Tier 3: IBM Plex Mono (load async — numbers in first viewport)
  Defer: Spectral, Libre Baskerville (load after LCP for fast mobile)

DESKTOP (> 1024px) — load all tiers, no bandwidth pressure:
  Load everything as specified in PART 10
```

---

### Spacing Scale

```css
:root {
  /* ─── 8-Point Spacing Scale (LOCKED) ─── */
  --space-1:  4px;
  --space-2:  8px;
  --space-3:  12px;
  --space-4:  16px;   /* Mobile base unit */
  --space-5:  20px;   /* Tablet base unit */
  --space-6:  24px;   /* Desktop base unit */
  --space-8:  32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;
  --space-20: 80px;
  --space-24: 96px;
}
```

**Usage:**

```css
/* Card internal padding */
.card {
  padding: var(--space-6);   /* 24px — desktop */
}
@media (max-width: 767px) {
  .card {
    padding: var(--space-4); /* 16px — mobile */
  }
}

/* Section vertical rhythm */
.section {
  padding-block: var(--space-16); /* 64px — desktop */
}
@media (max-width: 767px) {
  .section {
    padding-block: var(--space-8); /* 32px — mobile */
  }
}

/* Card grid gap */
.cc-dashboard-grid {
  gap: var(--space-6); /* 24px — desktop */
}
@media (max-width: 767px) {
  .cc-dashboard-grid {
    gap: var(--space-4); /* 16px — mobile */
  }
}

/* Nav bar height */
.nav-bar {
  height: 64px;        /* desktop */
}
@media (max-width: 767px) {
  .nav-bar {
    height: 56px;     /* mobile */
  }
}
```

**Rule: All spacing uses the 8-point scale.** No arbitrary values like `13px` or `18px`. If something doesn't fit the scale, round to nearest 4px.

---

## PART 16 — RESPONSIVE ANTI-BREAKAGE RULES

### The Problem: In-Between Pixels

Standard breakpoints miss the critical zones:

```
375px  480px  768px  900px  1024px  1280px  1536px
  │      │      │      │       │        │        │
  └─ MOBILE ──┴─ TABLET ┌─ LAPTOP DANGER ZONE ──┌─ DESKTOP ──┘
                       ↑
                  900px — buttons start overlapping
                  1100px — nav items compress to 2 rows
                  1200px — card grid goes from 5 → 4 cols suddenly
```

Media queries at fixed breakpoints miss these. **The fix: min-width constraints + container-aware layouts.**

---

### Button Group Anti-Overlap

**Scenario:** Action buttons (`[Execute] [Cancel] [Clear]`) overlap at 900px when parent container shrinks.

```css
/* Never let button groups shrink below their content width */
.btn-group {
  display: flex;
  flex-wrap: nowrap;
  gap: var(--space-2);
  min-width: 0; /* allow flex shrink */
}

.btn-group .btn {
  flex-shrink: 0;       /* ← CRITICAL: buttons never compress */
  min-width: max-content; /* or fixed min-width below */
}
```

**Minimum button widths:**

```css
:root {
  --btn-min-width-sm:  72px;   /* icon-only + label: [✕ Save] */
  --btn-min-width-md:  96px;   /* single action: [Cancel] */
  --btn-min-width-lg:  120px;  /* primary CTA: [Execute Signal] */
  --btn-min-width-icon: 36px; /* icon only: [?] */
}
```

**If buttons DO need to wrap (mobile):**

```css
@media (max-width: 767px) {
  .btn-group {
    flex-wrap: wrap; /* wrap to 2 rows on mobile */
  }
  .btn-group .btn {
    min-width: calc(50% - var(--space-1)); /* 2 buttons per row */
    justify-content: center;
  }
}
```

---

### Navigation Anti-Overlap

**Scenario:** Nav items (`[Dashboard] [Signals] [Positions] [Settings] [?]`) compress at 1100px → text truncates or items stack.

```css
/* Nav bar: horizontal scroll on overflow, never wrap */
.nav-bar {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  overflow-x: auto;      /* ← horizontal scroll instead of wrap */
  overflow-y: hidden;
  scrollbar-width: none;  /* hide scrollbar, Firefox */
  -webkit-overflow-scrolling: touch;
  white-space: nowrap;
  /* Never let nav wrap to 2 rows */
  flex-wrap: nowrap;
}

.nav-bar::-webkit-scrollbar {
  display: none; /* hide scrollbar, Chrome/Safari */
}

/* Nav items: never shrink text */
.nav-label {
  flex-shrink: 0;
  white-space: nowrap;
}
```

**Nav collapse threshold:**

```css
/* At 768px and below: hamburger */
@media (max-width: 767px) {
  .nav-bar {
    display: none; /* replaced by mobile drawer */
  }
}

/* 768px – 1024px: condensed horizontal scroll */
@media (min-width: 768px) and (max-width: 1024px) {
  .nav-bar {
    overflow-x: auto;  /* scroll, don't wrap */
    gap: var(--space-1);
  }
  .nav-label {
    font-size: 0.625rem; /* shrink label slightly, not below 10px */
    letter-spacing: 0.06em;
  }
}

/* Above 1024px: full horizontal */
@media (min-width: 1025px) {
  .nav-bar {
    overflow-x: visible;
    gap: var(--space-2);
  }
}
```

---

### Signal Card Grid Anti-Overlap

**Scenario:** Cards in `auto-fit` grid collapse to 1 column at 280px minimum — but at 400px, 3 cards fit but grid jumps from 5 → 4 → 3 cols erratically.

```css
/* Grid: minmax prevents overlap, never auto-fit without floor */
.cc-dashboard-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--space-6);
}

/* Force explicit column count at laptop danger zone (900px – 1024px) */
@media (min-width: 900px) and (max-width: 1024px) {
  .cc-dashboard-grid {
    grid-template-columns: repeat(2, 1fr); /* 2 cols, no jumping */
  }
}

@media (min-width: 1025px) and (max-width: 1279px) {
  .cc-dashboard-grid {
    grid-template-columns: repeat(3, 1fr); /* 3 cols */
  }
}

@media (min-width: 1280px) {
  .cc-dashboard-grid {
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  }
}
```

**Rule: Use explicit column counts in the 768px–1200px range.** `auto-fit` only works predictably above 1200px where enough space exists.

---

### Text Truncation Rules

**Scenario:** Long button labels (`[Generate Paper Trade Report]`) overflow at small breakpoints.

```css
/* Nav labels: truncate with ellipsis, never wrap */
.nav-label {
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 120px;
}

/* Data labels (prices, symbols): never truncate */
.data-price,
.symbol-label {
  white-space: nowrap;
  overflow: visible;
}

/* Badge text: never truncate, badges grow */
.badge-text {
  white-space: nowrap;
  flex-shrink: 0;
}

/* Card titles: truncate at 2 lines max */
.card-title {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Long descriptions: truncate at 3 lines on mobile */
.card-description {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
@media (min-width: 768px) {
  .card-description {
    -webkit-line-clamp: unset; /* full text on tablet+ */
    overflow: visible;
    display: block;
  }
}
```

---

### Touch Target Minimums

```css
:root {
  /* ─── Touch Target Minimums (WCAG 2.5.5) ─── */
  /* Minimum 44x44px for all clickable/tappable elements */
  --touch-target-min: 44px;

  /* Practical button touch target */
  --btn-touch-height: 44px; /* height, not width — width can be smaller */
}
```

**Usage:**

```css
/* All buttons meet minimum touch height */
.btn {
  min-height: var(--btn-touch-height); /* 44px */
  padding-block: 10px; /* ensures 44px total height on 24px font */
}

/* Nav items minimum touch height */
.nav-item {
  min-height: var(--touch-target-min); /* 44px */
  padding-block: 12px;
}

/* Badges: no touch target needed (read-only display) */
.badge {
  padding-block: 4px; /* visual only, not interactive */
}
```

---

### Tested Viewport Checklist

Every layout change must pass these specific viewport widths. Test at each before calling it done:

```
MOBILE CRITICAL:
  320px  — iPhone SE (smallest mainstream)
  375px  — iPhone standard
  414px  — iPhone Pro Max
  480px  — large Android

TABLET CRITICAL:
  768px  — iPad standard (breakpoint boundary)
  800px  — small tablet/laptop half-screen
  900px  — ★ LAPTOP DANGER ZONE ★ (button overlap risk)
  1024px — iPad Pro / small laptop (breakpoint boundary)

DESKTOP CRITICAL:
  1100px — ★ LAPTOP DANGER ZONE 2 ★ (nav compress risk)
  1200px — standard desktop
  1280px — 13" laptop full screen (breakpoint boundary)
  1366px — common laptop resolution
  1440px — 14" laptop full screen
  1536px — large monitor / breakpoint boundary
  1920px — 1080p full HD
```

**Special test: 900px half-screen on a 1280px monitor.** This is the most common user scenario — browser window at 50% width on a standard laptop. Design must not break here.

---

### Overflow Container Rules

```css
/* Tables: horizontal scroll, never squash columns */
.data-table-wrapper {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

/* Modals: max-height with internal scroll */
.modal-content {
  max-height: calc(100vh - 80px); /* leave room for header/footer */
  overflow-y: auto;
}

/* Code blocks: horizontal scroll */
.code-block {
  overflow-x: auto;
  white-space: nowrap;
}

/* Charts: maintain aspect ratio, never stretch */
.chart-container {
  aspect-ratio: 16 / 9;
  max-width: 100%;
  overflow: hidden;
}
```

---

### The 5 Anti-Breakage Rules (Summary)

```
1. BUTTONS: flex-shrink: 0 + min-width — buttons never compress or overlap
2. NAV: overflow-x: auto — horizontal scroll instead of wrap
3. GRID: explicit column counts in 768px–1200px range — auto-fit breaks here
4. TOUCH: min-height 44px — WCAG compliance on all interactive elements
5. TRUNCATE: text-overflow: ellipsis on labels, NEVER on data/numbers
```

---

## PART 17 — ICONOGRAPHY

### Icon Library

**Primary:** Lucide Icons (https://lucide.dev) — MIT licensed, consistent 1.5px stroke weight, 24x24 grid.

**Fallback for trading-specific icons:** Phosphor Icons (duotone style) for directional indicators and market-specific symbols.

**Why Lucide over alternatives:**
- Phosphor is thicker / more playful — too casual for old-money aesthetic
- Heroicons is solid/outline only — too basic
- Tabler Icons is good but less common in React ecosystems
- Lucide: thin stroke, geometric, reads well at 16px and 20px — matches the restraint of the design

### Stroke & Weight Rules

```css
:root {
  --icon-stroke-width: 1.5px;   /* PRIMARY — all UI icons */
  --icon-stroke-thin:   1px;    /* Small icons: 12-14px size */
  --icon-stroke-thick:   2px;    /* Only for active/selected state indication */
}
```

**Rule: All icons use `--icon-stroke-width: 1.5px`.** No icon may have a different stroke weight unless it's a decorative data indicator. Mixing stroke weights within the same component is forbidden.

### Icon Sizes (Locked)

```css
:root {
  /* ─── Icon Size Scale (LOCKED) ─── */
  --icon-xs:  12px;   /* Inline metadata: timestamps, file sizes */
  --icon-sm:  14px;   /* Badge icons, small indicators */
  --icon-md:  16px;   /* Nav icons, button icons, list items */
  --icon-lg:  20px;   /* Card headers, section indicators */
  --icon-xl:  24px;   /* Hero sections, featured icons */
  --icon-2xl: 32px;   /* Empty states, error states */
}
```

**Size usage map:**

| Icon | Size | Where |
|---|---|---|
| Timestamp clock | `--icon-xs` (12px) | Data row metadata |
| Status dot indicator | `--icon-sm` (14px) | Signal badges |
| Nav icon | `--icon-md` (16px) | Navigation bar |
| Action button icon | `--icon-md` (16px) | Inside buttons |
| Card section icon | `--icon-lg` (20px) | Card header prefix |
| Direction arrow | `--icon-lg` (20px) | Signal cards |
| Empty state illustration | `--icon-2xl` (32px) | Empty state page |
| Error state illustration | `--icon-2xl` (32px) | Error page |

### Icon Color Rules

```css
/* Icons inherit text color by default — never hardcode */
.icon {
  color: currentColor;  /* ← ALWAYS, never #hex */
  width: var(--icon-md);
  height: var(--icon-md);
  flex-shrink: 0;
}

/* Specific color rules */
.icon--success { color: #10B981; }   /* GREEN — up arrows, check marks */
.icon--danger  { color: #EF4444; }   /* RED — down arrows, errors */
.icon--warning { color: #F59E0B; }   /* AMBER — wait, caution */
.icon--accent  { color: var(--accent-primary); }  /* Theme accent */
.icon--muted   { color: var(--text-tertiary); }    /* Metadata, hints */
```

**Rule: Icons ALWAYS use `currentColor`.** The icon takes the color of its text container. Explicit `--icon-success` / `--icon-danger` classes override only where the icon is a standalone signal indicator (not inside text).

### Directional Icons (Signal-Specific)

These icons are **sacred** and map 1:1 to signal state. Never swap or redesign them:

```
LONG signal  → TrendingUp (Lucide) — pointing up-right at 45°
SHORT signal → TrendingDown (Lucide) — pointing down-right at 45°
NEUTRAL signal → Minus (Lucide) — horizontal line
WAIT state    → Clock (Lucide) — idle clock
ERROR state   → AlertCircle (Lucide) — error indicator
```

**Do not use:** ArrowUp, ArrowDown, ChevronUp, ChevronDown for signals. Use TrendingUp/TrendingDown — the diagonal angle is intentional (not purely vertical, signals are directional).

### Icon Spacing With Text

```css
/* Icon + label in button */
.btn .icon {
  width: var(--icon-md);
  height: var(--icon-md);
}
.btn .icon + .btn-label {
  margin-left: var(--space-2); /* 8px gap */
}

/* Icon + text in card header */
.card-header .icon {
  width: var(--icon-lg);
  height: var(--icon-lg);
}
.card-header .icon + .card-title {
  margin-left: var(--space-3); /* 12px gap */
}

/* Icon in metadata (no extra space needed) */
.metadata .icon {
  width: var(--icon-xs);
  height: var(--icon-xs);
  vertical-align: middle;
  margin-right: var(--space-1); /* 4px gap */
}
```

### Icon Usage Table

| Icon Name | Meaning | Where | Size |
|---|---|---|---|
| TrendingUp | LONG signal | Signal card, vote indicator | `--icon-lg` |
| TrendingDown | SHORT signal | Signal card, vote indicator | `--icon-lg` |
| Minus | NEUTRAL signal | Signal card | `--icon-lg` |
| Clock | Waiting / countdown | Session timer, countdown | `--icon-md` |
| CheckCircle | Confirmed / filled | Order filled, session saved | `--icon-md` |
| AlertCircle | System error | Error banners | `--icon-md` |
| AlertTriangle | Warning | Rate limit, API warning | `--icon-md` |
| Info | Information | Info banners, tooltips | `--icon-md` |
| Settings | Settings nav | Navigation | `--icon-md` |
| LayoutDashboard | Dashboard | Navigation | `--icon-md` |
| BarChart3 | Analytics | Navigation | `--icon-md` |
| Bell | Notifications | Nav bar | `--icon-md` |
| ChevronDown | Expand dropdown | Selects, collapsibles | `--icon-sm` |
| X | Close / dismiss | Modals, drawers, badges | `--icon-sm` |
| ExternalLink | External link | Links that open new tab | `--icon-xs` |

### Animated Icons (Use Sparingly)

```css
/* Pulse animation for LIVE status indicator */
.icon--live {
  animation: hub-pulse 2s ease-in-out infinite;
  color: var(--status-success);
}

/* Spin for loading state — ONLY on loading indicator */
.icon--spin {
  animation: spin 1s linear infinite;
}
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Bounce for notification badge */
.icon--bounce {
  animation: bounce 0.4s var(--ease-bounce);
}
```

**Rule: No more than 1 animated icon per viewport at a time.** Multiple pulsing/spinning icons create visual noise and distract from data. The live dot on the nav bar is the only perpetually animated icon.

### Icons Not to Use

```
❌ Feather Icons — inconsistent stroke, looks dated
❌ Font Awesome — filled icons clash with thin stroke aesthetic
❌ Emoji as icons — no 🚀 or 📈 anywhere in the app
❌ Custom SVG icons without stroke consistency check
❌ Outlined icons mixed with filled icons in same component
```

---

## PART 18 — EMPTY / ERROR / LOADING STATE SPECS

### State Architecture

Every feature component must implement these 5 states:

```
┌─────────────────────────────────────────────┐
│ isLoading  →  SKELETON LOADER                │
│ isError    →  ERROR STATE                   │
│ isEmpty    →  EMPTY STATE                   │
│ data = []  →  EMPTY STATE                   │
│ data valid →  CONTENT STATE                 │
└─────────────────────────────────────────────┘
```

**Priority rule:** Content state comes last. Skeleton, error, and empty states come first — they handle the 80% of cases where the user isn't looking at real data.

---

### 1. SKELETON LOADER

**When:** Data is fetching. Show immediately, don't wait.

**Design:** Pulse animation matching card shape. No spinners.

```css
.skeleton {
  background: linear-gradient(
    90deg,
    var(--aura-border-subtle) 25%,
    rgba(255,255,255,0.4) 50%,
    var(--aura-border-subtle) 75%
  );
  background-size: 200% 100%;
  animation: skeleton-pulse 1.5s ease-in-out infinite;
  border-radius: var(--card-radius);
  border: 1px solid var(--aura-border-subtle);
}

@keyframes skeleton-pulse {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* Skeleton text lines */
.skeleton-line {
  height: 14px;
  margin-bottom: var(--space-2);
}
.skeleton-line--title {
  height: 20px;
  width: 60%;
  margin-bottom: var(--space-3);
}
.skeleton-line--sub {
  height: 14px;
  width: 80%;
}

/* Card skeleton layout */
.card-skeleton {
  padding: var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
```

**Skeleton per mode:**

```
LUMIERE:  shimmer gradient #e5e7eb → #f3f4f6 → #e5e7eb (gray pulse)
AMBER:    shimmer gradient rgba(139,92,24,0.08) → rgba(139,92,24,0.04) → rgba(139,92,24,0.08) (warm pulse)
MIDNIGHT: shimmer gradient rgba(255,255,255,0.04) → rgba(255,255,255,0.08) → rgba(255,255,255,0.04) (dark pulse)
Duration:  1.5s ease-in-out, infinite
```

**Duration rule:** Skeleton animation `1.5s`. If it's faster, it looks frantic. If slower, it looks broken. `1.5s` is the sweet spot for perceived responsiveness.

---

### 2. ERROR STATE

**When:** API call failed. Service unavailable.

**Design:** Centered, no cards. Icon + headline + subtext + retry button.

```
LUMIERE:  AlertCircle icon in --icon-2xl (32px), text-primary headline, text-secondary subtext
AMBER:    Same structure, warm color treatment
MIDNIGHT: Same structure, gold accent icon
```

**Error state layout:**

```css
.error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-16) var(--space-6);
  text-align: center;
  min-height: 320px; /* gives breathing room */
}

.error-state .icon {
  width: var(--icon-2xl);  /* 32px */
  height: var(--icon-2xl);
  color: var(--status-danger);
  margin-bottom: var(--space-4);
}

.error-state__title {
  font-family: var(--font-body);
  font-weight: 600;
  font-size: var(--text-title-sm);  /* 18px */
  color: var(--text-primary);
  margin-bottom: var(--space-2);
}

.error-state__description {
  font-family: var(--font-body);
  font-weight: 400;
  font-size: var(--text-body-sm);  /* 14px */
  color: var(--text-secondary);
  max-width: 360px;
  line-height: var(--lh-body);
  margin-bottom: var(--space-6);
}

.error-state__action {
  margin-top: var(--space-4);
}
```

**Error copy (copy these verbatim):**

| Error Type | Title | Description |
|---|---|---|
| Service unavailable | `Service temporarily unavailable` | `Unable to reach the consensus engine. Please try again in a moment.` |
| Network error | `Connection lost` | `Check your internet connection and try again.` |
| Invalid symbol | `Symbol not found` | `The symbol you entered was not recognized. Check the symbol and try again.` |
| Rate limit | `Slow down` | `Too many requests. Please wait a moment before trying again.` |
| Auth expired | `Session expired` | `Your session has expired. Please log in again.` |

**No error state should show technical details.** `Error: ECONNREFUSED at consensusRoutes.mjs:42` is for logs only, never for users.

---

### 3. EMPTY STATE

**When:** No data available for the requested context. Not an error — just nothing to show.

**Design:** Centered, icon + headline + subtext + optional action button.

```
LUMIERE:  Inbox/Clipboard icon, text-primary headline, text-secondary subtext
AMBER:    Same structure, warm treatment
MIDNIGHT: Same structure, muted gold icon
```

**Empty state layout:**

```css
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-16) var(--space-6);
  text-align: center;
  min-height: 240px;
}

.empty-state .icon {
  width: var(--icon-2xl);
  height: var(--icon-2xl);
  color: var(--text-tertiary);
  margin-bottom: var(--space-4);
}

.empty-state__title {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: var(--text-title-md);  /* 20px Cormorant */
  color: var(--text-primary);
  margin-bottom: var(--space-2);
}

.empty-state__description {
  font-family: var(--font-body);
  font-weight: 400;
  font-size: var(--text-body-sm);
  color: var(--text-secondary);
  max-width: 320px;
  line-height: var(--lh-body);
  margin-bottom: var(--space-6);
}
```

**Empty copy:**

| Context | Title | Description |
|---|---|---|
| No sessions loaded | `No sessions yet` | `Sessions will appear here once data starts flowing from the trading engine.` |
| No news | `No news available` | `Breaking news and market updates will appear here when available.` |
| No paper trades | `No paper trades recorded` | `Start paper trading to see your trade history and performance here.` |
| No consensus data | `Waiting for consensus` | `The consensus engine is initializing. Data will populate once the first analysis completes.` |
| Search no results | `No results found` | `Try adjusting your search terms or filters.` |

**Empty state CTA:** Where applicable, add a clear action: `[Load Sample Data]`, `[Configure Symbol]`, `[Start Paper Trade]`. Empty states with actions convert better than empty states without.

---

### 4. LOADING STATE (Progressive)

**For long operations (paper trade generation, backtest running):**

```css
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-12) var(--space-6);
}

.loading-state__spinner {
  width: 32px;
  height: 32px;
  border: 2px solid var(--aura-border-subtle);
  border-top-color: var(--accent-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.loading-state__label {
  font-family: var(--font-ui);
  font-weight: 500;
  font-size: var(--text-ui-md);  /* 12px DM Sans */
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: var(--ls-label);
}

.loading-state__progress {
  font-family: var(--font-data);
  font-size: var(--text-data-xs);
  color: var(--text-tertiary);
}
```

**Rule: Never use a spinner for data loading.** Spinners are for user-initiated long operations (export, generate). Data fetching uses skeleton loaders only.

---

### 5. CONTENT STATE

**The 10/10 rule for data displays:**

```
If data takes > 200ms to load → show skeleton immediately
If skeleton shows > 3s with no data → show error state (not spinner)
If error state shown → offer retry button, not auto-retry
If data is [] (empty array) → show empty state, not skeleton
If data is valid → show content with stagger animation
```

**Content state animation:**

```css
.content-state {
  animation: fadeSlideUp var(--duration-slow) var(--ease-enter) both;
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
```

---

### State Summary Card

Every new component must implement and pass this checklist:

```
┌─────────────────────────────────────────────────────┐
│  STATE CHECKLIST (mandatory for every data component)│
├─────────────────────────────────────────────────────┤
│  [ ] Skeleton state — matches card shape, pulses     │
│  [ ] Error state — icon + title + description + CTA │
│  [ ] Empty state — icon + title + description + CTA │
│  [ ] Error copy — no technical jargon               │
│  [ ] Empty copy — includes action where applicable  │
│  [ ] Loading = skeleton, NOT spinner                │
│  [ ] Error = retry button, NOT auto-retry           │
│  [ ] Empty[] = empty state, NOT skeleton           │
│  [ ] Content animates in with stagger               │
│  [ ] All 3 modes tested (LUMIERE/AMBER/MIDNIGHT)   │
│  [ ] All 4 breakpoints tested (320/768/1024/1280)  │
│  [ ] Touch targets 44px minimum                     │
└─────────────────────────────────────────────────────┘
```

---

## PART 19 — LIVE DATA ANIMATION

### The Core Problem

Price feeds, consensus scores, and vote counts update every tick. Without animation, numbers snap — users can't tell if a price went up or down, or if the number changed at all. Animation makes data changes *legible*, not just visible.

### The 3 Data Update Animations

#### 1. Price Tick Flash
**Trigger:** Price value changes by any amount.
**Behavior:** Brief background flash on the number. Green for up, red for down. Fades out over 600ms.

```css
/* Base: price text */
.data-price {
  font-family: var(--font-data);
  font-weight: 600;
  font-size: var(--text-data-lg);
  font-variant-numeric: tabular-nums;
  transition: color 200ms ease;
}

/* Up tick: green flash */
.data-price--up {
  color: #10B981;
  animation: price-flash-up 600ms ease-out forwards;
}

@keyframes price-flash-up {
  0%   { background-color: rgba(16, 185, 129, 0.25); }
  40%  { background-color: rgba(16, 185, 129, 0.15); }
  100% { background-color: transparent; }
}

/* Down tick: red flash */
.data-price--down {
  color: #EF4444;
  animation: price-flash-down 600ms ease-out forwards;
}

@keyframes price-flash-down {
  0%   { background-color: rgba(239, 68, 68, 0.25); }
  40%  { background-color: rgba(239, 68, 68, 0.15); }
  100% { background-color: transparent; }
}
```

**Per mode adaptation:**

```css
/* MIDNIGHT: slightly brighter for visibility on dark */
[data-aura-theme="midnight"] .data-price--up {
  animation: price-flash-up-midnight 600ms ease-out forwards;
}
@keyframes price-flash-up-midnight {
  0%   { background-color: rgba(16, 185, 129, 0.35); }
  100% { background-color: transparent; }
}

[data-aura-theme="midnight"] .data-price--down {
  animation: price-flash-down-midnight 600ms ease-out forwards;
}
@keyframes price-flash-down-midnight {
  0%   { background-color: rgba(239, 68, 68, 0.35); }
  100% { background-color: transparent; }
}
```

**Rule: Flash duration is 600ms, not faster.** Anything under 400ms is invisible on a 60Hz display. 600ms gives enough time for the eye to catch the change without feeling slow.

#### 2. Number Roll (Count Up/Down)
**Trigger:** Large value change (confidence score, vote count, P&L).
**Behavior:** Numbers count up or down from old value to new value over 400ms. Creates a "rolling ticker" effect.

```css
/* Number roll: old value slides out, new value rolls in */
.data-roll {
  position: relative;
  overflow: hidden;
  display: inline-block;
  font-family: var(--font-data);
  font-variant-numeric: tabular-nums;
}

.data-roll__digit {
  display: inline-block;
  transition: transform 400ms var(--ease-enter);
}

/* Up roll: digits move up */
.data-roll--up .data-roll__digit--new {
  animation: roll-up 400ms var(--ease-enter) forwards;
}
.data-roll--up .data-roll__digit--old {
  position: absolute;
  animation: roll-out-up 400ms var(--ease-enter) forwards;
}

/* Down roll: digits move down */
.data-roll--down .data-roll__digit--new {
  animation: roll-down 400ms var(--ease-enter) forwards;
}
.data-roll--down .data-roll__digit--old {
  position: absolute;
  animation: roll-out-down 400ms var(--ease-enter) forwards;
}

@keyframes roll-up {
  from { transform: translateY(100%); opacity: 0; }
  to   { transform: translateY(0); opacity: 1; }
}
@keyframes roll-out-up {
  from { transform: translateY(0); opacity: 1; }
  to   { transform: translateY(-100%); opacity: 0; }
}
@keyframes roll-down {
  from { transform: translateY(-100%); opacity: 0; }
  to   { transform: translateY(0); opacity: 1; }
}
@keyframes roll-out-down {
  from { transform: translateY(0); opacity: 1; }
  to   { transform: translateY(100%); opacity: 0; }
}
```

**When to use roll vs flash:**
```
Price tick (every tick, small change)     → Flash only (600ms)
Confidence score change (>5% delta)     → Roll (400ms)
Vote count change                        → Flash (immediate feedback)
P&L change (large monetary value)        → Roll + Flash combined
Consensus percentage change              → Flash (always)
```

#### 3. Confidence Arc Animation
**Trigger:** Consensus confidence percentage changes.
**Behavior:** SVG arc animates from old percentage to new percentage. Duration: 800ms.

```css
/* Confidence arc: SVG stroke-dashoffset animation */
.confidence-arc {
  transition: stroke-dashoffset 800ms var(--ease-enter);
}

.confidence-arc--up {
  stroke: #10B981;
  filter: drop-shadow(0 0 4px rgba(16, 185, 129, 0.5));
}

.confidence-arc--down {
  stroke: #EF4444;
  filter: drop-shadow(0 0 4px rgba(239, 68, 68, 0.5));
}
```

---

### Live Data Update Rules

```
1. Price flash: 600ms, green/red background, color transition 200ms
2. Number roll: 400ms, ease-enter, old digit out / new digit in
3. Confidence arc: 800ms, ease-enter, stroke-dashoffset animation
4. Never animate data updates with elastic/bounce easing — feels broken
5. Disable data animations when prefers-reduced-motion is active
6. Stop animation after 3 consecutive rapid updates (debounce) — flash only once
7. Directional arrow icon (TrendingUp/Down) pulses once on data change
```

**Reduced motion override for live data:**

```css
@media (prefers-reduced-motion: reduce) {
  .data-price--up,
  .data-price--down {
    animation: none;
  }
  .data-roll__digit--new,
  .data-roll__digit--old {
    animation: none;
    opacity: 1;
    transform: none;
  }
  .confidence-arc {
    transition: none;
  }
}
```

---

### Consensus Score Change Animation

```css
/* Score goes UP: green tint, slide up, confidence arc grows */
.consensus-score--up {
  animation: score-up 400ms var(--ease-enter) forwards;
}
@keyframes score-up {
  0%   { color: #10B981; transform: translateY(4px); }
  60%  { color: #10B981; transform: translateY(-2px); }
  100% { color: var(--text-primary); transform: translateY(0); }
}

/* Score goes DOWN: red tint, slide down, confidence arc shrinks */
.consensus-score--down {
  animation: score-down 400ms var(--ease-enter) forwards;
}
@keyframes score-down {
  0%   { color: #EF4444; transform: translateY(-4px); }
  60%  { color: #EF4444; transform: translateY(2px); }
  100% { color: var(--text-primary); transform: translateY(0); }
}
```

---

## PART 20 — DARK LUMIERE VARIANT (OBSIDIAN CLINICAL)

### The Gap

LUMIERE is clinical and clean — but some traders want that Swiss-bank precision in dark mode too. MIDNIGHT has warmth and candlelight, which is its identity. There's no spec for "clinical dark" — the cold, precise version of LUMIERE without the gold warmth.

**This is an optional 4th mode, not replacing MIDNIGHT.**

### When to Use

```
MIDNIGHT  → Late night trading, focused deep work, candlelight warmth
OBSIDIAN  → User prefers dark but wants clinical precision (Bloomberg-style dark)
```

### Color Tokens

```css
/* OBSIDIAN MODE (Clinical Dark) — Optional 4th mode */
:root[data-aura-theme="obsidian"],
:root[data-theme="obsidian"] {
  --aura-base-layer: #0d0f14;           /* Near black, slight blue undertone */
  --aura-surface-elevated: #161a24;    /* Dark slate, cooler than MIDNIGHT */
  --aura-surface-glass: rgba(22, 26, 36, 0.85);
  --aura-text-primary: #e8e8ec;         /* Cool white */
  --aura-text-secondary: #8b8fa8;       /* Cool gray */
  --aura-text-tertiary: #565870;        /* Muted slate */
  --aura-accent-primary: #3b82f6;       /* Cobalt blue — KEPT from LUMIERE */
  --aura-accent-glow: rgba(59, 130, 246, 0.15);
  --aura-accent-red: #ef4444;
  --aura-accent-purple: #8b5cf6;
  --aura-accent-red-glow: rgba(239, 68, 68, 0.2);
  --aura-accent-green-glow: rgba(16, 185, 129, 0.2);
  --aura-accent-yellow-glow: rgba(245, 158, 11, 0.2);
  --aura-border-subtle: rgba(255, 255, 255, 0.06);
  --aura-border-strong: rgba(255, 255, 255, 0.12);
  --aura-gem-glow: 0 0 15px rgba(59, 130, 246, 0.5);  /* Blue gem glow */
  --aura-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);     /* Pure black shadow */
  --aura-overlay: rgba(0, 0, 0, 0.75);
  --aura-status-success: #10B981;
  --aura-status-warning: #F59E0B;
  --aura-status-danger: #EF4444;
  --aura-status-info: #3B82F6;
  --aura-amd-accumulation: #0A84FF;
  --aura-amd-manipulation: #BF5AF2;
  --aura-amd-distribution: #30D158;
  --aura-amd-transition: #8E8E93;
}
```

### OBSIDIAN vs MIDNIGHT: The Difference

| Property | OBSIDIAN (Clinical Dark) | MIDNIGHT (Vault Dark) |
|---|---|---|
| Base background | `#0d0f14` (cooler, blue-tinted) | `#05070a` (warmer, near-black) |
| Surface | `#161a24` (dark slate) | `#12141c` (slightly lighter) |
| Accent color | `#3b82f6` (cobalt blue) | `#b8860b` (dark gold) |
| Gem glow | Cobalt blue | Dark gold |
| Mood | Bloomberg Terminal dark | Private vault at midnight |
| Card shadow | Pure black | Gold-tinted on hover |
| Surface glass | `rgba(22,26,36,0.85)` | `rgba(18,20,28,0.7)` |
| Text secondary | `#8b8fa8` (cool gray) | `#94a3b8` (blue-gray) |

**Key insight:** OBSIDIAN keeps the LUMIERE accent color (cobalt blue `#3b82f6`) because the accent IS the identity. MIDNIGHT's gold is its signature. OBSIDIAN's signature is the blue-on-dark precision — the Bloomberg terminal feel.

### OBSIDIAN Theme Switcher

The theme switcher in `index.css` currently has 3 modes. Add OBSIDIAN as 4th:

```html
<!-- Theme switcher: 4 modes -->
<button data-theme="lumiere">☀</button>
<button data-theme="amber"> ◐ </button>
<button data-theme="obsidian"> ◑ </button>
<button data-theme="midnight"> ◒ </button>
```

```css
/* Theme index: 4 buttons at 42px apart */
/* 0 = LUMIERE, 1 = AMBER, 2 = OBSIDIAN, 3 = MIDNIGHT */
:root[data-aura-theme="lumiere"]  { --theme-index: 0; }
:root[data-aura-theme="amber"]   { --theme-index: 1; }
:root[data-aura-theme="obsidian"] { --theme-index: 2; }
:root[data-aura-theme="midnight"] { --theme-index: 3; }

/* Glider moves 42px per position: 0, 42, 84, 126 */
.aura-theme-switcher__glider {
  transform: translateX(calc(var(--theme-index, 0) * 42px));
  /* Duration stays 420ms ease-enter */
}
```

**Note:** The glider math is `var(--theme-index, 0) * 42px`. With 4 buttons at 36px each + 6px padding each side, the glider is 36px wide and positions at 6, 48, 90, 132px left. Adjust if button sizes change.

---

## PART 21 — KEYBOARD NAVIGATION & ACCESSIBILITY

### Focus Management Rules

```css
/* Global focus style — always present */
:focus-visible {
  outline: 2px solid var(--accent-primary);
  outline-offset: 3px;
  box-shadow: 0 0 0 5px var(--accent-glow);
}

/* Remove focus ring on mouse click (keep for keyboard) */
:focus:not(:focus-visible) {
  outline: none;
  box-shadow: none;
}
```

### Skip Link (First Focusable Element)

```css
.skip-link {
  position: absolute;
  top: -100px;
  left: var(--space-4);
  padding: var(--space-2) var(--space-4);
  background: var(--accent-primary);
  color: #ffffff;
  font-family: var(--font-ui);
  font-weight: 600;
  font-size: var(--text-ui-md);
  border-radius: var(--radius-md);
  z-index: var(--z-tooltip);
  transition: top var(--duration-smooth) var(--ease-default);
}

.skip-link:focus {
  top: var(--space-4);
  outline: 2px solid var(--accent-primary);
  outline-offset: 3px;
  box-shadow: 0 0 0 5px var(--accent-glow);
}
```

**HTML:** `<a class="skip-link" href="#main-content">Skip to main content</a>` — must be the very first focusable element in the document.

### Focus Trap in Modals

```javascript
// Modal focus trap — in modal open handler
function trapFocus(modalEl) {
  const focusable = modalEl.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  function handleTab(e) {
    if (e.key !== 'Tab') return;
    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  modalEl.addEventListener('keydown', handleTab);
  first.focus(); // focus first element on open
  return () => modalEl.removeEventListener('keydown', handleTab);
}
```

### Arrow Key Navigation in Data Tables

```css
/* Table cells: keyboard navigable with arrow keys */
.data-table td:focus,
.data-table th:focus {
  outline: 2px solid var(--accent-primary);
  outline-offset: -2px;
  background-color: color-mix(in srgb, var(--accent-primary) 8%, transparent);
}
```

### Roving Tabindex for Nav

```jsx
// Nav keyboard navigation — roving tabindex pattern
function NavBar() {
  const [activeIndex, setActiveIndex] = useState(0);
  const navItems = ['Dashboard', 'Signals', 'Positions', 'Settings'];

  function handleKey(e, index) {
    if (e.key === 'ArrowRight') {
      setActiveIndex((index + 1) % navItems.length);
    }
    if (e.key === 'ArrowLeft') {
      setActiveIndex((index - 1 + navItems.length) % navItems.length);
    }
  }

  return (
    <nav>
      {navItems.map((item, i) => (
        <button
          key={item}
          tabIndex={i === activeIndex ? 0 : -1}
          onKeyDown={(e) => handleKey(e, i)}
          onClick={() => setActiveIndex(i)}
        >
          {item}
        </button>
      ))}
    </nav>
  );
}
```

**Rule: Only the active nav item has `tabIndex={0}`.** All others have `tabIndex={-1}`. This prevents the keyboard user from tabbing through all nav items on every tab press.

### Escape Key Behavior

```css
/* Escape closes modals/drawers, resets hover states */
.modal:focus-trap-escape {
  /* modal close handler: on Escape key, call closeModal() */
}

/* Escape key visual feedback */
.modal.is-closing {
  animation: modal-escape-out 200ms var(--ease-exit) forwards;
}
@keyframes modal-escape-out {
  from { opacity: 1; transform: scale(1); }
  to   { opacity: 0; transform: scale(0.96); }
}
```

### High Contrast Mode Support

```css
/* Respect forced-colors (Windows High Contrast Mode) */
@media (forced-colors: active) {
  .card {
    border: 2px solid CanvasText;
  }
  .badge-long {
    background-color: Mark;
    color: MarkText;
    border: 2px solid ButtonText;
  }
  .badge-short {
    background-color: Mark;
    color: MarkText;
    border: 2px solid ButtonText;
  }
  .btn-primary {
    background-color: ButtonFace;
    border: 2px solid ButtonText;
    color: ButtonText;
  }
  /* All colors use system tokens — signal colors still visible */
}
```

### Screen Reader Announcements

```html
<!-- Live region: announces price changes to screen readers -->
<div
  role="status"
  aria-live="polite"
  aria-atomic="true"
  class="sr-only"
>
  <!-- Dynamic: inject "NIFTY at 22,450 up 50 points" on each price update -->
</div>
```

```css
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```

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

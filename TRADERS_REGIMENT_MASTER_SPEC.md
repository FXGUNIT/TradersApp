# TRADERS REGIMENT — MASTER SPECIFICATION v9+
## Institutional Futures Trading Terminal — Complete Technical & UX Documentation

**Project Code:** `mnq-system-v9.jsx` → Target: `v10.jsx`  
**Design Standard:** AURA Tri-State Theme Engine + Apple iOS Glassmorphism  
**Trading Focus:** MNQ/MES Intraday Futures (AMD Framework)

---

## 🎯 PROJECT PHILOSOPHY

**Core Principle:** "Institutional-grade precision meets consumer-grade simplicity."

This terminal must feel like:
- A Bloomberg terminal (power, data density)
- Apple Music (clean, intuitive, delightful)
- A fighter jet cockpit (critical info instantly readable, zero friction in execution)

**Non-Negotiable UX Standard:**  
Every action must be executable in **under 2 seconds** during live market conditions. The UI is designed for speed under pressure, not aesthetic exploration.

---

## 📐 PART 1: AURA THEME SYSTEM INTEGRATION

### 1.1 THE THREE STATES

**[LUMIÈRE] — Day Mode (Market Open)**
- **Philosophy:** "The Glass Trading Floor"
- **Use Case:** 10:00 AM - 5:00 PM IST trading hours
- **Ambient Light:** Bright office/natural daylight
- **Visual Goal:** Maximum clarity, zero eye strain during active screen time

**[AMBER] — Eye Comfort Mode (Pre/Post Market)**
- **Philosophy:** "The War Room Library"
- **Use Case:** Pre-market prep (7:00-10:00 AM IST), post-session review
- **Ambient Light:** Indoor lighting, evening transition
- **Visual Goal:** Reduce blue light 65%, maintain readability for extended analysis

**[MIDNIGHT] — Night Mode (After Hours)**
- **Philosophy:** "The Obsidian Vault"
- **Use Case:** Late night journaling, weekend strategy planning
- **Ambient Light:** Dark room, OLED battery optimization
- **Visual Goal:** Deep blacks, muted colors, 92% blue light reduction

---

### 1.2 COLOR TOKEN SYSTEM (CSS Variables)

**IMPLEMENTATION INSTRUCTION:**  
Every color in the JSX must be replaced with `var(--token-name)`. No hardcoded hex codes except in the CSS variable definitions.

```css
/* ROOT THEME TOKENS */
:root {
  /* Base Layers */
  --base-layer: #FBFBFC;
  --surface-elevated: #FFFFFF;
  --surface-glass: rgba(255,255,255,0.8);
  
  /* Typography */
  --text-primary: #121212;
  --text-secondary: #6B7280;
  --text-tertiary: #9CA3AF;
  
  /* Borders & Dividers */
  --border-subtle: rgba(0,0,0,0.05);
  --border-strong: rgba(0,0,0,0.12);
  
  /* Accent Colors */
  --accent-primary: #2563EB;
  --accent-glow: rgba(37,99,235,0.1);
  
  /* Shadows (Luxury Depth) */
  --shadow-sm: 0 2px 8px rgba(0,0,0,0.04);
  --shadow-md: 0 10px 40px rgba(0,0,0,0.06);
  --shadow-lg: 0 20px 60px rgba(0,0,0,0.08);
  
  /* AMD Phase Colors (Universal) */
  --amd-accumulation: #0A84FF;
  --amd-manipulation: #BF5AF2;
  --amd-distribution: #30D158;
  --amd-transition: #8E8E93;
  
  /* Status Colors */
  --status-success: #10B981;
  --status-warning: #F59E0B;
  --status-danger: #EF4444;
  --status-info: #3B82F6;
}

/* AMBER MODE OVERRIDE */
:root[data-theme="amber"] {
  --base-layer: #F4EBD0;
  --surface-elevated: #FDF6E3;
  --surface-glass: rgba(253,246,227,0.85);
  --text-primary: #3D2B1F;
  --text-secondary: #7C6A53;
  --text-tertiary: #A89680;
  --border-subtle: rgba(139,92,24,0.1);
  --border-strong: rgba(139,92,24,0.2);
  --accent-primary: #D97706;
  --accent-glow: rgba(217,119,6,0.1);
  --shadow-sm: 0 2px 8px rgba(67,52,34,0.08);
  --shadow-md: 0 10px 40px rgba(67,52,34,0.1);
  --shadow-lg: 0 20px 60px rgba(67,52,34,0.12);
}

/* MIDNIGHT MODE OVERRIDE */
:root[data-theme="midnight"] {
  --base-layer: #05070A;
  --surface-elevated: #12141C;
  --surface-glass: rgba(18,20,28,0.7);
  --text-primary: #E1E1E1;
  --text-secondary: #94A3B8;
  --text-tertiary: #64748B;
  --border-subtle: rgba(255,255,255,0.05);
  --border-strong: rgba(255,255,255,0.1);
  --accent-primary: #38BDF8;
  --accent-glow: rgba(56,189,248,0.1);
  --shadow-sm: 0 0 0 1px rgba(255,255,255,0.05);
  --shadow-md: 0 0 0 1px rgba(255,255,255,0.08);
  --shadow-lg: 0 0 0 2px rgba(255,255,255,0.1);
}
```

---

### 1.3 GLASSMORPHISM COMPONENTS

```css
/* GLASS PANEL — Main Cards, Analysis Sections */
.glass-panel {
  background: var(--surface-glass);
  backdrop-filter: saturate(180%) blur(20px);
  -webkit-backdrop-filter: saturate(180%) blur(20px);
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  box-shadow: var(--shadow-md);
}

/* GLASS BUTTON — All Interactive Buttons */
.btn-glass {
  background: var(--accent-glow);
  border: 1px solid var(--accent-primary);
  border-radius: 8px;
  padding: 12px 24px;
  color: var(--accent-primary);
  font-family: 'IBM Plex Mono', monospace;
  font-size: 11px;
  letter-spacing: 1.5px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.btn-glass:hover {
  transform: scale(1.025) translateY(-2px);
  box-shadow: 0 10px 30px var(--accent-glow);
}

/* INPUT GLASS — All Form Inputs */
.input-glass {
  background: var(--surface-elevated);
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  padding: 10px 14px;
  color: var(--text-primary);
  font-family: 'IBM Plex Mono', monospace;
  font-size: 12px;
  transition: all 0.2s ease;
}

/* GRADIENT TEXT — Headers, Key Labels */
.gemini-gradient-text {
  background: linear-gradient(135deg, var(--accent-primary), var(--amd-manipulation));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  font-weight: 700;
  letter-spacing: 2px;
}
```

---

## 🖥️ PART 2: MAIN TERMINAL UX ARCHITECTURE

### 2.1 THE FOUR-TAB NAVIGATION SYSTEM

**Tab Structure (Fixed Header):**
1. **PREMARKET** - Morning Intel Briefing
2. **TRADE ENTRY** - Execution Cockpit  
3. **JOURNAL** - Performance Vault
4. **ACCOUNT MGR** - Control Center

---

## 🧮 PART 3: MATHEMATICAL FORMULAS

### 3.1 VOLATILITY ENGINE (Continuous)

**Formula 1: Volatility Ratio (VR)**
```
VR = 5D_ATR / 20D_ATR
- VR < 0.7 → COMPRESSED
- VR 0.7-1.2 → NORMAL
- VR > 1.2 → EXPANDED
```

### 3.2 DYNAMIC STOP LOSS MULTIPLIER
```
Dynamic_SL_Mult = Base_SL_Mult × (1 + VR_Adjustment)
Where VR_Adjustment = (VR - 1.0) × 0.5
```

### 3.3 POSITION SIZING
```
Max_Risk_USD = Account_Balance × (Risk_Pct / 100)
Contracts = FLOOR(Max_Risk_USD / (SL_Points × Dollars_Per_Point))
```

### 3.4 DRAWDOWN THROTTLING
```
Buffer_Pct = (Distance_To_Liq / Max_Drawdown) × 100
If Buffer_Pct < 25%: Trigger_Throttle = TRUE, Risk × 0.5
```

### 3.5 AMD QUANTITATIVE DETECTION
- **ACCUMULATION**: Range < 0.8× 20D_ADR, Volume ↑ near lows
- **MANIPULATION**: Wick Ratio ≥ 0.40, Wick > 1.5× ATR
- **DISTRIBUTION**: Range > 1.2× 20D_ADR, Higher highs/lower lows
- **TRANSITION**: Conflicting signals, ADX declining

### 3.6 MANIPULATION WICK VALIDATION
```
Wick_Ratio = Relevant_Wick / Total_Range
If Wick_Ratio ≥ 0.40 AND Range > 1.5× ATR → MANIPULATION DETECTED
```

---

## 📋 PART 4: DATA FLOW & CONNECTIONS

### 4.1 FIREBASE STRUCTURE
```
traders-regiment-db/
├── users/
│   └── {uid}/
│       ├── profile/ (fullName, email, status, createdAt, lastLogin)
│       ├── journal/ (trade entries with AMD phase, P&L, result)
│       ├── firmRules/ (parsed T&C rules)
│       ├── accountState/ (startingBalance, currentBalance, highWaterMark)
│       ├── sessions/ (login history)
│       └── otps/ (email/phone verification)
```

---

## 📋 PART 5: IMPLEMENTATION CHECKLIST

### Phase 1: Theme System
- [ ] Create index.css with AURA color tokens
- [ ] Add theme toggle component (3-state orb)
- [ ] Implement localStorage persistence
- [ ] Test all 3 themes

### Phase 2: Component Refactor
- [ ] Replace hardcoded colors with var(--token)
- [ ] Apply glassmorphism classes
- [ ] Apply .gemini-gradient-text to headers

### Phase 3: Math Engine
- [ ] Create math-engine.js with volatility formulas
- [ ] Implement dynamic SL calculation
- [ ] Implement drawdown throttle logic

### Phase 4: AMD Framework
- [ ] Update dropdowns to 4 AMD labels
- [ ] Add AMD performance breakdown in Journal

---

## 🎓 USAGE FOR AI AGENTS

When modifying this codebase:

1. **Follow AURA Theme System** - Use CSS variables only, no hardcoded hex
2. **Preserve All Features** - No breaking changes
3. **Test Thoroughly** - Run lint, build, and manual QA
4. **Update Documentation** - Keep this spec accurate

**Version:** 1.0  
**Last Updated:** 2026-03-25  
**Compatible with:** Traders Regiment v9+

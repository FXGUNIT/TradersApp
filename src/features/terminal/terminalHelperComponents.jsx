// Terminal Helper Components - Matching exact backup UI
// These components replicate the exact styling from App.jsx.bak
// Theme-aware using CSS variables from index.css

const getCSSVar = (varName, fallback) => {
  if (typeof document === 'undefined') return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || fallback;
};

export const getThemeColors = () => ({
  text: getCSSVar('--aura-text-primary', '#111827'),
  muted: getCSSVar('--aura-text-secondary', '#6B7280'),
  bg: getCSSVar('--aura-base-layer', '#F9FAFB'),
  card: getCSSVar('--aura-surface-elevated', '#FFFFFF'),
  border: getCSSVar('--aura-border-subtle', 'rgba(0,0,0,0.08)'),
  accent: getCSSVar('--aura-accent-primary', '#3B82F6'),
});

export const T = {
  text: "#111827",
  muted: "#6B7280",
  dim: "rgba(0,0,0,0.25)",
  blue: "#3B82F6",
  orange: "#F97316",
  purple: "#A855F7",
  green: "#22C55E",
  red: "#EF4444",
  gold: "#FBBF24",
  cyan: "#06B6D4",
  amdA: "#10B981",
  amdM: "#F97316",
  amdD: "#EF4444",
  amdT: "#8B5CF6",
  font: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif",
  mono: "'SF Mono', 'Menlo', 'Monaco', 'Courier New', monospace",
};

// Time options for IST timezone
export const TIME_OPTIONS = (() => {
  const opts = [{ v: '', l: '— time IST —' }];
  for (let h = 10; h <= 17; h++) {
    for (let m = 0; m < 60; m += 5) {
      if (h === 17 && m > 0) continue;
      const hh = h > 12 ? h - 12 : (h === 0 ? 12 : h);
      const ampm = h >= 12 ? 'PM' : 'AM';
      opts.push({ v: `${hh}:${String(m).padStart(2, '0')} ${ampm}`, l: `${hh}:${String(m).padStart(2, '0')} ${ampm} IST` });
    }
  }
  return opts;
})();

export const AMD_PHASES = {
  ACCUMULATION: { color: T.amdA, icon: "◎", label: "Accumulation (Mean Reversion)", desc: "Smart money building long positions" },
  MANIPULATION: { color: T.amdM, icon: "⚡", label: "Manipulation (Reversal)", desc: "Stop hunt / false breakout" },
  DISTRIBUTION: { color: T.amdD, icon: "◈", label: "Distribution (Trend)", desc: "Smart money offloading into strength" },
  TRANSITION: { color: T.amdT, icon: "⟳", label: "Transition (No Trade)", desc: "Phase shifting — stay flat" },
  UNCLEAR: { color: T.muted, icon: "?", label: "Phase Unclear", desc: "No clear institutional signature" },
};

// Style constants matching backup exactly
export const getInputStyle = () => {
  const colors = getThemeColors();
  return { 
    background: colors.card, 
    border: `1px solid ${colors.border}`, 
    borderRadius: 8, 
    padding: "12px 14px", 
    color: colors.text, 
    fontFamily: T.mono, 
    fontSize: 14, 
    width: "100%", 
    boxSizing: "border-box", 
    outline: "none", 
    transition: "all 0.2s ease", 
  };
};

export const inp = { 
  background: "#F9FAFB", 
  border: `1px solid rgba(0,0,0,0.08)`, 
  borderRadius: 8, 
  padding: "12px 14px", 
  color: T.text, 
  fontFamily: T.mono, 
  fontSize: 14, 
  width: "100%", 
  boxSizing: "border-box", 
  outline: "none", 
  transition: "all 0.2s ease", 
  backdropFilter: "none", 
  WebkitBackdropFilter: "none" 
};

export const cardS = (e = {}) => { 
  const colors = getThemeColors();
  return { 
    background: colors.card, 
    border: "none", 
    borderRadius: 12, 
    padding: "24px 32px", 
    marginBottom: 16, 
    boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.05)", 
    ...e 
  };
};

export const glowBtn = (color, disabled) => ({ 
  background: disabled ? "#f3f4f6" : "var(--aura-surface-elevated, #1a1a1a)", 
  border: disabled ? "1px solid #e5e7eb" : "1px solid var(--aura-border-subtle, #1a1a1a)", 
  borderRadius: 6, 
  padding: "12px 24px", 
  cursor: disabled ? "not-allowed" : "pointer", 
  color: disabled ? "#9ca3af" : "var(--aura-text-primary, #ffffff)", 
  fontFamily: T.font, 
  fontSize: 12, 
  fontWeight: 700, 
  letterSpacing: 1.5, 
  transition: "all 0.2s ease", 
  opacity: disabled ? 0.6 : 1, 
});

export const lbl = { 
  color: "var(--aura-text-secondary, #64748B)", 
  fontSize: 11, 
  letterSpacing: 1.5, 
  marginBottom: 6, 
  display: "block", 
  textTransform: "uppercase", 
  fontWeight: 600, 
  fontFamily: T.font 
};

// LED Component
export function LED({ color, size = 10, pulse = true }) {
  return (
    <div style={{ 
      width: size, 
      height: size, 
      borderRadius: "50%", 
      background: color, 
      boxShadow: `0 0 ${size}px ${color},0 0 ${size * 2}px ${color}60`, 
      animation: pulse ? `led-pulse 1.8s ease-in-out infinite` : "none", 
      flexShrink: 0 
    }} />
  );
}

// Tag Component
export function Tag({ label, color }) {
  return (
    <span style={{ 
      background: color + "15", 
      color, 
      border: `1px solid ${color}35`, 
      borderRadius: 6, 
      padding: "4px 10px", 
      fontSize: 11, 
      letterSpacing: 1, 
      fontWeight: 600, 
      whiteSpace: "nowrap" 
    }}>
      {label}
    </span>
  );
}

// SHead Component - Section Header
export function SHead({ icon, title, color, sub, right }) { 
  return (
    <div style={{ 
      display: "flex", 
      alignItems: "center", 
      gap: 12, 
      marginBottom: 18, 
      paddingBottom: 12, 
      borderBottom: `1px solid ${color}20` 
    }}>
      <span style={{ color, fontSize: 18 }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ color, fontSize: 13, letterSpacing: 1.5, fontWeight: 700 }}>{title}</div>
        {sub && <div style={{ color: T.muted, fontSize: 11, marginTop: 4, fontWeight: 400 }}>{sub}</div>}
      </div>
      {right}
    </div>
  ); 
}

// Field Component - Form Input
export function Field({ label, type = "text", value, onChange, placeholder, options, highlight, disabled, mono }) { 
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={lbl}>{label}</label>
      {options ? (
        <select 
          value={value} 
          onChange={e => onChange(e.target.value)} 
          disabled={disabled} 
          style={{ 
            ...inp, 
            borderColor: highlight ? T.green : "rgba(255,255,255,0.12)", 
            opacity: disabled ? 0.5 : 1, 
            fontFamily: T.font 
          }} 
          className="input-glass"
        >
          {options.map(o => <option key={o.v ?? o} value={o.v ?? o}>{o.l ?? o}</option>)}
        </select>
      ) : (
        <input 
          type={type} 
          value={value} 
          onChange={e => onChange(e.target.value)} 
          placeholder={placeholder} 
          disabled={disabled} 
          style={{ 
            ...inp, 
            borderColor: highlight ? T.green : "rgba(255,255,255,0.12)", 
            opacity: disabled ? 0.5 : 1, 
            fontFamily: mono ? T.mono : T.font 
          }} 
          className="input-glass" 
        />
      )}
    </div>
  ); 
}

// Loader Component
export function Loader({ color, label }) { 
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 240, gap: 16 }}>
      <div style={{ display: "flex", gap: 4, alignItems: "flex-end", height: 28 }}>
        {[8, 15, 10, 20, 12, 17, 9].map((h, i) => (
          <div 
            key={i} 
            style={{ 
              width: 4, 
              height: h, 
              background: color, 
              borderRadius: 2, 
              animation: `bar ${0.85 + i * 0.05}s ${i * 0.1}s ease-in-out infinite alternate` 
            }} 
          />
        ))}
      </div>
      <span style={{ color: T.muted, fontSize: 12, letterSpacing: 2, fontWeight: 600 }}>{label}</span>
    </div>
  ); 
}

// RenderOut Component - AI Output Renderer
export function RenderOut({ text }) {
  if (!text) return null;
  return (
    <div style={{ fontFamily: T.font, lineHeight: 1.8, fontSize: 13 }}>
      {text.split('\n').map((line, i) => {
        const t = line.trim();
        if (t.startsWith('## ')) return <h2 key={i} style={{ color: T.gold, fontSize: 15, margin: "24px 0 10px", borderBottom: `1px solid rgba(255,255,255,0.1)`, paddingBottom: 8, letterSpacing: 1, fontWeight: 700 }}>{t.slice(3)}</h2>;
        if (t.startsWith('### ')) return <h3 key={i} style={{ color: T.blue, fontSize: 13, margin: "14px 0 6px", letterSpacing: 0.5, fontWeight: 600 }}>{t.slice(4)}</h3>;
        if (t.includes('🚫')) return <div key={i} style={{ background: "rgba(255,69,58,0.1)", border: `1px solid rgba(255,69,58,0.3)`, borderRadius: 6, padding: "12px 16px", margin: "8px 0", color: T.red, fontSize: 13, fontWeight: 600 }}>{t}</div>;
        if (t.includes('✅')) return <div key={i} style={{ background: "rgba(48,209,88,0.1)", border: `1px solid rgba(48,209,88,0.3)`, borderRadius: 6, padding: "12px 16px", margin: "8px 0", color: T.green, fontSize: 13, fontWeight: 600 }}>{t}</div>;
        if (t.includes('⚠️') || t.includes('⚠')) return <div key={i} style={{ background: "rgba(255,214,10,0.1)", border: `1px solid rgba(255,214,10,0.3)`, borderRadius: 6, padding: "12px 16px", margin: "8px 0", color: T.gold, fontSize: 13, fontWeight: 600 }}>{t}</div>;
        if (t.includes('**')) { const parts = t.split(/(\*\*[^*]+\*\*)/g); return <p key={i} style={{ color: "#A1A1A6", margin: "4px 0" }}>{parts.map((p2, j) => p2.startsWith('**') ? <strong key={j} style={{ color: T.text, fontWeight: 600 }}>{p2.replace(/\*\*/g, '')}</strong> : p2)}</p>; }
        if (!t) return <div key={i} style={{ height: 6 }} />;
        return <p key={i} style={{ color: t.startsWith('→') || t.startsWith('AMD') ? T.cyan : "#A1A1A6", margin: "3px 0" }}>{line}</p>;
      })}
    </div>
  );
}

// AMDPhaseTag Component
export function AMDPhaseTag({ phase }) {
  const cfg = AMD_PHASES[phase] || AMD_PHASES.UNCLEAR;
  return (
    <div style={{ 
      display: "flex", 
      alignItems: "center", 
      gap: 10, 
      padding: "8px 14px", 
      background: cfg.color + "15", 
      border: `1px solid ${cfg.color}40`, 
      borderRadius: 8 
    }} 
    className="glass-panel"
    >
      <LED color={cfg.color} size={10} pulse={phase !== 'UNCLEAR'} />
      <div>
        <div style={{ color: cfg.color, fontSize: 12, fontWeight: 700, letterSpacing: 1 }}>{cfg.icon} {cfg.label}</div>
        <div style={{ color: T.muted, fontSize: 11, marginTop: 2 }}>{cfg.desc}</div>
      </div>
    </div>
  );
}

// TrafficLight Component
export function TrafficLight({ state }) {
  if (state === 'none') return null;
  const cfg = { 
    green: { color: T.green, label: "TRADE CLEAR", sub: "All systems go · Compliance passed" }, 
    yellow: { color: T.gold, label: "CAUTION ACTIVE", sub: "Warning detected — review analysis" }, 
    red: { color: T.red, label: "TERMINAL LOCKED", sub: "Compliance breach or market closed" } 
  };
  const c = cfg[state];
  return (
    <div style={{ 
      display: "flex", 
      alignItems: "center", 
      gap: 16, 
      padding: "14px 20px", 
      background: "rgba(0,0,0,0.4)", 
      border: `1px solid ${c.color}30`, 
      borderRadius: 10, 
      marginBottom: 16 
    }} 
    className="glass-panel"
    >
      <div style={{ 
        width: 22, 
        height: 22, 
        borderRadius: "50%", 
        background: c.color, 
        boxShadow: `0 0 12px ${c.color},0 0 32px ${c.color}60`, 
        animation: `led-pulse 1.6s ease-in-out infinite`, 
        flexShrink: 0 
      }} />
      <div>
        <div style={{ color: c.color, fontSize: 13, letterSpacing: 2, fontWeight: 800 }}>{c.label}</div>
        <div style={{ color: T.muted, fontSize: 11, marginTop: 3 }}>{c.sub}</div>
      </div>
    </div>
  );
}

// CountdownBanner Component
export function CountdownBanner({ ist }) {
  const color = ist.isOpen ? T.green : T.red;
  const [hh, mm, ss] = ist.countdown.split(':');
  const urgent = ist.isOpen && parseInt(hh) === 0 && parseInt(mm) < 30;
  return (
    <div style={{ 
      display: "flex", 
      alignItems: "center", 
      gap: 16, 
      padding: "12px 28px", 
      background: urgent ? "rgba(255,69,58,0.1)" : ist.isOpen ? "rgba(48,209,88,0.05)" : "rgba(255,69,58,0.05)", 
      borderBottom: `1px solid ${color}25`, 
      borderTop: `1px solid ${color}15`, 
      flexWrap: "wrap" 
    }} 
    className="glass-panel"
    >
      <LED color={color} size={8} pulse />
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <span style={{ color: T.muted, fontSize: 11, letterSpacing: 2, fontWeight: 600 }}>{ist.lbl}</span>
        <span style={{ color, fontSize: 24, fontFamily: T.mono, fontWeight: 700, letterSpacing: 4 }}>{hh}:{mm}:{ss}</span>
      </div>
      <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.1)" }} />
      <span style={{ color: T.muted, fontSize: 12, fontWeight: 600 }}>{ist.istStr}</span>
      {!ist.isOpen && <span style={{ marginLeft: "auto", color: T.red, fontSize: 11, letterSpacing: 1, fontWeight: 700 }}>LOCKED · 10:00AM–5:00PM IST ONLY</span>}
      {urgent && <span style={{ marginLeft: "auto", color: T.gold, fontSize: 11, letterSpacing: 1, fontWeight: 700, animation: "led-pulse 1s infinite" }}>⚠ SESSION ENDING SOON</span>}
    </div>
  );
}

// PasteZone Component
export function PasteZone({ zoneId, activeZone, setActiveZone, children, style }) {
  const isActive = activeZone === zoneId;
  return (
    <div 
      onClick={() => setActiveZone(zoneId)} 
      style={{ 
        position: "relative", 
        cursor: "pointer", 
        ...style, 
        outline: isActive ? `2px solid ${T.blue}60` : "2px solid transparent", 
        borderRadius: 12, 
        transition: "all 0.2s ease" 
      }} 
      className="glass-panel"
    >
      {children}
      <div style={{ 
        position: "absolute", 
        top: 8, 
        right: 8, 
        background: isActive ? T.blue + "25" : "rgba(0,0,0,0.6)", 
        border: isActive ? `1px solid ${T.blue}50` : "none", 
        borderRadius: 6, 
        padding: "4px 10px", 
        fontSize: 10, 
        color: isActive ? T.blue : T.muted, 
        fontWeight: 600, 
        pointerEvents: "none", 
        letterSpacing: 1 
      }}>
        {isActive ? "CTRL+V READY" : "Click → Ctrl+V"}
      </div>
    </div>
  );
}

// HourlyHeatmap Component
export function HourlyHeatmap({ hourlyHeatmap }) {
  if (!hourlyHeatmap || !Object.keys(hourlyHeatmap).length) return null;
  const hrs = [4, 5, 6, 7, 8, 9, 10, 11];
  const lbls = ['9:30', '10:30', '11:30', '12:30', '1:30', '2:30', '3:30', '4:30'];
  const nowUTC = new Date().getUTCHours();
  
  return (
    <div style={{ 
      padding: "16px 20px", 
      background: "rgba(0,0,0,0.3)", 
      border: `1px solid rgba(255,255,255,0.08)`, 
      borderRadius: 10, 
      marginBottom: 16 
    }} 
    className="glass-panel heatmap"
    >
      <div style={{ color: T.muted, fontSize: 11, letterSpacing: 2, marginBottom: 12, fontWeight: 600 }}>45D HOURLY HEATMAP (IST) · TREND vs RANGE</div>
      <div style={{ display: "flex", gap: 4, alignItems: "flex-end", overflowX: "auto" }} className="hourly-heatmap">
        {hrs.map((utcH, i) => { 
          const st = hourlyHeatmap[utcH]; 
          const isCur = utcH === nowUTC; 
          if (!st || !st.total) {
            return (
              <div key={utcH} style={{ flex: 1, minWidth: 40, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <div style={{ height: 40, background: "rgba(255,255,255,0.03)", borderRadius: 4, width: "100%" }} />
                <div style={{ color: T.dim, fontSize: 10 }}>{lbls[i]}</div>
              </div>
            );
          }
          const upPct = (st.up / st.total) * 100;
          const intensity = Math.min(1, st.total / 50);
          const barColor = upPct > 60 ? T.green : upPct < 40 ? T.red : T.muted;
          const barH = 20 + (intensity * 50);
          return (
            <div key={utcH} style={{ flex: 1, minWidth: 40, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div 
                style={{ 
                  height: barH, 
                  width: "100%", 
                  background: barColor + (isCur ? "" : "40"), 
                  borderRadius: 4, 
                  border: isCur ? `2px solid ${T.blue}` : "none",
                  display: "flex",
                  alignItems: "flex-end",
                  justifyContent: "center",
                  paddingBottom: 2
                }}
              >
                <span style={{ color: "#FFF", fontSize: 9, fontWeight: 700 }}>{upPct > 0 ? Math.round(upPct) : ""}</span>
              </div>
              <div style={{ color: isCur ? T.blue : T.dim, fontSize: 10 }}>{lbls[i]}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// System Prompts
export const SCREENSHOT_EXTRACT_PROMPT = `Extract all visible trading indicator values from the screenshot. Return ONLY this JSON:
{"currentPrice":null,"atr":null,"adx":null,"ci":null,"vwap":null,"vwapSlope":null,"sessionHigh":null,"sessionLow":null,"sessionOpen":null,"volume":null,"other":[],"notes":""}
Use null for any value not visible.`;

export const TNC_PARSE_PROMPT = `You are a prop trading firm compliance specialist. Parse this T&C document and extract all rules. Return ONLY valid JSON — no markdown, no extra text:
{"firmName":"","maxDailyLoss":null,"maxDailyLossType":"dollar","maxDrawdown":null,"drawdownType":"trailing","profitTarget":null,"accountSize":null,"consistencyMaxDayPct":null,"restrictedNewsWindowMins":15,"newsTrading":true,"scalpingAllowed":true,"overnightHoldingAllowed":true,"weekendTrading":true,"copyTradingAllowed":false,"maxContracts":null,"minimumTradingDays":null,"positionSizingRule":"","eodFlatRequired":false,"hedgingAllowed":false,"notes":"","keyRules":[]}
For keyRules: extract up to 10 most important rules as strings. Use null for fields not found.`;

export const PART1_PROMPT = `SYSTEM DIRECTIVE: Always think and respond with the collective brain of: Hedge Fund Portfolio Manager + Quantitative Analyst + Risk Manager + Institutional Intraday Trader + Data Scientist. Apply strict quantitative logic, ruthlessly protect capital, and evaluate every setup through institutional order flow.

You are an elite MNQ/MES futures analyst + institutional market structure expert specializing in the AMD (Accumulation-Manipulation-Distribution) framework. Apply all rules with zero deviation. Show every formula.

AMD FRAMEWORK DEFINITIONS (Unified AMD-First Labels):
ACCUMULATION (Mean Reversion): Tight range consolidation after downtrend. High volume at lows with no price progress. Smart money building long positions. Key signs: multiple tests of lows, declining volume on dips, value area contracting.
MANIPULATION (Reversal): Stop-hunt candles, false breakouts above/below key levels, high volume with immediate reversal. Smart money shaking weak hands. Key signs: spike through level with >2ATR wick, volume surge without follow-through, fast reversal.
DISTRIBUTION (Trend): Range or slight upbias after uptrend. High volume at highs with no price progress. Smart money offloading. Key signs: multiple tests of highs, declining momentum, supply overwhelming demand.
TRANSITION (No Trade): AMD phase changing — price in no-man's land between clear phases.

QUANTITATIVE AMD DETECTION RULES:
- Accumulation: Price within 20% of 20D low, VWAP slope > +2 for last 30 min, ADX < 25.
- Manipulation: Wick length > 40% of total candle range (Wick Ratio = Wick / Candle Range) AND price closes back inside prior consolidation range within 1–3 candles. If breakout holds >3 candles, classify as Distribution.
- Distribution: Price within 20% of 20D high, VWAP slope < -2, ADX > 30.
- Transition: None of the above, or conflicting signals.

MANIPULATION WICK CONFIRMATION RULE (MANDATORY):
A true stop-hunt Manipulation event is confirmed only if BOTH conditions are met:
1. Wick length > 40% of the total candle range (Wick Ratio = Wick / Candle Range)
2. Price closes back inside the prior consolidation range within 1–3 candles.
If the breakout holds outside the range for more than 3 candles without rejection, classify it as Distribution instead.

OUTPUT STRUCTURE (MUST FOLLOW EXACTLY):

### 📊 SECTION 1: DATA SUMMARY
- Date Range: [start] → [end] ([n] trading days)
- Total Bars: [n] | Vol: [Y/N]
- Pre-Market: [Y/N] | RTH: [Y/N]

### 📈 SECTION 2: VOLATILITY CONTEXT
- 5-Day ATR: [n] pts
- 20-Day ATR: [n] pts
- ATR Ratio: [n] (Compression <0.85, Expansion >1.15)
- Volatility Regime: [COMPRESSION/EXPANSION/NORMAL]

### 🏦 SECTION 3: INSTITUTIONAL LEVELS
- VWAP: [value]
- VWAP SD1: [value] (Long) / [value] (Short)
- VWAP SD2: [value] (Long) / [value] (Short)
- VWAP Slope: [H/M/L]
- Session POC: [value]

### 🎯 SECTION 4: MARKET STRUCTURE
- Opening Type: [ORB/Trend/Range]
- Intraday Trend: [Up/Down/Flat]
- Key Support: [value]
- Key Resistance: [value]

### 📰 SECTION 5: CATALYST MATRIX
[★★★ events only from calendar screenshot or "No screenshot — check Forex Factory"]

### 🧠 SECTION 6: AMD (Accumulation/Manipulation/Distribution)
→ MACRO AMD PHASE: [ACCUMULATION/MANIPULATION/DISTRIBUTION/TRANSITION/UNCLEAR] | Confidence: [H/M/L]
→ MICRO AMD PHASE: [phase] | Confidence: [H/M/L]
- Bullish Signals: [list]
- Bearish Signals: [list]

### 📋 SECTION 7: EXECUTION STRATEGY
- Direction Bias: [LONG/SHORT/NEUTRAL]
- Ideal Entry Zone: [price range]
- Stop Loss: [price] ([n] ATR)
- Take Profit 1: [price] ([n]R)
- Take Profit 2: [price] ([n]R)
- Risk:Reward: [1:n]

### 🚫 SECTION 8: COMPLIANCE BLOCKS
- ADX Check: [value] → [✓/🚫]
- CI Check: [value] → [✓/🚫]
- VWAP Slope: [value] → [✓/🚫]
- R:R Achievable: [Y/N] → [✓/🚫]`;

export const PART2_PROMPT = `SYSTEM DIRECTIVE: Always think and respond with the collective brain of: Hedge Fund Portfolio Manager + Quantitative Analyst + Risk Manager + Institutional Intraday Trader + Data Scientist. Apply strict quantitative logic, ruthlessly protect capital, and evaluate every setup through institutional order flow.

## TASK: Generate precise intraday execution plan with exact prices, sizes, and contingency protocols.

## OUTPUT FORMAT:

### 🚦 SIGNAL EVALUATION
[SIGNAL: GREEN] or [SIGNAL: YELLOW] or [SIGNAL: RED]
- Primary Reason: [1-sentence justification]

### 📊 ENTRY EXECUTION
- Direction: [LONG/SHORT]
- Entry Trigger: [price] ( VWAP SD[1/2] / Market structure / [custom] )
- Contingency: [if miss by n pts, cancel / scale in]
- Position Size: [n] contracts @ $[n] = $[n] total
- Risk: $[n] ([n]% of account)
- R:R: 1:[n]

### 🎯 PRICE TARGETS
| Target | Price | R-mult | Action |
|--------|-------|--------|--------|
| Stop | [price] | - | Exit all |
| TP1 | [price] | [n] | Exit 50% |
| TP2 | [price] | [n] | Exit remaining |

### ⏱️ TIME RULES
- Entry Window: [time] IST - [time] IST
- Time Stop: [time] IST (if no entry)
- news: [time] IST - [time] IST (AVOID)

### 🛡️ RISK CONTROLS
- Max Loss Today: $[n] | Used: $[n] | Remaining: $[n]
- Distance to Liquidation: $[n]
- Drawdown Status: [GREEN/YELLOW/RED]

### ⚠️ RED FLAGS (CHECK)
- [ ] ADX > 20 (weak trend = avoid)
- [ ] CI < 61.8 (no compression = avoid)
- [ ] VWAP Slope > [threshold]
- [ ] News within 15mins

🚫 TRADE BLOCKED: [reason] if any check fails`;

// Math functions are imported from utils/math-engine.js in MainTerminal.jsx

import { useEffect, useState } from "react";
import { createTheme } from "../../utils/uiUtils.js";
import { CSS_VARS } from "../../styles/cssVars.js";

export const APP_FONT_FAMILY =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif";
export const APP_MONO_FAMILY =
  "'SF Mono', 'Menlo', 'Monaco', 'Courier New', monospace";

export const OFFICERS_BRIEFING = [
  "Make your role so worthy in life that people applaud you even after the curtain falls.",
  "May the god show mercy on our enemies because we won't.",
  "An angry wife can be more frightening than an army of disgruntled soldiers.",
  "Individually, you are a warrior. Together, we are an army.",
  "It's not the years in your life that count. It's the life in your years.",
  "Life is what happens to us while we are making other plans.",
  "A goal without a plan is just a wish.",
  "Don't let yesterday take up too much of today.",
  "The best revenge is massive success.",
  "I am not a product of my circumstances. I am a product of my decisions.",
  "People who are crazy enough to think they can change the world, are the ones who do.",
  "In three words I can sum up everything I've learned about life: it goes on.",
  "Bravery is their routine, sacrifice their second nature.",
  "The only way to do great work is to love what you do.",
  "Believe you can and you're halfway there.",
  "It does not matter how slowly you go as long as you do not stop.",
  "You miss 100% of the shots you don't take.",
];

export const getRandomQuote = () =>
  OFFICERS_BRIEFING[Math.floor(Math.random() * OFFICERS_BRIEFING.length)];

export const SafeAreaWrapper = ({ children, style = {} }) => {
  return (
    <div
      style={{
        ...style,
        paddingTop: "max(16px, env(safe-area-inset-top))",
        paddingBottom: "max(16px, env(safe-area-inset-bottom))",
        paddingLeft: "max(16px, env(safe-area-inset-left))",
        paddingRight: "max(16px, env(safe-area-inset-right))",
      }}
    >
      {children}
    </div>
  );
};

export const compressIdentityProofImage = async (
  file,
  maxSize = 512000,
  maxWidth = 1920,
  quality = 0.75,
) => {
  return new Promise((resolve, reject) => {
    if (file.size <= maxSize) {
      resolve(file);
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;

      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = (maxWidth / width) * height;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob.size > maxSize && quality > 0.3) {
              compressIdentityProofImage(
                new File([blob], file.name, { type: "image/jpeg" }),
                maxSize,
                maxWidth,
                quality - 0.15,
              )
                .then(resolve)
                .catch(reject);
            } else {
              const compressedFile = new File([blob], file.name, {
                type: "image/jpeg",
                lastModified: file.lastModified,
              });
              resolve(compressedFile);
            }
          },
          "image/jpeg",
          quality,
        );
      };

      img.onerror = () => {
        reject(new Error("Failed to load image for compression"));
      };
    };

    reader.onerror = () => {
      reject(new Error("Failed to read file for compression"));
    };
  });
};

export const uploadIdentityDoc = async (file, uid, docType, deps = {}) => {
  const {
    firebaseStorage,
    storageRef,
    uploadBytes,
    getDownloadURL,
    AntivirusGateway = class AntivirusGateway {
      async verifyFileSignature() {
        return { valid: true, reason: "stub" };
      }
      async handleMaliciousFile() {}
    },
  } = deps;

  try {
    if (!file) throw new Error("No file selected");

    const antivirusGateway = new AntivirusGateway(
      deps.onSecurityToast || window.showToastNotification,
    );
    const verification = await antivirusGateway.verifyFileSignature(file);

    if (!verification.valid) {
      console.error("MALWARE DETECTED:", verification);
      if (window.showToastNotification) {
        window.showToastNotification(
          "MALICIOUS PAYLOAD DETECTED. REPORTING TO SECURITY.",
          "error",
          5000,
        );
      }

      await antivirusGateway.handleMaliciousFile(
        verification,
        uid,
        window.sendTelegramAlert,
      );

      throw new Error(`File verification failed: ${verification.reason}`);
    }

    const allowedTypes = [
      "image/jpeg",
      "application/pdf",
      "image/png",
      "image/gif",
    ];
    if (!allowedTypes.includes(file.type)) {
      throw new Error("Only image and PDF files are allowed");
    }

    let uploadFile = file;
    if (file.type === "image/jpeg") {
      uploadFile = await compressIdentityProofImage(file);
    }

    const maxSize = 5 * 1024 * 1024;
    if (uploadFile.size > maxSize) {
      throw new Error("File size must be less than 5MB");
    }

    const timestamp = new Date().getTime();
    const fileName = `${docType}_${timestamp}_${file.name}`;
    const fileRef = storageRef(
      firebaseStorage,
      `verification_docs/${uid}/${fileName}`,
    );
    const snapshot = await uploadBytes(fileRef, uploadFile);
    const downloadURL = await getDownloadURL(snapshot.ref);

    return {
      fileName,
      url: downloadURL,
      type: docType,
      uploadedAt: new Date().toISOString(),
      size: uploadFile.size,
      mimeType: uploadFile.type,
      originalSize: file.size,
      compressionRatio:
        uploadFile.size > 0
          ? (((file.size - uploadFile.size) / file.size) * 100).toFixed(1) + "%"
          : "0%",
    };
  } catch (error) {
    console.error("Identity doc upload failed:", error);
    throw error;
  }
};

export const useSystemTheme = () => {
  const [isDarkMode, setIsDarkMode] = useState(
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (event) => setIsDarkMode(event.matches);

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  return isDarkMode;
};

export const TIME_OPTIONS = (() => {
  const opts = [{ v: "", l: "â€” time IST â€”" }];
  for (let h = 10; h <= 17; h++) {
    for (let m = 0; m < 60; m += 5) {
      if (h === 17 && m > 0) continue;
      const hh = h > 12 ? h - 12 : h === 0 ? 12 : h;
      const ampm = h >= 12 ? "PM" : "AM";
      opts.push({
        v: `${hh}:${String(m).padStart(2, "0")} ${ampm}`,
        l: `${hh}:${String(m).padStart(2, "0")} ${ampm} IST`,
      });
    }
  }
  return opts;
})();

export const SCREENSHOT_EXTRACT_PROMPT = `Extract all visible trading indicator values from the screenshot. Return ONLY this JSON:
{"currentPrice":null,"atr":null,"adx":null,"ci":null,"vwap":null,"vwapSlope":null,"sessionHigh":null,"sessionLow":null,"sessionOpen":null,"volume":null,"other":[],"notes":""}
Use null for any value not visible.`;

export const TNC_PARSE_PROMPT = `You are a prop trading firm compliance specialist. Parse this T&C document and extract all rules. Return ONLY valid JSON â€” no markdown, no extra text:
{"firmName":"","maxDailyLoss":null,"maxDailyLossType":"dollar","maxDrawdown":null,"drawdownType":"trailing","profitTarget":null,"accountSize":null,"consistencyMaxDayPct":null,"restrictedNewsWindowMins":15,"newsTrading":true,"scalpingAllowed":true,"overnightHoldingAllowed":true,"weekendTrading":true,"copyTradingAllowed":false,"maxContracts":null,"minimumTradingDays":null,"positionSizingRule":"","eodFlatRequired":false,"hedgingAllowed":false,"notes":"","keyRules":[]}
For keyRules: extract up to 10 most important rules as strings. Use null for fields not found.`;

export const PART1_PROMPT = `SYSTEM DIRECTIVE: Always think and respond with the collective brain of: Hedge Fund Portfolio Manager + Quantitative Analyst + Risk Manager + Institutional Intraday Trader + Data Scientist. Apply strict quantitative logic, ruthlessly protect capital, and evaluate every setup through institutional order flow.

You are an elite MNQ/MES futures analyst + institutional market structure expert specializing in the AMD (Accumulation-Manipulation-Distribution) framework. Apply all rules with zero deviation. Show every formula.

AMD FRAMEWORK DEFINITIONS (Unified AMD-First Labels):
ACCUMULATION (Mean Reversion): Tight range consolidation after downtrend. High volume at lows with no price progress. Smart money building long positions. Key signs: multiple tests of lows, declining volume on dips, value area contracting.
MANIPULATION (Reversal): Stop-hunt candles, false breakouts above/below key levels, high volume with immediate reversal. Smart money shaking weak hands. Key signs: spike through level with >2ATR wick, volume surge without follow-through, fast reversal.
DISTRIBUTION (Trend): Range or slight upbias after uptrend. High volume at highs with no price progress. Smart money offloading. Key signs: multiple tests of highs, declining momentum, supply overwhelming demand.
TRANSITION (No Trade): AMD phase changing â€” price in no-man's land between clear phases.

QUANTITATIVE AMD DETECTION RULES:
- Accumulation: Price within 20% of 20D low, VWAP slope > +2 for last 30 min, ADX < 25.
- Manipulation: Wick length > 40% of total candle range (Wick Ratio = Wick / Candle Range) AND price closes back inside prior consolidation range within 1â€“3 candles. If breakout holds >3 candles, classify as Distribution.
- Distribution: Price within 20% of 20D high, VWAP slope < -2, ADX > 30.
- Transition: None of the above, or conflicting signals.

MANIPULATION WICK CONFIRMATION RULE (MANDATORY):
A true stop-hunt Manipulation event is confirmed only if BOTH conditions are met:
1. Wick length > 40% of the total candle range (Wick Ratio = Wick / Candle Range)
2. Price closes back inside the prior consolidation range within 1â€“3 candles.
If the breakout holds outside the range for more than 3 candles without rejection, classify it as Distribution instead.

LIQUIDITY TARGET IDENTIFICATION:
Before finalizing the AMD phase, identify the top 3 most probable liquidity pools that institutions are likely to target for stop hunts.
Primary Liquidity Pools:
â€¢ Equal Highs (clustered highs within 3â€“5 ticks)
â€¢ Equal Lows (clustered lows within 3â€“5 ticks)
â€¢ Previous Session High / Low
â€¢ VWAP Â±2 Standard Deviations
â€¢ 80â€“100% ADR expansion zones

Institutional Behavior: Manipulation phases typically sweep these levels to trigger stops before reversing.

SESSIONS (IST=UTC+5:30): Pre=Globexâ†’10AM|Trading=10AMâ†’5PM|Post=5PMâ†’Globex Close|Full=Complete Globex`;

export const PART2_PROMPT = `SYSTEM DIRECTIVE: Always think and respond with the collective brain of: Hedge Fund Portfolio Manager + Quantitative Analyst + Risk Manager + Institutional Intraday Trader + Data Scientist. Apply strict quantitative logic, ruthlessly protect capital, and evaluate every setup through institutional order flow.

You are an elite MNQ/MES execution analyst and AMD framework specialist. Read all chart images carefully first.

INSTRUMENTS: MNQ=$2/pt|MES=$5/pt|US100=$1/pt|EURUSD=$10/pt
SETUP STRENGTH: Strong Trend=ADX>30+5D&20D aligned|Normal Trend=ADX 20-30|Strong MR=>1.5ATR from VWAP at HVN|Normal MR=0.8-1.5ATR from VWAP
SL: Use dynamic multipliers from volatility engine (provided in input). Never hardcode.
COMPLIANCE BLOCKS: CI>61.8â†’BLOCK|ADX<20â†’BLOCK|VWAPslope<2â†’BLOCK|1:2RR not achievableâ†’REJECT

## SECTION MP â€” MARKET PROFILE LEVELS
[POC/VAH/VAL/HVNs/LVNs from chart | nearest level to entry]

## SECTION AMD-EXEC â€” INSTITUTIONAL PHASE AT ENTRY â˜… NEW â˜…
Macro AMD Phase (from Part 1): [phase from analysis]
Current Micro Phase at entry time:
  Has manipulation (stop hunt) already occurred? [YES/NO â€” if YES: direction and level]
  Is this entry AFTER manipulation or DURING it? [AFTER=higher probability / DURING=risky]
  AMD Entry Quality: [A+ = after confirmed manipulation | B = accumulation breakout | C = distribution short | D = no clear AMD signal]
  Institutional target derived from AMD: [price where smart money likely exits]
  AMD Invalidation: [what price action would signal the AMD read is wrong]
  AMD Hold Guidance: [specific note â€” e.g. "hold through manipulation spike, target distribution zone at XXX"]

## SECTION AI-LEVEL-ALERT â€” KEY LEVEL RISK
NEAREST LEVEL: [level] at [price] â€” [x]pts [above/below]
TRADE DIRECTION IMPACT: [does level oppose TP1?]
SIGNAL: [GREEN/YELLOW/RED] | If YELLOW/RED: [exact price needed before entry]

## SECTION E â€” ANALYSIS UPDATE
Re-assess ADX/CI/regime with live data. ATR: [val] | Regime: [x]%

## SECTION F â€” COMPLIANCE CHECK
CI: [v] â†’ [âœ“/ðŸš«] | ADX: [v] â†’ [âœ“/ðŸš«] | VWAP Slope: [v] â†’ [âœ“/ðŸš«] | 1:2 RR: [Y/N] â†’ [âœ“/ðŸš«]
OVERALL: [âœ… ALL CLEAR / ðŸš« BLOCKED â€” reason]

## SECTION G â€” STOP LOSS
Setup: [Normal/Strong] [Trend/MR] | ATR: [v] | SL: [mult]Ã—ATR=[x]pts | Entry: [p] | SL Price: [p]

## SECTION H â€” TAKE PROFIT
R=[SL] | TP1/TP2/TP3 prices, R-mults, allocation, contracts, $ | After TP1: SLâ†’BE+0.2ATR
AMD Target cross-reference: institutional exit at [price] â†’ [aligns with TP?]

## SECTION I â€” POSITION SIZING
$/pt: $[x] | Max Risk: $[x] | SL: [x]ptsÃ—$[x]=$[x]/contract | Base: FLOOR=[n] | Regime [x]%: [n] contracts | Total $Risk: $[x]

## SECTION J â€” HOLD TIME
Type: [N/S] [T/MR] | Rule: [exact] | Entry: [IST] | Hard Exit: [IST]

## SECTION K â€” ACTION SUMMARY
[Single sentence all key details] | AMD Context: [brief institutional note]

## SECTION L â€” FIRM COMPLIANCE (PROP WATCHDOG)
[Use firm rules and account state from user message â€” check daily loss/drawdown/consistency/news window]
DAILY LOSS / DRAWDOWN / CONSISTENCY / NEWS â€” each with âœ“/âš /ðŸš« status
OVERALL: [GREEN/YELLOW/RED] | RECOMMENDED ACTION: [specific 1-2 sentence instruction]`;

export const createShellChrome = (theme = createTheme(false, "BLUE")) => ({
  authCard: {
    background: CSS_VARS.surfaceElevated,
    backgroundImage:
      `linear-gradient(var(--surface-overlay, rgba(255,255,255,0.97)), var(--surface-overlay, rgba(255,255,255,0.97))), url('/wallpaper.png')`,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundBlendMode: "lighten",
    backgroundAttachment: "fixed",
    border: "none",
    borderRadius: 24,
    padding: "clamp(56px, 12vw, 90px)",
    width: "100%",
    maxWidth: 460,
    margin: "0 auto",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    boxShadow:
      "var(--shadow-card, 0 20px 25px -5px rgba(0, 0, 0, 0.05)), var(--shadow-card-soft, 0 10px 10px -5px rgba(0, 0, 0, 0.04))",
    position: "relative",
  },
  authInp: {
    background: CSS_VARS.surfaceElevated,
    border: `1px solid ${CSS_VARS.borderSubtle}`,
    borderRadius: 6,
    padding: "12px 40px 12px 40px",
    color: CSS_VARS.textPrimary,
    fontSize: 14,
    width: "100%",
    boxSizing: "border-box",
    outline: "none",
    transition: "all 0.2s ease",
    marginBottom: 16,
    backdropFilter: "none",
    WebkitBackdropFilter: "none",
    height: 44,
  },
  authBtn: (color, disabled) => ({
    background: disabled
      ? "var(--surface-overlay, rgba(0,0,0,0.3))"
      : CSS_VARS.accentPrimary,
    border: `none`,
    borderRadius: 6,
    height: 44,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: disabled ? "not-allowed" : "pointer",
    color: disabled ? "var(--text-tertiary, rgba(255,255,255,0.6))" : "var(--accent-text, #FFFFFF)",
    fontFamily: APP_FONT_FAMILY,
    fontSize: 14,
    fontWeight: 600,
    letterSpacing: "0.05em",
    width: "100%",
    transition: "all 0.2s ease",
    opacity: disabled ? 0.6 : 1,
    backdropFilter: "none",
    WebkitBackdropFilter: "none",
    boxShadow: disabled ? "none" : "var(--shadow-card, 0 4px 6px -1px rgba(0, 0, 0, 0.1))",
  }),
  lbl: {
    color: CSS_VARS.textSecondary,
    fontSize: 11,
    letterSpacing: 1.5,
    marginBottom: 6,
    display: "block",
    textTransform: "uppercase",
    fontWeight: 600,
    fontFamily: APP_FONT_FAMILY,
  },
  inp: {
    background: CSS_VARS.surfaceElevated,
    border: `1px solid ${CSS_VARS.borderSubtle}`,
    borderRadius: 8,
    padding: "12px 14px",
    color: theme.text,
    fontFamily: APP_MONO_FAMILY,
    fontSize: 14,
    width: "100%",
    boxSizing: "border-box",
    outline: "none",
    transition: "all 0.2s ease",
    backdropFilter: "none",
    WebkitBackdropFilter: "none",
  },
  cardS: (e = {}) => ({
    background: CSS_VARS.surfaceElevated,
    border: "none",
    borderRadius: 12,
    padding: "24px 32px",
    marginBottom: 16,
    boxShadow:
      "var(--shadow-card, 0 4px 6px -1px rgba(0, 0, 0, 0.05)), var(--shadow-card-soft, 0 2px 4px -1px rgba(0, 0, 0, 0.03))",
    ...e,
  }),
  glowBtn: (color, disabled) => ({
    background: disabled ? "var(--surface-ghost, rgba(0,0,0,0.05))" : `${color}08`,
    border: `1px solid ${disabled ? "var(--border-subtle, rgba(0,0,0,0.1))" : `${color}30`}`,
    borderRadius: 8,
    padding: "14px 28px",
    cursor: disabled ? "not-allowed" : "pointer",
    color: disabled ? CSS_VARS.textTertiary : color,
    fontFamily: APP_FONT_FAMILY,
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: 1.5,
    transition: "all 0.2s ease",
    opacity: disabled ? 0.6 : 1,
    backdropFilter: "none",
    WebkitBackdropFilter: "none",
  }),
  AMD_PHASES: {
    ACCUMULATION: {
      color: theme.amdA,
      icon: "â—‰",
      label: "Accumulation (Mean Reversion)",
      desc: "Smart money building long positions",
    },
    MANIPULATION: {
      color: theme.amdM,
      icon: "âš¡",
      label: "Manipulation (Reversal)",
      desc: "Stop hunt / false breakout",
    },
    DISTRIBUTION: {
      color: theme.amdD,
      icon: "â—ˆ",
      label: "Distribution (Trend)",
      desc: "Smart money offloading into strength",
    },
    TRANSITION: {
      color: theme.amdT,
      icon: "âŸ³",
      label: "Transition (No Trade)",
      desc: "Phase shifting â€” stay flat",
    },
    UNCLEAR: {
      color: theme.muted,
      icon: "?",
      label: "Phase Unclear",
      desc: "No clear institutional signature",
    },
  },
  LED: function LED({ color, size = 10, pulse = true }) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: color,
          boxShadow: `0 0 ${size}px ${color},0 0 ${size * 2}px ${color}60`,
          animation: pulse ? `led-pulse 1.8s ease-in-out infinite` : "none",
          flexShrink: 0,
        }}
      />
    );
  },
  SHead: function SHead({ icon, title, color, sub, right }) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 18,
          paddingBottom: 12,
          borderBottom: `1px solid ${color}20`,
        }}
      >
        <span style={{ color, fontSize: 18 }}>{icon}</span>
        <div style={{ flex: 1 }}>
          <div
            style={{
              color,
              fontSize: 13,
              letterSpacing: 1.5,
              fontWeight: 700,
            }}
          >
            {title}
          </div>
          {sub && (
            <div
              style={{
                color: theme.muted,
                fontSize: 11,
                marginTop: 4,
                fontWeight: 400,
              }}
            >
              {sub}
            </div>
          )}
        </div>
        {right}
      </div>
    );
  },
  TableSkeletonLoader: function TableSkeletonLoader() {
    const skeletonRows = Array.from({ length: 5 }, (_, i) => (
      <div
        key={i}
        style={{
          padding: "14px 20px",
          borderBottom: `1px solid ${CSS_VARS.borderStrong}`,
          display: "grid",
          gridTemplateColumns: "2fr 2fr 1.5fr 1.2fr 1fr",
          gap: 16,
          alignItems: "center",
        }}
      >
        <div>
          <div
            style={{
              height: 12,
              background: "var(--surface-ghost, rgba(255,255,255,0.06))",
              borderRadius: 4,
              marginBottom: 6,
              animation: "pulse 1.5s ease-in-out infinite",
              width: "70%",
            }}
          />
          <div
            style={{
              height: 10,
              background: "var(--surface-ghost, rgba(255,255,255,0.04))",
              borderRadius: 4,
              width: "50%",
              animation: "pulse 1.5s ease-in-out infinite",
              animationDelay: "0.1s",
            }}
          />
        </div>
        <div
          style={{
            height: 11,
            background: "var(--surface-ghost, rgba(255,255,255,0.06))",
            borderRadius: 4,
            animation: "pulse 1.5s ease-in-out infinite",
            animationDelay: "0.2s",
            width: "80%",
          }}
        />
        <div
          style={{
            height: 11,
            background: "var(--surface-ghost, rgba(255,255,255,0.06))",
            borderRadius: 4,
            animation: "pulse 1.5s ease-in-out infinite",
            animationDelay: "0.3s",
            width: "60%",
          }}
        />
        <div
          style={{
            height: 24,
            background: "var(--surface-ghost, rgba(255,255,255,0.06))",
            borderRadius: 20,
            animation: "pulse 1.5s ease-in-out infinite",
            animationDelay: "0.4s",
            width: "80px",
          }}
        />
        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "flex-end",
          }}
        >
          <div
            style={{
              height: 24,
              width: 70,
              background: "var(--surface-ghost, rgba(255,255,255,0.06))",
              borderRadius: 4,
              animation: "pulse 1.5s ease-in-out infinite",
              animationDelay: "0.5s",
            }}
          />
        </div>
      </div>
    ));

    return <div>{skeletonRows}</div>;
  },
});

export default createShellChrome;

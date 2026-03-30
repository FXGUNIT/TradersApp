import React from "react";
import { CSS_VARS } from "../../styles/cssVars.js";
import {
  AMDPhaseTag,
  LED,
  T,
  Tag,
  TrafficLight,
} from "./terminalHelperComponents";

export default function TerminalTradeReadinessPanel({
  complianceColor,
  curBal,
  dailyLossUsed,
  displayedAmdPhase,
  extractedVals,
  hasFirmRules = false,
  isDDBreached = false,
  isDDWarning = false,
  isDailyBreached = false,
  isDailyWarning = false,
  liqLevel = 0,
  liveAmdContext,
  liveAmdPhase,
  marketOpen = false,
  maxDD = 0,
  maxDL = 0,
  sd1Target = null,
  sd2Target = null,
  sweepEstimate = null,
  throttleActive = false,
  trafficState = "none",
  volatilityRegime = "Balanced",
  vr = 0,
}) {
  return (
    <>
      <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 280 }}>
          <AMDPhaseTag phase={displayedAmdPhase} />
        </div>
        <div style={{ flex: 2, minWidth: 280 }}>
          <TrafficLight state={trafficState} />
        </div>
      </div>

      {hasFirmRules && (
        <div
          style={{
            display: "flex",
            gap: 16,
            padding: "14px 20px",
            background: CSS_VARS.card,
            border: `1px solid ${complianceColor}40`,
            borderRadius: 10,
            marginBottom: 16,
            flexWrap: "wrap",
            boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)",
          }}
          className="glass-panel"
        >
          <LED color={complianceColor} size={10} />
          <span style={{ color: complianceColor, fontSize: 11, letterSpacing: 1, fontWeight: 700 }}>
            WATCHDOG:
          </span>
          {maxDL > 0 && (
            <span
              style={{
                color: isDailyBreached ? T.red : isDailyWarning ? T.gold : T.green,
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              Daily ${dailyLossUsed.toFixed(0)}/{maxDL}
            </span>
          )}
          {maxDD > 0 && curBal > 0 && (
            <span
              style={{
                color: isDDBreached ? T.red : isDDWarning ? T.gold : T.green,
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              LiqDist ${(curBal - liqLevel).toFixed(0)}
            </span>
          )}
          <span style={{ color: marketOpen ? T.green : T.red, fontSize: 11, fontWeight: 600 }}>
            {marketOpen ? "MARKET OPEN" : "MARKET CLOSED"}
          </span>
          {throttleActive && (
            <span style={{ color: T.gold, fontSize: 11, fontWeight: 700 }}>
              DRAWDOWN THROTTLE
            </span>
          )}
        </div>
      )}

      {(extractedVals.adx !== null || extractedVals.ci !== null || sd1Target) && (
        <div
          style={{
            display: "flex",
            gap: 16,
            padding: "12px 20px",
            background: "rgba(0,0,0,0.5)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 8,
            marginBottom: 16,
            flexWrap: "wrap",
          }}
          className="glass-panel"
        >
          <span style={{ color: T.dim, fontSize: 10, letterSpacing: 1, fontWeight: 700 }}>
            LIVE:
          </span>
          {extractedVals.adx !== null && (
            <span
              style={{
                color: extractedVals.adx < 20 ? T.red : T.green,
                fontSize: 12,
                fontWeight: 700,
                fontFamily: T.mono,
              }}
            >
              ADX {extractedVals.adx}
            </span>
          )}
          {extractedVals.ci !== null && (
            <span
              style={{
                color: extractedVals.ci > 61.8 ? T.red : T.green,
                fontSize: 12,
                fontWeight: 700,
                fontFamily: T.mono,
              }}
            >
              CI {extractedVals.ci}
            </span>
          )}
          {extractedVals.vwap !== null && (
            <span style={{ color: T.blue, fontSize: 12, fontWeight: 700, fontFamily: T.mono }}>
              VWAP {extractedVals.vwap}
            </span>
          )}
          {sd1Target && (
            <span style={{ color: T.cyan, fontSize: 12, fontWeight: 700, fontFamily: T.mono }}>
              SD1 {sd1Target.toFixed(2)}
            </span>
          )}
          {sd2Target && (
            <span style={{ color: T.purple, fontSize: 12, fontWeight: 700, fontFamily: T.mono }}>
              SD2 {sd2Target.toFixed(2)}
            </span>
          )}
        </div>
      )}

      <div
        style={{
          padding: "12px 20px",
          background: "rgba(0,0,0,0.5)",
          border: `1px solid ${T.blue}40`,
          borderRadius: 8,
          marginBottom: 20,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
        className="glass-panel"
      >
        <span style={{ color: T.dim, fontSize: 10, letterSpacing: 1, fontWeight: 700 }}>
          VOLATILITY REGIME:
        </span>
        <span
          style={{
            color:
              volatilityRegime === "Compression"
                ? T.red
                : volatilityRegime === "Expansion"
                  ? T.green
                  : T.blue,
            fontSize: 14,
            fontWeight: 800,
          }}
        >
          {volatilityRegime}
        </span>
        <span style={{ color: T.muted, fontSize: 12, fontFamily: T.mono, fontWeight: 600 }}>
          (VR = {vr.toFixed(2)})
        </span>
      </div>

      {(liveAmdContext.range > 0 || liveAmdContext.relevantWick > 0) && (
        <div
          style={{
            padding: "12px 20px",
            background: "rgba(191,90,242,0.08)",
            border: "1px solid rgba(191,90,242,0.22)",
            borderRadius: 8,
            marginBottom: 20,
          }}
          className="glass-panel"
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ color: T.purple, fontSize: 10, letterSpacing: 1.2, fontWeight: 800 }}>
              LIVE AMD SIGNAL
            </span>
            <Tag label={liveAmdPhase} color={T.purple} />
            <Tag label={`Range ${liveAmdContext.range.toFixed(2)}`} color={T.blue} />
            <Tag
              label={`Wick ${liveAmdContext.relevantWick.toFixed(2)}`}
              color={liveAmdContext.wickValidation.manipulated ? T.gold : T.muted}
            />
            <Tag
              label={
                liveAmdContext.wickValidation.manipulated
                  ? "Manipulation wick"
                  : "No wick manipulation"
              }
              color={liveAmdContext.wickValidation.manipulated ? T.gold : T.green}
            />
          </div>
          <div style={{ color: T.muted, fontSize: 12, marginTop: 6, lineHeight: 1.5 }}>
            {liveAmdContext.volumeNearLows
              ? "Close is holding near the session lows."
              : "Price is not sitting near the session lows."}{" "}
            {liveAmdContext.higherHighs
              ? "Higher highs are still forming."
              : liveAmdContext.lowerLows
                ? "Lower lows are still forming."
                : "Trend structure is mixed."}
          </div>
        </div>
      )}

      {sweepEstimate && (
        <div
          style={{
            padding: "12px 20px",
            background: "rgba(14,165,233,0.08)",
            border: "1px solid rgba(14,165,233,0.25)",
            borderRadius: 8,
            marginBottom: 20,
          }}
          className="glass-panel"
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ color: T.blue, fontSize: 10, letterSpacing: 1.2, fontWeight: 800 }}>
              LIQUIDITY SWEEP WATCH
            </span>
            <Tag
              label={`${sweepEstimate.levelName} ${sweepEstimate.levelValue.toFixed(2)}`}
              color={T.cyan}
            />
            <span
              style={{
                color:
                  sweepEstimate.probability > 0.7
                    ? T.red
                    : sweepEstimate.probability > 0.45
                      ? T.gold
                      : T.green,
                fontSize: 13,
                fontWeight: 800,
              }}
            >
              {(sweepEstimate.probability * 100).toFixed(0)}%
            </span>
          </div>
          <div style={{ color: T.muted, fontSize: 12, marginTop: 6, lineHeight: 1.5 }}>
            {sweepEstimate.alert}. {sweepEstimate.recommendedAction}.
          </div>
        </div>
      )}
    </>
  );
}

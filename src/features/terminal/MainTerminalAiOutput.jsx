import React from "react";
import {
  T,
  Tag,
  Loader,
  RenderOut,
  AMDPhaseTag,
  glowBtn,
} from "./terminalHelperComponents";
import { CSS_VARS } from "../../styles/cssVars.js";

/**
 * MainTerminalAiOutput — P1 premarket analysis output display + "Go to Trade Entry" CTA.
 * Extracted from MainTerminalAiPanels to satisfy the ≤300-line component limit.
 *
 * Props:
 *   err                 — string  (error message to show inline above button)
 *   setErr              — (msg: string) => void
 *   loading             — boolean (analysis running)
 *   p1Out               — string  (analysis result text)
 *   displayedAmdPhase   — string  (AMD phase tag)
 *   runPart1            — () => Promise<void>  (triggers P1 analysis)
 *   setActiveTab        — (tab: string) => void
 *   parsed              — object | null  (CSV parsed data — used to disable button)
 *   isCsvParsing        — boolean
 */
export default function MainTerminalAiOutput({
  err,
  setErr,
  loading,
  p1Out,
  displayedAmdPhase,
  runPart1,
  setActiveTab,
  parsed,
  isCsvParsing,
}) {
  return (
    <>
      {/* Error display */}
      {err && (
        <div
          style={{
            color: T.red,
            fontSize: 12,
            marginBottom: 12,
            fontWeight: 600,
          }}
        >
          &#x26A0; {err}
        </div>
      )}

      {/* Run P1 Analysis button */}
      <button
        onClick={runPart1}
        disabled={loading || isCsvParsing || !parsed || parsed.totalDays < 5}
        style={glowBtn(T.green, loading || isCsvParsing || !parsed || parsed.totalDays < 5)}
        className="btn-glass"
      >
        &#x25B6; RUN AMD PREMARKET ANALYSIS
      </button>

      {/* P1 Output */}
      <div style={{ marginTop: 20 }}>
        {loading && (
          <Loader color={T.green} label="COLLECTIVE BRAIN PROCESSING AMD PHASES..." />
        )}
        {!loading && p1Out && (
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <Tag label="ANALYSIS COMPLETE" color={T.green} />
                <AMDPhaseTag phase={displayedAmdPhase} />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => {
                    setActiveTab("trade");
                    setErr("");
                  }}
                  style={glowBtn(T.orange, false)}
                  className="btn-glass"
                >
                  &#x2192; TRADE ENTRY
                </button>
                <button
                  onClick={() => navigator.clipboard?.writeText(p1Out)}
                  style={{
                    background: "transparent",
                    border: `1px solid ${CSS_VARS.borderSubtle}`,
                    borderRadius: 6,
                    padding: "8px 12px",
                    cursor: "pointer",
                    color: CSS_VARS.textSecondary,
                    fontSize: 10,
                    fontFamily: T.font,
                  }}
                >
                  &#x2398; COPY
                </button>
              </div>
            </div>
            <div
              style={{
                borderLeft: `4px solid ${T.blue}`,
                background: CSS_VARS.card,
                borderRadius: 8,
                padding: "16px",
                boxShadow: "0 1px 3px 0 rgba(15,23,42,0.1)",
              }}
              className="glass-panel"
            >
              <RenderOut text={p1Out} />
            </div>
          </div>
        )}
      </div>
    </>
  );
}

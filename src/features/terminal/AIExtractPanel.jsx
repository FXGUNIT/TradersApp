/**
 * AIExtractPanel — extracted from TradeTab.jsx for file size compliance.
 * OCR and AI Extract buttons with status display.
 */
import React from "react";
import { T, glowBtn } from "./terminalHelperComponents";
import { CSS_VARS } from "../../styles/cssVars.js";

export default function AIExtractPanel({
  isOcrBusy,
  ocrStatus,
  runOcr,
  screenshots,
  extracting,
  extractStatus,
  extractFromScreenshots,
}) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 12,
        margin: "16px 0",
        padding: "12px 20px",
        background: CSS_VARS.card,
        border: `1px solid ${CSS_VARS.borderSubtle}`,
        borderRadius: 8,
        boxShadow: `0 1px 3px 0 ${CSS_VARS.borderSubtle}`,
      }}
      className="glass-panel"
    >
      {/* ① Native OCR — local, no API call */}
      <button
        onClick={runOcr}
        disabled={isOcrBusy || screenshots.length === 0}
        style={glowBtn(T.green, isOcrBusy || screenshots.length === 0)}
        className="btn-glass"
      >
        {isOcrBusy ? `⟳ ${ocrStatus}` : `① ${ocrStatus}`}
      </button>

      {/* ② AI Extract — cloud-powered, broader understanding */}
      <button
        onClick={extractFromScreenshots}
        disabled={extracting || screenshots.length === 0}
        style={glowBtn(T.purple, extracting || !screenshots.length)}
        className="btn-glass"
      >
        {extracting ? "⟳ READING..." : "② EXTRACT INDICATORS"}
      </button>

      <span style={{ color: T.muted, fontSize: 10, flex: 1, fontWeight: 500 }}>
        {extractStatus || "① local OCR (no login) · ② AI extract (needs model)"}
      </span>
    </div>
  );
}

import React from "react";
import { T, GlassSkeletonLoader, cardS, SHead } from "./terminalHelperComponents";
import { CSS_VARS } from "../../styles/cssVars.js";
import { FileSpreadsheet } from "lucide-react";

/**
 * MainTerminalCsvZone — Premarket CSV drop zone UI.
 *
 * Props:
 *   parsed          — CSV parse result object
 *   isCsvParsing    — boolean, true while parsing
 *   csvBorderColor  — CSS color string for drop border
 *   csvStatusColor  — CSS color string for status text
 *   csvStatusText   — string, status message to display
 *   csvProgress     — number 0-100 for skeleton loader
 *   handleCsvDrop   — (e: DragEvent | ChangeEvent) => void
 */
export default function MainTerminalCsvZone({
  parsed,
  isCsvParsing,
  csvBorderColor,
  csvStatusColor,
  csvStatusText,
  csvProgress,
  handleCsvDrop,
}) {
  const surfaceMuted = CSS_VARS.baseLayer;

  return (
    <div style={cardS()}>
      <SHead icon={FileSpreadsheet} title="LOAD NINJATRADER 1-MIN DATA" color={T.blue} />

      {/* ── Glass Skeleton during parsing ── */}
      {isCsvParsing ? (
        <div
          style={{
            border: `2px dashed ${T.blue}50`,
            borderRadius: 8,
            padding: "8px",
            background: surfaceMuted,
          }}
          className="glass-panel"
        >
          <GlassSkeletonLoader
            progress={csvProgress}
            color={T.blue}
            label="Parsing NinjaTrader data"
            title="NINJATRADER 1-MIN DATA"
          />
        </div>
      ) : (
        /* ── Normal drop zone ── */
        <div
          onDrop={handleCsvDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => document.getElementById("csvIn").click()}
          style={{
            border: `2px dashed ${csvBorderColor}`,
            borderRadius: 8,
            padding: "24px",
            textAlign: "center",
            cursor: "pointer",
            background: surfaceMuted,
          }}
        >
          <input
            id="csvIn"
            type="file"
            accept=".txt,.csv"
            style={{ display: "none" }}
            onChange={handleCsvDrop}
          />
          <div style={{ fontSize: 24, marginBottom: 6, opacity: 0.25 }}>⊞</div>
          <div style={{ color: csvStatusColor, fontSize: 12, fontWeight: 600 }}>
            {csvStatusText}
          </div>
          {parsed && (
            <div
              style={{
                color: CSS_VARS.textTertiary,
                fontSize: 11,
                marginTop: 4,
              }}
            >
              Latest: {parsed.days[parsed.days.length - 1]?.date} · ATR(14) ={" "}
              <span style={{ color: T.green, fontWeight: 700 }}>
                {parsed.tradingHoursAtr14} pts
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

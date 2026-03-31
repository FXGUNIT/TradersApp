import React from "react";
import {
  T,
  AMD_PHASES,
  Tag,
  SHead,
  Loader,
  RenderOut,
  AMDPhaseTag,
  PasteZone,
  cardS,
  glowBtn,
  inp,
  lbl,
} from "./terminalHelperComponents";
import { CSS_VARS } from "../../styles/cssVars.js";

const warningTint = "var(--status-warning-soft, rgba(255,214,10,0.12))";
const surfaceMuted = CSS_VARS.baseLayer;

export default function PremarketTab({
  // CSV state
  parsed,
  isCsvParsing,
  parseMsg,
  csvBorderColor,
  csvStatusColor,
  csvStatusText,
  // Chart images
  p1NewsChart,
  p1PremarketChart,
  p1KeyLevelsChart,
  activeZone,
  setActiveZone,
  // Handlers
  handleCsvDrop,
  // Analysis state
  loading,
  p1Out,
  displayedAmdPhase,
  // Handlers
  runPart1,
  setActiveTab,
  setErr,
  err,
}) {
  return (
    <div>
      {/* CSV Upload */}
      <div style={cardS()}>
        <SHead icon="⊞" title="LOAD NINJATRADER 1-MIN DATA" color={T.blue} />
        <div
          onDrop={handleCsvDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => !isCsvParsing && document.getElementById("csvIn").click()}
          style={{
            border: `2px dashed ${csvBorderColor}`,
            borderRadius: 8,
            padding: "24px",
            textAlign: "center",
            cursor: isCsvParsing ? "progress" : "pointer",
            opacity: isCsvParsing ? 0.82 : 1,
            background: surfaceMuted,
          }}
        >
          <input
            id="csvIn"
            type="file"
            accept=".txt,.csv"
            style={{ display: "none" }}
            onChange={handleCsvDrop}
            disabled={isCsvParsing}
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
      </div>

      {/* Screenshot Paste Zones */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 14,
          marginBottom: 14,
        }}
      >
        {[
          {
            zid: "p1news",
            icon: "📅",
            title: "ECONOMIC CALENDAR",
            color: T.red,
            hint: "★★★ events only",
            state: p1NewsChart,
            setter: null,
            inputId: "p1newsIn",
          },
          {
            zid: "p1prem",
            icon: "🌅",
            title: "PREMARKET CHART",
            color: T.orange,
            hint: "open type + prev week H/L",
            state: p1PremarketChart,
            setter: null,
            inputId: "p1premIn",
          },
          {
            zid: "p1lvl",
            icon: "◈",
            title: "KEY LEVELS CHART",
            color: T.gold,
            hint: "PDH/PDL/POC/VAH/VAL/VWAP",
            state: p1KeyLevelsChart,
            setter: null,
            inputId: "p1lvlIn",
          },
        ].map((zone) => (
          <PasteZone
            key={zone.zid}
            zoneId={zone.zid}
            activeZone={activeZone}
            setActiveZone={setActiveZone}
          >
            <div
              style={cardS({ margin: 0, borderLeft: `4px solid ${zone.color}` })}
              className="glass-panel"
            >
              <SHead icon={zone.icon} title={zone.title} color={zone.color} />
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  document.getElementById(zone.inputId)?.click();
                }}
                style={{
                  border: `2px dashed ${zone.state ? zone.color : CSS_VARS.borderSubtle}`,
                  borderRadius: 6,
                  padding: "12px",
                  textAlign: "center",
                  cursor: "pointer",
                  background: surfaceMuted,
                  minHeight: 64,
                }}
              >
                {zone.state ? (
                  <div>
                    <img
                      src={`data:${zone.state.type};base64,${zone.state.b64}`}
                      style={{
                        maxWidth: "100%",
                        maxHeight: 56,
                        borderRadius: 3,
                        objectFit: "contain",
                        marginBottom: 4,
                      }}
                    />
                  </div>
                ) : (
                  <div>
                    <div
                      style={{
                        color: CSS_VARS.textTertiary,
                        fontSize: 11,
                        marginBottom: 2,
                      }}
                    >
                      Click → Ctrl+V or drag
                    </div>
                    <div
                      style={{
                        color: CSS_VARS.textSecondary,
                        fontSize: 9,
                      }}
                    >
                      {zone.hint}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </PasteZone>
        ))}
      </div>

      {err && (
        <div
          style={{
            color: T.red,
            fontSize: 12,
            marginBottom: 12,
            fontWeight: 600,
          }}
        >
          ⚠ {err}
        </div>
      )}
      <button
        onClick={runPart1}
        disabled={loading || isCsvParsing || !parsed || parsed.totalDays < 5}
        style={glowBtn(T.green, loading || isCsvParsing || !parsed || parsed.totalDays < 5)}
        className="btn-glass"
      >
        ▶ RUN AMD PREMARKET ANALYSIS
      </button>

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
                  → TRADE ENTRY
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
                  ⎘ COPY
                </button>
              </div>
            </div>
            <div
              style={cardS({ borderLeft: `4px solid ${T.blue}` })}
              className="glass-panel"
            >
              <RenderOut text={p1Out} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

import React from "react";
import {
  T,
  SHead,
  PasteZone,
  cardS,
} from "./terminalHelperComponents";
import { CSS_VARS } from "../../styles/cssVars.js";
import { Calendar, Sun, Target } from "lucide-react";
import MainTerminalAiOutput from "./MainTerminalAiOutput.jsx";

/**
 * MainTerminalAiPanels — P1/P2 analysis sections: screenshot paste zones, run button, and output display.
 *
 * Props:
 *   p1NewsChart         — ChartImage | null
 *   p1PremarketChart    — ChartImage | null
 *   p1KeyLevelsChart    — ChartImage | null
 *   activeZone          — string | null
 *   setActiveZone       — (zoneId) => void
 *   flashingZoneId       — string | null
 *   err                 — string (error message)
 *   setErr              — (msg) => void
 *   loading             — boolean (analysis running)
 *   p1Out               — string (analysis result)
 *   displayedAmdPhase   — string (AMD phase display)
 *   runPart1            — () => Promise<void>
 *   setActiveTab         — (tab) => void
 *   parsed              — object | null
 *   isCsvParsing        — boolean
 */
export default function MainTerminalAiPanels({
  p1NewsChart,
  p1PremarketChart,
  p1KeyLevelsChart,
  activeZone,
  setActiveZone,
  flashingZoneId,
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
  const surfaceMuted = CSS_VARS.baseLayer;

  return (
    <>
      {/* P1 Screenshot Paste Zones */}
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
            icon: Calendar,
            title: "ECONOMIC CALENDAR",
            color: T.red,
            hint: "★★★ events only",
            state: p1NewsChart,
            setter: null,
            inputId: "p1newsIn",
          },
          {
            zid: "p1prem",
            icon: Sun,
            title: "PREMARKET CHART",
            color: T.orange,
            hint: "open type + prev week H/L",
            state: p1PremarketChart,
            setter: null,
            inputId: "p1premIn",
          },
          {
            zid: "p1lvl",
            icon: Target,
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
            flashingZoneId={flashingZoneId}
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

      <MainTerminalAiOutput
        err={err}
        setErr={setErr}
        loading={loading}
        p1Out={p1Out}
        displayedAmdPhase={displayedAmdPhase}
        runPart1={runPart1}
        setActiveTab={setActiveTab}
        parsed={parsed}
        isCsvParsing={isCsvParsing}
      />
    </>
  );
}

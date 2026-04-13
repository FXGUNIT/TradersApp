import React, { forwardRef } from "react";
import MainTerminalCsvZone from "./MainTerminalCsvZone.jsx";
import MainTerminalAiPanels from "./MainTerminalAiPanels.jsx";

/**
 * PremarketTab — top-level premarket tab composing CSV zone + AI panels.
 *
 * Props:
 *   parsed, isCsvParsing, csvStatusText, csvStatusColor, csvBorderColor, csvProgress
 *     — owned by MainTerminalCsvZone; kept in sync via setCsvParsed / setCsvStatus callbacks.
 *     Passed here only so other sibling tabs can read them without prop-drilling.
 *
 *   csvZoneRef              — forwarded ref: ref.current?.triggerCsvDrop()
 *   setCsvParsed            — (v) => void  — syncs CSV parsed result back to MainTerminal
 *   setCsvParsing           — (v) => void
 *   setCsvStatus            — (msg) => void
 *   setErr                  — (msg) => void
 *
 *   p1NewsChart / p1PremarketChart / p1KeyLevelsChart
 *   activeZone / setActiveZone
 *   flashingZoneId
 *   loading / p1Out / displayedAmdPhase
 *   runPart1 / setActiveTab / err
 */
const PremarketTab = forwardRef(function PremarketTab(
  {
    // CSV state (from MainTerminalCsvZone via callbacks)
    parsed,
    isCsvParsing,
    csvStatusText,
    csvStatusColor,
    csvBorderColor,
    csvProgress,
    // CSV callbacks (push CSV state back to MainTerminal)
    setCsvParsed,
    setCsvParsing,
    setCsvStatus,
    setErr,
    // Chart images
    p1NewsChart,
    p1PremarketChart,
    p1KeyLevelsChart,
    // Zones
    activeZone,
    setActiveZone,
    flashingZoneId,
    // Analysis
    loading,
    p1Out,
    displayedAmdPhase,
    runPart1,
    setActiveTab,
    err,
  },
  ref,
) {
  return (
    <div>
      {/* CSV Upload — owns CSV worker + drop UI; syncs state to MainTerminal */}
      <MainTerminalCsvZone
        ref={ref}
        setParsed={setCsvParsed}
        setIsCsvParsing={setCsvParsing}
        setParseMsg={setCsvStatus}
        setErr={setErr}
      />

      {/* P1 Analysis: paste zones, run button, output display */}
      <MainTerminalAiPanels
        p1NewsChart={p1NewsChart}
        p1PremarketChart={p1PremarketChart}
        p1KeyLevelsChart={p1KeyLevelsChart}
        activeZone={activeZone}
        setActiveZone={setActiveZone}
        flashingZoneId={flashingZoneId}
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
    </div>
  );
});

export default PremarketTab;

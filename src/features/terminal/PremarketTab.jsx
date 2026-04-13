import React, { forwardRef } from "react";
import MainTerminalCsvZone from "./MainTerminalCsvZone.jsx";
import MainTerminalAiPanels from "./MainTerminalAiPanels.jsx";

/**
 * PremarketTab - top-level premarket tab composing CSV zone + AI panels.
 *
 * Props:
 *   parsed, isCsvParsing
 *     - mirrored in MainTerminal via MainTerminalCsvZone callbacks so sibling
 *       panels can consume CSV state without owning the drop zone.
 *
 *   forwarded ref
 *     - ref.current?.triggerCsvDrop()
 *     - ref.current?.syncCsvState({ parsed, parseMsg, isCsvParsing })
 *
 *   setCsvParsed            - (v) => void
 *   setCsvParsing           - (v) => void
 *   setCsvStatus            - (msg) => void
 *   setErr                  - (msg) => void
 *
 *   p1NewsChart / p1PremarketChart / p1KeyLevelsChart
 *   activeZone / setActiveZone
 *   flashingZoneId
 *   loading / p1Out / displayedAmdPhase
 *   runPart1 / setActiveTab / err
 */
const PremarketTab = forwardRef(function PremarketTab(
  {
    // CSV state mirrored from MainTerminalCsvZone callbacks
    parsed,
    isCsvParsing,
    // CSV callbacks
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
      <MainTerminalCsvZone
        ref={ref}
        onParsedChange={setCsvParsed}
        onParsingChange={setCsvParsing}
        onStatusChange={setCsvStatus}
        onErrorChange={setErr}
      />

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

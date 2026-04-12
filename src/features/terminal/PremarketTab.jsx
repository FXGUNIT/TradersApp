import React from "react";
import MainTerminalCsvZone from "./MainTerminalCsvZone.jsx";
import MainTerminalAiPanels from "./MainTerminalAiPanels.jsx";

const warningTint = "var(--status-warning-soft, rgba(255,214,10,0.12))";
const surfaceMuted = CSS_VARS.baseLayer;

export default function PremarketTab({
  // CSV state
  parsed,
  isCsvParsing,
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
  flashingZoneId,
  csvProgress,
}) {
  return (
    <div>
      {/* CSV Upload */}
      <MainTerminalCsvZone
        parsed={parsed}
        isCsvParsing={isCsvParsing}
        csvBorderColor={csvBorderColor}
        csvStatusColor={csvStatusColor}
        csvStatusText={csvStatusText}
        csvProgress={csvProgress}
        handleCsvDrop={handleCsvDrop}
      />


      {/* P1 Analysis (screenshot zones + run + output) */}
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

  );
}

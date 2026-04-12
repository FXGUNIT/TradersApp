import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  T,
  AMD_PHASES,
  Field,
  SHead,
  Tag,
  RenderOut,
  TrafficLight,
  cardS,
  glowBtn,
  inp,
  lbl,
} from "./terminalHelperComponents";
import { CSS_VARS } from "../../styles/cssVars.js";
import TerminalTradeReadinessPanel from "./TerminalTradeReadinessPanel.jsx";
import { RiskSlider } from "./RiskSlider.jsx";
import { useDebounce } from "./useDebounce.js";
import VerdictRadar, { deriveVerdictScores } from "./VerdictRadar.jsx";
import TradeTabCircuitBreaker from "./TradeTabCircuitBreaker.jsx";
import P2TradeForm from "./P2TradeForm.jsx";
import VerdictSynthesis from "./VerdictSynthesis.jsx";
import MainTerminalImageCapture from "./MainTerminalImageCapture.jsx";
import {
  Zap,              // Trade Setup section
} from "lucide-react";

const warningTint = "var(--status-warning-soft, rgba(255,214,10,0.12))";
const dangerTint = "var(--status-danger-soft, rgba(255,69,58,0.1))";

export default function TradeTab({
  // Readiness panel props
  complianceColor,
  curBal,
  dailyLossUsed,
  displayedAmdPhase,
  extractedVals,
  hasFirmRules,
  isDDBreached,
  isDDWarning,
  isDailyBreached,
  isDailyWarning,
  liqLevel,
  liveAmdContext,
  liveAmdPhase,
  marketOpen,
  maxDD,
  maxDL,
  sd1Target,
  sd2Target,
  sweepEstimate,
  throttleActive,
  trafficState,
  volatilityRegime,
  vr,
  // Trade form
  f,
  sf,
  // Screenshots
  screenshots,
  setScreenshots,
  // Charts
  mpChart,
  setMpChart,
  vwapChart,
  setVwapChart,
  activeZone,
  setActiveZone,
  // Extraction
  extracting,
  extractStatus,
  extractFromScreenshots,
  // P2 state
  p2Jf,
  sp2,
  showP2TradeForm,
  setShowP2TradeForm,
  p2Out,
  p2Ref,
  // Derived
  predictedP2TP1,
  predictedP2SL,
  // Errors & loading
  err,
  setErr,
  loading,
  isTerminalDerivedPending,
  execBlocked,
  // Handlers
  runPart2,
  addP2Trade,
  // Risk slider
  slPts,
  ptVal,
  accountState,
  drawdownType,
  // Settings
  makeImgHandler,
  handleScreenshotDrop,
  flashingZoneId,
  // OCR state writers
  setExtractedVals,
  showToast,
}) {
  // MainTerminalImageCapture owns the OCR hook internally

  // Debounced risk save — fires 800ms after the slider's onCommit (mouseUp)
  // Debounced risk save — fires 800ms after the slider's onCommit (mouseUp)
  const debouncedSaveRisk = useDebounce((riskPct) => {
    sf("riskPct")(riskPct);
  }, 800);

  // ── Verdict radar — derive 5 scores from readiness panel signals ───────
  const [circuitSecs, setCircuitSecs] = useState(0);

  // All inputs come from terminalDerivedState (already computed by the worker)
  const verdictScores = useMemo(
    () =>
      deriveVerdictScores({
        extractedVals,
        volatilityRegime,
        vr,
        displayedAmdPhase,
        tradeFormRRR: f.rrr,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [extractedVals, volatilityRegime, vr, displayedAmdPhase, f.rrr],
  );

  return (
    <div>
      <TradeTabCircuitBreaker
        execBlocked={execBlocked}
        onCircuitSecsChange={setCircuitSecs}
        circuitSecs={circuitSecs}
      />
      <TerminalTradeReadinessPanel
        complianceColor={complianceColor}
        curBal={curBal}
        dailyLossUsed={dailyLossUsed}
        displayedAmdPhase={displayedAmdPhase}
        extractedVals={extractedVals}
        hasFirmRules={Boolean(hasFirmRules)}
        isDDBreached={isDDBreached}
        isDDWarning={isDDWarning}
        isDailyBreached={isDailyBreached}
        isDailyWarning={isDailyWarning}
        liqLevel={liqLevel}
        liveAmdContext={liveAmdContext}
        liveAmdPhase={liveAmdPhase}
        marketOpen={marketOpen}
        maxDD={maxDD}
        maxDL={maxDL}
        sd1Target={sd1Target}
        sd2Target={sd2Target}
        sweepEstimate={sweepEstimate}
        throttleActive={throttleActive}
        trafficState={trafficState}
        volatilityRegime={volatilityRegime}
        vr={vr}
      />

      {/* Trade Setup */}
      <div style={cardS({ borderLeft: `4px solid ${T.orange}` })} className="glass-panel card-tilt">
        <SHead icon={Zap} title="TRADE SETUP" color={T.orange} />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 16,
          }}
        >
          <Field
            label="TIME (IST)"
            value={f.timeIST}
            onChange={sf("timeIST")}
            options={[
              { v: "9:30", l: "9:30 AM" },
              { v: "10:00", l: "10:00 AM" },
              { v: "11:00", l: "11:00 AM" },
              { v: "12:00", l: "12:00 PM" },
            ]}
          />
          <Field
            label="INSTRUMENT"
            value={f.instrument}
            onChange={sf("instrument")}
            options={[{ v: "MNQ", l: "MNQ · $2/pt" }, { v: "MES", l: "MES · $5/pt" }]}
          />
          <Field
            label="DIRECTION"
            value={f.direction}
            onChange={sf("direction")}
            options={[{ v: "Long", l: "↑ Long" }, { v: "Short", l: "↓ Short" }]}
          />
          <Field
            label="TRADE TYPE"
            value={f.tradeType}
            onChange={sf("tradeType")}
            options={[{ v: "Trend", l: "Trend" }, { v: "MR", l: "Mean Reversion" }]}
          />
          <Field
            label="ACCOUNT BALANCE ($)"
            value={f.accountBalance}
            onChange={sf("accountBalance")}
            type="number"
            mono
          />
          <RiskSlider
            value={f.riskPct ?? "0.3"}
            onChange={sf("riskPct")}
            onCommit={debouncedSaveRisk}
            currentBalance={accountState?.currentBalance}
            startingBalance={accountState?.startingBalance}
            highWaterMark={accountState?.highWaterMark}
            maxDrawdown={maxDD ?? 0}
            drawdownType={drawdownType ?? "trailing"}
            slPts={slPts ?? 0}
            ptVal={ptVal ?? 1}
            throttleActive={throttleActive ?? false}
          />
        </div>

        {throttleActive && (
          <div
            style={{
              marginTop: 12,
              padding: "10px 16px",
              background: warningTint,
              border: `1px solid ${CSS_VARS.statusWarning}`,
              borderRadius: 6,
              color: T.gold,
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            ⚠ Drawdown throttle active: risk halved to {f.riskPct}%
          </div>
        )}
      </div>

      {/* Entry Price */}
      <div style={cardS()}>
        <label style={lbl}>ENTRY PRICE</label>
        <input
          type="number"
          value={f.entryPrice}
          onChange={(e) => sf("entryPrice")(e.target.value)}
          placeholder="exact entry level"
          style={inp}
          className="input-glass"
        />
      </div>

      {/* Image Upload Zones */}
      <MainTerminalImageCapture
        screenshots={screenshots}
        setScreenshots={setScreenshots}
        mpChart={mpChart}
        setMpChart={setMpChart}
        vwapChart={vwapChart}
        setVwapChart={setVwapChart}
        activeZone={activeZone}
        setActiveZone={setActiveZone}
        flashingZoneId={flashingZoneId}
        extractFromScreenshots={extractFromScreenshots}
        handleScreenshotDrop={handleScreenshotDrop}
        makeImgHandler={makeImgHandler}
        extracting={extracting}
        extractStatus={extractStatus}
        setExtractedVals={setExtractedVals}
        showToast={showToast}
      />

      {/* Notes */}
      <div style={cardS()}>
        <label style={lbl}>NOTES</label>
        <textarea
          value={f.notes}
          onChange={(e) => sf("notes")(e.target.value)}
          style={{ ...inp, minHeight: 60, resize: "vertical" }}
          className="input-glass"
        />
      </div>

      {err && (
        <div
          style={{
            color: T.red,
            fontSize: 13,
            marginBottom: 16,
            fontWeight: 600,
            padding: "12px 16px",
            background: dangerTint,
            borderRadius: 8,
          }}
        >
          ⚠ {err}
        </div>
      )}

      <button
        onClick={runPart2}
        disabled={loading || isTerminalDerivedPending || execBlocked}
        style={glowBtn(T.orange, loading || isTerminalDerivedPending || execBlocked)}
        className="btn-glass"
      >
        {isTerminalDerivedPending
          ? "SYNCING ENGINE..."
          : execBlocked
            ? circuitSecs > 0
              ? `⏸ CIRCUIT LOCKED ${Math.floor(circuitSecs / 60)}:${String(circuitSecs % 60).padStart(2, "0")}`
              : "🚫 LOCKED"
            : "⚡ CAPTURE ENGINE"}
      </button>

      <P2TradeForm
        p2Jf={p2Jf}
        sp2={sp2}
        showP2TradeForm={showP2TradeForm}
        setShowP2TradeForm={setShowP2TradeForm}
        p2Out={p2Out}
        p2Ref={p2Ref}
        predictedP2TP1={predictedP2TP1}
        predictedP2SL={predictedP2SL}
        loading={loading}
        addP2Trade={addP2Trade}
        err={err}
        setErr={setErr}
        trafficState={trafficState}
        verdictScores={verdictScores}
      />

      {/*
      <VerdictSynthesis verdictScores={verdictScores} />
      */}
    </div>
  );
}

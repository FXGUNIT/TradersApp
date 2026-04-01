import React, { useEffect, useRef, useState } from "react";
import {
  T,
  AMD_PHASES,
  Field,
  SHead,
  Tag,
  RenderOut,
  TrafficLight,
  PasteZone,
  cardS,
  glowBtn,
  inp,
  lbl,
} from "./terminalHelperComponents";
import { CSS_VARS } from "../../styles/cssVars.js";
import TerminalTradeReadinessPanel from "./TerminalTradeReadinessPanel.jsx";
import { useTerminalOcr, OCR_STATES } from "./useTerminalOcr.js";
import { RiskSlider } from "./RiskSlider.jsx";
import { useDebounce } from "./useDebounce.js";
import VerdictRadar, { deriveVerdictScores } from "./VerdictRadar.jsx";
import {
  Zap,              // Trade Setup section
  BarChart2,        // INDICATORS zone
  Activity,         // VWAP CHART zone
  LayoutGrid,      // 30-MIN MP CHART zone
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
  // ── OCR hook (BFF seam — owns Tesseract.js state and execution) ────────────
  const { ocrState, ocrProgress, runOcr, ocrStatus } = useTerminalOcr({
    screenshots,
    showToast,
    onResult: (ocrValues) => {
      // Merge OCR results into extractedVals — OCR values complement AI values
      setExtractedVals((prev) => ({ ...prev, ...ocrValues }));
    },
  });

  const isOcrBusy = ocrState === OCR_STATES.LOADING || ocrState === OCR_STATES.SCANNING;

  // Debounced risk save — fires 800ms after the slider's onCommit (mouseUp)
  // Debounced risk save — fires 800ms after the slider's onCommit (mouseUp)
  const debouncedSaveRisk = useDebounce((riskPct) => {
    sf("riskPct")(riskPct);
  }, 800);

  // ── Verdict radar — derive 5 scores from readiness panel signals ───────
  // ── Circuit breaker countdown (reads localStorage every second) ──────────
  const CIRCUIT_KEY = "tilt_circuit_until";
  const getCircuitSecs = () => {
    try {
      const v = localStorage.getItem(CIRCUIT_KEY);
      if (!v) return 0;
      const remaining = Math.max(0, Math.ceil((parseInt(v, 10) - Date.now()) / 1000));
      return remaining;
    } catch { return 0; }
  };
  const [circuitSecs, setCircuitSecs] = useState(getCircuitSecs);
  const circuitTimerRef = useRef(null);

  useEffect(() => {
    if (!execBlocked) {
      if (circuitTimerRef.current) { clearInterval(circuitTimerRef.current); circuitTimerRef.current = null; }
      return;
    }
    // Poll every second
    circuitTimerRef.current = setInterval(() => {
      const secs = getCircuitSecs();
      setCircuitSecs(secs);
      if (secs <= 0 && circuitTimerRef.current) {
        clearInterval(circuitTimerRef.current);
        circuitTimerRef.current = null;
      }
    }, 1000);
    return () => { if (circuitTimerRef.current) clearInterval(circuitTimerRef.current); };
  }, [execBlocked]);
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
            maxDrawdown={maxDrawdown ?? 0}
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
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 16,
          marginBottom: 12,
        }}
      >
        {[
          { zid: "ss", icon: BarChart2, title: "INDICATORS", color: T.purple, isMulti: true },
          {
            zid: "vwap",
            icon: Activity,
            title: "VWAP CHART",
            color: T.blue,
            state: vwapChart,
            setter: setVwapChart,
            inputId: "vwapIn",
          },
          {
            zid: "mp",
            icon: LayoutGrid,
            title: "30-MIN MP CHART",
            color: T.gold,
            state: mpChart,
            setter: setMpChart,
            inputId: "mpIn",
          },
        ].map((zone) => (
          <PasteZone
            key={zone.zid}
            zoneId={zone.zid}
            activeZone={activeZone}
            setActiveZone={setActiveZone}
            flashingZoneId={flashingZoneId}
            scanningZoneId={isOcrBusy ? zone.zid : null}
            ocrSuccessZoneId={ocrState === OCR_STATES.SUCCESS ? zone.zid : null}
          >
            <div
              data-pastezone="true"
              style={cardS({ margin: 0, borderLeft: `4px solid ${zone.color}` })}
              className="glass-panel"
            >
              <SHead icon={zone.icon} title={zone.title} color={zone.color} />

              {zone.isMulti ? (
                <div
                  data-testid="terminal-screenshot-dropzone"
                  onDrop={handleScreenshotDrop}
                  onDragOver={(e) => e.preventDefault()}
                  style={{
                    border: `2px dashed ${screenshots.length ? T.purple : CSS_VARS.borderSubtle}`,
                    borderRadius: 8,
                    padding: "16px",
                    textAlign: "center",
                    cursor: "copy",
                    background: CSS_VARS.surfaceGlass,
                  }}
                  className="glass-panel"
                >
                  <div
                    data-testid="terminal-screenshot-count"
                    style={{
                      color: T.muted,
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: 1.2,
                      marginBottom: 8,
                    }}
                  >
                    SCREENSHOTS {Math.min(screenshots.length, 4)}/4
                  </div>
                  {screenshots.length > 0 ? (
                    <div>
                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          flexWrap: "wrap",
                          justifyContent: "center",
                          marginBottom: 8,
                        }}
                      >
                        {screenshots.map((s, i) => (
                          <div
                            key={i}
                            style={{
                              position: "relative",
                              width: 60,
                              height: 40,
                              borderRadius: 4,
                              overflow: "hidden",
                              border: `1px solid ${T.purple}60`,
                            }}
                          >
                            <img
                              src={`data:${s.type};base64,${s.b64}`}
                              style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            />
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setScreenshots((p) => p.filter((_, idx) => idx !== i));
                              }}
                              style={{
                                position: "absolute",
                                top: 0,
                                right: 0,
                                background: CSS_VARS.surfaceGlass,
                                border: "none",
                                width: 16,
                                height: 16,
                                cursor: "pointer",
                                color: CSS_VARS.textPrimary,
                                fontSize: 10,
                                padding: 0,
                              }}
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div
                        style={{ color: T.muted, fontSize: 12, marginBottom: 4, fontWeight: 600 }}
                      >
                        Paste or drag screenshots here
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div
                  data-testid={zone.zid === "vwap" ? "terminal-vwap-dropzone" : "terminal-mp-dropzone"}
                  onDrop={makeImgHandler(zone.setter)}
                  onDragOver={(e) => e.preventDefault()}
                  onClick={(e) => {
                    e.stopPropagation();
                    document.getElementById(zone.inputId)?.click();
                  }}
                  style={{
                    border: `2px dashed ${zone.state ? zone.color : CSS_VARS.borderSubtle}`,
                    borderRadius: 8,
                    padding: "16px",
                    textAlign: "center",
                    cursor: "pointer",
                    background: CSS_VARS.surfaceGlass,
                  }}
                  className="glass-panel"
                >
                  <input
                    id={zone.inputId}
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={makeImgHandler(zone.setter)}
                  />
                  {zone.state ? (
                    <div>
                      <img
                        src={`data:${zone.state.type};base64,${zone.state.b64}`}
                        style={{
                          maxWidth: "100%",
                          maxHeight: 60,
                          borderRadius: 4,
                          objectFit: "contain",
                          marginBottom: 8,
                          cursor: "crosshair",
                        }}
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          zone.setter(null);
                        }}
                        style={{
                          display: "block",
                          margin: "0 auto",
                          background: dangerTint,
                          border: `1px solid ${CSS_VARS.statusDanger}`,
                          borderRadius: 4,
                          padding: "4px 12px",
                          cursor: "pointer",
                          color: T.red,
                          fontSize: 10,
                          fontFamily: T.font,
                          fontWeight: 700,
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div
                        style={{ color: T.muted, fontSize: 12, marginBottom: 4, fontWeight: 600 }}
                      >
                        Click → Ctrl+V or drag
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </PasteZone>
        ))}
      </div>

      {/* AI Extract Button */}
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

      <div ref={p2Ref} style={{ marginTop: 24 }}>
        {loading && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              minHeight: 240,
              gap: 16,
            }}
          >
            <div style={{ display: "flex", gap: 4, alignItems: "flex-end", height: 28 }}>
              {[8, 15, 10, 20, 12, 17, 9].map((h, i) => (
                <div
                  key={i}
                  style={{
                    width: 4,
                    height: h,
                    background: T.orange,
                    borderRadius: 2,
                    animation: `bar ${0.85 + i * 0.05}s ${i * 0.1}s ease-in-out infinite alternate`,
                  }}
                />
              ))}
            </div>
            <span
              style={{
                color: T.muted,
                fontSize: 12,
                letterSpacing: 2,
                fontWeight: 600,
              }}
            >
              RECURSIVE CONSENSUS ENGINE
            </span>
          </div>
        )}
        {!loading && p2Out && (
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <Tag label="EXECUTION PLAN READY" color={T.orange} />
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={() => setShowP2TradeForm((v) => !v)}
                  style={glowBtn(T.purple, false)}
                  className="btn-glass"
                >
                  {showP2TradeForm ? "✕ CANCEL" : "+ LOG TRADE"}
                </button>
              </div>
            </div>

            {showP2TradeForm && (
              <div
                style={{
                  background: CSS_VARS.card,
                  border: `1px solid ${CSS_VARS.borderSubtle}`,
                  borderRadius: 12,
                  padding: "20px 24px",
                  marginBottom: 20,
                  boxShadow: `0 1px 3px 0 ${CSS_VARS.borderSubtle}, 0 1px 2px 0 ${CSS_VARS.borderSubtle}`,
                }}
                className="glass-panel"
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: 16,
                    marginBottom: 16,
                  }}
                >
                  <Field
                    label="EXIT PRICE"
                    value={p2Jf.exit}
                    onChange={sp2("exit")}
                    type="number"
                    mono
                  />
                  <Field
                    label="RESULT"
                    value={p2Jf.result}
                    onChange={sp2("result")}
                    options={[
                      { v: "win", l: "✓ Win" },
                      { v: "loss", l: "✗ Loss" },
                      { v: "breakeven", l: "◎ BE" },
                    ]}
                  />
                  <Field
                    label="AMD PHASE AT TRADE"
                    value={p2Jf.amdPhase}
                    onChange={sp2("amdPhase")}
                    options={Object.keys(AMD_PHASES).map((k) => ({
                      v: k,
                      l: AMD_PHASES[k].label,
                    }))}
                  />
                  <Field
                    label="P&L ($)"
                    value={p2Jf.pnl}
                    onChange={sp2("pnl")}
                    type="number"
                    mono
                  />
                  <Field
                    label="BALANCE AFTER ($)"
                    value={p2Jf.balAfter}
                    onChange={sp2("balAfter")}
                    type="number"
                    mono
                  />
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
                  <Tag
                    label={`Pred TP1: ${Number.isFinite(predictedP2TP1) ? predictedP2TP1.toFixed(2) : "—"}`}
                    color={T.green}
                  />
                  <Tag
                    label={`Pred SL: ${Number.isFinite(predictedP2SL) ? predictedP2SL.toFixed(2) : "—"}`}
                    color={T.red}
                  />
                </div>
                <button
                  onClick={addP2Trade}
                  style={glowBtn(T.purple, false)}
                  className="btn-glass"
                >
                  + ADD TO JOURNAL
                </button>
              </div>
            )}

            <TrafficLight state={trafficState} />

            <div style={cardS({ borderLeft: `4px solid ${T.orange}` })} className="glass-panel card-tilt">
              <RenderOut text={p2Out} />
            </div>

            {/* ── Supreme Verdict Synthesis Radar ─────────────────── */}
            {verdictScores && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 20,
                  padding: "16px 20px",
                  background: CSS_VARS.card,
                  border: `1px solid ${CSS_VARS.borderSubtle}`,
                  borderRadius: 12,
                  boxShadow: `0 1px 3px 0 ${CSS_VARS.borderSubtle}`,
                }}
                className="glass-panel"
              >
                <SHead icon="◈" title="VERDICT SYNTHESIS" color={T.purple} />
                <VerdictRadar scores={verdictScores} size={180} animated />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

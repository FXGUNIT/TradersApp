import React from 'react';
import { T, AMD_PHASES } from '../../constants/theme.js';
import { cardS, glowBtn, lbl, inp } from '../../utils/styleUtils.js';
import { TIME_OPTIONS } from '../../constants/appConstants.js';
import { SHead, Field, AMDPhaseTag, TrafficLight, LED, Tag, HourlyHeatmap, PasteZone, RenderOut } from '../../components/SharedUI.jsx';
import { councilStage } from '../../services/ai-router.js';

export function TradeEntryTab({
  f, sf, ist, currentAMD, fr, parsed, extractedVals,
  screenshots, setScreenshots, onScreenshotDrop, activeZone, setActiveZone,
  vwapChart, setVwapChart, mpChart, setMpChart, makeImgHandler,
  trafficState, throttleActive, complianceColor, isDailyBreached, isDDBreached, isDailyWarning, isDDWarning,
  execBlocked, execBlockReason, maxDL, maxDD, curBal, liqLevel, dailyLossUsed,
  VR, volatilityRegime, sd1Target, sd2Target,
  extracting, loading, err, extractFromScreenshots,
  p2Out, p2Ref, runPart2, p2Jf, sp2, showP2TradeForm, setShowP2TradeForm, addP2Trade,
  showToast
}) {
  return (
          <div>
            <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 280 }}>
                <AMDPhaseTag phase={currentAMD} />
              </div>
              <div style={{ flex: 2, minWidth: 280 }}>
                <TrafficLight state={trafficState} />
              </div>
            </div>

            {fr.parsed && (
              <div style={{ display: "flex", gap: 16, padding: "14px 20px", background: "#FFFFFF", border: `1px solid ${complianceColor}40`, borderRadius: 10, marginBottom: 16, flexWrap: "wrap", boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)" }} className="glass-panel">
                <LED color={complianceColor} size={10} />
                <span style={{ color: complianceColor, fontSize: 11, letterSpacing: 1, fontWeight: 700 }}>WATCHDOG:</span>
                {maxDL > 0 && <span style={{ color: isDailyBreached ? T.red : isDailyWarning ? T.gold : T.green, fontSize: 11, fontWeight: 600 }}>Daily ${dailyLossUsed.toFixed(0)}/${maxDL}</span>}
                {maxDD > 0 && curBal > 0 && <span style={{ color: isDDBreached ? T.red : isDDWarning ? T.gold : T.green, fontSize: 11, fontWeight: 600 }}>LiqDist ${(curBal - liqLevel).toFixed(0)}</span>}
                <span style={{ color: ist.isOpen ? T.green : T.red, fontSize: 11, fontWeight: 600 }}>{ist.isOpen ? "ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â MARKET OPEN" : "ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â MARKET CLOSED"}</span>
                {throttleActive && <span style={{ color: T.gold, fontSize: 11, fontWeight: 700 }}>ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â  DRAWDOWN THROTTLE</span>}
              </div>
            )}

            {parsed && <HourlyHeatmap hourlyHeatmap={parsed.hourlyHeatmap} />}

            {(extractedVals.adx !== null || extractedVals.ci !== null || sd1Target) && (
              <div style={{ display: "flex", gap: 16, padding: "12px 20px", background: "rgba(0,0,0,0.5)", border: `1px solid rgba(255,255,255,0.1)`, borderRadius: 8, marginBottom: 16, flexWrap: "wrap" }} className="glass-panel">
                <span style={{ color: T.dim, fontSize: 10, letterSpacing: 1, fontWeight: 700 }}>LIVE:</span>
                {extractedVals.adx !== null && <span style={{ color: extractedVals.adx < 20 ? T.red : T.green, fontSize: 12, fontWeight: 700, fontFamily: T.mono }}>ADX {extractedVals.adx}</span>}
                {extractedVals.ci !== null && <span style={{ color: extractedVals.ci > 61.8 ? T.red : T.green, fontSize: 12, fontWeight: 700, fontFamily: T.mono }}>CI {extractedVals.ci}</span>}
                {extractedVals.vwap !== null && <span style={{ color: T.blue, fontSize: 12, fontWeight: 700, fontFamily: T.mono }}>VWAP {extractedVals.vwap}</span>}
                {sd1Target && <span style={{ color: T.cyan, fontSize: 12, fontWeight: 700, fontFamily: T.mono }}>SD1 {sd1Target.toFixed(2)}</span>}
                {sd2Target && <span style={{ color: T.purple, fontSize: 12, fontWeight: 700, fontFamily: T.mono }}>SD2 {sd2Target.toFixed(2)}</span>}
              </div>
            )}

            <div style={{ padding: "12px 20px", background: "rgba(0,0,0,0.5)", border: `1px solid ${T.blue}40`, borderRadius: 8, marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }} className="glass-panel">
              <span style={{ color: T.dim, fontSize: 10, letterSpacing: 1, fontWeight: 700 }}>VOLATILITY REGIME:</span>
              <span style={{ color: volatilityRegime === 'Compression' ? T.red : volatilityRegime === 'Expansion' ? T.green : T.blue, fontSize: 14, fontWeight: 800 }}>{volatilityRegime}</span>
              <span style={{ color: T.muted, fontSize: 12, fontFamily: T.mono, fontWeight: 600 }}>(VR = {VR.toFixed(2)})</span>
            </div>

            <div style={cardS({ borderLeft: `4px solid ${T.orange}` })} className="glass-panel card-tilt">
              <SHead icon="ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡" title="TRADE SETUP" color={T.orange} />
              
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
                <Field label="TIME (IST)" value={f.timeIST} onChange={sf('timeIST')} options={TIME_OPTIONS} />
                <Field label="INSTRUMENT" value={f.instrument} onChange={sf('instrument')} options={[{ v: 'MNQ', l: 'MNQ ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· $2/pt' }, { v: 'MES', l: 'MES ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· $5/pt' }]} />
                <Field label="DIRECTION" value={f.direction} onChange={sf('direction')} options={[{ v: 'Long', l: 'ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¹Ã…â€œ Long' }, { v: 'Short', l: 'ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ Short' }]} />
                <Field label="TRADE TYPE" value={f.tradeType} onChange={sf('tradeType')} options={[{ v: 'Trend', l: 'Trend' }, { v: 'MR', l: 'Mean Reversion' }]} />
                <Field label="ACCOUNT BALANCE ($)" value={f.accountBalance} onChange={sf('accountBalance')} type="number" mono />
                <Field label="RISK %" value={f.riskPct} onChange={sf('riskPct')} options={[{ v: '0.2', l: '0.2%' }, { v: '0.3', l: '0.3%' }, { v: '0.4', l: '0.4%' }]} />
              </div>
              
              {isThrottled && (
                <div style={{ marginTop: 12, padding: "10px 16px", background: "rgba(255,214,10,0.1)", border: `1px solid rgba(255,214,10,0.3)`, borderRadius: 6, color: T.gold, fontSize: 12, fontWeight: 600 }}>
                  ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â  Drawdown throttle active: risk halved to {activeRiskPct}%
                </div>
              )}
            </div>

            <div style={cardS()} className="glass-panel card-tilt">
              <label style={lbl}>ENTRY PRICE</label>
              <input type="number" value={f.entryPrice} onChange={e => sf('entryPrice')(e.target.value)} placeholder="exact entry level" style={inp} className="input-glass" />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginBottom: 12 }}>
              {[
                { zid: 'ss', icon: 'ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â ', title: 'INDICATORS', color: T.purple, isMulti: true }, 
                { zid: 'vwap', icon: 'ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â°', title: 'VWAP CHART', color: T.blue, state: vwapChart, setter: setVwapChart, inputId: 'vwapIn' }, 
                { zid: 'mp', icon: 'ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÆ’Ã¢â‚¬Â¹ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ', title: '30-MIN MP CHART', color: T.gold, state: mpChart, setter: setMpChart, inputId: 'mpIn' }
              ].map(zone => (
                <PasteZone key={zone.zid} zoneId={zone.zid} activeZone={activeZone} setActiveZone={setActiveZone}>
                  <div data-pastezone="true" style={cardS({ margin: 0, borderLeft: `4px solid ${zone.color}` })} className="glass-panel">
                    <SHead icon={zone.icon} title={zone.title} color={zone.color} />
                    
                    {zone.isMulti ? (
                      <div onDrop={onScreenshotDrop} onDragOver={e => e.preventDefault()} onClick={e => { e.stopPropagation(); document.getElementById('ssIn').click(); }} style={{ border: `2px dashed ${screenshots.length ? T.purple : "rgba(255,255,255,0.15)"}`, borderRadius: 8, padding: "16px", textAlign: "center", cursor: "pointer", background: "rgba(0,0,0,0.3)" }} className="glass-panel">
                        <input id="ssIn" type="file" accept="image/*" multiple style={{ display: "none" }} onChange={onScreenshotDrop} />
                        {screenshots.length > 0 ? (
                          <div>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", marginBottom: 8 }}>
                              {screenshots.map((s, i) => (
                                <div key={i} style={{ position: "relative", width: 60, height: 40, borderRadius: 4, overflow: "hidden", border: `1px solid ${T.purple}60` }}>
                                  <img src={`data:${s.type};base64,${s.b64}`} className="aspect-ratio-4-3" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                  <button onClick={e => { e.stopPropagation(); setScreenshots(p => p.filter((_, idx) => idx !== i)); }} style={{ position: "absolute", top: 0, right: 0, background: "rgba(0,0,0,0.8)", border: "none", width: 16, height: 16, cursor: "pointer", color: "#fff", fontSize: 10, padding: 0 }}>ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢</button>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div style={{ color: T.muted, fontSize: 12, marginBottom: 4, fontWeight: 600 }}>Click ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ Ctrl+V or drag</div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div onDrop={makeImgHandler(zone.setter)} onDragOver={e => e.preventDefault()} onClick={e => { e.stopPropagation(); document.getElementById(zone.inputId).click(); }} style={{ border: `2px dashed ${zone.state ? zone.color : "rgba(255,255,255,0.15)"}`, borderRadius: 8, padding: "16px", textAlign: "center", cursor: "pointer", background: "rgba(0,0,0,0.3)" }} className="glass-panel">
                        <input id={zone.inputId} type="file" accept="image/*" style={{ display: "none" }} onChange={makeImgHandler(zone.setter)} />
                        {zone.state ? (
                          <div>
                            <img src={`data:${zone.state.type};base64,${zone.state.b64}`} className="aspect-ratio-4-3" style={{ maxWidth: "100%", maxHeight: 60, borderRadius: 4, objectFit: "contain", marginBottom: 8, cursor: "crosshair" }} />
                            <button onClick={e => { e.stopPropagation(); zone.setter(null); }} style={{ display: "block", margin: "0 auto", background: "rgba(255,69,58,0.1)", border: `1px solid rgba(255,69,58,0.4)`, borderRadius: 4, padding: "4px 12px", cursor: "pointer", color: T.red, fontSize: 10, fontFamily: T.font, fontWeight: 700 }}>ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢</button>
                          </div>
                        ) : (
                          <div>
                            <div style={{ color: T.muted, fontSize: 12, marginBottom: 4, fontWeight: 600 }}>Click ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ Ctrl+V or drag</div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </PasteZone>
              ))}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 16, margin: "16px 0", padding: "12px 20px", background: "#FFFFFF", border: `1px solid #E5E7EB`, borderRadius: 8, boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)" }} className="glass-panel">
              <button onClick={extractFromScreenshots} disabled={extracting || screenshots.length === 0} style={glowBtn(T.purple, extracting || !screenshots.length)} className="btn-glass">
                {extracting ? "ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³ READING..." : "ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â° EXTRACT INDICATORS"}
              </button>
            </div>

            <div style={cardS()} className="glass-panel card-tilt">
              <label style={lbl}>NOTES</label>
              <textarea value={f.notes} onChange={e => sf('notes')(e.target.value)} style={{ ...inp, minHeight: 60, resize: "vertical" }} className="input-glass" />
            </div>

            {err && (
              <div style={{ color: T.red, fontSize: 13, marginBottom: 16, fontWeight: 600, padding: "12px 16px", background: "rgba(255,69,58,0.1)", borderRadius: 8 }}>
                ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â  {err}
              </div>
            )}

            <button onClick={runPart2} disabled={loading || execBlocked} style={glowBtn(T.orange, loading || execBlocked)} className="btn-glass">
              {execBlocked ? `ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â« LOCKED` : "ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ RUN AMD COMPLIANCE + EXECUTION PLAN"}
            </button>

            <div ref={p2Ref} style={{ marginTop: 24 }}>
              {loading && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 240, gap: 16 }}>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 28 }}>
                    {[8, 15, 10, 20, 12, 17, 9].map((h, i) => <div key={i} style={{ width: 4, height: h, background: T.orange, borderRadius: 2, animation: `bar ${0.85 + i * 0.05}s ${i * 0.1}s ease-in-out infinite alternate` }} />)}
                  </div>
                  <span style={{ color: T.muted, fontSize: 12, letterSpacing: 2, fontWeight: 600 }}>RECURSIVE CONSENSUS ENGINE</span>
                  {/* Stage progress indicator */}
                  <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                    {[
                      { key: 'stage1', icon: '\uD83D\uDCE1', label: 'Triple-Front' },
                      { key: 'stage2', icon: '\u2696\uFE0F', label: 'Preliminary' },
                      { key: 'stage3', icon: '\uD83D\uDD0D', label: 'Cross-Exam' },
                      { key: 'stage4', icon: '\uD83C\uDFDB\uFE0F', label: 'Briefing' },
                      { key: 'stage5', icon: '\uD83C\uDFC6', label: 'Verdict' },
                    ].map((s) => {
                      const stages = ['stage1', 'stage2', 'stage3', 'stage4', 'stage5', 'complete'];
                      const ci = stages.indexOf(councilStage.current);
                      const si = stages.indexOf(s.key);
                      const isActive = councilStage.current === s.key;
                      const isDone = ci > si;
                      return (
                        <div key={s.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, opacity: isDone ? 1 : isActive ? 1 : 0.35, transition: 'opacity 0.4s' }}>
                          <div style={{
                            width: 36, height: 36, borderRadius: '50%',
                            background: isDone ? 'rgba(34,197,94,0.15)' : isActive ? 'rgba(249,115,22,0.15)' : 'rgba(255,255,255,0.05)',
                            border: `2px solid ${isDone ? '#22C55E' : isActive ? T.orange : 'rgba(255,255,255,0.1)'}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                            animation: isActive ? 'led-pulse 1.5s ease-in-out infinite' : 'none'
                          }}>
                            {isDone ? '\u2713' : s.icon}
                          </div>
                          <span style={{ fontSize: 9, color: isDone ? '#22C55E' : isActive ? T.orange : T.dim, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' }}>{s.label}</span>
                        </div>
                      );
                    })}
                  </div>
                  <span style={{ fontSize: 11, color: T.orange, fontWeight: 600, letterSpacing: 1, marginTop: 4, animation: 'led-pulse 2s ease-in-out infinite' }}>{councilStage.label}</span>
                </div>
              )}
              {!loading && p2Out && (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <Tag label="EXECUTION PLAN READY" color={T.orange} />
                    <div style={{ display: "flex", gap: 10 }}>
                      <button onClick={() => setShowP2TradeForm(v => !v)} style={glowBtn(T.purple, false)} className="btn-glass">
                        {showP2TradeForm ? "ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ CANCEL" : "+ LOG TRADE"}
                      </button>
                    </div>
                  </div>
                  
                  {showP2TradeForm && (
                    <div style={{ background: "#FFFFFF", border: `1px solid #E5E7EB`, borderRadius: 12, padding: "20px 24px", marginBottom: 20, boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)" }} className="glass-panel">
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 16 }}>
                        <Field label="EXIT PRICE" value={p2Jf.exit} onChange={sp2('exit')} type="number" mono />
                        <Field label="RESULT" value={p2Jf.result} onChange={sp2('result')} options={[{ v: 'win', l: 'ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ Win' }, { v: 'loss', l: 'ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â Loss' }, { v: 'breakeven', l: 'ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â½ BE' }]} />
                        <Field label="AMD PHASE AT TRADE" value={p2Jf.amdPhase} onChange={sp2('amdPhase')} options={Object.keys(AMD_PHASES).map(k => ({ v: k, l: AMD_PHASES[k].label }))} />
                        <Field label="P&L ($)" value={p2Jf.pnl} onChange={sp2('pnl')} type="number" mono />
                        <Field label="BALANCE AFTER ($)" value={p2Jf.balAfter} onChange={sp2('balAfter')} type="number" mono />
                      </div>
                      <button onClick={addP2Trade} style={glowBtn(T.purple, false)} className="btn-glass">+ ADD TO JOURNAL</button>
                    </div>
                  )}
                  
                  <TrafficLight state={trafficState} />
                  
                  <div style={cardS({ borderLeft: `4px solid ${T.orange}` })} className="glass-panel card-tilt">
                    <RenderOut text={p2Out} />
                  </div>
                </div>
              )}
            </div>
          </div>
  );
}

import React from "react";
import {
  T,
  SHead,
  PasteZone,
  cardS,
  glowBtn,
} from "./terminalHelperComponents";
import { CSS_VARS } from "../../styles/cssVars.js";
import { useTerminalOcr, OCR_STATES } from "./useTerminalOcr.js";
import {
  BarChart2,
  Activity,
  LayoutGrid,
} from "lucide-react";

/**
 * MainTerminalImageCapture — screenshot/OCR management and chart paste zones.
 *
 * Props:
 *   screenshots        — ScreenshotImage[]
 *   setScreenshots     — (fn) => void
 *   mpChart            — ChartImage | null
 *   setMpChart         — (img) => void
 *   vwapChart          — ChartImage | null
 *   setVwapChart       — (img) => void
 *   activeZone         — string | null
 *   setActiveZone      — (zoneId) => void
 *   flashingZoneId      — string | null
 *   extractFromScreenshots — () => Promise<void>
 *   handleScreenshotDrop  — (e) => void
 *   makeImgHandler     — (setter) => (e) => void
 *   extracting         — boolean
 *   extractStatus      — string
 *   setExtractedVals   — (fn) => void
 *   showToast          — (msg, type) => void
 */
export default function MainTerminalImageCapture({
  screenshots,
  setScreenshots,
  mpChart,
  setMpChart,
  vwapChart,
  setVwapChart,
  activeZone,
  setActiveZone,
  flashingZoneId,
  extractFromScreenshots,
  handleScreenshotDrop,
  makeImgHandler,
  extracting,
  extractStatus,
  setExtractedVals,
  showToast,
}) {
  // ── OCR hook (owns Tesseract.js state and execution) ────────────────────────
  const { ocrState, runOcr, ocrStatus } = useTerminalOcr({
    screenshots,
    showToast,
    onResult: (ocrValues) => {
      setExtractedVals((prev) => ({ ...prev, ...ocrValues }));
    },
  });

  const isOcrBusy = ocrState === OCR_STATES.LOADING || ocrState === OCR_STATES.SCANNING;

  return (
    <>
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
                /* ── Multi-screenshot paste zone ── */
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
                /* ── Single image paste zone ── */
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
                          background: "var(--status-danger-soft, rgba(255,69,58,0.1))",
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

      {/* AI Extract Buttons */}
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
        {/* Native OCR — local, no API call */}
        <button
          onClick={runOcr}
          disabled={isOcrBusy || screenshots.length === 0}
          style={glowBtn(T.green, isOcrBusy || screenshots.length === 0)}
          className="btn-glass"
        >
          {isOcrBusy ? `⟳ ${ocrStatus}` : `① ${ocrStatus}`}
        </button>

        {/* AI Extract — cloud-powered */}
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
    </>
  );
}

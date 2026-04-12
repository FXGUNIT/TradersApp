/**
 * ImageUploadPanel — extracted from TradeTab.jsx for file size compliance.
 * Three PasteZone areas: INDICATORS (multi screenshot), VWAP CHART, 30-MIN MP CHART.
 */
import React from "react";
import {
  T,
  SHead,
  PasteZone,
  cardS,
} from "./terminalHelperComponents";
import { CSS_VARS } from "../../styles/cssVars.js";
import {
  BarChart2,
  Activity,
  LayoutGrid,
} from "lucide-react";

const dangerTint = "var(--status-danger-soft, rgba(255,69,58,0.1))";

export default function ImageUploadPanel({
  screenshots,
  setScreenshots,
  mpChart,
  setMpChart,
  vwapChart,
  setVwapChart,
  activeZone,
  setActiveZone,
  flashingZoneId,
  isOcrBusy,
  ocrState,
  makeImgHandler,
  handleScreenshotDrop,
}) {
  const zones = [
    {
      zid: "ss",
      icon: BarChart2,
      title: "INDICATORS",
      color: T.purple,
      isMulti: true,
    },
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
  ];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        gap: 16,
        marginBottom: 12,
      }}
    >
      {zones.map((zone) => (
        <PasteZone
          key={zone.zid}
          zoneId={zone.zid}
          activeZone={activeZone}
          setActiveZone={setActiveZone}
          flashingZoneId={flashingZoneId}
          scanningZoneId={isOcrBusy ? zone.zid : null}
          ocrSuccessZoneId={ocrState === "SUCCESS" ? zone.zid : null}
        >
          <div
            data-pastezone="true"
            style={cardS({ margin: 0, borderLeft: `4px solid ${zone.color}` })}
            className="glass-panel"
          >
            <SHead icon={zone.icon} title={zone.title} color={zone.color} />

            {zone.isMulti ? (
              <MultiImageZone
                screenshots={screenshots}
                setScreenshots={setScreenshots}
                handleScreenshotDrop={handleScreenshotDrop}
                color={zone.color}
              />
            ) : (
              <SingleImageZone
                zone={zone}
                makeImgHandler={makeImgHandler}
                dangerTint={dangerTint}
              />
            )}
          </div>
        </PasteZone>
      ))}
    </div>
  );
}

function MultiImageZone({ screenshots, setScreenshots, handleScreenshotDrop, color }) {
  return (
    <div
      data-testid="terminal-screenshot-dropzone"
      onDrop={handleScreenshotDrop}
      onDragOver={(e) => e.preventDefault()}
      style={{
        border: `2px dashed ${screenshots.length ? color : CSS_VARS.borderSubtle}`,
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
                border: `1px solid ${color}60`,
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
      ) : (
        <div style={{ color: T.muted, fontSize: 12, marginBottom: 4, fontWeight: 600 }}>
          Paste or drag screenshots here
        </div>
      )}
    </div>
  );
}

function SingleImageZone({ zone, makeImgHandler, dangerTint }) {
  return (
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
        <div style={{ color: T.muted, fontSize: 12, marginBottom: 4, fontWeight: 600 }}>
          Click → Ctrl+V or drag
        </div>
      )}
    </div>
  );
}

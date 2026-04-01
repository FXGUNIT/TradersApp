import React, { useCallback, useEffect, useRef } from "react";
import { T } from "./terminalHelperComponents.jsx";
import { CSS_VARS } from "../../styles/cssVars.js";

/**
 * RiskSlider — luxury custom risk percentage slider.
 *
 * Replaces the dropdown (0.2 / 0.3 / 0.4) with a continuous, glowing orb
 * on a 1px rail. Dragging updates visual state instantly. A debounced onCommit
 * fires only on mouseUp so Firebase saves don't spam during drag.
 *
 * Physical stop: the slider cannot be dragged past the mathematically computed
 * drawdown limit (maxRiskPct = distanceToLiq / currentBalance * 100).
 *
 * Zone coloring:
 *   0.1 → 25% buffer  : green   (safe zone)
 *   25% → 10% buffer  : blue    (normal zone)
 *   10% → 0% buffer   : gold    (warning zone)
 *   At/above throttle  : red     (throttled — half-risk applied)
 */

export function RiskSlider({
  // Current value (string from form state, e.g. "0.3")
  value,
  // Called on every drag tick — visual only, no Firebase write
  onChange,
  // Called on mouseUp — debounced save to Firebase
  onCommit,
  // ── Account math for physical stop ───────────────────────────────────────
  currentBalance,
  startingBalance,
  highWaterMark,
  maxDrawdown = 0,
  drawdownType = "trailing",
  // ── Derived state for live preview ──────────────────────────────────────
  slPts = 0,
  ptVal = 1,
  throttleActive = false,
  // ── Display options ─────────────────────────────────────────────────────
  min = 0.1,
  max = 1.0,
  step = 0.05,
  color = T.blue,
}) {
  const trackRef = useRef(null);
  const isDragging = useRef(false);
  const committedValue = useRef(parseFloat(value) || 0.3);

  // ── Math helpers ─────────────────────────────────────────────────────────

  const val = parseFloat(value) || 0.3;

  // Physical stop: max risk% = distanceToLiq / currentBalance * 100
  // But cap it at the provided max (prevents going to 0 on small accounts)
  const curBal = parseFloat(currentBalance) || 0;
  const liqLevel =
    drawdownType === "trailing"
      ? (parseFloat(highWaterMark) || curBal) - maxDrawdown
      : (parseFloat(startingBalance) || curBal) - maxDrawdown;
  const distToLiq = Math.max(0, curBal - liqLevel);
  const maxRiskPct = curBal > 0
    ? Math.min(max, Math.max(min, (distToLiq / curBal) * 100))
    : max;

  // Effective risk: halved when throttle is active
  const effectiveRisk = throttleActive ? val / 2 : val;

  // Throttle boundary: risk% at which throttle triggers (distToLiq / curBal * 100 * 0.25)
  const throttleRiskThreshold = curBal > 0
    ? Math.max(0.1, (distToLiq / curBal) * 100 * 0.25)
    : 0;

  // Clamp value to physical stop
  const clampedVal = Math.min(val, maxRiskPct);

  // ── Zone colour: green → blue → gold → red ───────────────────────────────
  const zoneColor = (() => {
    if (throttleActive) return T.red;
    if (maxRiskPct <= 0) return T.red;
    const pct = (val / maxRiskPct) * 100;
    if (pct >= 75) return T.gold;
    if (pct >= 25) return T.blue;
    return T.green;
  })();

  // ── Live preview calculations ─────────────────────────────────────────────

  const riskUSD = (curBal * effectiveRisk) / 100;
  const contracts = slPts > 0 && ptVal > 0
    ? Math.max(1, Math.floor(riskUSD / (slPts * ptVal)))
    : "—";
  const slDollars = slPts > 0 ? (slPts * (contracts === "—" ? 0 : contracts) * ptVal).toFixed(0) : "—";

  // ── Helpers ──────────────────────────────────────────────────────────────

  function valToPercent(v) {
    return ((v - min) / (maxRiskPct - min)) * 100;
  }

  function percentToVal(pct) {
    const raw = min + (pct / 100) * (maxRiskPct - min);
    return Math.round(raw / step) * step;
  }

  function getClientX(e) {
    if (e.touches) return e.touches[0].clientX;
    return e.clientX;
  }

  // ── Drag handlers (mouse + touch) ────────────────────────────────────────

  const handleDrag = useCallback(
    (e) => {
      if (!isDragging.current || !trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const rawPct = Math.max(0, Math.min(100, ((getClientX(e) - rect.left) / rect.width) * 100));
      const newVal = Math.min(percentToVal(rawPct), maxRiskPct);
      // Update visual state immediately
      onChange(String(Math.round(newVal * 100) / 100));
    },
    [onChange, maxRiskPct, min, step],
  );

  const handleDragEnd = useCallback(
    (e) => {
      if (!isDragging.current) return;
      isDragging.current = false;
      document.removeEventListener("mousemove", handleDrag);
      document.removeEventListener("mouseup", handleDragEnd);
      document.removeEventListener("touchmove", handleDrag);
      document.removeEventListener("touchend", handleDragEnd);
      // Commit on mouseUp — only this fires the Firebase save
      if (onCommit) {
        onCommit(value);
      }
    },
    [handleDrag, onCommit, value],
  );

  const handleDragStart = useCallback(
    (e) => {
      e.preventDefault();
      isDragging.current = true;
      committedValue.current = parseFloat(value) || 0.3;
      // Immediately snap to cursor position
      handleDrag(e);
      document.addEventListener("mousemove", handleDrag);
      document.addEventListener("mouseup", handleDragEnd);
      document.addEventListener("touchmove", handleDrag, { passive: false });
      document.addEventListener("touchend", handleDragEnd);
    },
    [handleDrag, handleDragEnd, value],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      document.removeEventListener("mousemove", handleDrag);
      document.removeEventListener("mouseup", handleDragEnd);
      document.removeEventListener("touchmove", handleDrag);
      document.removeEventListener("touchend", handleDragEnd);
    };
  }, [handleDrag, handleDragEnd]);

  // ── Render ────────────────────────────────────────────────────────────────

  const trackPct = valToPercent(clampedVal);
  const thumbPct = valToPercent(Math.min(val, maxRiskPct));
  const isAtLimit = Math.abs(val - maxRiskPct) < step;

  return (
    <div style={{ userSelect: "none" }}>
      {/* ── Header row ─────────────────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ color: T.muted, fontSize: 9, letterSpacing: 2, fontWeight: 700 }}>
            RISK %
          </span>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
            <span
              style={{
                color: zoneColor,
                fontSize: 22,
                fontWeight: 800,
                fontFamily: T.mono,
                letterSpacing: 1,
                transition: "color 0.2s ease",
              }}
            >
              {val.toFixed(2)}
            </span>
            <span style={{ color: T.muted, fontSize: 13, fontWeight: 600 }}>%</span>
          </div>
        </div>

        {/* Zone badge */}
        <div
          style={{
            background: `${zoneColor}20`,
            border: `1px solid ${zoneColor}60`,
            borderRadius: 6,
            padding: "4px 10px",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 1,
            color: zoneColor,
          }}
        >
          {throttleActive
            ? "⛔ THROTTLED"
            : isAtLimit
              ? "⚠ MAX REACHED"
              : `BUFFER ${distToLiq > 0 ? Math.round((distToLiq / curBal) * 100) : 0}%`}
        </div>
      </div>

      {/* ── Slider rail ─────────────────────────────────────────────── */}
      <div
        ref={trackRef}
        onMouseDown={handleDragStart}
        onTouchStart={handleDragStart}
        style={{
          position: "relative",
          height: 4,
          background: CSS_VARS.borderSubtle,
          borderRadius: 2,
          cursor: "pointer",
          marginBottom: 20,
        }}
      >
        {/* Zone gradient: green → blue → gold → red as slider fills */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            height: "100%",
            width: `${trackPct}%`,
            borderRadius: 2,
            background: zoneColor,
            transition: isDragging.current ? "none" : "width 0.15s ease, background 0.2s ease",
            opacity: 0.85,
            boxShadow: `0 0 6px ${zoneColor}80`,
          }}
        />

        {/* Physical stop marker */}
        {valToPercent(maxRiskPct) < 100 && (
          <div
            style={{
              position: "absolute",
              left: `${valToPercent(maxRiskPct)}%`,
              top: -3,
              height: 10,
              width: 2,
              background: `${T.red}80`,
              borderRadius: 1,
              transform: "translateX(-50%)",
            }}
          />
        )}

        {/* Throttle zone marker */}
        {throttleRiskThreshold > min && valToPercent(throttleRiskThreshold) < 100 && (
          <div
            style={{
              position: "absolute",
              left: `${valToPercent(throttleRiskThreshold)}%`,
              top: -2,
              height: 8,
              width: 1,
              background: `${T.gold}60`,
              borderRadius: 1,
              transform: "translateX(-50%)",
            }}
          />
        )}

        {/* ── Glowing orb thumb ──────────────────────────────────── */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: `${thumbPct}%`,
            width: 14,
            height: 14,
            transform: "translate(-50%, -50%)",
            borderRadius: "50%",
            background: zoneColor,
            boxShadow: isDragging.current
              ? `0 0 0 4px ${zoneColor}30, 0 0 16px ${zoneColor}90, 0 0 24px ${zoneColor}60`
              : `0 0 0 3px ${zoneColor}20, 0 0 10px ${zoneColor}70`,
            cursor: isDragging.current ? "grabbing" : "grab",
            transition: isDragging.current ? "none" : "left 0.15s ease, box-shadow 0.2s ease, background 0.2s ease",
            zIndex: 10,
          }}
          onMouseDown={handleDragStart}
          onTouchStart={handleDragStart}
        >
          {/* Inner bright spot */}
          <div
            style={{
              position: "absolute",
              top: "25%",
              left: "25%",
              width: "50%",
              height: "50%",
              borderRadius: "50%",
              background: "rgba(255,255,255,0.5)",
            }}
          />
        </div>
      </div>

      {/* ── Scale labels ──────────────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
        <span style={{ color: T.muted, fontSize: 9, fontWeight: 700, letterSpacing: 1 }}>0.1%</span>
        <span style={{ color: T.muted, fontSize: 9, fontWeight: 700, letterSpacing: 1 }}>
          {throttleActive
            ? `EFF ${effectiveRisk.toFixed(2)}% (throttled)`
            : maxRiskPct < max
              ? `${maxRiskPct.toFixed(1)}% MAX`
              : "0.4% MAX"}
        </span>
      </div>

      {/* ── Live preview ────────────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 10,
          padding: "12px 14px",
          background: `${zoneColor}0a`,
          border: `1px solid ${zoneColor}30`,
          borderRadius: 8,
        }}
      >
        <PreviewCell
          label="CONTRACTS"
          value={contracts}
          unit=""
          color={zoneColor}
        />
        <PreviewCell
          label="SL POINTS"
          value={slPts > 0 ? slPts.toFixed(1) : "—"}
          unit="pts"
          color={zoneColor}
        />
        <PreviewCell
          label="RISK $"
          value={riskUSD > 0 ? `$${riskUSD.toFixed(0)}` : "—"}
          unit=""
          color={zoneColor}
        />
      </div>

      {/* ── Distance to Liquidation bar ───────────────────────────── */}
      {curBal > 0 && liqLevel > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ color: T.muted, fontSize: 9, letterSpacing: 1, fontWeight: 700 }}>
              DISTANCE TO LIQUIDATION
            </span>
            <span style={{ color: zoneColor, fontSize: 9, fontWeight: 700 }}>
              ${distToLiq.toFixed(0)}
            </span>
          </div>
          <div
            style={{
              height: 4,
              background: `${T.red}20`,
              borderRadius: 2,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${Math.min(100, (distToLiq / curBal) * 100)}%`,
                background: zoneColor,
                borderRadius: 2,
                transition: "width 0.2s ease",
                opacity: 0.85,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Small sub-component ───────────────────────────────────────────────────

function PreviewCell({ label, value, unit, color }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ color: T.muted, fontSize: 8, letterSpacing: 1.5, fontWeight: 700, marginBottom: 3 }}>
        {label}
      </div>
      <div style={{ color, fontSize: 16, fontWeight: 800, fontFamily: T.mono, letterSpacing: 1 }}>
        {value}
        {unit && (
          <span style={{ fontSize: 9, fontWeight: 500, marginLeft: 2, color: T.muted }}>
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}

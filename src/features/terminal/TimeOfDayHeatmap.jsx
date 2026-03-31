import React, { useState } from "react";
import { T } from "./terminalHelperComponents";

const CSS_VARS = { statusSuccess: T.green, statusDanger: T.red };

/**
 * TimeOfDayHeatmap — shows P&L heatmap by hour of day (9am–4pm IST).
 *
 * Muted opacity-based shading: win-hours are green-tinted, loss-hours are
 * red-tinted, break-even is neutral. Hovering magnifies the square (scale 1.15).
 *
 * Data shape (from journalMetrics.hourlyProfitMap):
 *   { [hour]: { pnl, wins, losses, count } }
 *   hours 9–16 inclusive
 */
export default function TimeOfDayHeatmap({ hourlyProfitMap }) {
  const [hoveredHour, setHoveredHour] = useState(null);

  if (!hourlyProfitMap || !Object.keys(hourlyProfitMap).length) return null;

  const hours = [9, 10, 11, 12, 13, 14, 15, 16];
  const labels = ["9AM", "10AM", "11AM", "12PM", "1PM", "2PM", "3PM", "4PM"];

  // Find global max |pnl| for colour scaling
  const maxAbs = Math.max(
    1,
    ...hours.map((h) => Math.abs(hourlyProfitMap[h]?.pnl || 0)),
  );

  function hourOpacity(hour) {
    const data = hourlyProfitMap[hour];
    if (!data || data.count === 0) return 0;
    return Math.min(0.85, 0.1 + (data.count / 10) * 0.75);
  }

  function hourBg(hour) {
    const data = hourlyProfitMap[hour];
    if (!data || data.count === 0) return `rgba(255,255,255,0.03)`;
    if (data.pnl > 0) {
      const alpha = hourOpacity(hour);
      return `rgba(34, 197, 94, ${alpha})`; // green
    }
    if (data.pnl < 0) {
      const alpha = hourOpacity(hour);
      return `rgba(255, 69, 58, ${alpha})`; // red
    }
    return `rgba(255, 214, 10, 0.15)`; // gold for breakeven
  }

  function hourBorder(hour) {
    const data = hourlyProfitMap[hour];
    if (!data || data.count === 0) return "1px solid rgba(255,255,255,0.05)";
    if (data.pnl > 0) return `1px solid rgba(34, 197, 94, 0.3)`;
    if (data.pnl < 0) return `1px solid rgba(255, 69, 58, 0.3)`;
    return `1px solid rgba(255, 214, 10, 0.2)`;
  }

  return (
    <div
      style={{
        padding: "14px 16px",
        background: "rgba(0,0,0,0.06)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 10,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <span
          style={{
            color: T.muted,
            fontSize: 10,
            letterSpacing: 2,
            fontWeight: 700,
          }}
        >
          TIME-OF-DAY P&L HEATMAP (IST)
        </span>
        <div style={{ display: "flex", gap: 12 }}>
          {[
            { color: T.green, label: "Win" },
            { color: T.red, label: "Loss" },
            { color: T.gold, label: "BE" },
          ].map(({ color, label }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 2,
                  background: color,
                  opacity: 0.6,
                }}
              />
              <span style={{ color: T.muted, fontSize: 9, fontWeight: 600 }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(8, 1fr)",
          gap: 6,
        }}
      >
        {hours.map((hour, i) => {
          const data = hourlyProfitMap[hour];
          const isHovered = hoveredHour === hour;
          const count = data?.count || 0;
          const pnl = data?.pnl || 0;

          return (
            <div
              key={hour}
              onMouseEnter={() => setHoveredHour(hour)}
              onMouseLeave={() => setHoveredHour(null)}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
                cursor: "default",
                transform: isHovered ? "scale(1.15)" : "scale(1)",
                transition: "transform 0.15s ease",
                transformOrigin: "center center",
                zIndex: isHovered ? 10 : 1,
              }}
            >
              {/* Cell */}
              <div
                style={{
                  width: "100%",
                  aspectRatio: "1",
                  borderRadius: 6,
                  background: hourBg(hour),
                  border: hourBorder(hour),
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "background 0.2s ease, transform 0.15s ease",
                }}
              >
                {count > 0 && (
                  <span
                    style={{
                      color:
                        pnl > 0
                          ? `rgba(34,197,94,${Math.min(1, 0.5 + Math.abs(pnl) / maxAbs * 0.5)})`
                          : pnl < 0
                            ? `rgba(255,69,58,${Math.min(1, 0.5 + Math.abs(pnl) / maxAbs * 0.5)})`
                            : `${T.gold}90`,
                      fontSize: 10,
                      fontWeight: 800,
                      fontFamily: T.mono,
                    }}
                  >
                    {pnl >= 0 ? "+" : ""}
                    {pnl.toFixed(0)}
                  </span>
                )}
              </div>

              {/* Label */}
              <span
                style={{
                  color: T.muted,
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: 0.5,
                  opacity: isHovered ? 1 : 0.7,
                  transition: "opacity 0.15s ease",
                }}
              >
                {labels[i]}
              </span>

              {/* Hover tooltip */}
              {isHovered && count > 0 && (
                <div
                  style={{
                    position: "absolute",
                    bottom: "100%",
                    left: "50%",
                    transform: "translateX(-50%)",
                    background: "rgba(15,23,42,0.95)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: 6,
                    padding: "6px 10px",
                    whiteSpace: "nowrap",
                    zIndex: 100,
                    pointerEvents: "none",
                    marginBottom: 4,
                  }}
                >
                  <div style={{ color: T.blue, fontSize: 10, fontWeight: 800, marginBottom: 2 }}>
                    {labels[i]}
                  </div>
                  <div style={{ color: pnl >= 0 ? T.green : T.red, fontSize: 11, fontWeight: 700 }}>
                    {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}
                  </div>
                  <div style={{ color: T.muted, fontSize: 9 }}>
                    {count} trade{count !== 1 ? "s" : ""} · {data.wins}W / {data.losses}L
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

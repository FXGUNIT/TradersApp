import React from "react";
import { T } from "./terminalHelperComponents";
import { CSS_VARS } from "../../styles/cssVars.js";

const dangerTint = "var(--status-danger-soft, rgba(255,69,58,0.1))";
const surfaceMuted = CSS_VARS.baseLayer;
const surfaceStrong = CSS_VARS.surfaceElevated;

function formatExitPlan(entry) {
  const count = Number.parseInt(entry?.partialExitCount || entry?.partial_exit_count || "0", 10);
  if (Number.isFinite(count) && count > 0) {
    return `${count} legs`;
  }
  return "Single";
}

function formatRemainingQty(entry) {
  const raw = entry?.remainingQty ?? entry?.remaining_qty ?? "";
  if (raw === "" || raw === null || raw === undefined) {
    return "—";
  }
  return String(raw);
}

export default function PaperTradeLogView({ journal = [], setJournal }) {
  if (!Array.isArray(journal) || journal.length === 0) {
    return (
      <div
        style={{
          background: CSS_VARS.card,
          border: `1px solid ${CSS_VARS.borderSubtle}`,
          borderRadius: 12,
          padding: "60px",
          textAlign: "center",
          color: CSS_VARS.textSecondary,
          fontSize: 14,
          fontWeight: 600,
          boxShadow: `0 1px 3px 0 ${CSS_VARS.borderSubtle}`,
        }}
        className="glass-panel"
      >
        No paper trades logged yet
      </div>
    );
  }

  return (
    <div
      style={{
        background: CSS_VARS.card,
        border: `1px solid ${CSS_VARS.borderSubtle}`,
        borderRadius: 12,
        overflow: "hidden",
        boxShadow: `0 1px 3px 0 ${CSS_VARS.borderSubtle}`,
      }}
      className="glass-panel"
    >
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${CSS_VARS.borderSubtle}` }}>
              {["DATE", "INST", "DIR", "AMD", "EXITS", "REMAIN", "ENTRY", "EXIT", "P&L", "RESULT", ""].map(
                (header) => (
                  <th
                    key={header}
                    style={{
                      padding: "14px 16px",
                      textAlign: "left",
                      color: CSS_VARS.textSecondary,
                      fontSize: 10,
                      letterSpacing: 1.5,
                      fontFamily: T.font,
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                      background: surfaceMuted,
                    }}
                  >
                    {header}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {[...journal].reverse().map((entry, index) => {
              const pnlValue = parseFloat(entry.pnl || 0);
              const isWin = entry.result === "win";
              const isLoss = entry.result === "loss";

              return (
                <tr
                  key={entry.id || `${entry.date}-${index}`}
                  style={{
                    borderBottom: `1px solid ${CSS_VARS.borderSubtle}`,
                    background: index % 2 === 0 ? surfaceMuted : surfaceStrong,
                  }}
                >
                  <td
                    style={{
                      padding: "12px 16px",
                      color: CSS_VARS.textSecondary,
                      fontSize: 11,
                      whiteSpace: "nowrap",
                      fontFamily: T.mono,
                    }}
                  >
                    {entry.date}
                  </td>
                  <td
                    style={{
                      padding: "12px 16px",
                      color: CSS_VARS.textPrimary,
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    {entry.instrument}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <span
                      style={{
                        color: entry.direction === "Long" ? T.green : T.red,
                        fontSize: 11,
                        fontWeight: 600,
                      }}
                    >
                      {entry.direction === "Long" ? "BUY" : "SELL"}
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ color: T.gold, fontSize: 10, fontWeight: 600 }}>
                      {entry.amdPhase?.slice(0, 10) || "—"}
                    </span>
                  </td>
                  <td
                    style={{
                      padding: "12px 16px",
                      color: CSS_VARS.textSecondary,
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    {formatExitPlan(entry)}
                  </td>
                  <td
                    style={{
                      padding: "12px 16px",
                      color: CSS_VARS.textSecondary,
                      fontSize: 11,
                      fontFamily: T.mono,
                    }}
                  >
                    {formatRemainingQty(entry)}
                  </td>
                  <td
                    style={{
                      padding: "12px 16px",
                      color: CSS_VARS.textTertiary,
                      fontSize: 11,
                      fontFamily: T.mono,
                    }}
                  >
                    {entry.entry || "—"}
                  </td>
                  <td
                    style={{
                      padding: "12px 16px",
                      color: CSS_VARS.textTertiary,
                      fontSize: 11,
                      fontFamily: T.mono,
                    }}
                  >
                    {entry.exit || "—"}
                  </td>
                  <td
                    style={{
                      padding: "12px 16px",
                      color: pnlValue >= 0 ? T.green : T.red,
                      fontSize: 13,
                      fontWeight: 800,
                      fontFamily: T.mono,
                    }}
                  >
                    {pnlValue >= 0 ? "+" : ""}${pnlValue.toFixed(0)}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <span
                      style={{
                        color: isWin ? T.green : isLoss ? T.red : CSS_VARS.textSecondary,
                        fontSize: 11,
                        fontWeight: 800,
                      }}
                    >
                      {isWin ? "WIN" : isLoss ? "LOSS" : "BE"}
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <button
                      onClick={() =>
                        setJournal((prev) => prev.filter((_, rowIndex) => rowIndex !== journal.length - 1 - index))
                      }
                      style={{
                        background: dangerTint,
                        border: `1px solid ${CSS_VARS.statusDanger}`,
                        borderRadius: 4,
                        cursor: "pointer",
                        color: T.red,
                        fontSize: 10,
                        padding: "4px 8px",
                        fontWeight: 700,
                      }}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

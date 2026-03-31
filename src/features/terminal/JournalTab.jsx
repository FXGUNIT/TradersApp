import React from "react";
import {
  T,
  AMD_PHASES,
  Field,
  glowBtn,
  inp,
  lbl,
} from "./terminalHelperComponents";
import { CSS_VARS } from "../../styles/cssVars.js";
import TerminalJournalOverview from "./TerminalJournalOverview.jsx";
import TimeOfDayHeatmap from "./TimeOfDayHeatmap.jsx";

const dangerTint = "var(--status-danger-soft, rgba(255,69,58,0.1))";
const surfaceMuted = CSS_VARS.baseLayer;
const surfaceStrong = CSS_VARS.surfaceElevated;

export default function JournalTab({
  // State
  journal,
  setJournal,
  jf,
  sjf,
  showForm,
  setShowForm,
  metrics,
  isJournalMetricsPending,
  equityCurveView,
  // Handlers
  addJournalEntry,
}) {
  return (
    <div>
      <TerminalJournalOverview
        equityCurveView={equityCurveView}
        isJournalMetricsPending={isJournalMetricsPending}
        metrics={metrics}
      />

      {/* Time-of-Day P&L Heatmap */}
      {metrics?.hourlyProfitMap && (
        <TimeOfDayHeatmap hourlyProfitMap={metrics.hourlyProfitMap} />
      )}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <span
          style={{
            color: T.muted,
            fontSize: 11,
            letterSpacing: 1.5,
            fontWeight: 700,
          }}
        >
          TRADE HISTORY — {journal.length} ENTRIES
        </span>
        <button
          onClick={() => setShowForm((f) => !f)}
          style={glowBtn(showForm ? T.muted : T.green, false)}
          className="btn-glass"
        >
          {showForm ? "✕ CANCEL" : "+ LOG TRADE"}
        </button>
      </div>

      {showForm && (
        <div
          style={{
            background: surfaceMuted,
            border: `1px solid ${CSS_VARS.borderSubtle}`,
            borderRadius: 10,
            padding: "18px 20px",
            marginBottom: 14,
          }}
        >
          <div
            style={{
              color: T.purple,
              fontSize: 11,
              letterSpacing: 1.5,
              fontWeight: 800,
              marginBottom: 10,
              textTransform: "uppercase",
            }}
          >
            Add Journal Entry
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
              gap: 10,
              marginBottom: 10,
            }}
          >
            <div>
              <label style={lbl}>DATE</label>
              <input
                type="date"
                value={jf.date}
                onChange={(e) => sjf("date")(e.target.value)}
                style={inp}
              />
            </div>
            <div>
              <label style={lbl}>Instrument</label>
              <input
                type="text"
                placeholder="Instrument"
                value={jf.instrument}
                onChange={(e) => sjf("instrument")(e.target.value)}
                style={inp}
                className="input-glass"
              />
            </div>
            <Field
              label="DIRECTION"
              value={jf.direction}
              onChange={sjf("direction")}
              options={[{ v: "Long", l: "↑ Long" }, { v: "Short", l: "↓ Short" }]}
            />
            <Field
              label="TYPE"
              value={jf.tradeType}
              onChange={sjf("tradeType")}
              options={[{ v: "Trend", l: "Trend" }, { v: "MR", l: "Mean Reversion" }]}
            />
            <Field
              label="AMD PHASE"
              value={jf.amdPhase}
              onChange={sjf("amdPhase")}
              options={Object.keys(AMD_PHASES).map((k) => ({
                v: k,
                l: AMD_PHASES[k].label,
              }))}
            />
            <Field
              label="RRR"
              value={jf.rrr}
              onChange={sjf("rrr")}
              options={[
                { v: "1:1", l: "1:1" },
                { v: "1:1.2", l: "1:1.2" },
                { v: "1:2", l: "1:2" },
                { v: "1:2.2", l: "1:2.2" },
              ]}
            />
            <Field
              label="RESULT"
              value={jf.result}
              onChange={sjf("result")}
              options={[
                { v: "win", l: "✓ Win" },
                { v: "loss", l: "✗ Loss" },
                { v: "breakeven", l: "◎ BE" },
              ]}
            />
            <Field
              label="ENTRY"
              placeholder="Entry price"
              value={jf.entry}
              onChange={sjf("entry")}
              type="number"
              mono
            />
            <Field
              label="PRED TP1"
              placeholder="Predicted TP1"
              value={jf.predictedTP1}
              onChange={sjf("predictedTP1")}
              type="number"
              mono
            />
            <Field
              label="ACTUAL EXIT"
              placeholder="Exit price"
              value={jf.exit}
              onChange={sjf("exit")}
              type="number"
              mono
            />
            <Field
              label="P&L ($)"
              placeholder="P&L"
              value={jf.pnl}
              onChange={sjf("pnl")}
              type="number"
              mono
            />
            <Field
              label="BAL AFTER ($)"
              value={jf.balAfter}
              onChange={sjf("balAfter")}
              type="number"
              mono
            />
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={lbl}>NOTES</label>
            <textarea
              value={jf.lessons}
              onChange={(e) => sjf("lessons")(e.target.value)}
              placeholder="Audit journal entry."
              style={{ ...inp, minHeight: 88, resize: "vertical" }}
              className="input-glass"
            />
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              onClick={() => {
                addJournalEntry();
                setShowForm(false);
              }}
              style={glowBtn(T.green, false)}
              className="btn-glass"
            >
              SAVE ENTRY
            </button>
            <button
              onClick={() => setJournal((prev) => prev.slice(0, -1))}
              style={glowBtn(T.red, journal.length === 0)}
              className="btn-glass"
              disabled={journal.length === 0}
            >
              Remove
            </button>
          </div>
        </div>
      )}

      {journal.length === 0 ? (
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
          No trades logged yet
        </div>
      ) : (
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
                  {["DATE", "INST", "DIR", "TYPE", "AMD", "ENTRY", "EXIT", "P&L", "RESULT", ""].map(
                    (h, i) => (
                      <th
                        key={i}
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
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {[...journal].reverse().map((t, i) => {
                  const pv = parseFloat(t.pnl || 0);
                  const isW = t.result === "win";
                  const isL = t.result === "loss";
                  return (
                    <tr
                      key={i}
                      style={{
                        borderBottom: `1px solid ${CSS_VARS.borderSubtle}`,
                        background: i % 2 === 0 ? surfaceMuted : surfaceStrong,
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
                        {t.date}
                      </td>
                      <td
                        style={{
                          padding: "12px 16px",
                          color: CSS_VARS.textPrimary,
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      >
                        {t.instrument}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span
                          style={{
                            color: t.direction === "Long" ? T.green : T.red,
                            fontSize: 11,
                            fontWeight: 600,
                          }}
                        >
                          {t.direction === "Long" ? "BUY" : "SELL"}
                        </span>
                      </td>
                      <td
                        style={{
                          padding: "12px 16px",
                          color: T.blue,
                          fontSize: 11,
                          fontWeight: 500,
                        }}
                      >
                        {t.tradeType}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span style={{ color: T.gold, fontSize: 10, fontWeight: 600 }}>
                          {t.amdPhase?.slice(0, 10)}
                        </span>
                      </td>
                      <td
                        style={{
                          padding: "12px 16px",
                          color: CSS_VARS.textTertiary,
                          fontSize: 11,
                          fontFamily: T.mono,
                        }}
                      >
                        {t.entry || "—"}
                      </td>
                      <td
                        style={{
                          padding: "12px 16px",
                          color: CSS_VARS.textTertiary,
                          fontSize: 11,
                          fontFamily: T.mono,
                        }}
                      >
                        {t.exit || "—"}
                      </td>
                      <td
                        style={{
                          padding: "12px 16px",
                          color: pv >= 0 ? T.green : T.red,
                          fontSize: 13,
                          fontWeight: 800,
                          fontFamily: T.mono,
                        }}
                      >
                        {pv >= 0 ? "+" : ""}${pv.toFixed(0)}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <span
                          style={{
                            color: isW ? T.green : isL ? T.red : CSS_VARS.textSecondary,
                            fontSize: 11,
                            fontWeight: 800,
                          }}
                        >
                          {isW ? "WIN" : isL ? "LOSS" : "BE"}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <button
                          onClick={() =>
                            setJournal((prev) => prev.filter((_, idx) => idx !== journal.length - 1 - i))
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
                          ✕
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

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
import PaperTradeLogView from "./PaperTradeLogView.jsx";
import TimeOfDayHeatmap from "./TimeOfDayHeatmap.jsx";
import { computePayoutTrajectory } from "./journalMetrics.js";

const surfaceMuted = CSS_VARS.baseLayer;

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
  // Payout projection
  firmRules = {},
  accountState: _accountState = {},
}) {
  // Payout trajectory — derived from journal + firmRules (no new computation, pure math)
  const payout = computePayoutTrajectory(journal, firmRules);

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

      {/* Payout Trajectory Projection */}
      {payout && payout.eligible && payout.pctToTarget > 0 && (
        <div
          style={{
            padding: "12px 20px",
            background: "rgba(0,0,0,0.06)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 10,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 8,
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
              PAYOUT TRAJECTORY
            </span>
            <span
              style={{
                color: T.gold,
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: 1,
              }}
            >
              {payout.pctToTarget >= 100
                ? "✓ TARGET REACHED"
                : payout.projectedDay
                  ? `Targeting Day ${payout.projectedDay}`
                  : "Projecting…"}
            </span>
          </div>
          {/* Progress bar */}
          <div
            style={{
              height: 4,
              background: "rgba(255,255,255,0.06)",
              borderRadius: 2,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${Math.min(100, payout.pctToTarget)}%`,
                background: payout.pctToTarget >= 100 ? T.green : T.gold,
                borderRadius: 2,
                transition: "width 0.5s ease",
                opacity: 0.8,
              }}
            />
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: 6,
            }}
          >
            <span style={{ color: T.muted, fontSize: 9, fontWeight: 600, letterSpacing: 1 }}>
              Day {payout.currentDay}
            </span>
            <span style={{ color: T.gold, fontSize: 9, fontWeight: 700, letterSpacing: 1 }}>
              {payout.totalNet >= 0 ? "+" : ""}${payout.totalNet?.toFixed(0)} net · avg ${payout.avgDailyNet?.toFixed(1)}/day
            </span>
            <span style={{ color: T.muted, fontSize: 9, fontWeight: 600, letterSpacing: 1 }}>
              ${payout.targetDays} day target
            </span>
          </div>
        </div>
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
              label="PARTIAL EXITS"
              placeholder="0"
              value={jf.partialExitCount}
              onChange={sjf("partialExitCount")}
              type="number"
              mono
            />
            <Field
              label="EXIT QTY"
              placeholder="Qty closed early"
              value={jf.partialExitQty}
              onChange={sjf("partialExitQty")}
              type="number"
              mono
            />
            <Field
              label="EXIT P&L ($)"
              placeholder="Partial exit P&L"
              value={jf.partialExitPnl}
              onChange={sjf("partialExitPnl")}
              type="number"
              mono
            />
            <Field
              label="REMAINING QTY"
              placeholder="Open runner qty"
              value={jf.remainingQty}
              onChange={sjf("remainingQty")}
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

      <PaperTradeLogView journal={journal} setJournal={setJournal} />
    </div>
  );
}

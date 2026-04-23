import React from "react";
import {
  AMD_PHASES,
  Field,
  Tag,
  RenderOut,
  TrafficLight,
  cardS,
  glowBtn,
} from "./terminalHelperComponents";
import { CSS_VARS } from "../../styles/cssVars.js";
import VerdictSynthesis from "./VerdictSynthesis.jsx";

export default function P2TradeForm({
  p2Jf,
  sp2,
  showP2TradeForm,
  setShowP2TradeForm,
  p2Out,
  p2Ref,
  predictedP2TP1,
  predictedP2SL,
  loading,
  addP2Trade,
  err: _err,
  setErr: _setErr,
  trafficState,
  verdictScores,
}) {
  return (
    <div ref={p2Ref} style={{ marginTop: 24 }}>
      {/* Loading skeleton */}
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
          <div
            style={{ display: "flex", gap: 4, alignItems: "flex-end", height: 28 }}
          >
            {[8, 15, 10, 20, 12, 17, 9].map((h, i) => (
              <div
                key={i}
                style={{
                  width: 4,
                  height: h,
                  background: "var(--status-orange, #ff9500)",
                  borderRadius: 2,
                  animation: `bar ${0.85 + i * 0.05}s ${i * 0.1}s ease-in-out infinite alternate`,
                }}
              />
            ))}
          </div>
          <span
            style={{
              color: "var(--text-muted, #8e8e93)",
              fontSize: 12,
              letterSpacing: 2,
              fontWeight: 600,
            }}
          >
            RECURSIVE CONSENSUS ENGINE
          </span>
        </div>
      )}

      {/* Output panel — shown when not loading and p2Out exists */}
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
            <Tag label="EXECUTION PLAN READY" color="var(--status-orange, #ff9500)" />
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setShowP2TradeForm((v) => !v)}
                style={glowBtn("var(--status-purple, #bf5af2)", false)}
                className="btn-glass"
              >
                {showP2TradeForm ? "CANCEL" : "+ LOG TRADE"}
              </button>
            </div>
          </div>

          {/* Collapsible P2 trade entry form */}
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
                    { v: "win", l: "Win" },
                    { v: "loss", l: "Loss" },
                    { v: "breakeven", l: "BE" },
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
                  label="PARTIAL EXITS"
                  value={p2Jf.partialExitCount}
                  onChange={sp2("partialExitCount")}
                  type="number"
                  mono
                />
                <Field
                  label="EXIT QTY"
                  value={p2Jf.partialExitQty}
                  onChange={sp2("partialExitQty")}
                  type="number"
                  mono
                />
                <Field
                  label="EXIT P&L ($)"
                  value={p2Jf.partialExitPnl}
                  onChange={sp2("partialExitPnl")}
                  type="number"
                  mono
                />
                <Field
                  label="REMAINING QTY"
                  value={p2Jf.remainingQty}
                  onChange={sp2("remainingQty")}
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
              <div
                style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 16 }}
              >
                <Tag
                  label={`Pred TP1: ${
                    Number.isFinite(predictedP2TP1)
                      ? predictedP2TP1.toFixed(2)
                      : "—"
                  }`}
                  color="var(--status-green, #30d158)"
                />
                <Tag
                  label={`Pred SL: ${
                    Number.isFinite(predictedP2SL)
                      ? predictedP2SL.toFixed(2)
                      : "—"
                  }`}
                  color="var(--status-red, #ff453a)"
                />
              </div>
              <button
                onClick={addP2Trade}
                style={glowBtn("var(--status-purple, #bf5af2)", false)}
                className="btn-glass"
              >
                + ADD TO JOURNAL
              </button>
            </div>
          )}
        </div>
      )}

      {/* TrafficLight + RenderOut sit in the parent, not this form — shown via parent */}

      {trafficState && <TrafficLight state={trafficState} />}

      {p2Out && (
        <div
          style={cardS({ borderLeft: `4px solid var(--status-orange, #ff9500)` })}
          className="glass-panel card-tilt"
        >
          <RenderOut text={p2Out} />
        </div>
      )}

      <VerdictSynthesis verdictScores={verdictScores} />
    </div>
  );
}

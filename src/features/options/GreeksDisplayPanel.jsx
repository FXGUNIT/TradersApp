import React from "react";
import { Activity } from "lucide-react";
import { SectionCard } from "../consensus/SectionCard.jsx";
import { formatPercent, formatPrice, formatSigned } from "./optionsMetrics.js";

function GreekColumn({ title, leg, color }) {
  return (
    <div
      style={{
        display: "grid",
        gap: 8,
        padding: "12px",
        borderRadius: 12,
        background: "rgba(255,255,255,0.03)",
        border: "1px solid var(--border-subtle, rgba(255,255,255,0.08))",
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.5, color, textTransform: "uppercase" }}>
        {title}
      </div>
      <div style={{ display: "grid", gap: 6 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>Premium</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>
            {formatPrice(leg?.lastPrice, { currency: "INR" })}
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>Delta</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>
            {formatSigned(leg?.delta)}
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>Gamma</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>
            {formatSigned(leg?.gamma)}
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>Theta</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>
            {formatSigned(leg?.theta)}
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>Vega</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>
            {formatSigned(leg?.vega)}
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>IV</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>
            {formatPercent(leg?.impliedVolatility)}
          </span>
        </div>
      </div>
    </div>
  );
}

export const GreeksDisplayPanel = React.memo(function GreeksDisplayPanel({
  atmRow,
  chainSource = "unavailable",
}) {
  const call = atmRow?.call || null;
  const put = atmRow?.put || null;
  const hasGreeks = Boolean(call || put);

  return (
    <SectionCard title="Greeks Snapshot" icon={Activity} accent="rgba(255,204,0,0.82)">
      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ fontSize: 11, lineHeight: 1.6, color: "var(--text-secondary)" }}>
          {chainSource === "bff"
            ? "ATM call and put greeks from the live chain."
            : "Live option-chain greeks are unavailable. This panel will populate once the BFF options route responds."}
        </div>

        {hasGreeks ? (
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
            <GreekColumn title="ATM Call" leg={call} color="#30D158" />
            <GreekColumn title="ATM Put" leg={put} color="#FF9F0A" />
          </div>
        ) : (
          <div className="cc-empty-panel">
            No live greeks returned yet.
          </div>
        )}
      </div>
    </SectionCard>
  );
});

export default GreeksDisplayPanel;

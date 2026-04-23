import React from "react";
import { Layers3 } from "lucide-react";
import { SectionCard } from "../consensus/SectionCard.jsx";
import { formatPrice } from "./optionsMetrics.js";

function formatOi(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "-";
  }

  return new Intl.NumberFormat("en-IN", {
    notation: value >= 100000 ? "compact" : "standard",
    maximumFractionDigits: value >= 100000 ? 1 : 0,
  }).format(value);
}

export const OptionsStrikePanel = React.memo(function OptionsStrikePanel({
  rows = [],
  atmStrike = null,
  selectedExpiry = null,
  chainSource = "unavailable",
}) {
  return (
    <SectionCard title="Strike Ladder" icon={Layers3} accent="rgba(10,132,255,0.82)">
      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ fontSize: 11, lineHeight: 1.6, color: "var(--text-secondary)" }}>
          {selectedExpiry
            ? `Monitoring the ${selectedExpiry} chain.`
            : "Expiry not selected yet."}{" "}
          {chainSource === "bff"
            ? "Live quotes shown where available."
            : "Quotes are unavailable, so the ladder is showing strike structure only."}
        </div>

        {rows.length > 0 ? (
          <div style={{ display: "grid", gap: 8 }}>
            {rows.map((row) => {
              const isAtm = atmStrike !== null && row?.strike === atmStrike;
              return (
                <div
                  key={`${selectedExpiry || "na"}-${row?.strike || "strike"}`}
                  style={{
                    display: "grid",
                    gap: 8,
                    gridTemplateColumns: "1fr auto 1fr",
                    alignItems: "center",
                    padding: "10px 12px",
                    borderRadius: 12,
                    background: isAtm ? "rgba(10,132,255,0.08)" : "rgba(255,255,255,0.03)",
                    border: isAtm
                      ? "1px solid rgba(10,132,255,0.45)"
                      : "1px solid var(--border-subtle, rgba(255,255,255,0.08))",
                  }}
                >
                  <div style={{ display: "grid", gap: 3 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#30D158" }}>
                      CALL
                    </div>
                    <div style={{ fontSize: 13, color: "var(--text-primary)" }}>
                      {formatPrice(row?.call?.lastPrice, { currency: "INR" })}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--text-tertiary)" }}>
                      OI {formatOi(row?.call?.openInterest)}
                    </div>
                  </div>

                  <div style={{ display: "grid", gap: 3, textAlign: "center" }}>
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 800,
                        letterSpacing: 1.4,
                        textTransform: "uppercase",
                        color: isAtm ? "#0A84FF" : "var(--text-secondary)",
                      }}
                    >
                      {isAtm ? "ATM" : "Strike"}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text-primary)" }}>
                      {row?.strike ?? "-"}
                    </div>
                  </div>

                  <div style={{ display: "grid", gap: 3, textAlign: "right" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#FF9F0A" }}>
                      PUT
                    </div>
                    <div style={{ fontSize: 13, color: "var(--text-primary)" }}>
                      {formatPrice(row?.put?.lastPrice, { currency: "INR" })}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--text-tertiary)" }}>
                      OI {formatOi(row?.put?.openInterest)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="cc-empty-panel">
            Strike data is not available yet.
          </div>
        )}
      </div>
    </SectionCard>
  );
});

export default OptionsStrikePanel;

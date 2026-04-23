import React from "react";
import { Waves } from "lucide-react";
import { SectionCard } from "../consensus/SectionCard.jsx";
import { MetricRow } from "../consensus/MetricRow.jsx";
import { formatPercent } from "./optionsMetrics.js";

export const VolRegimeIndicator = React.memo(function VolRegimeIndicator({
  regime,
  expectedMove,
}) {
  return (
    <SectionCard title="Volatility Regime" icon={Waves} accent={regime?.tone || "rgba(10,132,255,0.82)"}>
      <MetricRow
        icon={Waves}
        label="Regime"
        value={regime?.label || "Balanced"}
        sub="Derived from feature volatility regime plus option IV"
        color={regime?.tone || "var(--text-primary)"}
      />
      <MetricRow
        icon={Waves}
        label="Average IV"
        value={formatPercent(regime?.averageIv)}
      />
      <MetricRow
        icon={Waves}
        label="Realized Vol"
        value={formatPercent(regime?.realizedVol)}
      />
      <MetricRow
        icon={Waves}
        label="Sweep Probability"
        value={formatPercent(regime?.sweepProb)}
        sub={
          typeof expectedMove?.uncertainty_band === "number"
            ? `Uncertainty band ±${(expectedMove.uncertainty_band / 2).toFixed(0)} ticks`
            : "Using current session feature vector"
        }
      />
      <div
        style={{
          marginTop: 8,
          padding: "10px 12px",
          borderRadius: 10,
          background: "rgba(10,132,255,0.05)",
          border: "1px solid rgba(10,132,255,0.14)",
          fontSize: 11,
          lineHeight: 1.6,
          color: "var(--text-secondary)",
        }}
      >
        {regime?.summary || "Volatility context will populate once the options chain responds."}
      </div>
    </SectionCard>
  );
});

export default VolRegimeIndicator;

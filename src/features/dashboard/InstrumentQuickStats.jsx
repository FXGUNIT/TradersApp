import React from "react";
import { Layers3, ShieldCheck, Waypoints } from "lucide-react";
import { SectionCard } from "../consensus/SectionCard.jsx";
import { MetricRow } from "../consensus/MetricRow.jsx";

export function InstrumentQuickStats({ activeInstrument, consensus }) {
  const instrument = consensus?.instrument || activeInstrument;
  const modelCount = Array.isArray(instrument?.models) ? instrument.models.length : 0;
  const circuitState = consensus?.circuitBreakerState || "closed";

  return (
    <SectionCard title="Instrument Intel" icon={Layers3} accent="var(--aura-amd-manipulation, #7C3AED)">
      <MetricRow
        icon={Layers3}
        label="Instrument"
        value={instrument?.label || instrument?.symbol || "NIFTY"}
        sub={instrument?.market || instrument?.sessionType || "NSE"}
        color="var(--aura-amd-manipulation, #7C3AED)"
      />
      <MetricRow
        icon={Waypoints}
        label="Model Stack"
        value={`${modelCount} models`}
        sub={instrument?.timeframe ? `${instrument.timeframe} routing` : "Consensus routing"}
      />
      <MetricRow
        icon={ShieldCheck}
        label="Circuit Breaker"
        value={String(circuitState).toUpperCase()}
        sub={circuitState === "open" ? "Request protection active" : "Requests flowing normally"}
      />
    </SectionCard>
  );
}

export default InstrumentQuickStats;

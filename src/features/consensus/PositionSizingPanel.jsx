import React from "react";
import { Clock, DollarSign, Layers3 } from "lucide-react";
import { getLotSize, getOptionsUnderlying } from "../options/optionsMetrics.js";
import { SectionCard } from "./SectionCard.jsx";
import { MetricRow } from "./MetricRow.jsx";

export const PositionSizingPanel = React.memo(function PositionSizingPanel({
  position_sizing,
  instrument,
}) {
  if (!position_sizing) return null;

  const throttled = position_sizing.drawdown_throttled;
  const isOptionsInstrument = String(instrument?.symbol || "").toUpperCase() === "NSEOPTIONS";
  const optionsUnderlying = isOptionsInstrument ? getOptionsUnderlying(instrument) : null;
  const lotSize = isOptionsInstrument ? getLotSize(optionsUnderlying) : null;

  return (
    <SectionCard title="Position Sizing" icon={DollarSign} accent="rgba(48,209,88,0.8)">
      <MetricRow
        icon={DollarSign}
        label={isOptionsInstrument ? "Model Units" : "Contracts"}
        value={position_sizing.contracts || 1}
        color="#30D158"
        sub={isOptionsInstrument ? "Futures-native sizing output" : undefined}
      />
      <MetricRow
        icon={DollarSign}
        label="Risk / Trade"
        value={`$${(position_sizing.risk_per_trade_dollars || 0).toFixed(0)}`}
        sub={`${((position_sizing.risk_pct_of_account || 0) * 100).toFixed(2)}% of account`}
      />
      <MetricRow
        icon={DollarSign}
        label="Kelly Fraction"
        value={`${((position_sizing.kelly_fraction || 0) * 100).toFixed(0)}%`}
        sub="Half-Kelly applied"
      />
      {isOptionsInstrument && (
        <MetricRow
          icon={Layers3}
          label="Option Lot Size"
          value={`${lotSize || 0} units`}
          sub={`${optionsUnderlying || "NIFTY"} lot reference for derivatives execution`}
        />
      )}
      <MetricRow
        icon={Clock}
        label="Max Wait"
        value={`${position_sizing.max_wait_minutes || 30} min`}
        sub={throttled ? "Drawdown throttle: SIZE HALVED" : "Normal sizing"}
        color={throttled ? "#FF453A" : undefined}
      />
      {isOptionsInstrument && (
        <div
          style={{
            marginTop: 8,
            padding: "10px 12px",
            borderRadius: 10,
            background: "rgba(48,209,88,0.06)",
            border: "1px solid rgba(48,209,88,0.15)",
            fontSize: 11,
            lineHeight: 1.6,
            color: "var(--text-secondary)",
          }}
        >
          Options routing is active, but the current sizing engine still emits futures-native risk units.
          Validate lot count, premium outlay, and broker margin before sending an options order.
        </div>
      )}
    </SectionCard>
  );
});

export default PositionSizingPanel;

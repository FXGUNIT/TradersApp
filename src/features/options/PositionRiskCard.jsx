import React from "react";
import { ShieldAlert } from "lucide-react";
import { SectionCard } from "../consensus/SectionCard.jsx";
import { MetricRow } from "../consensus/MetricRow.jsx";
import { formatPrice, getBiasOptionType, getLotSize } from "./optionsMetrics.js";

function getBreakEven(leg, signal) {
  if (!leg?.strike || !leg?.lastPrice) {
    return null;
  }

  return signal === "LONG"
    ? leg.strike + leg.lastPrice
    : signal === "SHORT"
      ? leg.strike - leg.lastPrice
      : null;
}

export const PositionRiskCard = React.memo(function PositionRiskCard({
  symbol = "NIFTY",
  signal = "NEUTRAL",
  biasLeg,
  positionSizing,
}) {
  const lotSize = getLotSize(symbol);
  const biasType = getBiasOptionType(signal);
  const premiumPerLot = biasLeg?.lastPrice ? biasLeg.lastPrice * lotSize : null;
  const breakEven = getBreakEven(biasLeg, signal);
  const modelRiskBudget = positionSizing?.risk_per_trade_dollars ?? null;

  return (
    <SectionCard title="Position Risk" icon={ShieldAlert} accent="rgba(255,69,58,0.8)">
      <MetricRow
        icon={ShieldAlert}
        label="Bias Structure"
        value={biasType || "WAIT"}
        sub={biasLeg?.tradingSymbol || "Awaiting live option quote"}
        color="#FF453A"
      />
      <MetricRow
        icon={ShieldAlert}
        label="Lot Size"
        value={`${lotSize} units`}
        sub="Exchange lot size"
      />
      <MetricRow
        icon={ShieldAlert}
        label="Premium / Lot"
        value={formatPrice(premiumPerLot, { currency: "INR" })}
        sub={premiumPerLot !== null ? "Maximum loss for a long single-leg entry" : "Needs live option premium"}
      />
      <MetricRow
        icon={ShieldAlert}
        label="Break-even"
        value={formatPrice(breakEven)}
        sub={breakEven !== null ? "Strike plus/minus premium" : "Available when live premium is present"}
      />
      <MetricRow
        icon={ShieldAlert}
        label="Model Risk Budget"
        value={
          typeof modelRiskBudget === "number"
            ? `$${modelRiskBudget.toFixed(0)}`
            : "—"
        }
        sub="Current sizing engine remains futures-native; validate broker margin before execution"
      />
    </SectionCard>
  );
});

export default PositionRiskCard;

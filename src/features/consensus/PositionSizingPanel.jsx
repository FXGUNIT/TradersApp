/**
 * PositionSizingPanel — Contracts, risk, Kelly fraction panel
 * Extracted from CollectiveConsciousness.jsx (I06)
 */
import React from 'react';
import { DollarSign, Clock } from 'lucide-react';
import { SectionCard } from './SectionCard.jsx';
import { MetricRow } from './MetricRow.jsx';

export const PositionSizingPanel = React.memo(function PositionSizingPanel({ position_sizing }) {
  if (!position_sizing) return null;
  const throttled = position_sizing.drawdown_throttled;
  return (
    <SectionCard title="Position Sizing" icon={DollarSign} accent="rgba(48,209,88,0.8)">
      <MetricRow
        icon={DollarSign} label="Contracts"
        value={position_sizing.contracts || 1}
        color="#30D158"
      />
      <MetricRow
        icon={DollarSign} label="Risk / Trade"
        value={`$${(position_sizing.risk_per_trade_dollars || 0).toFixed(0)}`}
        sub={`${((position_sizing.risk_pct_of_account || 0) * 100).toFixed(2)}% of account`}
      />
      <MetricRow
        icon={DollarSign} label="Kelly Fraction"
        value={`${((position_sizing.kelly_fraction || 0) * 100).toFixed(0)}%`}
        sub="Half-Kelly applied"
      />
      <MetricRow
        icon={Clock} label="Max Wait"
        value={`${position_sizing.max_wait_minutes || 30} min`}
        sub={throttled ? 'Drawdown throttle: SIZE HALVED' : 'Normal sizing'}
        color={throttled ? '#FF453A' : undefined}
      />
    </SectionCard>
  );
});

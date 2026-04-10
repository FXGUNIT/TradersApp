/**
 * ExitStrategyPanel — ML-determined exit strategy (stop, TP1, TP2, trailing)
 * Extracted from CollectiveConsciousness.jsx (I06)
 */
import React from 'react';
import { Shield, Clock } from 'lucide-react';
import { SectionCard } from './SectionCard.jsx';
import { MetricRow } from './MetricRow.jsx';

export const ExitStrategyPanel = React.memo(function ExitStrategyPanel({ exit_plan }) {
  if (!exit_plan) return null;
  return (
    <SectionCard title="Exit Strategy (ML)" icon={Shield} accent="rgba(124,58,237,0.8)">
      <MetricRow
        icon={Shield} label="Strategy"
        value={exit_plan.strategy || 'ML-DETERMINED'}
        color="rgba(124,58,237,0.9)"
      />
      <MetricRow
        icon={Shield} label="Stop Loss"
        value={`${exit_plan.stop_loss_ticks || 20} ticks`}
      />
      <MetricRow
        icon={Shield} label="TP1 — Close"
        value={`${((exit_plan.tp1_pct || 0) * 100).toFixed(0)}% @ ${exit_plan.tp1_ticks || 0}t`}
      />
      <MetricRow
        icon={Shield} label="TP2 — Close"
        value={`${((exit_plan.tp2_pct || 0) * 100).toFixed(0)}% @ ${exit_plan.tp2_ticks || 0}t`}
      />
      <MetricRow
        icon={Shield} label="Trailing Distance"
        value={`${exit_plan.trailing_distance_ticks || 0} ticks`}
        sub={`activate at ${exit_plan.trail_activate_at_ticks || 0}t in profit`}
      />
      <MetricRow
        icon={Clock} label="Max Hold"
        value={`${exit_plan.max_hold_minutes || 60} min`}
      />
    </SectionCard>
  );
});

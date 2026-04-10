/**
 * ExpectedMovePanel — Conservative/Expected/Aggressive move ticks
 * Extracted from CollectiveConsciousness.jsx (I06)
 */
import React from 'react';
import { Target } from 'lucide-react';
import { SectionCard } from './SectionCard.jsx';
import { MetricRow } from './MetricRow.jsx';

export const ExpectedMovePanel = React.memo(function ExpectedMovePanel({ expected_move }) {
  if (!expected_move) return null;
  return (
    <SectionCard title="Expected Move" icon={Target} accent="rgba(10,132,255,0.8)">
      <MetricRow
        icon={Target} label="Conservative"
        value={`${expected_move.conservative_ticks || 0} ticks`}
        sub="25th percentile"
      />
      <MetricRow
        icon={Target} label="Expected"
        value={`${expected_move.expected_ticks || 0} ticks`}
        sub="50th percentile (median)"
        color="#30D158"
      />
      <MetricRow
        icon={Target} label="Aggressive"
        value={`${expected_move.aggressive_ticks || 0} ticks`}
        sub="75th percentile"
      />
      <MetricRow
        icon={Target} label="Uncertainty Band"
        value={`±${((expected_move.uncertainty_band || 0) / 2).toFixed(0)} ticks`}
        sub="IQR width / 2"
      />
    </SectionCard>
  );
});

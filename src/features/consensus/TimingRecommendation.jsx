/**
 * TimingRecommendation — Entry timing, best window, P(profitable) panel
 * Extracted from CollectiveConsciousness.jsx (I06)
 */
import React from 'react';
import { Clock, Activity, Award } from 'lucide-react';
import { SectionCard } from './SectionCard.jsx';
import { MetricRow } from './MetricRow.jsx';

export const TimingRecommendation = React.memo(function TimingRecommendation({ timing }) {
  if (!timing) return null;
  return (
    <SectionCard title="Entry Timing" icon={Clock} accent="rgba(10,132,255,0.8)">
      <MetricRow
        icon={Clock} label="Enter Now"
        value={timing.enter_now ? 'YES' : 'WAIT'}
        color={timing.enter_now ? '#30D158' : '#FF453A'}
      />
      <MetricRow
        icon={Activity} label="P(Profitable Now)"
        value={`${((timing.P_profitable_entry_now || 0.5) * 100).toFixed(0)}%`}
      />
      <MetricRow
        icon={Award} label="Best Window"
        value={timing.best_entry_window || '—'}
      />
      {timing.candle_close_entry !== false && (
        <MetricRow
          icon={Clock} label="Wait for Candle Close"
          value="ALWAYS"
          sub="Never enter mid-candle"
          muted
        />
      )}
    </SectionCard>
  );
});

/**
 * RRRRecommendation — Risk:Reward Ratio panel
 * Extracted from CollectiveConsciousness.jsx (I06)
 */
import React from 'react';
import { Target } from 'lucide-react';
import { SectionCard } from './SectionCard.jsx';
import { MetricRow } from './MetricRow.jsx';

export const RRRRecommendation = React.memo(function RRRRecommendation({ rrr }) {
  if (!rrr) return null;
  return (
    <SectionCard title="Risk:Reward Ratio" icon={Target} accent="rgba(255,159,10,0.8)">
      <MetricRow
        icon={Target} label="Recommended R:R"
        value={`1:${(rrr.recommended_rr || 2).toFixed(1)}`}
        color="#FF9F0A"
      />
      <MetricRow
        icon={Target} label="Expected Win Rate"
        value={`${((rrr.expected_win_rate || 0.5) * 100).toFixed(0)}%`}
      />
      <MetricRow
        icon={Target} label="Profit Factor"
        value={(rrr.profit_factor || 1).toFixed(2)}
      />
      <MetricRow
        icon={Target} label="Confidence"
        value={`${((rrr.confidence || 0) * 100).toFixed(0)}%`}
        sub={`Based on ${rrr.sample_size || 0} trades`}
      />
      {rrr.why_this_rr && (
        <div style={{
          marginTop: 8, padding: '8px 10px', borderRadius: 8,
          background: 'rgba(255,159,10,0.06)',
          border: '1px solid rgba(255,159,10,0.15)',
          fontSize: 10.5, color: 'var(--text-secondary)',
          lineHeight: 1.5,
        }}>
          {rrr.why_this_rr}
        </div>
      )}
    </SectionCard>
  );
});

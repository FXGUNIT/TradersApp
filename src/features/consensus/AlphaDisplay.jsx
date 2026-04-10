/**
 * AlphaDisplay — Alpha score, confidence, stability panel
 * Extracted from CollectiveConsciousness.jsx (I06)
 */
import React from 'react';
import { Activity, Award } from 'lucide-react';
import { SectionCard } from './SectionCard.jsx';
import { MetricRow } from './MetricRow.jsx';

export const AlphaDisplay = React.memo(function AlphaDisplay({ alpha }) {
  if (!alpha) return null;
  return (
    <SectionCard title="Alpha Score" icon={Activity} accent="rgba(255,204,0,0.8)">
      <MetricRow
        icon={Activity} label="Alpha Ticks"
        value={`${(alpha.alpha_score || 0).toFixed(1)}`}
        sub="Edge over random per trade"
        color={alpha.alpha_score > 0 ? '#30D158' : '#FF453A'}
      />
      <MetricRow
        icon={Activity} label="Confidence"
        value={`${((alpha.alpha_confidence || 0) * 100).toFixed(0)}%`}
      />
      <MetricRow
        icon={Activity} label="Stability"
        value={`${((alpha.alpha_stability || 0) * 100).toFixed(0)}%`}
        sub="% rolling windows with +alpha"
      />
      <MetricRow
        icon={Award} label="Best Window"
        value={alpha.best_alpha_window || '—'}
      />
    </SectionCard>
  );
});

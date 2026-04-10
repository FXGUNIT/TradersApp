/**
 * SessionProbabilityPanel — Current session context + best alpha window
 * Extracted from CollectiveConsciousness.jsx (I06)
 */
import React from 'react';
import { Clock, Activity, Award } from 'lucide-react';
import { SectionCard } from './SectionCard.jsx';
import { MetricRow } from './MetricRow.jsx';

const SESSION_NAMES = ['Pre-Market', 'Main Trading', 'Post-Market'];
const SESSION_COLORS = ['rgba(255,159,10,0.7)', 'rgba(10,132,255,0.9)', 'rgba(124,58,237,0.9)'];

export const SessionProbabilityPanel = React.memo(function SessionProbabilityPanel({ session }) {
  const sessionId = session?.id ?? 1;
  const accent = SESSION_COLORS[sessionId] || SESSION_COLORS[1];
  return (
    <SectionCard title="Session" icon={Clock} accent={accent}>
      <MetricRow
        icon={Clock} label="Current Session"
        value={session?.name || SESSION_NAMES[sessionId] || 'Main Trading'}
        color={accent}
      />
      <MetricRow
        icon={Activity} label="Session Progress"
        value={`${((session?.session_pct || 0) * 100).toFixed(0)}%`}
        sub={`${session?.minutes_into_session || 0} min elapsed`}
      />
      <MetricRow
        icon={Award} label="Best Alpha Window"
        value="10:00–11:30 ET"
        sub="Historical edge: 5–6 ticks avg"
      />
    </SectionCard>
  );
});

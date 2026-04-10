/**
 * VoteItem — Individual model vote display row
 * Extracted from CollectiveConsciousness.jsx (I06)
 */
import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { SIGNAL_COLOR_MAP } from './SignalBadge.jsx';

export const VoteItem = React.memo(function VoteItem({ name, signal, confidence, reason }) {
  const c = SIGNAL_COLOR_MAP[signal] || SIGNAL_COLOR_MAP.NEUTRAL;
  const Icon = signal === 'LONG' ? TrendingUp : signal === 'SHORT' ? TrendingDown : Minus;
  return (
    <div style={{
      padding: '8px 0',
      borderBottom: '1px solid var(--border-subtle)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
          {name}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <Icon size={12} color={c.text} />
          <span style={{ fontSize: 11, fontWeight: 700, color: c.text }}>
            {signal}
          </span>
          {confidence != null && (
            <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
              {(confidence * 100).toFixed(0)}%
            </span>
          )}
        </div>
      </div>
      {reason && (
        <div style={{ fontSize: 10, color: 'var(--text-tertiary)', lineHeight: 1.4 }}>
          {reason}
        </div>
      )}
    </div>
  );
});

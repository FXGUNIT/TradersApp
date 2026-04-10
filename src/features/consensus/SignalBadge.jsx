/**
 * SignalBadge — Consensus Signal Display
 * Extracted from CollectiveConsciousness.jsx (I06)
 */
import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

const SIGNAL_COLORS = {
  LONG: { bg: 'rgba(48,209,88,0.08)', border: 'rgba(48,209,88,0.3)', text: '#30D158', label: 'LONG' },
  SHORT: { bg: 'rgba(255,69,58,0.08)', border: 'rgba(255,69,58,0.3)', text: '#FF453A', label: 'SHORT' },
  NEUTRAL: { bg: 'rgba(100,100,100,0.08)', border: 'rgba(100,100,100,0.2)', text: '#8E8E93', label: 'NEUTRAL' },
};

export const SIGNAL_COLOR_MAP = SIGNAL_COLORS;

export const SignalBadge = React.memo(function SignalBadge({ signal, confidence }) {
  const c = SIGNAL_COLORS[signal] || SIGNAL_COLORS.NEUTRAL;
  const Icon = signal === 'LONG' ? TrendingUp : signal === 'SHORT' ? TrendingDown : Minus;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '8px 16px', borderRadius: 12,
      background: c.bg, border: `1.5px solid ${c.border}`,
    }}>
      <Icon size={18} color={c.text} />
      <span style={{ fontSize: 15, fontWeight: 800, color: c.text, letterSpacing: 1 }}>
        {c.label}
      </span>
      {confidence != null && (
        <span style={{ fontSize: 11, color: c.text, opacity: 0.8, marginLeft: 4 }}>
          {(confidence * 100).toFixed(0)}%
        </span>
      )}
    </div>
  );
});

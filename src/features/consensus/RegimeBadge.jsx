/**
 * RegimeBadge — Compact regime state badge
 * Extracted from CollectiveConsciousness.jsx (I06)
 */
import React from 'react';
import { Gauge } from 'lucide-react';

export const REGIME_COLORS = {
  COMPRESSION: '#0A84FF',
  NORMAL:      '#30D158',
  EXPANSION:   '#FF9F0A',
  CRISIS:      '#FF453A',
};

export const RegimeBadge = React.memo(function RegimeBadge({ regime }) {
  const color = REGIME_COLORS[regime] || REGIME_COLORS.NORMAL;
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px',
      borderRadius: 20,
      background: `${color}22`,
      border: `1px solid ${color}`,
    }}>
      <Gauge size={12} color={color} />
      <span style={{ fontSize: 11, fontWeight: 800, color, letterSpacing: 1 }}>
        {regime || '—'}
      </span>
    </div>
  );
});

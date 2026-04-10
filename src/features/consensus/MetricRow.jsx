/**
 * MetricRow — Key/value display row for consensus panels
 * Extracted from CollectiveConsciousness.jsx (I06)
 */
import React from 'react';

export const MetricRow = React.memo(function MetricRow({ icon: Icon, label, value, sub, color = 'var(--text-primary)', muted }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '7px 0',
      borderBottom: '1px solid var(--border-subtle, rgba(255,255,255,0.06))',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icon size={13} color={muted ? 'var(--text-tertiary)' : 'var(--text-secondary)'} />
        <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>
          {label}
        </span>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: muted ? 'var(--text-tertiary)' : color }}>
          {value || '—'}
        </div>
        {sub && (
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 1 }}>
            {sub}
          </div>
        )}
      </div>
    </div>
  );
});

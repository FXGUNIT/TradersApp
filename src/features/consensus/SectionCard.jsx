/**
 * SectionCard — Glass-card wrapper for consensus panels
 * Extracted from CollectiveConsciousness.jsx (I06)
 */
import React from 'react';

export const SectionCard = React.memo(function SectionCard({ title, icon: Icon, children, accent }) {
  return (
    <div style={{
      background: 'var(--surface-glass, rgba(255,255,255,0.03))',
      border: `1px solid ${accent || 'var(--border-subtle)'}`,
      borderRadius: 14,
      padding: '14px 16px',
      marginBottom: 12,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 7,
        marginBottom: 12,
        paddingBottom: 10,
        borderBottom: '1px solid var(--border-subtle)',
      }}>
        {Icon && <Icon size={14} color={accent || 'var(--text-secondary)'} />}
        <span style={{
          fontSize: 10, fontWeight: 800, letterSpacing: 2,
          color: accent || 'var(--text-secondary)',
          textTransform: 'uppercase',
        }}>
          {title}
        </span>
      </div>
      {children}
    </div>
  );
});

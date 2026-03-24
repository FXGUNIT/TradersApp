import React from 'react';

const Breadcrumbs = ({ items, onNavigate }) => {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '12px 32px',
      borderBottom: '1px solid rgba(255,255,255,0.1)',
      background: 'rgba(0,0,0,0.3)',
      overflowX: 'auto'
    }}>
      {items.map((item, idx) => (
        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => item.onNavigate && onNavigate(item.path)}
            style={{
              background: item.active ? 'rgba(0,122,255,0.2)' : 'transparent',
              border: 'none',
              color: item.active ? '#0A84FF' : '#8E8E93',
              cursor: item.onNavigate ? 'pointer' : 'default',
              fontSize: 11,
              fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
              fontWeight: 700,
              letterSpacing: 1,
              padding: '4px 8px',
              borderRadius: 4,
              transition: 'all 0.2s ease',
              pointerEvents: item.onNavigate ? 'auto' : 'none'
            }}
            onMouseEnter={e => {
              if (item.onNavigate && !item.active) {
                e.currentTarget.style.background = 'rgba(0,122,255,0.1)';
                e.currentTarget.style.color = '#0A84FF';
              }
            }}
            onMouseLeave={e => {
              if (item.onNavigate && !item.active) {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = '#8E8E93';
              }
            }}
            title={item.label}
          >
            {item.icon} {item.label}
          </button>
          {idx < items.length - 1 && (
            <span style={{ color: '#3A3A3C', fontSize: 10 }}>›</span>
          )}
        </div>
      ))}
    </div>
  );
};

export default Breadcrumbs;

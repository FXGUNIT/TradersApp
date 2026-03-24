import React from 'react';

const AiEnginesStatus = ({ statuses = [true, true, true, true] }) => {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 12, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>AI ENGINES</span>
      {statuses.map((ok, idx) => (
        <span 
          key={idx} 
          title={`Engine ${idx+1}`} 
          style={{ 
            width: 10, 
            height: 10, 
            borderRadius: 6, 
            display: 'inline-block', 
            background: ok ? '#22c55e' : '#f87171', 
            boxShadow: ok ? '0 0 6px #34d399' : 'none' 
          }} 
        />
      ))}
    </div>
  );
};

export default AiEnginesStatus;

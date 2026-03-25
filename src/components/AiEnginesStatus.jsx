import React from 'react';

const AI_ENGINE_NAMES = ['Gemini', 'Groq', 'OpenRouter', 'Cerebras', 'DeepSeek', 'SambaNova'];

const AiEnginesStatus = ({ statuses = [true, true, true, true, true, true] }) => {
  const normalizedStatuses = statuses.length >= 6 ? statuses : [...statuses, ...Array(6 - statuses.length).fill(true)];
  
  const offlineIndices = normalizedStatuses.map((ok, idx) => ok ? -1 : idx).filter(idx => idx >= 0);
  const liveIndices = normalizedStatuses.map((ok, idx) => ok ? idx : -1).filter(idx => idx >= 0);
  
  const offlineCount = offlineIndices.length;
  
  const displayOfflineIndicators = offlineCount > 3 ? 1 : Math.min(offlineCount, 3);
  
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 12, color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>AI</span>
      {liveIndices.map(idx => (
        <span 
          key={`live-${idx}`} 
          title={`${AI_ENGINE_NAMES[idx]}: Online`} 
          style={{ 
            width: 10, 
            height: 10, 
            borderRadius: 6, 
            display: 'inline-block', 
            background: '#22c55e', 
            boxShadow: '0 0 6px #34d399'
          }} 
        />
      ))}
      {displayOfflineIndicators > 0 && Array(displayOfflineIndicators).fill(0).map((_, i) => (
        <span 
          key={`offline-${i}`} 
          title={offlineCount > 3 ? `${offlineCount} AI engines offline` : `${AI_ENGINE_NAMES[offlineIndices[i]]}: Offline`}
          style={{ 
            width: 10, 
            height: 10, 
            borderRadius: 6, 
            display: 'inline-block', 
            background: '#f87171', 
            boxShadow: 'none'
          }} 
        />
      ))}
    </div>
  );
};

export default AiEnginesStatus;

import React, { useState } from 'react';

const CommandPalette = ({ isOpen, onClose, users, onJumpToUser, onToggleGhostMode, ghostMode, showToast }) => {
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  
  if (!isOpen) return null;
  
  const commands = [
    {
      id: 'ghost-mode',
      label: ghostMode ? '👁️ Disable Ghost Mode' : '👁️ Enable Ghost Mode',
      category: 'Settings',
      action: () => onToggleGhostMode()
    },
    {
      id: 'refresh-users',
      label: '↺ Refresh User List',
      category: 'Data',
      action: () => showToast('Refreshing user data...', 'info')
    },
    {
      id: 'export-users',
      label: '💾 Export Users (CSV)', 
      category: 'Data',
      action: () => showToast('Export feature coming soon!', 'info')
    }
  ];
  
  const userCommands = Object.entries(users || {}).map(([uid, user]) => ({
    id: `user-${uid}`,
    label: `👤 ${user.fullName || 'Unknown'} (${user.email || 'no-email'})`,
    category: 'Users',
    action: () => onJumpToUser(uid),
    metadata: { uid, user }
  }));
  
  const allCommands = [...commands, ...userCommands];
  
  const queryLower = query.toLowerCase();
  const filtered = allCommands.filter(cmd =>
    cmd.label.toLowerCase().includes(queryLower) ||
    cmd.category.toLowerCase().includes(queryLower)
  );
  
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx(Math.min(selectedIdx + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx(Math.max(selectedIdx - 1, 0));
    } else if (e.key === 'Enter' && filtered[selectedIdx]) {
      e.preventDefault();
      filtered[selectedIdx].action();
      onClose();
      setQuery('');
      setSelectedIdx(0);
    }
  };
  
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '20vh',
        zIndex: 2000,
        animation: 'fadeInDashboard 0.15s ease-out'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: '#0A0E27',
          borderRadius: 12,
          border: '1px solid rgba(0,122,255,0.3)',
          width: '90%',
          maxWidth: '600px',
          maxHeight: '70vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0,0,0,0.8)',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <input
            autoFocus
            type="text"
            placeholder="⌘ Search users, commands..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIdx(0);
            }}
            onKeyDown={handleKeyDown}
            style={{
              width: '100%',
              background: 'rgba(0,0,0,0.4)',
              border: '1px solid rgba(0,122,255,0.3)',
              borderRadius: 6,
              padding: '12px 16px',
              color: '#F2F2F7',
              fontSize: 14,
              fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
              outline: 'none',
              transition: 'all 0.2s ease'
            }}
          />
        </div>
        
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: '#8E8E93' }}>
              <div style={{ fontSize: 20, marginBottom: 8 }}>∅</div>
              <div style={{ fontSize: 12 }}>No commands or users match "{query}"</div>
            </div>
          ) : (
            filtered.map((cmd, idx) => (
              <div
                key={cmd.id}
                onClick={() => {
                  cmd.action();
                  onClose();
                  setQuery('');
                  setSelectedIdx(0);
                }}
                style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                  background: selectedIdx === idx ? 'rgba(0,122,255,0.15)' : 'transparent',
                  cursor: 'pointer',
                  transition: 'background 0.15s ease',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
                onMouseEnter={() => setSelectedIdx(idx)}
              >
                <div>
                  <div style={{ color: '#F2F2F7', fontSize: 13, fontWeight: 500 }}>{cmd.label}</div>
                  <div style={{ color: '#3A3A3C', fontSize: 10, marginTop: 2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    {cmd.category}
                  </div>
                </div>
                <div style={{ color: '#8E8E93', fontSize: 10, fontWeight: 600 }}>
                  {selectedIdx === idx && '⏎'}
                </div>
              </div>
            ))
          )}
        </div>
        
        <div style={{ padding: '8px 16px', background: 'rgba(0,122,255,0.05)', borderTop: '1px solid rgba(255,255,255,0.1)', fontSize: 10, color: '#8E8E93' }}>
          <span style={{ marginRight: 16 }}>↑↓ Navigate</span>
          <span style={{ marginRight: 16 }}>⏎ Select</span>
          <span>ESC Close</span>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;

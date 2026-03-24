import React, { useState } from 'react';

const UserSwitcher = ({ users, currentViewAsUser, onSwitchUser, ghostMode }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  const currentUser = currentViewAsUser 
    ? Object.entries(users || {}).find(([uid]) => uid === currentViewAsUser)?.[1]
    : null;
  
  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: ghostMode ? 'rgba(0,255,127,0.15)' : currentViewAsUser ? 'rgba(0,122,255,0.15)' : 'transparent',
          border: `1px solid ${ghostMode ? 'rgba(0,255,127,0.4)' : currentViewAsUser ? 'rgba(0,122,255,0.4)' : 'rgba(255,255,255,0.2)'}`,
          borderRadius: 6,
          padding: '8px 12px',
          cursor: 'pointer',
          color: ghostMode ? '#00FF7F' : currentViewAsUser ? '#0A84FF' : '#8E8E93',
          fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 1,
          transition: 'all 0.2s ease-in-out',
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}
        onMouseEnter={e => {
          if (!currentViewAsUser && !ghostMode) {
            e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)';
          }
        }}
        onMouseLeave={e => {
          if (!currentViewAsUser && !ghostMode) {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
          }
        }}
        title={currentViewAsUser ? `Viewing as: ${currentUser?.fullName}` : 'Switch to view as another user'}
      >
        <span>{ghostMode ? '👻' : currentViewAsUser ? '👁️' : '👥'}</span>
        <span>{ghostMode ? 'GHOST' : currentViewAsUser ? `AS: ${currentUser?.fullName?.split(' ')[0].toUpperCase()}` : 'SHADOW MODE'}</span>
      </button>
      
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 4,
            background: 'rgba(20,20,20,0.95)',
            border: '1px solid rgba(0,122,255,0.3)',
            borderRadius: 6,
            padding: '8px 0',
            minWidth: '200px',
            maxHeight: '300px',
            overflowY: 'auto',
            zIndex: 1001,
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {currentViewAsUser && (
            <button
              onClick={() => {
                onSwitchUser(null);
                setIsOpen(false);
              }}
              style={{
                width: '100%',
                padding: '8px 16px',
                background: 'rgba(255,69,58,0.15)',
                border: 'none',
                cursor: 'pointer',
                color: '#FF453A',
                fontSize: 10,
                fontWeight: 600,
                textAlign: 'left',
                borderBottom: '1px solid rgba(255,69,58,0.2)',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,69,58,0.25)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,69,58,0.15)'}
            >
              ✕ Exit Shadow Mode
            </button>
          )}
          
          {Object.entries(users || {}).slice(0, 20).map(([uid, user]) => (
            <button
              key={uid}
              onClick={() => {
                onSwitchUser(uid);
                setIsOpen(false);
              }}
              style={{
                width: '100%',
                padding: '8px 16px',
                background: currentViewAsUser === uid ? 'rgba(0,122,255,0.2)' : 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: currentViewAsUser === uid ? '#0A84FF' : '#8E8E93',
                fontSize: 10,
                fontWeight: 600,
                textAlign: 'left',
                transition: 'all 0.15s ease',
                borderBottom: '1px solid rgba(255,255,255,0.05)'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(0,122,255,0.15)';
                e.currentTarget.style.color = '#F2F2F7';
              }}
              onMouseLeave={e => {
                if (currentViewAsUser !== uid) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = '#8E8E93';
                }
              }}
            >
              <div style={{ fontSize: 9, fontWeight: 700 }}>👤 {user.fullName || 'Unknown'}</div>
              <div style={{ fontSize: 8, color: '#3A3A3C', marginTop: 2 }}>{user.email || 'no-email'}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default UserSwitcher;

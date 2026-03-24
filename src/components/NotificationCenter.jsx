import React, { useState, useEffect } from 'react';

const NotificationCenter = ({ isOpen, onClose, notifications = [] }) => {
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  const isMobile = windowWidth < 768;
  
  if (isMobile) {
    if (!isOpen) return null;
    
    return (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.9)',
          zIndex: 1001,
          display: 'flex',
          flexDirection: 'column',
          animation: 'fadeInDashboard 0.3s ease-out',
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)'
        }}
      >
        <div
          style={{
            padding: '16px',
            borderBottom: '1px solid rgba(0,122,255,0.3)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <div style={{ color: '#0A84FF', fontSize: 16, fontWeight: 700, letterSpacing: 1 }}>
            🔔 NOTIFICATIONS
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#8E8E93',
              fontSize: 20,
              cursor: 'pointer',
              padding: '4px 8px'
            }}
          >
            ✕
          </button>
        </div>
        
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
          {notifications.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#8E8E93', paddingTop: '32px' }}>
              <div style={{ fontSize: 32, marginBottom: 16 }}>🔇</div>
              <div style={{ fontSize: 12, fontWeight: 600 }}>No new notifications</div>
            </div>
          ) : (
            notifications.map((notif, idx) => (
              <div
                key={idx}
                style={{
                  padding: '12px',
                  background: 'rgba(0,122,255,0.1)',
                  border: '1px solid rgba(0,122,255,0.2)',
                  borderRadius: 6,
                  marginBottom: 12,
                  color: '#F2F2F7',
                  fontSize: 12
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: 4 }}>{notif.title}</div>
                <div style={{ color: '#8E8E93', fontSize: 11 }}>{notif.message}</div>
                <div style={{ color: '#3A3A3C', fontSize: 10, marginTop: 6 }}>{notif.time}</div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }
  
  if (!isOpen) return null;
  
  return (
    <div
      style={{
        position: 'fixed',
        right: 0,
        top: 0,
        bottom: 0,
        width: '320px',
        background: 'rgba(20,20,20,0.95)',
        borderLeft: '1px solid rgba(0,122,255,0.3)',
        zIndex: 1001,
        display: 'flex',
        flexDirection: 'column',
        animation: 'slideInToast 0.3s ease-out',
        backdropFilter: 'blur(10px)'
      }}
    >
      <div
        style={{
          padding: '16px',
          borderBottom: '1px solid rgba(0,122,255,0.3)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0
        }}
      >
        <div style={{ color: '#0A84FF', fontSize: 14, fontWeight: 700, letterSpacing: 1 }}>
          ALERTS
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#8E8E93',
            fontSize: 18,
            cursor: 'pointer',
            padding: '4px 8px',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={e => e.currentTarget.style.color = '#0A84FF'}
          onMouseLeave={e => e.currentTarget.style.color = '#8E8E93'}
        >
          ✕
        </button>
      </div>
      
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
        {notifications.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#8E8E93', paddingTop: '48px' }}>
            <div style={{ fontSize: 32, marginBottom: 16 }}>🔇</div>
            <div style={{ fontSize: 11, fontWeight: 600 }}>No alerts</div>
          </div>
        ) : (
          notifications.map((notif, idx) => (
            <div
              key={idx}
              style={{
                padding: '12px',
                background: 'rgba(0,122,255,0.1)',
                border: '1px solid rgba(0,122,255,0.2)',
                borderRadius: 6,
                marginBottom: 12,
                color: '#F2F2F7',
                fontSize: 11
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 4 }}>{notif.title}</div>
              <div style={{ color: '#8E8E93', fontSize: 10 }}>{notif.message}</div>
              <div style={{ color: '#3A3A3C', fontSize: 9, marginTop: 6 }}>{notif.time}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default NotificationCenter;

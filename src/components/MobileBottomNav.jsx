import React, { useState, useEffect } from 'react';

const MobileBottomNav = ({ currentPage, onNavigate }) => {
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  const isMobile = windowWidth < 768;
  
  if (!isMobile) return null;
  
  const navItems = [
    { icon: '📊', label: 'Dashboard', id: 'dashboard' },
    { icon: '👥', label: 'Users', id: 'users' },
    { icon: '🔔', label: 'Alerts', id: 'alerts' },
    { icon: '⚙️', label: 'Settings', id: 'settings' }
  ];
  
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: '60px',
        background: 'rgba(20,20,20,0.95)',
        borderTop: '1px solid rgba(0,122,255,0.3)',
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        zIndex: 999,
        backdropFilter: 'blur(10px)',
        paddingBottom: 'max(0px, env(safe-area-inset-bottom))'
      }}
    >
      {navItems.map(item => (
        <button
          key={item.id}
          onClick={() => onNavigate(item.id)}
          style={{
            background: currentPage === item.id ? 'rgba(0,122,255,0.2)' : 'transparent',
            border: 'none',
            borderTop: currentPage === item.id ? '2px solid #0A84FF' : 'none',
            cursor: 'pointer',
            color: currentPage === item.id ? '#0A84FF' : '#8E8E93',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
            padding: '8px 12px',
            fontSize: 10,
            fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
            fontWeight: 700,
            letterSpacing: 0.5,
            transition: 'all 0.2s ease',
            width: '100%'
          }}
          onMouseEnter={e => {
            if (currentPage !== item.id) {
              e.currentTarget.style.color = '#0A84FF';
              e.currentTarget.style.background = 'rgba(0,122,255,0.1)';
            }
          }}
          onMouseLeave={e => {
            if (currentPage !== item.id) {
              e.currentTarget.style.color = '#8E8E93';
              e.currentTarget.style.background = 'transparent';
            }
          }}
        >
          <span style={{ fontSize: 18 }}>{item.icon}</span>
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
};

export default MobileBottomNav;

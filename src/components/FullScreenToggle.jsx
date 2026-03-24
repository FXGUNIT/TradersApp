import React, { useState, useEffect } from 'react';

const FullScreenToggle = ({ showToast }) => {
  const [isFullScreen, setIsFullScreen] = useState(false);
  
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = document.fullscreenElement !== null;
      setIsFullScreen(isCurrentlyFullscreen);
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);
  
  const toggleFullScreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen().catch(err => {
          console.warn('Fullscreen request denied:', err);
          showToast?.('Fullscreen mode is sleeping. Wake it later.', 'warning');
        });
        setIsFullScreen(true);
        showToast?.('Viewport expanded. Immersive mode engaged. [ESC] to exit.', 'success');
      } else {
        await document.exitFullscreen();
        setIsFullScreen(false);
        showToast?.('📺 Full-Screen Mode Disabled', 'info');
      }
    } catch (error) {
      console.error('Fullscreen toggle error:', error);
      showToast?.('Fullscreen dimension unavailable. Adjust your timeline.', 'error');
    }
  };
  
  return (
    <button 
      onClick={toggleFullScreen}
      style={{
        background: isFullScreen ? "rgba(0,122,255,0.2)" : "transparent",
        border: `1px solid ${isFullScreen ? "rgba(0,122,255,0.5)" : "rgba(255,255,255,0.2)"}`,
        borderRadius: 6,
        padding: "8px 12px",
        cursor: "pointer",
        color: isFullScreen ? '#0A84FF' : '#8E8E93',
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 1,
        transition: "all 0.2s ease-in-out",
        display: 'flex',
        alignItems: 'center',
        gap: 6
      }}
      onMouseEnter={e => {
        if (!isFullScreen) {
          e.currentTarget.style.background = "rgba(255,255,255,0.05)";
          e.currentTarget.style.borderColor = "rgba(255,255,255,0.3)";
          e.currentTarget.style.transform = "translateY(-2px)";
        }
      }}
      onMouseLeave={e => {
        if (!isFullScreen) {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)";
          e.currentTarget.style.transform = "translateY(0)";
        }
      }}
      title={isFullScreen ? "Exit Full-Screen (ESC)" : "Enter Full-Screen Mode"}
    >
      ⛶
    </button>
  );
};

export default FullScreenToggle;

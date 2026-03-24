import React from 'react';

const LoadingOverlay = ({ isLoading, message = 'Syncing with Database...' }) => {
  if (!isLoading) return null;
  
  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: "rgba(0,0,0,0.4)",
      backdropFilter: "blur(8px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1000,
      pointerEvents: "none"
    }}>
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 16,
        background: "rgba(20,20,20,0.95)",
        borderRadius: 12,
        padding: "40px",
        border: `1px solid rgba(0,122,255,0.2)`,
        pointerEvents: "auto",
        boxShadow: "0 8px 32px rgba(0,0,0,0.6)"
      }}>
        <div style={{
          width: 40,
          height: 40,
          borderRadius: "50%",
          border: "3px solid rgba(0,122,255,0.2)",
          borderTopColor: '#0A84FF',
          animation: "spin 1s linear infinite",
          pointerEvents: "none"
        }} />
        
        <div style={{
          color: '#0A84FF',
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: 1,
          textTransform: "uppercase",
          animation: "pulse 2s ease-in-out infinite"
        }}>
          ⚡ {message}
        </div>
      </div>
    </div>
  );
};

export default LoadingOverlay;

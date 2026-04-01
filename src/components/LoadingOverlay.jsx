import React from 'react';
import { Zap } from 'lucide-react';
import { CSS_VARS } from "../styles/cssVars.js";

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
        border: `1px solid ${CSS_VARS.accentPrimary}30`,
        pointerEvents: "auto",
        boxShadow: "0 8px 32px rgba(0,0,0,0.6)"
      }}>
        <div style={{
          width: 40,
          height: 40,
          borderRadius: "50%",
          border: `3px solid ${CSS_VARS.accentPrimary}30`,
          borderTopColor: CSS_VARS.accentPrimary,
          animation: "spin 1s linear infinite",
          pointerEvents: "none"
        }} />

        <div style={{
          color: CSS_VARS.accentPrimary,
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: 1,
          textTransform: "uppercase",
          animation: "pulse 2s ease-in-out infinite",
          display: "flex",
          alignItems: "center",
          gap: 6
        }}>
          <Zap size={14} />
          {message}
        </div>
      </div>
    </div>
  );
};

export default LoadingOverlay;

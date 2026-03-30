import React, { useEffect, useState } from "react";

export default function LoadingFallback() {
  const [dots, setDots] = useState(0);
  const [showVideoFallback, setShowVideoFallback] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((value) => (value + 1) % 4);
    }, 500);

    return () => clearInterval(interval);
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--surface-base, #F9FAFB)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: '"Inter", "Helvetica", sans-serif',
        flexDirection: "column",
        gap: 24,
      }}
    >
      <div
        style={{
          width: 120,
          height: 120,
          borderRadius: "50%",
          overflow: "hidden",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.15)",
          background: "var(--surface-elevated, #FFFFFF)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--accent-warning, #D97706)",
          fontSize: 48,
          fontWeight: 700,
          animation: showVideoFallback ? "shell-loading-spin 1s linear infinite" : "none",
        }}
      >
        {showVideoFallback ? (
          "..."
        ) : (
          <video
            src="/logo.mp4"
            autoPlay
            loop
            muted
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
            onError={() => {
              setShowVideoFallback(true);
            }}
          />
        )}
      </div>

      <div style={{ textAlign: "center" }}>
        <div
          style={{
            color: "var(--text-primary, #111827)",
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: 2,
            marginBottom: 8,
          }}
        >
          {"LOADING".split("").map((char, index) => (
            <span
              key={index}
              style={{
                display: "inline-block",
                animation: `shell-loading-wave 0.6s ease-in-out ${index * 0.1}s infinite`,
                transformOrigin: "center bottom",
              }}
            >
              {char}
            </span>
          ))}
          {"...".padStart(1 + (dots || 0), ".")}
        </div>
        <div
          style={{
            color: "var(--text-secondary, #6B7280)",
            fontSize: 12,
            letterSpacing: 1,
            marginTop: 12,
          }}
        >
          Initializing dashboard · Compiling modules
        </div>
      </div>

      <style>{`
        @keyframes shell-loading-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes shell-loading-wave {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
      `}</style>
    </div>
  );
}

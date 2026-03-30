import React from "react";

function SplashLogo() {
  return (
    <div style={{ textAlign: "center", marginBottom: 36 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 8,
          marginBottom: 20,
        }}
      >
        <img
          src="/logo.png"
          alt="Logo"
          style={{
            borderRadius: "50%",
            overflow: "hidden",
            objectFit: "cover",
            width: 60,
            height: 60,
            border: "none",
            display: "block",
          }}
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />
        <div style={{ textAlign: "left" }}>
          <div
            style={{
              color: "var(--text-primary, #111827)",
              fontSize: "clamp(16px, 3vw, 18px)",
              letterSpacing: 1.5,
              fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
              fontWeight: 700,
            }}
          >
            THE DEPARTMENT OF INSTITUTIONAL ARTILLERY
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SplashScreen() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--surface-elevated, #FFFFFF)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <SplashLogo />
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 5,
            alignItems: "flex-end",
            height: 30,
            marginTop: 24,
          }}
        >
          {[10, 18, 12, 24, 15, 20, 11].map((height, index) => (
            <div
              key={index}
              style={{
                width: 5,
                height,
                background: "var(--accent-success, #10B981)",
                borderRadius: 3,
                animation: `shell-splash-bar 0.85s ${index * 0.1}s ease-in-out infinite alternate`,
              }}
            />
          ))}
        </div>
        <div
          style={{
            color: "var(--text-secondary, #64748B)",
            fontSize: 11,
            letterSpacing: 4,
            marginTop: 16,
            fontWeight: 600,
          }}
        >
          INITIALIZING...
        </div>
      </div>

      <style>{`
        @keyframes shell-splash-bar {
          from { transform: scaleY(0.75); opacity: 0.7; }
          to { transform: scaleY(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

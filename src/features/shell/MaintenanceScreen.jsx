import React, { useEffect, useState } from "react";

export default function MaintenanceScreen() {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    const now = new Date();
    const nextMaintenance = new Date(
      now.getTime() + Math.random() * 4 * 60 * 60 * 1000,
    );

    const updateCountdown = () => {
      const diff = nextMaintenance - new Date();
      if (diff <= 0) {
        setTimeLeft("Returning now...");
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        setTimeLeft(`${hours}h ${minutes}m`);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 30000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--surface-base, #F9FAFB)",
        backdropFilter: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        padding: 20,
        fontFamily: "Consolas, monospace",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: `radial-gradient(circle at 20% 50%, rgba(0,122,255,0.05) 0%, transparent 50%),
                     radial-gradient(circle at 80% 80%, rgba(48,209,88,0.05) 0%, transparent 50%)`,
          animation: "shell-maintenance-fade 4s ease-in-out infinite",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          textAlign: "center",
          maxWidth: 600,
        }}
      >
        <div
          style={{
            fontSize: 80,
            marginBottom: 24,
            animation: "shell-maintenance-float 3s ease-in-out infinite",
          }}
        >
          ...
        </div>

        <h1
          style={{
            color: "var(--text-primary, #F2F2F7)",
            fontSize: 48,
            fontWeight: 800,
            marginBottom: 16,
            letterSpacing: 2,
            textTransform: "uppercase",
            background: "linear-gradient(135deg, #0A84FF 0%, #30D158 100%)",
            backgroundClip: "text",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          BACK SOON
        </h1>

        <div
          style={{
            color: "var(--text-secondary, #A1A1A6)",
            fontSize: 16,
            fontWeight: 600,
            marginBottom: 32,
            letterSpacing: 1,
            lineHeight: 1.6,
          }}
        >
          We&apos;re performing scheduled maintenance to enhance your trading
          experience.
          <br />
          System integrity checks in progress.
        </div>

        <div
          style={{
            background: "rgba(0,122,255,0.1)",
            border: "1px solid rgba(0,122,255,0.3)",
            borderRadius: 12,
            padding: 24,
            marginBottom: 32,
            backdropFilter: "blur(10px)",
          }}
        >
          <div
            style={{
              color: "var(--text-secondary, #A1A1A6)",
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 12,
              letterSpacing: 1,
            }}
          >
            ESTIMATED DOWNTIME
          </div>
          <div
            style={{
              color: "var(--accent-primary, #2563eb)",
              fontSize: 28,
              fontWeight: 800,
              fontFamily: "Consolas, monospace",
              letterSpacing: 2,
            }}
          >
            {timeLeft || "Loading..."}
          </div>
        </div>

        <div
          style={{
            textAlign: "left",
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 8,
            padding: 20,
            marginBottom: 32,
          }}
        >
          <div
            style={{
              color: "#F2F2F7",
              fontSize: 12,
              fontWeight: 700,
              marginBottom: 16,
              letterSpacing: 1,
              textTransform: "uppercase",
            }}
          >
            SYSTEM UPGRADES IN PROGRESS
          </div>
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            {[
              "Optimizing database queries",
              "Enhancing security protocols",
              "Improving performance metrics",
            ].map((item) => (
              <li
                key={item}
                style={{
                  color: "#A1A1A6",
                  fontSize: 12,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span
                  style={{
                    color: "#30D158",
                    fontWeight: 800,
                  }}
                >
                  OK
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div
          style={{
            color: "#5A5A5F",
            fontSize: 12,
            fontWeight: 500,
            letterSpacing: "0.5px",
          }}
        >
          Thank you for your patience. We&apos;re back to full capacity shortly.
          <br />
          <span style={{ marginTop: 8, display: "block" }}>
            Need immediate support?{" "}
            <span style={{ color: "#0A84FF" }}>contact@tradersapp.io</span>
          </span>
        </div>
      </div>

      <style>{`
        @keyframes shell-maintenance-fade {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        @keyframes shell-maintenance-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
      `}</style>
    </div>
  );
}

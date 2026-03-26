import React, { useEffect, useState } from "react";

const overlay = "var(--aura-overlay, rgba(0,0,0,0.7))";
const panelBg = "var(--surface-glass, rgba(18,20,28,0.92))";
const border = "var(--border-subtle, rgba(255,255,255,0.08))";
const accent = "var(--accent-primary, #0A84FF)";
const textPrimary = "var(--text-primary, #F2F2F7)";
const textSecondary = "var(--text-secondary, #94A3B8)";
const textTertiary = "var(--text-tertiary, #64748B)";

const cardStyle = {
  padding: "12px",
  background: "var(--accent-glow, rgba(0,122,255,0.1))",
  border: `1px solid ${border}`,
  borderRadius: 6,
  marginBottom: 12,
  color: textPrimary,
};

export default function NotificationCenter({
  isOpen,
  onClose,
  notifications = [],
}) {
  const [windowWidth, setWindowWidth] = useState(() =>
    typeof window === "undefined" ? 1024 : window.innerWidth,
  );

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const isMobile = windowWidth < 768;

  if (!isOpen) return null;

  if (isMobile) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: overlay,
          zIndex: 1001,
          display: "flex",
          flexDirection: "column",
          animation: "fadeInDashboard 0.3s ease-out",
          paddingTop: "env(safe-area-inset-top)",
          paddingBottom: "env(safe-area-inset-bottom)",
          backdropFilter: "blur(16px)",
        }}
      >
        <div
          style={{
            padding: "16px",
            borderBottom: `1px solid ${border}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: panelBg,
          }}
        >
          <div
            style={{
              color: accent,
              fontSize: 16,
              fontWeight: 700,
              letterSpacing: 1,
            }}
          >
            NOTIFICATIONS
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: textSecondary,
              fontSize: 20,
              cursor: "pointer",
              padding: "4px 8px",
            }}
          >
            x
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
          {notifications.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                color: textSecondary,
                paddingTop: "32px",
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 600 }}>
                No new notifications
              </div>
            </div>
          ) : (
            notifications.map((notif, idx) => (
              <div key={idx} style={cardStyle}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>
                  {notif.title}
                </div>
                <div style={{ color: textSecondary, fontSize: 11 }}>
                  {notif.message}
                </div>
                <div style={{ color: textTertiary, fontSize: 10, marginTop: 6 }}>
                  {notif.time}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        position: "fixed",
        right: 0,
        top: 0,
        bottom: 0,
        width: "320px",
        background: panelBg,
        borderLeft: `1px solid ${border}`,
        zIndex: 1001,
        display: "flex",
        flexDirection: "column",
        animation: "slideInToast 0.3s ease-out",
        backdropFilter: "blur(18px)",
      }}
    >
      <div
        style={{
          padding: "16px",
          borderBottom: `1px solid ${border}`,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            color: accent,
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: 1,
          }}
        >
          ALERTS
        </div>
        <button
          onClick={onClose}
          style={{
            background: "transparent",
            border: "none",
            color: textSecondary,
            fontSize: 18,
            cursor: "pointer",
            padding: "4px 8px",
            transition: "all 0.2s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = accent;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = textSecondary;
          }}
        >
          x
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "12px" }}>
        {notifications.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              color: textSecondary,
              paddingTop: "48px",
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 600 }}>No alerts</div>
          </div>
        ) : (
          notifications.map((notif, idx) => (
            <div key={idx} style={{ ...cardStyle, fontSize: 11 }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>
                {notif.title}
              </div>
              <div style={{ color: textSecondary, fontSize: 10 }}>
                {notif.message}
              </div>
              <div style={{ color: textTertiary, fontSize: 9, marginTop: 6 }}>
                {notif.time}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

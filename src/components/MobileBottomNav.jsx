import React, { useEffect, useState } from "react";

export default function MobileBottomNav({ currentPage, onNavigate }) {
  const [windowWidth, setWindowWidth] = useState(() =>
    typeof window === "undefined" ? 1024 : window.innerWidth,
  );

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  if (windowWidth >= 768) return null;

  const navItems = [
    { icon: "Dash", label: "Dashboard", id: "dashboard" },
    { icon: "Users", label: "Users", id: "users" },
    { icon: "Alerts", label: "Alerts", id: "alerts" },
    { icon: "Settings", label: "Settings", id: "settings" },
  ];

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height: "60px",
        background: "var(--surface-glass, rgba(20,20,20,0.95))",
        borderTop: "1px solid var(--border-subtle, rgba(0,122,255,0.3))",
        display: "flex",
        justifyContent: "space-around",
        alignItems: "center",
        zIndex: 999,
        backdropFilter: "blur(10px)",
        paddingBottom: "max(0px, env(safe-area-inset-bottom))",
      }}
    >
      {navItems.map((item) => (
        <button
          key={item.id}
          onClick={() => onNavigate(item.id)}
          style={{
            background:
              currentPage === item.id
                ? "var(--accent-glow, rgba(0,122,255,0.2))"
                : "transparent",
            border: "none",
            borderTop:
              currentPage === item.id
                ? "2px solid var(--accent-primary, #0A84FF)"
                : "none",
            cursor: "pointer",
            color:
              currentPage === item.id
                ? "var(--accent-primary, #0A84FF)"
                : "var(--text-secondary, #8E8E93)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4,
            padding: "8px 12px",
            fontSize: 10,
            fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
            fontWeight: 700,
            letterSpacing: 0.5,
            transition: "all 0.2s ease",
            width: "100%",
          }}
          onMouseEnter={(event) => {
            if (currentPage !== item.id) {
              event.currentTarget.style.color =
                "var(--accent-primary, #0A84FF)";
              event.currentTarget.style.background =
                "var(--accent-glow, rgba(0,122,255,0.1))";
            }
          }}
          onMouseLeave={(event) => {
            if (currentPage !== item.id) {
              event.currentTarget.style.color =
                "var(--text-secondary, #8E8E93)";
              event.currentTarget.style.background = "transparent";
            }
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 800 }}>{item.icon}</span>
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
}

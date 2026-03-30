import { useState } from "react";

const TOAST_COLORS = {
  success: {
    border: "#30D158",
    bg: "rgba(48, 209, 88, 0.1)",
    text: "#30D158",
    icon: "\u2713",
  },
  error: {
    border: "#FF453A",
    bg: "rgba(255, 69, 58, 0.1)",
    text: "#FF453A",
    icon: "\u2715",
  },
  warning: {
    border: "#FFD60A",
    bg: "rgba(255, 214, 10, 0.1)",
    text: "#FFD60A",
    icon: "\u26A0",
  },
  info: {
    border: "#0A84FF",
    bg: "rgba(10, 132, 255, 0.1)",
    text: "#0A84FF",
    icon: "\u2139",
  },
  critical: {
    border: "#FF3B30",
    bg: "rgba(255, 59, 48, 0.15)",
    text: "#FF3B30",
    icon: "\uD83D\uDEA8",
  },
};

export default function Toast({ toasts, onDismiss, fontFamily = "inherit" }) {
  const [swipedToast, setSwipedToast] = useState(null);
  const [touchStart, setTouchStart] = useState(null);
  const isMobile = window.innerWidth < 768;

  const handleTouchStart = (event, toastId) => {
    setTouchStart({ x: event.touches[0].clientX, id: toastId });
  };

  const handleTouchMove = (event, toastId) => {
    if (!touchStart || touchStart.id !== toastId) return;

    const currentX = event.touches[0].clientX;
    const diffX = currentX - touchStart.x;

    if (diffX > 50) {
      setSwipedToast(toastId);
    }
  };

  const handleTouchEnd = (toastId) => {
    if (swipedToast === toastId) {
      onDismiss(toastId);
      setSwipedToast(null);
    }
    setTouchStart(null);
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 20,
        right: isMobile ? 12 : 20,
        left: isMobile ? 12 : "auto",
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        pointerEvents: "none",
        maxWidth: isMobile ? "calc(100% - 24px)" : 420,
      }}
    >
      {toasts.map((toast) => {
        const color = TOAST_COLORS[toast.type] || TOAST_COLORS.info;
        const isBeingSwiped = swipedToast === toast.id;

        return (
          <div
            key={toast.id}
            onTouchStart={(event) => handleTouchStart(event, toast.id)}
            onTouchMove={(event) => handleTouchMove(event, toast.id)}
            onTouchEnd={() => handleTouchEnd(toast.id)}
            style={{
              background: color.bg,
              border: color.border.startsWith("#")
                ? `1px solid ${color.border}30`
                : "1px solid rgba(10,132,255,0.3)",
              borderLeft: `4px solid ${color.border}`,
              borderRadius: 8,
              padding: "14px 16px ",
              backdropFilter: "blur(20px)",
              display: "flex",
              alignItems: "center",
              gap: 12,
              fontFamily,
              fontSize: 13,
              color: color.text,
              fontWeight: 600,
              animation: "slideInToast-gpu 0.3s ease-out",
              boxShadow: "0 0 20px rgba(0,0,0,0.4)",
              pointerEvents: "auto",
              cursor: isMobile ? "grab" : "default",
              userSelect: "none",
              transform: isBeingSwiped ? "translateX(100%)" : "translateX(0)",
              opacity: isBeingSwiped ? 0.5 : 1,
              transition: isBeingSwiped ? "none" : "all 0.2s ease",
              position: "relative",
              overflow: "hidden",
              minWidth: isMobile ? "100%" : 320,
              maxWidth: isMobile ? "100%" : 400,
            }}
          >
            <div
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                height: "3px",
                background: color.border,
                width: `${((toast.time_remaining || toast.duration || 3000) / (toast.duration || 3000)) * 100}%`,
                animation: `${toast.duration || 3000}ms linear backwards`,
                borderRadius: "0 0 0 8px",
              }}
            />

            <span style={{ fontSize: 18, fontWeight: 700, flexShrink: 0 }}>{color.icon}</span>
            <span style={{ flex: 1, lineHeight: 1.4 }}>{toast.message}</span>

            <button
              onClick={() => onDismiss(toast.id)}
              style={{
                background: "transparent",
                border: "none",
                color: color.text,
                fontSize: 18,
                cursor: "pointer",
                padding: "4px 8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                opacity: 0.6,
                transition: "opacity 0.2s",
                marginLeft: "8px",
              }}
              onMouseEnter={(event) => {
                event.currentTarget.style.opacity = "1";
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.opacity = "0.6";
              }}
            >
              {"\u2715"}
            </button>

            {isMobile && toasts.length > 1 && (
              <div
                style={{
                  position: "absolute",
                  right: 4,
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: 4,
                  height: 4,
                  borderRadius: "50%",
                  background: color.border,
                  opacity: 0.4,
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

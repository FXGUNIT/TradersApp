import { useEffect, useState } from "react";
import { CSS_VARS } from "../../styles/cssVars.js";
import { CheckCircle2, XCircle, AlertTriangle, Info, Siren } from "lucide-react";

const TOAST_ICONS = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
  critical: Siren,
};

const TOAST_COLORS = {
  success: {
    border: CSS_VARS.statusSuccess,
    bg: "var(--status-success-soft, rgba(48, 209, 88, 0.1))",
    text: CSS_VARS.statusSuccess,
  },
  error: {
    border: CSS_VARS.statusDanger,
    bg: "var(--status-danger-soft, rgba(255, 69, 58, 0.1))",
    text: CSS_VARS.statusDanger,
  },
  warning: {
    border: CSS_VARS.statusWarning,
    bg: "var(--status-warning-soft, rgba(255, 214, 10, 0.1))",
    text: CSS_VARS.statusWarning,
  },
  info: {
    border: CSS_VARS.statusInfo,
    bg: "var(--status-info-soft, rgba(10, 132, 255, 0.1))",
    text: CSS_VARS.statusInfo,
  },
  critical: {
    border: CSS_VARS.statusDanger,
    bg: "var(--status-danger-soft-strong, rgba(255, 59, 48, 0.15))",
    text: CSS_VARS.statusDanger,
  },
};

function getIsMobileViewport() {
  return typeof window !== "undefined" && window.innerWidth < 768;
}

export default function Toast({ toasts, onDismiss, fontFamily = "inherit" }) {
  const [swipedToast, setSwipedToast] = useState(null);
  const [touchStart, setTouchStart] = useState(null);
  const [isMobile, setIsMobile] = useState(getIsMobileViewport);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const handleResize = () => setIsMobile(getIsMobileViewport());
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

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
        const ToastIcon = TOAST_ICONS[toast.type] || Info;
        const progressDuration = toast.duration || 3000;
        const progressMs = Math.max(1, progressDuration);
        const progressPct = ((toast.time_remaining || progressDuration) / progressMs) * 100;

        return (
          <div
            key={toast.id}
            onTouchStart={(event) => handleTouchStart(event, toast.id)}
            onTouchMove={(event) => handleTouchMove(event, toast.id)}
            onTouchEnd={() => handleTouchEnd(toast.id)}
            style={{
              background: color.bg,
              border: `1px solid ${CSS_VARS.borderSubtle}`,
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
              boxShadow: `0 0 20px ${CSS_VARS.borderStrong}`,
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
                width: `${Math.min(100, Math.max(0, progressPct))}%`,
                animation: `${progressMs}ms linear backwards`,
                borderRadius: "0 0 0 8px",
              }}
            />

            <ToastIcon size={18} style={{ flexShrink: 0 }} />
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
              <XCircle size={16} />
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

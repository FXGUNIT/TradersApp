import React, { useEffect, useState } from "react";

export default function FullScreenToggle({ showToast }) {
  const [isFullScreen, setIsFullScreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullScreen(document.fullscreenElement !== null);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const toggleFullScreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen().catch((error) => {
          console.warn("Fullscreen request denied:", error);
          showToast?.(
            "Fullscreen mode is sleeping. Wake it later.",
            "warning",
          );
        });
        setIsFullScreen(true);
        showToast?.(
          "Viewport expanded. Immersive mode engaged. [ESC] to exit.",
          "success",
        );
      } else {
        await document.exitFullscreen();
        setIsFullScreen(false);
        showToast?.("Full-Screen Mode Disabled", "info");
      }
    } catch (error) {
      console.error("Fullscreen toggle error:", error);
      showToast?.(
        "Fullscreen dimension unavailable. Adjust your timeline.",
        "error",
      );
    }
  };

  return (
    <button
      onClick={toggleFullScreen}
      style={{
        background: isFullScreen
          ? "var(--accent-glow, rgba(0,122,255,0.2))"
          : "transparent",
        border: `1px solid ${
          isFullScreen
            ? "var(--accent-primary, #0A84FF)"
            : "var(--border-subtle, rgba(255,255,255,0.2))"
        }`,
        borderRadius: 6,
        padding: "8px 12px",
        cursor: "pointer",
        color: isFullScreen
          ? "var(--accent-primary, #0A84FF)"
          : "var(--text-secondary, #8E8E93)",
        fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 1,
        transition: "all 0.2s ease-in-out",
        display: "flex",
        alignItems: "center",
        gap: 6,
      }}
      onMouseEnter={(event) => {
        if (!isFullScreen) {
          event.currentTarget.style.background =
            "var(--surface-glass, rgba(255,255,255,0.05))";
          event.currentTarget.style.borderColor =
            "var(--border-strong, rgba(255,255,255,0.3))";
          event.currentTarget.style.transform = "translateY(-2px)";
        }
      }}
      onMouseLeave={(event) => {
        if (!isFullScreen) {
          event.currentTarget.style.background = "transparent";
          event.currentTarget.style.borderColor =
            "var(--border-subtle, rgba(255,255,255,0.2))";
          event.currentTarget.style.transform = "translateY(0)";
        }
      }}
      title={isFullScreen ? "Exit Full-Screen (ESC)" : "Enter Full-Screen Mode"}
    >
      Full Screen
    </button>
  );
}

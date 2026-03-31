import React from "react";
import FounderCard from "../../components/FounderCard.jsx";

function resolveEngineColor(mind, state) {
  if (mind?.isReserve) {
    return {
      dot: "#A855F7",
      text: "#7E22CE",
      glow: "rgba(168,85,247,0.5)",
    };
  }
  if (state === "online") {
    return {
      dot: "#22C55E",
      text: "#166534",
      glow: "rgba(34,197,94,0.5)",
    };
  }
  if (state === "unconfigured") {
    return {
      dot: "#94A3B8",
      text: "#475569",
      glow: "rgba(148,163,184,0.28)",
    };
  }
  if (state === "checking") {
    return {
      dot: "#38BDF8",
      text: "#0C4A6E",
      glow: "rgba(56,189,248,0.35)",
    };
  }
  return {
    dot: "#EF4444",
    text: "#991B1B",
    glow: "rgba(239,68,68,0.5)",
  };
}

export default function OfficersBriefingFooter({
  dailyQuote,
  theme,
  quadCoreStatus,
}) {
  const aiSystems = Object.entries(quadCoreStatus || {});
  const allUnconfigured = aiSystems.every(
    ([, mind]) => mind?.status === "unconfigured",
  );

  return (
    <div
      style={{
        marginTop: "auto",
        backgroundColor: "var(--surface-elevated)",
        borderTop: "1px solid var(--border-subtle)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "32px",
        padding: "60px 40px 40px 40px",
        boxShadow:
          "0 -1px 3px 0 rgba(0, 0, 0, 0.05), 0 -1px 2px 0 rgba(0, 0, 0, 0.04)",
      }}
    >
      <div style={{ textAlign: "center", maxWidth: 600 }}>
        <div
          style={{
            color: "var(--text-secondary)",
            fontSize: "0.9rem",
            fontStyle: "italic",
            lineHeight: 1.8,
            fontFamily: theme.font,
          }}
        >
          "{dailyQuote}" 🦅
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          textAlign: "center",
        }}
      >
        <FounderCard
          linkedInUrl="https://www.linkedin.com/in/singhgunit/"
          theme={theme}
        />
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "16px",
          padding: "12px 24px",
          borderRadius: "10px",
          background:
            "linear-gradient(135deg, var(--surface-elevated), var(--base-layer))",
          border: "1px solid var(--border-subtle)",
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            fontSize: "0.7rem",
            fontWeight: 700,
            color: "var(--text-secondary)",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          AI System Status
        </span>
        <span
          style={{
            fontSize: "0.64rem",
            fontWeight: 700,
            color: "var(--status-info)",
            background: "color-mix(in srgb, var(--status-info) 12%, transparent)",
            border: "1px solid color-mix(in srgb, var(--status-info) 25%, transparent)",
            borderRadius: 999,
            padding: "4px 8px",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          Watchtower Active
        </span>
        {allUnconfigured && (
          <span
            style={{
              fontSize: "0.64rem",
              fontWeight: 600,
              color: "var(--text-secondary)",
            }}
          >
            Fresh provider keys needed
          </span>
        )}
        {aiSystems.map(([key, mind]) => {
          const state = mind?.status || (mind?.online ? "online" : "offline");
          const color = resolveEngineColor(mind, state);
          return (
            <div
              key={key}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
              title={mind?.reason || `${mind?.name || key}: ${state}`}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: color.dot,
                  boxShadow: `0 0 6px ${color.glow}`,
                  animation: "led-pulse 2s ease-in-out infinite",
                }}
              />
              <span
                style={{
                  fontSize: "0.68rem",
                  fontWeight: 600,
                  color: color.text,
                  fontFamily: "ui-monospace, monospace",
                }}
              >
                {mind?.name || key}
              </span>
            </div>
          );
        })}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          textAlign: "center",
        }}
      >
        <div
          style={{
            color: "var(--text-tertiary)",
            fontSize: "0.75rem",
            letterSpacing: "0.1em",
            fontWeight: 500,
            marginBottom: 0,
            textTransform: "uppercase",
          }}
        >
          WELCOME TO THE REGIMENT
        </div>
      </div>
    </div>
  );
}

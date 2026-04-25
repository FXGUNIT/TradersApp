import React from "react";
import FounderCard from "../../components/FounderCard.jsx";
import { getInitialNewsSystemStatus } from "../../services/clients/NewsStatusClient.js";
import { CSS_VARS } from "../../styles/cssVars.js";

function resolveEngineColor(mind, state) {
  if (mind?.isReserve) {
    return {
      dot: CSS_VARS.amdManipulation,
      text: "var(--text-secondary, #7E22CE)",
      glow: "var(--accent-glow, rgba(168,85,247,0.5))",
    };
  }
  if (state === "online") {
    return {
      dot: CSS_VARS.statusSuccess,
      text: "var(--status-success, #166534)",
      glow: "var(--status-success-soft, rgba(34,197,94,0.5))",
    };
  }
  if (state === "unconfigured") {
    return {
      dot: CSS_VARS.textTertiary,
      text: CSS_VARS.textSecondary,
      glow: "var(--border-subtle, rgba(148,163,184,0.28))",
    };
  }
  if (state === "checking") {
    return {
      dot: CSS_VARS.statusInfo,
      text: "var(--status-info, #0C4A6E)",
      glow: "var(--status-info-soft, rgba(56,189,248,0.35))",
    };
  }
  return {
    dot: CSS_VARS.statusDanger,
    text: "var(--status-danger, #991B1B)",
    glow: "var(--status-danger-soft, rgba(239,68,68,0.5))",
  };
}

function resolveSignalColor(state) {
  if (state === "active") {
    return {
      dot: CSS_VARS.statusSuccess,
      text: "var(--status-success, #166534)",
      glow: "var(--status-success-soft, rgba(34,197,94,0.5))",
      badge: "color-mix(in srgb, var(--status-success) 12%, transparent)",
      border: "color-mix(in srgb, var(--status-success) 25%, transparent)",
      label: "ACTIVE",
    };
  }
  if (state === "checking") {
    return {
      dot: CSS_VARS.statusInfo,
      text: "var(--status-info, #0C4A6E)",
      glow: "var(--status-info-soft, rgba(56,189,248,0.35))",
      badge: "color-mix(in srgb, var(--status-info) 12%, transparent)",
      border: "color-mix(in srgb, var(--status-info) 25%, transparent)",
      label: "CHECKING",
    };
  }
  if (state === "inactive") {
    return {
      dot: CSS_VARS.textTertiary,
      text: CSS_VARS.textSecondary,
      glow: "var(--border-subtle, rgba(148,163,184,0.28))",
      badge: "color-mix(in srgb, var(--text-tertiary) 10%, transparent)",
      border: "color-mix(in srgb, var(--text-tertiary) 22%, transparent)",
      label: "NO",
    };
  }
  return {
    dot: CSS_VARS.statusDanger,
    text: "var(--status-danger, #991B1B)",
    glow: "var(--status-danger-soft, rgba(239,68,68,0.5))",
    badge: "color-mix(in srgb, var(--status-danger) 12%, transparent)",
    border: "color-mix(in srgb, var(--status-danger) 25%, transparent)",
    label: "OFFLINE",
  };
}

function FooterStatusChip({ signal }) {
  const appearance = resolveSignalColor(signal?.state);

  return (
    <div
      title={signal?.detail || `${signal?.name || "Status"}: ${appearance.label}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        borderRadius: 999,
        padding: "4px 10px",
        background: appearance.badge,
        border: `1px solid ${appearance.border}`,
      }}
    >
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: appearance.dot,
          boxShadow: `0 0 6px ${appearance.glow}`,
          animation: "led-pulse 2s ease-in-out infinite",
        }}
      />
      <span
        style={{
          fontSize: "0.78rem",
          fontWeight: 700,
          color: appearance.text,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        {signal?.name} {appearance.label}
      </span>
    </div>
  );
}

function resolveWatchtowerColor(status) {
  if (status === "healthy") {
    return {
      dot: CSS_VARS.statusSuccess,
      text: "var(--status-success, #166534)",
      glow: "var(--status-success-soft, rgba(34,197,94,0.5))",
      badge: "color-mix(in srgb, var(--status-success) 12%, transparent)",
      border: "color-mix(in srgb, var(--status-success) 25%, transparent)",
    };
  }
  if (status === "checking") {
    return {
      dot: CSS_VARS.statusInfo,
      text: "var(--status-info, #0C4A6E)",
      glow: "var(--status-info-soft, rgba(56,189,248,0.35))",
      badge: "color-mix(in srgb, var(--status-info) 12%, transparent)",
      border: "color-mix(in srgb, var(--status-info) 25%, transparent)",
    };
  }
  return {
    dot: CSS_VARS.statusDanger,
    text: "var(--status-danger, #991B1B)",
    glow: "var(--status-danger-soft, rgba(239,68,68,0.5))",
    badge: "color-mix(in srgb, var(--status-danger) 12%, transparent)",
    border: "color-mix(in srgb, var(--status-danger) 25%, transparent)",
  };
}

function WatchtowerStatusChip({ status }) {
  const appearance = resolveWatchtowerColor(status?.status);
  const faults = Array.isArray(status?.faults) ? status.faults : [];
  const corrections = Array.isArray(status?.corrections) ? status.corrections : [];
  const title = [
    status?.label || "WATCHTOWER CHECKING",
    ...faults.map((fault) => `${fault.title}: ${fault.detail}`),
    ...corrections.map((correction) => `${correction.title}: ${correction.detail}`),
  ].join("\n");

  return (
    <div
      title={title}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        borderRadius: 999,
        padding: "4px 10px",
        background: appearance.badge,
        border: `1px solid ${appearance.border}`,
      }}
    >
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: appearance.dot,
          boxShadow: `0 0 6px ${appearance.glow}`,
          animation: "led-pulse 2s ease-in-out infinite",
        }}
      />
      <span
        style={{
          fontSize: "0.78rem",
          fontWeight: 700,
          color: appearance.text,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        {status?.label || "WATCHTOWER CHECKING"}
      </span>
    </div>
  );
}

export default function OfficersBriefingFooter({
  dailyQuote,
  theme,
  quadCoreStatus,
  watchtowerStatus,
}) {
  const aiSystems = Object.entries(quadCoreStatus || {});
  const allUnconfigured = aiSystems.every(
    ([, mind]) => mind?.status === "unconfigured",
  );
  const newsSystemStatus =
    watchtowerStatus?.news || getInitialNewsSystemStatus();

  return (
    <div
      style={{
        marginTop: "auto",
        backgroundColor: CSS_VARS.surfaceElevated,
        borderTop: `1px solid ${CSS_VARS.borderSubtle}`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "32px",
        padding: "60px 40px 40px 40px",
        boxShadow:
          "var(--shadow-card, 0 -1px 3px 0 rgba(0, 0, 0, 0.05)), var(--shadow-card-soft, 0 -1px 2px 0 rgba(0, 0, 0, 0.04))",
      }}
    >
      <div style={{ textAlign: "center", maxWidth: 600 }}>
        <div
          style={{
            color: CSS_VARS.textSecondary,
            fontSize: "1.05rem",
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
            `linear-gradient(135deg, ${CSS_VARS.surfaceElevated}, ${CSS_VARS.baseLayer})`,
          border: `1px solid ${CSS_VARS.borderSubtle}`,
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            fontSize: "0.85rem",
            fontWeight: 700,
            color: "var(--text-secondary)",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          AI System Status
        </span>
        <WatchtowerStatusChip status={watchtowerStatus} />
        <FooterStatusChip signal={newsSystemStatus.liveNews} />
        <FooterStatusChip signal={newsSystemStatus.scheduledNews} />
        <span
          style={{
            fontSize: "0.76rem",
            fontWeight: 600,
            color: CSS_VARS.textSecondary,
          }}
          title="Watchtower refreshes BFF, AI, ML, and news status every 30 seconds."
        >
          30 SEC REFRESH
        </span>
        {allUnconfigured && (
          <span
            style={{
              fontSize: "0.78rem",
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
                  fontSize: "0.82rem",
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
            color: CSS_VARS.textTertiary,
            fontSize: "0.9rem",
            letterSpacing: "0.15em",
            fontWeight: 600,
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

import React from "react";

const AI_ENGINE_NAMES = [
  "Gemini",
  "Groq",
  "OpenRouter",
  "Cerebras",
  "DeepSeek",
  "SambaNova",
];

const STATUS_STYLES = {
  online: {
    dot: "#22c55e",
    glow: "0 0 6px rgba(34,197,94,0.55)",
    label: "Online",
  },
  offline: {
    dot: "#f87171",
    glow: "0 0 4px rgba(248,113,113,0.2)",
    label: "Offline",
  },
  unconfigured: {
    dot: "#94a3b8",
    glow: "0 0 4px rgba(148,163,184,0.18)",
    label: "Key missing",
  },
  checking: {
    dot: "#38bdf8",
    glow: "0 0 6px rgba(56,189,248,0.35)",
    label: "Checking",
  },
};

function normalizeStatusEntry(entry, index) {
  if (typeof entry === "boolean") {
    return {
      name: AI_ENGINE_NAMES[index] || `Engine ${index + 1}`,
      status: entry ? "online" : "offline",
      reason: entry ? "Provider ready." : "Provider unavailable.",
    };
  }

  if (!entry) {
    return {
      name: AI_ENGINE_NAMES[index] || `Engine ${index + 1}`,
      status: "unconfigured",
      reason: "Fresh provider key required.",
    };
  }

  const inferredState = entry?.status
    || (entry?.online
      ? "online"
      : entry?.configured === false
        ? "unconfigured"
        : entry?.configured === true
          ? "offline"
          : "unconfigured");
  return {
    name: entry?.name || AI_ENGINE_NAMES[index] || `Engine ${index + 1}`,
    status: STATUS_STYLES[inferredState] ? inferredState : "unconfigured",
    reason:
      entry?.reason ||
      (inferredState === "unconfigured"
        ? "Fresh provider key required."
        : inferredState === "online"
          ? "Provider ready."
          : "Provider unavailable."),
  };
}

const AiEnginesStatus = ({ statuses = [] }) => {
  const normalizedStatuses = AI_ENGINE_NAMES.map((name, index) =>
    normalizeStatusEntry(statuses[index], index),
  );

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <span
        style={{
          fontSize: 12,
          color: "#64748b",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: 1,
        }}
      >
        AI
      </span>

      <span
        title="AI Watchtower active"
        style={{
          width: 10,
          height: 10,
          borderRadius: 999,
          display: "inline-block",
          background: "#38bdf8",
          boxShadow: "0 0 6px rgba(56,189,248,0.45)",
        }}
      />

      {normalizedStatuses.map((entry) => {
        const appearance = STATUS_STYLES[entry.status] || STATUS_STYLES.offline;

        return (
          <span
            key={entry.name}
            title={`${entry.name}: ${appearance.label}${entry.reason ? ` - ${entry.reason}` : ""}`}
            style={{
              width: 10,
              height: 10,
              borderRadius: 999,
              display: "inline-block",
              background: appearance.dot,
              boxShadow: appearance.glow,
            }}
          />
        );
      })}
    </div>
  );
};

export default AiEnginesStatus;

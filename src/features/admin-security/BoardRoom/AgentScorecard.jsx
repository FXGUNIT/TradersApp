import React from "react";

function formatRelativeTime(timestamp) {
  if (!timestamp) return "Never";
  const diffMs = Date.now() - Number(timestamp);
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

export default function AgentScorecard({ agentMemories = {} }) {
  const cards = Object.entries(agentMemories)
    .sort(([, left], [, right]) => (right?.lastHeartbeat || 0) - (left?.lastHeartbeat || 0));

  return (
    <section
      style={{
        borderRadius: 20,
        border: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(7,15,27,0.72)",
        padding: 16,
        display: "grid",
        gap: 12,
      }}
    >
      <div>
        <div style={{ fontSize: 18, fontWeight: 800 }}>Agent scorecard</div>
        <div style={{ fontSize: 12, opacity: 0.7 }}>
          Live memory stats for agents participating in the loaded threads.
        </div>
      </div>

      {cards.length === 0 ? (
        <div style={{ fontSize: 13, opacity: 0.72 }}>No agent memory loaded yet.</div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
          }}
        >
          {cards.map(([agent, memory]) => (
            <article
              key={agent}
              style={{
                borderRadius: 16,
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.03)",
                padding: 14,
                display: "grid",
                gap: 8,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                <div style={{ fontWeight: 800 }}>{agent}</div>
                <div style={{ fontSize: 11, opacity: 0.7 }}>
                  {formatRelativeTime(memory?.lastHeartbeat)}
                </div>
              </div>
              <div style={{ fontSize: 12, opacity: 0.75 }}>
                Current thread: {memory?.currentThread || "None"}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 12 }}>
                <div>
                  Pending ack: {Array.isArray(memory?.pendingAcknowledgments) ? memory.pendingAcknowledgments.length : 0}
                </div>
                <div>Tasks: {memory?.activeTaskCount || 0}</div>
                <div>Plans approved: {memory?.totalPlansApproved || 0}</div>
                <div>Plans rejected: {memory?.totalPlansRejected || 0}</div>
              </div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                Avg ack: {memory?.avgAckTimeSeconds || 0}s
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

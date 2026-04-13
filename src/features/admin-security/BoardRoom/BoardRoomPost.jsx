import React, { useMemo, useState } from "react";

function tryParseJson(content) {
  if (typeof content !== "string") return null;
  const trimmed = content.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

function formatRelativeTime(timestamp) {
  if (!timestamp) return "Unknown";
  const diffMs = Date.now() - Number(timestamp);
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function deadlineLabel(deadline) {
  if (!deadline) return null;
  const diffMs = Number(deadline) - Date.now();
  if (diffMs <= 0) return "Past due";
  const diffMinutes = Math.ceil(diffMs / 60000);
  if (diffMinutes < 60) return `${diffMinutes}m left`;
  return `${Math.ceil(diffMinutes / 60)}h left`;
}

export default function BoardRoomPost({
  post,
  accentColor,
  disabled = false,
  onAcknowledge,
  onApprove,
  onReject,
  defaultResponder = "ceo",
}) {
  const parsedContent = useMemo(() => tryParseJson(post?.content), [post?.content]);
  const [response, setResponse] = useState("");
  const canAcknowledge = post?.acknowledgmentRequired && !post?.acknowledgedBy;
  const canModeratePlan = post?.type === "plan" && post?.planStatus === "pending_approval";

  return (
    <article
      style={{
        border: `1px solid ${accentColor}22`,
        borderRadius: 16,
        padding: 14,
        background: "rgba(255,255,255,0.02)",
        display: "grid",
        gap: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontWeight: 700 }}>{post?.author || "unknown"}</span>
          <span
            style={{
              borderRadius: 999,
              padding: "2px 8px",
              background: `${accentColor}22`,
              color: accentColor,
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 0.4,
            }}
          >
            {post?.type || "comment"}
          </span>
          {post?.planStatus && (
            <span style={{ fontSize: 11, opacity: 0.75 }}>
              Plan: {post.planStatus}
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 11, opacity: 0.7 }}>
          <span>{formatRelativeTime(post?.timestamp)}</span>
          {post?.acknowledgmentDeadline && <span>{deadlineLabel(post.acknowledgmentDeadline)}</span>}
          {post?.acknowledgedLate === true && <span style={{ color: "#f59e0b" }}>Late ack</span>}
        </div>
      </div>

      {Array.isArray(post?.mentions) && post.mentions.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {post.mentions.map((mention) => (
            <span
              key={`${post?.postId}-${mention}`}
              style={{
                borderRadius: 999,
                padding: "2px 8px",
                background: "rgba(255,255,255,0.08)",
                fontSize: 11,
              }}
            >
              @{mention}
            </span>
          ))}
        </div>
      )}

      {parsedContent ? (
        <pre
          style={{
            margin: 0,
            padding: 12,
            borderRadius: 12,
            background: "rgba(15,23,42,0.45)",
            overflowX: "auto",
            fontSize: 12,
            lineHeight: 1.5,
          }}
        >
          {JSON.stringify(parsedContent, null, 2)}
        </pre>
      ) : (
        <div style={{ whiteSpace: "pre-wrap", fontSize: 13, lineHeight: 1.55 }}>
          {post?.content || ""}
        </div>
      )}

      {(post?.linkedCommit || post?.linkedPR || post?.response) && (
        <div style={{ display: "grid", gap: 6, fontSize: 12, opacity: 0.8 }}>
          {post?.linkedCommit && <div>Commit: {post.linkedCommit}</div>}
          {post?.linkedPR && <div>PR: {post.linkedPR}</div>}
          {post?.response && <div>Response: {post.response}</div>}
        </div>
      )}

      {post?.acknowledgedBy && (
        <div style={{ fontSize: 12, opacity: 0.75 }}>
          Acknowledged by {post.acknowledgedBy}
        </div>
      )}

      {(canAcknowledge || canModeratePlan) && (
        <div style={{ display: "grid", gap: 10 }}>
          {canAcknowledge && (
            <>
              <input
                value={response}
                onChange={(event) => setResponse(event.target.value)}
                placeholder="Acknowledgment response"
                style={{
                  width: "100%",
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(15,23,42,0.35)",
                  color: "inherit",
                  padding: "10px 12px",
                }}
              />
              <button
                type="button"
                disabled={disabled}
                onClick={() => onAcknowledge?.(post, response || `Acknowledged by ${defaultResponder}`)}
                style={{
                  border: 0,
                  borderRadius: 10,
                  padding: "10px 14px",
                  background: accentColor,
                  color: "#04111f",
                  fontWeight: 700,
                  cursor: disabled ? "not-allowed" : "pointer",
                }}
              >
                Acknowledge
              </button>
            </>
          )}

          {canModeratePlan && (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onApprove?.(post)}
                style={{
                  border: 0,
                  borderRadius: 10,
                  padding: "10px 14px",
                  background: "#34d399",
                  color: "#062117",
                  fontWeight: 700,
                  cursor: disabled ? "not-allowed" : "pointer",
                }}
              >
                Approve plan
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onReject?.(post)}
                style={{
                  border: 0,
                  borderRadius: 10,
                  padding: "10px 14px",
                  background: "#f87171",
                  color: "#2b0909",
                  fontWeight: 700,
                  cursor: disabled ? "not-allowed" : "pointer",
                }}
              >
                Reject plan
              </button>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

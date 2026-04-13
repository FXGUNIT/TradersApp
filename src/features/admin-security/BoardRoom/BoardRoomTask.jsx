import React from "react";

export default function BoardRoomTask({
  task,
  accentColor,
  disabled = false,
  onToggle,
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      style={{
        width: "100%",
        display: "grid",
        gridTemplateColumns: "20px 1fr auto",
        gap: 10,
        alignItems: "center",
        padding: "10px 12px",
        borderRadius: 12,
        border: `1px solid ${accentColor}22`,
        background: "rgba(255,255,255,0.03)",
        color: "inherit",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <span
        style={{
          width: 16,
          height: 16,
          borderRadius: 999,
          border: `2px solid ${task?.done ? accentColor : "rgba(255,255,255,0.35)"}`,
          background: task?.done ? accentColor : "transparent",
          display: "inline-block",
          marginTop: 1,
        }}
      />
      <span
        style={{
          textAlign: "left",
          fontSize: 13,
          lineHeight: 1.4,
          textDecoration: task?.done ? "line-through" : "none",
          opacity: task?.done ? 0.7 : 1,
        }}
      >
        {task?.description || "Untitled task"}
      </span>
      <span style={{ fontSize: 11, opacity: 0.65 }}>
        {task?.done ? `Done${task?.doneBy ? ` by ${task.doneBy}` : ""}` : "Open"}
      </span>
    </button>
  );
}

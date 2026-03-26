import React, { useMemo, useState } from "react";

export default function CommandPalette({
  isOpen,
  onClose,
  users,
  onJumpToUser,
  onToggleGhostMode,
  ghostMode,
  showToast,
}) {
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);

  const normalizedUsers = useMemo(() => {
    if (Array.isArray(users)) {
      return users.reduce((acc, user, index) => {
        const key = user?.uid || user?.id || `user-${index}`;
        acc[key] = user;
        return acc;
      }, {});
    }
    return users || {};
  }, [users]);

  if (!isOpen) return null;

  const commands = [
    {
      id: "ghost-mode",
      label: ghostMode ? "Disable Ghost Mode" : "Enable Ghost Mode",
      category: "Settings",
      action: () => onToggleGhostMode(),
    },
    {
      id: "refresh-users",
      label: "Refresh User List",
      category: "Data",
      action: () => showToast("Refreshing user data...", "info"),
    },
    {
      id: "export-users",
      label: "Export Users (CSV)",
      category: "Data",
      action: () => showToast("Export feature coming soon!", "info"),
    },
  ];

  const userCommands = Object.entries(normalizedUsers).map(([uid, user]) => ({
    id: `user-${uid}`,
    label: `${user.fullName || "Unknown"} (${user.email || "no-email"})`,
    category: "Users",
    action: () => onJumpToUser(uid),
  }));

  const queryLower = query.toLowerCase();
  const filtered = [...commands, ...userCommands].filter(
    (cmd) =>
      cmd.label.toLowerCase().includes(queryLower) ||
      cmd.category.toLowerCase().includes(queryLower),
  );

  const overlay = "var(--aura-overlay, rgba(0,0,0,0.5))";
  const panelBg = "var(--surface-glass, rgba(18,20,28,0.92))";
  const border = "var(--border-subtle, rgba(255,255,255,0.08))";
  const accent = "var(--accent-primary, #0A84FF)";
  const textPrimary = "var(--text-primary, #F2F2F7)";
  const textSecondary = "var(--text-secondary, #94A3B8)";
  const textTertiary = "var(--text-tertiary, #64748B)";

  const handleKeyDown = (event) => {
    if (event.key === "Escape") {
      onClose();
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelectedIdx(Math.min(selectedIdx + 1, filtered.length - 1));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelectedIdx(Math.max(selectedIdx - 1, 0));
      return;
    }

    if (event.key === "Enter" && filtered[selectedIdx]) {
      event.preventDefault();
      filtered[selectedIdx].action();
      onClose();
      setQuery("");
      setSelectedIdx(0);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: overlay,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "20vh",
        zIndex: 2000,
        animation: "fadeInDashboard 0.15s ease-out",
        backdropFilter: "blur(16px)",
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: panelBg,
          borderRadius: 12,
          border: `1px solid ${border}`,
          width: "90%",
          maxWidth: "600px",
          maxHeight: "70vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
          overflow: "hidden",
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div style={{ padding: "16px", borderBottom: `1px solid ${border}` }}>
          <input
            autoFocus
            type="text"
            placeholder="Search users, commands..."
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelectedIdx(0);
            }}
            onKeyDown={handleKeyDown}
              style={{
              width: "100%",
              background: "var(--surface-elevated, rgba(15,23,42,0.85))",
              border: `1px solid ${border}`,
              borderRadius: 6,
              padding: "12px 16px",
              color: textPrimary,
              fontSize: 14,
              fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
              transition: "all 0.2s ease",
            }}
          />
        </div>

        <div style={{ overflowY: "auto", flex: 1 }}>
          {filtered.length === 0 ? (
            <div
              style={{
                padding: "32px 16px",
                textAlign: "center",
                color: textSecondary,
              }}
            >
              <div style={{ fontSize: 12 }}>
                No commands or users match "{query}"
              </div>
            </div>
          ) : (
            filtered.map((cmd, idx) => (
              <div
                key={cmd.id}
                onClick={() => {
                  cmd.action();
                  onClose();
                  setQuery("");
                  setSelectedIdx(0);
                }}
                style={{
                  padding: "12px 16px",
                  borderBottom: `1px solid ${border}`,
                  background:
                    selectedIdx === idx
                      ? "var(--accent-glow, rgba(0,122,255,0.15))"
                      : "transparent",
                  cursor: "pointer",
                  transition: "background 0.15s ease",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
                onMouseEnter={() => setSelectedIdx(idx)}
              >
                <div>
                  <div
                    style={{
                      color: textPrimary,
                      fontSize: 13,
                      fontWeight: 500,
                    }}
                  >
                    {cmd.label}
                  </div>
                  <div
                    style={{
                      color: textTertiary,
                      fontSize: 10,
                      marginTop: 2,
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                    }}
                  >
                    {cmd.category}
                  </div>
                </div>
                <div
                  style={{
                    color: selectedIdx === idx ? accent : textSecondary,
                    fontSize: 10,
                    fontWeight: 600,
                  }}
                >
                  {selectedIdx === idx && "Enter"}
                </div>
              </div>
            ))
          )}
        </div>

        <div
          style={{
            padding: "8px 16px",
            background: "var(--accent-glow, rgba(0,122,255,0.05))",
            borderTop: `1px solid ${border}`,
            fontSize: 10,
            color: textSecondary,
          }}
        >
          <span style={{ marginRight: 16 }}>Up/Down Navigate</span>
          <span style={{ marginRight: 16 }}>Enter Select</span>
          <span>ESC Close</span>
        </div>
      </div>
    </div>
  );
}

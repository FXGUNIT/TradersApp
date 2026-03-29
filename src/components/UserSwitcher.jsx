import React, { useMemo, useState } from "react";

export default function UserSwitcher({
  users,
  currentViewAsUser,
  onSwitchUser,
}) {
  const [isOpen, setIsOpen] = useState(false);

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

  const currentUser = currentViewAsUser
    ? Object.entries(normalizedUsers).find(([uid]) => uid === currentViewAsUser)
        ?.[1]
    : null;

  const activeBg = currentViewAsUser
    ? "var(--accent-glow, rgba(0,122,255,0.15))"
    : "transparent";
  const activeBorder = currentViewAsUser
    ? "var(--accent-primary, #0A84FF)"
    : "var(--border-subtle, rgba(255,255,255,0.2))";
  const activeText = currentViewAsUser
    ? "var(--accent-primary, #0A84FF)"
    : "var(--text-secondary, #8E8E93)";

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: activeBg,
          border: `1px solid ${activeBorder}`,
          borderRadius: 6,
          padding: "8px 12px",
          cursor: "pointer",
          color: activeText,
          fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 1,
          transition: "all 0.2s ease-in-out",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
        onMouseEnter={(event) => {
          if (!currentViewAsUser) {
            event.currentTarget.style.background =
              "var(--surface-glass, rgba(255,255,255,0.05))";
            event.currentTarget.style.borderColor =
              "var(--border-strong, rgba(255,255,255,0.3))";
          }
        }}
        onMouseLeave={(event) => {
          if (!currentViewAsUser) {
            event.currentTarget.style.background = "transparent";
            event.currentTarget.style.borderColor =
              "var(--border-subtle, rgba(255,255,255,0.2))";
          }
        }}
        title={
          currentViewAsUser
            ? `Viewing as: ${currentUser?.fullName}`
            : "Switch to view as another user"
        }
      >
        <span>{currentViewAsUser ? "View" : "Users"}</span>
        <span>
          {currentViewAsUser
            ? `AS: ${currentUser?.fullName?.split(" ")[0].toUpperCase()}`
            : "VIEW MODE"}
        </span>
      </button>

      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            right: 0,
            marginTop: 4,
            background: "var(--surface-glass, rgba(20,20,20,0.95))",
            border: "1px solid var(--border-subtle, rgba(0,122,255,0.3))",
            borderRadius: 6,
            padding: "8px 0",
            minWidth: "200px",
            maxHeight: "300px",
            overflowY: "auto",
            zIndex: 1001,
            boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
            backdropFilter: "blur(18px)",
          }}
          onClick={(event) => event.stopPropagation()}
        >
          {currentViewAsUser && (
            <button
              onClick={() => {
                onSwitchUser(null);
                setIsOpen(false);
              }}
              style={{
                width: "100%",
                padding: "8px 16px",
                background: "var(--aura-accent-red-glow, rgba(255,69,58,0.15))",
                border: "none",
                cursor: "pointer",
                color: "var(--status-danger, #EF4444)",
                fontSize: 10,
                fontWeight: 600,
                textAlign: "left",
                borderBottom:
                  "1px solid var(--border-subtle, rgba(255,69,58,0.2))",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(event) => {
                event.currentTarget.style.background = "rgba(255,69,58,0.25)";
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.background =
                  "var(--aura-accent-red-glow, rgba(255,69,58,0.15))";
              }}
            >
              Exit Shadow Mode
            </button>
          )}

          {Object.entries(normalizedUsers)
            .slice(0, 20)
            .map(([uid, user]) => (
              <button
                key={uid}
                onClick={() => {
                  onSwitchUser(uid);
                  setIsOpen(false);
                }}
                style={{
                  width: "100%",
                  padding: "8px 16px",
                  background:
                    currentViewAsUser === uid
                      ? "var(--accent-glow, rgba(0,122,255,0.2))"
                      : "transparent",
                  border: "none",
                  cursor: "pointer",
                  color:
                    currentViewAsUser === uid
                      ? "var(--accent-primary, #0A84FF)"
                      : "var(--text-secondary, #8E8E93)",
                  fontSize: 10,
                  fontWeight: 600,
                  textAlign: "left",
                  transition: "all 0.15s ease",
                  borderBottom:
                    "1px solid var(--border-subtle, rgba(255,255,255,0.05))",
                }}
                onMouseEnter={(event) => {
                  event.currentTarget.style.background =
                    "var(--accent-glow, rgba(0,122,255,0.15))";
                  event.currentTarget.style.color =
                    "var(--text-primary, #F2F2F7)";
                }}
                onMouseLeave={(event) => {
                  if (currentViewAsUser !== uid) {
                    event.currentTarget.style.background = "transparent";
                    event.currentTarget.style.color =
                      "var(--text-secondary, #8E8E93)";
                  }
                }}
              >
                <div style={{ fontSize: 9, fontWeight: 700 }}>
                  {user.fullName || "Unknown"}
                </div>
                <div
                  style={{
                    fontSize: 8,
                    color: "var(--text-tertiary, #64748B)",
                    marginTop: 2,
                  }}
                >
                  {user.email || "no-email"}
                </div>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

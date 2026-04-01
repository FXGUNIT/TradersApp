import React, { useEffect, useState } from "react";
import { listUserSessions as listIdentityUserSessions } from "../../services/clients/IdentityClient.js";
import { logoutOtherDevices } from "../../utils/sessionUtils.js";

const COLORS = {
  background: "var(--surface-base, #F9FAFB)",
  text: "var(--text-primary, #111827)",
  muted: "var(--text-secondary, #6B7280)",
  dim: "var(--text-tertiary, #94A3B8)",
  gold: "var(--status-warning, #D97706)",
  blue: "var(--status-info, #3B82F6)",
  green: "var(--status-success, #10B981)",
  red: "var(--status-danger, #EF4444)",
  font: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
};

const buttonStyle = (tone = "neutral", disabled = false) => {
  const backgroundByTone = {
    neutral: "rgba(59, 130, 246, 0.1)",
    danger: "#000000",
  };

  const borderByTone = {
    neutral: "1px solid rgba(59, 130, 246, 0.3)",
    danger: "none",
  };

  const colorByTone = {
    neutral: "#60A5FA",
    danger: "#FFFFFF",
  };

  return {
    background: disabled ? "rgba(0,0,0,0.3)" : backgroundByTone[tone],
    border: borderByTone[tone],
    color: disabled ? "rgba(255,255,255,0.6)" : colorByTone[tone],
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: 14,
    fontWeight: 600,
    padding: "8px 16px",
    borderRadius: 8,
    transition: "all 0.2s ease",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: "100%",
    fontFamily: COLORS.font,
  };
};

export default function SessionsManagementScreen({
  profile,
  auth,
  currentSessionId,
  onBack,
  showToast,
}) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [logoutLoading, setLogoutLoading] = useState(false);

  useEffect(() => {
    let active = true;

    const loadSessions = async () => {
      if (!auth || !profile) {
        if (active) {
          setSessions([]);
          setLoading(false);
        }
        return;
      }

      try {
        const sessionsDataRaw =
          (await listIdentityUserSessions(auth.uid, auth.token)) ||
          profile?.sessions ||
          profile?.fullData?.sessions ||
          {};

        const sessionsData = Array.isArray(sessionsDataRaw)
          ? sessionsDataRaw.reduce((accumulator, session, index) => {
              const sessionId =
                session?.sessionId || session?.id || `session_${index}`;
              accumulator[sessionId] = session;
              return accumulator;
            }, {})
          : sessionsDataRaw && typeof sessionsDataRaw === "object"
            ? sessionsDataRaw
            : {};

        const sessionsList = Object.entries(sessionsData).map(
          ([sessionId, sessionData]) => ({
            sessionId,
            ...sessionData,
            isCurrentSession: sessionId === currentSessionId,
          }),
        );

        if (!active) {
          return;
        }

        setSessions(
          sessionsList.sort(
            (left, right) => new Date(right.createdAt) - new Date(left.createdAt),
          ),
        );
      } catch (error) {
        console.error("Failed to fetch sessions:", error);
        if (active) {
          showToast(
            "Session data not responding. Running recovery sequence..",
            "error",
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadSessions();

    return () => {
      active = false;
    };
  }, [auth, currentSessionId, profile, showToast]);

  const handleLogoutOtherDevices = async () => {
    if (!auth || !currentSessionId) {
      return;
    }

    setLogoutLoading(true);
    try {
      const success = await logoutOtherDevices(
        auth.uid,
        currentSessionId,
        auth.token,
      );

      if (success) {
        showToast(
          "Session termination sequence complete. All terminals closed.",
          "success",
        );
        setSessions((previous) => previous.filter((session) => session.isCurrentSession));
      }
    } catch (error) {
      console.error("Logout other devices failed:", error);
      showToast(
        "Logout signal fading across network. Persist and retry.",
        "error",
      );
    } finally {
      setLogoutLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: COLORS.background,
        fontFamily: COLORS.font,
        padding: 20,
      }}
    >
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 24,
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <h1
            style={{
              margin: 0,
              color: COLORS.gold,
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: 2,
            }}
          >
            ACTIVE SESSIONS
          </h1>
          <button onClick={onBack} style={{ ...buttonStyle("neutral"), width: "auto" }}>
            <span style={{ fontSize: 16 }}>&larr;</span> Back to Dashboard
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", color: COLORS.muted, padding: 40 }}>
            loading...
          </div>
        ) : sessions.length === 0 ? (
          <div
            style={{
              background: "rgba(0,0,0,0.3)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8,
              padding: 20,
              textAlign: "center",
              color: COLORS.muted,
            }}
          >
            No active sessions
          </div>
        ) : (
          <>
            <div
              style={{
                marginBottom: 20,
                background: "rgba(0,0,0,0.2)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8,
                overflow: "hidden",
              }}
            >
              {sessions.map((session) => (
                <div
                  key={session.sessionId}
                  style={{
                    padding: 16,
                    borderBottom: "1px solid rgba(255,255,255,0.05)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div
                      style={{
                        color: COLORS.blue,
                        fontWeight: 700,
                        marginBottom: 4,
                      }}
                    >
                      {session.device}
                      {session.isCurrentSession && (
                        <span
                          style={{
                            color: COLORS.green,
                            fontSize: 11,
                            marginLeft: 8,
                          }}
                        >
                          (Current Device)
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: COLORS.muted }}>
                      {session.city}, {session.country}
                    </div>
                    <div style={{ fontSize: 11, color: COLORS.dim, marginTop: 4 }}>
                      Last Active: {new Date(session.lastActive).toLocaleDateString()}{" "}
                      {new Date(session.lastActive).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {sessions.filter((session) => !session.isCurrentSession).length > 0 && (
              <button
                onClick={handleLogoutOtherDevices}
                disabled={logoutLoading}
                style={buttonStyle("danger", logoutLoading)}
                className="btn-glass"
              >
                {logoutLoading
                  ? "LOGGING OUT..."
                  : "LOGOUT ALL OTHER DEVICES"}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

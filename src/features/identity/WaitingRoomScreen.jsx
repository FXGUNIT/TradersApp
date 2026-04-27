import React, { useEffect, useState } from "react";
import { getUserStatusByUid as getIdentityUserStatusByUid } from "../../services/clients/IdentityClient.js";

const authCard = {
  background: "var(--surface-elevated, #FFFFFF)",
  backgroundImage:
    "linear-gradient(rgba(255,255,255,0.97), rgba(255,255,255,0.97)), url('/wallpaper.png')",
  backgroundSize: "cover",
  backgroundPosition: "center",
  backgroundBlendMode: "lighten",
  backgroundAttachment: "fixed",
  border: "none",
  borderRadius: 24,
  padding: "clamp(56px, 12vw, 90px)",
  width: "100%",
  maxWidth: 460,
  margin: "0 auto",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  boxShadow:
    "0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
  position: "relative",
};

const authBtn = (disabled, tone = "dark") => {
  const backgroundByTone = {
    dark: "#000000",
    blue: "var(--accent-primary, #2563EB)",
    subtle: "transparent",
  };

  const colorByTone = {
    dark: "#FFFFFF",
    blue: "#FFFFFF",
    subtle: "var(--text-secondary, #6B7280)",
  };

  return {
    background: disabled ? "rgba(0,0,0,0.3)" : backgroundByTone[tone],
    border: "none",
    borderRadius: 6,
    height: 44,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: disabled ? "not-allowed" : "pointer",
    color: disabled ? "rgba(255,255,255,0.6)" : colorByTone[tone],
    fontFamily: "var(--font-ui)",
    fontSize: 14,
    fontWeight: 600,
    letterSpacing: "0.05em",
    width: "100%",
    transition: "all 0.2s ease",
    opacity: disabled ? 0.6 : 1,
    backdropFilter: "none",
    WebkitBackdropFilter: "none",
    boxShadow: disabled ? "none" : "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
  };
};

function AuthLogo() {
  return (
    <div style={{ textAlign: "center", marginBottom: 36 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 8,
          marginBottom: 20,
        }}
      >
        <img
          src="/logo.png"
          alt="Traders Regiment logo"
          style={{
            borderRadius: "50%",
            overflow: "hidden",
            objectFit: "cover",
            width: 60,
            height: 60,
            border: "none",
            display: "block",
          }}
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />
        <div style={{ textAlign: "left" }}>
          <div
            style={{
              color: "var(--text-primary, #111827)",
              fontSize: "clamp(16px, 3vw, 18px)",
              letterSpacing: 1.5,
              fontFamily: "var(--font-ui)",
              fontWeight: 700,
            }}
          >
            THE DEPARTMENT OF INSTITUTIONAL ARTILLERY
          </div>
        </div>
      </div>
    </div>
  );
}

export default function WaitingRoomScreen({
  profile,
  auth: sessionAuth,
  onRefresh,
  onLogout,
  onResendVerification,
}) {
  const [checking, setChecking] = useState(false);
  const [liveStatus, setLiveStatus] = useState(null);
  const [showVideoFallback, setShowVideoFallback] = useState(false);

  const auditData =
    typeof window !== "undefined" ? window.__TRADERS_AUDIT_DATA : null;

  const uid =
    sessionAuth?.uid ||
    auditData?.userAuth?.uid ||
    auditData?.adminAuth?.uid ||
    "";

  const email =
    sessionAuth?.email ||
    auditData?.userAuth?.email ||
    auditData?.adminAuth?.email ||
    "";

  const emailVerified = profile?.emailVerified !== false;
  const effectiveStatus = liveStatus || profile?.status || "PENDING";
  const eligibilityMessage = profile?.trainingEligibilityMessage || "";
  const daysUsed = Number(profile?.daysUsed ?? profile?.days_used ?? profile?.dayCounter ?? 0);
  const daysRemaining = Math.max(10 - daysUsed, 0);

  useEffect(() => {
    if (!uid || auditData) {
      return undefined;
    }

    let active = true;

    const refreshLiveStatus = async () => {
      try {
        const nextStatus =
          (await getIdentityUserStatusByUid(uid, sessionAuth?.token || "")) ||
          "PENDING";

        if (!active) {
          return;
        }

        setLiveStatus(nextStatus);
        if (nextStatus === "ACTIVE" && onRefresh) {
          void onRefresh();
        }
      } catch (error) {
        console.warn("Waiting room status refresh failed:", error);
      }
    };

    void refreshLiveStatus();
    const interval = setInterval(() => {
      void refreshLiveStatus();
    }, 15000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [auditData, onRefresh, sessionAuth?.token, uid]);

  useEffect(() => {
    if (!onRefresh) {
      return undefined;
    }

    const interval = setInterval(() => {
      void onRefresh();
    }, 30000);

    return () => clearInterval(interval);
  }, [onRefresh]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--surface-base, #F9FAFB)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--font-ui)",
        padding: 20,
      }}
    >
      <div
        style={{ ...authCard, maxWidth: 540, textAlign: "center" }}
        className="glass-panel"
      >
        <AuthLogo />
        <div
          style={{
            width: 120,
            height: 120,
            borderRadius: "50%",
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 24px",
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.15)",
            background: "rgba(217,119,6,0.08)",
            color: "#D97706",
            fontSize: 48,
            fontWeight: 700,
          }}
        >
          {showVideoFallback ? (
            "..."
          ) : (
            <video
              src="/logo.mp4"
              autoPlay
              loop
              muted
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
              onError={() => {
                setShowVideoFallback(true);
              }}
            />
          )}
        </div>
        <div
          style={{
            color: "#D97706",
            fontSize: 16,
            letterSpacing: 3,
            marginBottom: 20,
            fontWeight: 700,
          }}
        >
          APPLICATION UNDER REVIEW
        </div>
        <div style={{ color: "var(--text-secondary, #6B7280)", fontSize: 12, marginBottom: 12 }}>
          Account: {email}
        </div>
        {eligibilityMessage ? (
          <div
            style={{
              marginBottom: 20,
              padding: "14px 16px",
              borderRadius: 14,
              background: "rgba(37,99,235,0.08)",
              border: "1px solid rgba(37,99,235,0.18)",
              textAlign: "left",
            }}
          >
            <div
              style={{
                color: "#1D4ED8",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 1.8,
                textTransform: "uppercase",
                marginBottom: 8,
              }}
            >
              Training Data Policy
            </div>
            <div
              style={{
                color: "var(--text-primary, #1F2937)",
                fontSize: 13,
                lineHeight: 1.6,
              }}
            >
              {eligibilityMessage}
              {!profile?.isTrainingEligible
                ? ` ${daysRemaining} more distinct app-use day${daysRemaining === 1 ? "" : "s"} required.`
                : ""}
            </div>
          </div>
        ) : null}
        <div
          style={{
            color: "var(--text-primary, #374151)",
            fontSize: 14,
            lineHeight: 1.8,
            marginBottom: 28,
            padding: "20px 24px",
            background: "var(--surface-elevated, #FFFFFF)",
            border: "1px solid var(--border-subtle, rgba(0,0,0,0.05))",
            borderRadius: 12,
            boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)",
          }}
        >
          {emailVerified
            ? "Your Traders Regiment account is pending admin approval."
            : "Verify your Gmail inbox, then wait for admin approval to unlock access."}
        </div>
        <div
          style={{
            color: "var(--text-secondary, #6B7280)",
            fontSize: 12,
            lineHeight: 1.9,
            marginBottom: 32,
          }}
        >
          {emailVerified
            ? "Your application has been received. You will be notified once your account is authorized. Approval typically takes 24-48 hours."
            : "We sent a verification link to your Gmail address. After verification, your application remains pending until an admin approves it. Approval typically takes 24-48 hours."}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 24,
          }}
        >
          <div
            style={{
              padding: "8px 12px",
              borderRadius: 999,
              background: emailVerified
                ? "rgba(34,197,94,0.12)"
                : "rgba(217,119,6,0.12)",
              color: emailVerified ? "var(--accent-success, #16A34A)" : "#D97706",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 0.6,
            }}
          >
            {emailVerified ? "EMAIL VERIFIED" : "EMAIL VERIFICATION REQUIRED"}
          </div>
          <div
            style={{
              padding: "8px 12px",
              borderRadius: 999,
              background: "rgba(15,23,42,0.06)",
              color: "var(--text-primary, #111827)",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 0.6,
            }}
          >
            STATUS: {effectiveStatus}
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, flexDirection: "column" }}>
          <button
            onClick={async () => {
              setChecking(true);
              await onRefresh();
              setChecking(false);
            }}
            disabled={checking}
            style={authBtn(checking, "dark")}
            className="btn-glass"
          >
            {checking ? "CHECKING STATUS..." : "CHECK APPROVAL STATUS"}
          </button>
          {!emailVerified && (
            <button
              onClick={onResendVerification}
              style={authBtn(false, "blue")}
              className="btn-glass"
            >
              RESEND VERIFICATION EMAIL
            </button>
          )}
          <button
            onClick={onLogout}
            aria-label="logout"
            style={{ ...authBtn(false, "subtle"), background: "transparent" }}
            className="btn-glass"
          >
            LOGOUT
          </button>
        </div>
      </div>
    </div>
  );
}

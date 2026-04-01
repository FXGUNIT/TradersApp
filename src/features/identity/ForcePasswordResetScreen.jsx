import { useState } from "react";
import {
  calculatePasswordStrength,
  getStrengthLabel,
} from "../../utils/securityUtils.js";

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
            event.target.style.display = "none";
          }}
        />
        <div style={{ textAlign: "left" }}>
          <div
            style={{
              color: "var(--text-primary, #111827)",
              fontSize: "clamp(16px, 3vw, 18px)",
              letterSpacing: 1.5,
              fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
              fontWeight: 700,
            }}
          >
            TRADERS REGIMENT
          </div>
          <div
            style={{
              color: "var(--text-primary, #1e40af)",
              fontSize: "0.7rem",
              letterSpacing: 0.5,
              fontFamily: "Arial, 'Courier New', monospace",
              fontWeight: 700,
            }}
          >
            Account Portal
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ForcePasswordResetScreen({
  onReset,
  onLogout,
  theme,
}) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [capsLock, setCapsLock] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);

  const authCard = {
    background:
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

  const authInp = {
    background: "var(--surface-elevated, #FFFFFF)",
    border: "1px solid var(--border-subtle, rgba(0,0,0,0.05))",
    borderRadius: 6,
    padding: "12px 40px 12px 40px",
    color: "#0F172A",
    fontSize: 14,
    width: "100%",
    boxSizing: "border-box",
    outline: "none",
    transition: "all 0.2s ease",
    marginBottom: 16,
    backdropFilter: "none",
    WebkitBackdropFilter: "none",
    height: 44,
  };

  const authBtn = (disabled) => ({
    background: disabled ? "rgba(0,0,0,0.3)" : "#000000",
    border: "none",
    borderRadius: 6,
    height: 44,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: disabled ? "not-allowed" : "pointer",
    color: disabled ? "rgba(255,255,255,0.6)" : "#FFFFFF",
    fontFamily: theme.font,
    fontSize: 14,
    fontWeight: 600,
    letterSpacing: "0.05em",
    width: "100%",
    transition: "all 0.2s ease",
    opacity: disabled ? 0.6 : 1,
    backdropFilter: "none",
    WebkitBackdropFilter: "none",
    boxShadow: disabled ? "none" : "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
  });

  const lbl = {
    color: "var(--text-secondary, #64748B)",
    fontSize: 11,
    letterSpacing: 1.5,
    marginBottom: 6,
    display: "block",
    textTransform: "uppercase",
    fontWeight: 600,
    fontFamily: theme.font,
  };

  const handlePasswordChange = (event) => {
    const pwd = event.target.value;
    setNewPassword(pwd);
    setPasswordStrength(calculatePasswordStrength(pwd));
  };

  const handleKeyboardState = (event) => {
    setCapsLock(event.getModifierState("CapsLock"));
  };

  const resetPassword = async () => {
    setErr("");
    setMsg("");

    if (!newPassword || !confirmPassword) {
      setErr("Both password fields are required.");
      return;
    }

    if (newPassword.length < 8) {
      setErr("Password must be at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErr("Passwords do not match.");
      return;
    }

    if (passwordStrength < 2) {
      setErr("Password is too weak. Use uppercase, numbers, and symbols.");
      return;
    }

    setLoading(true);
    try {
      await onReset(newPassword);
      setMsg("Password reset successfully. Redirecting...");
    } catch (error) {
      setErr(error.message || "Password reset failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: theme.bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: theme.font,
        padding: 20,
      }}
    >
      <div style={authCard} className="glass-panel">
        <AuthLogo />
        <div
          style={{
            color: theme.red,
            fontSize: 12,
            letterSpacing: 2,
            textAlign: "center",
            marginBottom: 24,
            fontWeight: 700,
          }}
        >
          MANDATORY PASSWORD RESET
        </div>

        <div
          style={{
            background: "rgba(255,69,58,0.1)",
            border: "1px solid rgba(255,69,58,0.3)",
            borderRadius: 8,
            padding: 12,
            marginBottom: 20,
          }}
        >
          <p
            style={{
              color: theme.muted,
              fontSize: 12,
              margin: 0,
              lineHeight: 1.6,
            }}
          >
            Your password was last changed <strong>over 120 days ago</strong>.
            For security compliance, you must reset it before accessing your
            account.
          </p>
        </div>

        {err && (
          <div
            style={{
              color: theme.red,
              fontSize: 12,
              marginBottom: 16,
              padding: "10px 14px",
              background: "rgba(255,69,58,0.1)",
              border: "1px solid rgba(255,69,58,0.3)",
              borderRadius: 6,
              fontWeight: 500,
            }}
          >
            {err}
          </div>
        )}

        {msg && (
          <div
            style={{
              color: theme.green,
              fontSize: 12,
              marginBottom: 16,
              padding: "10px 14px",
              background: "rgba(48,209,88,0.1)",
              border: "1px solid rgba(48,209,88,0.3)",
              borderRadius: 6,
              fontWeight: 500,
            }}
          >
            {msg}
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <label style={lbl}>NEW PASSWORD *</label>
          <div style={{ position: "relative", width: "100%", marginBottom: 8 }}>
            <input
              type={showPwd ? "text" : "password"}
              value={newPassword}
              onChange={handlePasswordChange}
              onKeyDown={handleKeyboardState}
              onKeyUp={handleKeyboardState}
              placeholder="Min 8 characters"
              style={{
                ...authInp,
                letterSpacing: 2,
                width: "100%",
                marginBottom: 0,
              }}
              className="input-glass"
            />
            <button
              type="button"
              onClick={() => setShowPwd((prev) => !prev)}
              style={{
                position: "absolute",
                right: 10,
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                color: "#888",
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              {showPwd ? "HIDE" : "SHOW"}
            </button>
          </div>

          {capsLock && (
            <div
              style={{
                color: theme.red,
                fontSize: 10,
                marginBottom: 6,
                padding: "6px 8px",
                background: "rgba(255,69,58,0.1)",
                borderRadius: 3,
              }}
            >
              Caps Lock is ON
            </div>
          )}

          {newPassword && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", gap: 3, height: 3, marginBottom: 4 }}>
                {[0, 1, 2].map((idx) => (
                  <div
                    key={idx}
                    style={{
                      flex: 1,
                      height: "100%",
                      background:
                        passwordStrength > idx
                          ? getStrengthLabel(passwordStrength).color
                          : "rgba(255,255,255,0.1)",
                      borderRadius: 2,
                      transition: "all 0.2s ease",
                    }}
                  />
                ))}
              </div>
              <div
                style={{
                  fontSize: 9,
                  color: getStrengthLabel(passwordStrength).color,
                }}
              >
                Strength: <strong>{getStrengthLabel(passwordStrength).label}</strong>
              </div>
            </div>
          )}
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={lbl}>CONFIRM PASSWORD *</label>
          <div style={{ position: "relative", width: "100%" }}>
            <input
              type={showConfirm ? "text" : "password"}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Re-enter password"
              style={{
                ...authInp,
                letterSpacing: 2,
                width: "100%",
                marginBottom: 0,
              }}
              className="input-glass"
            />
            <button
              type="button"
              onClick={() => setShowConfirm((prev) => !prev)}
              style={{
                position: "absolute",
                right: 10,
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                color: "#888",
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              {showConfirm ? "HIDE" : "SHOW"}
            </button>
          </div>
        </div>

        <button
          onClick={resetPassword}
          disabled={loading || !newPassword || !confirmPassword}
          style={{
            ...authBtn(loading || !newPassword || !confirmPassword),
            marginBottom: 12,
          }}
          className="btn-glass"
        >
          {loading ? "RESETTING..." : "RESET PASSWORD"}
        </button>

        <button
          onClick={onLogout}
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: theme.dim,
            fontSize: 12,
            fontFamily: theme.font,
            display: "block",
            width: "100%",
            fontWeight: 600,
            transition: "color 0.2s",
          }}
          onMouseEnter={(event) => {
            event.target.style.color = theme.red;
          }}
          onMouseLeave={(event) => {
            event.target.style.color = theme.dim;
          }}
        >
          ← LOGOUT
        </button>
      </div>
    </div>
  );
}

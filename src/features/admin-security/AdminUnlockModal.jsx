import React, { useState } from "react";
import {
  getRememberDevice,
  setRememberDevice,
  getDeviceFingerprint,
  parseUserAgent,
} from "../../services/adminAuthService.js";

export default function AdminUnlockModal({
  authButton,
  authCardStyle,
  labelStyle,
  onCancel,
  onMasterEmailChange,
  onPasswordChange,
  onOtpChange,
  onProceedToCodeEntry,
  onRequestNew,
  onSendVerificationCodes,
  onTogglePasswordVisibility,
  onUnlockAdmin,
  onVerifyCodes,
  passwordError,
  passwordValue,
  show,
  showPassword,
  theme,
  verificationError,
  verificationState,
}) {
  const [rememberDevice, setRememberDeviceState] = useState(() =>
    getRememberDevice(),
  );

  const handleRememberChange = (checked) => {
    setRememberDeviceState(checked);
    setRememberDevice(checked);
  };

  if (!show) {
    return null;
  }

  const {
    masterEmail,
    masterEmailVerified,
    otpStep,
    otps,
    otpsVerified,
  } = verificationState;
  const { browser, os, device } = parseUserAgent();
  const fp = getDeviceFingerprint();
  const deviceInfo = `${browser} on ${os}${device !== "desktop" ? ` (${device})` : ""} · ${fp.substring(0, 12)}...`;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.85)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        backdropFilter: "blur(10px)",
      }}
    >
      <div style={authCardStyle} className="glass-panel">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 18,
          }}
        >
          <div style={{ color: theme.purple, fontSize: 20 }}>
            {"\u{1F6E1}\uFE0F"}
          </div>
          <div
            style={{
              color: theme.purple,
              fontSize: 12,
              letterSpacing: 1.5,
              fontWeight: 800,
            }}
          >
            ADMIN AUTHENTICATION
          </div>
        </div>

        {!masterEmailVerified ? (
          <div style={{ marginBottom: 20 }}>
            <div
              style={{
                color: theme.red,
                fontWeight: 700,
                fontSize: 12,
                marginBottom: 16,
                padding: "12px 14px",
                background: "rgba(255,69,58,0.1)",
                border: "1px solid rgba(255,69,58,0.3)",
                borderRadius: 8,
                textAlign: "center",
              }}
            >
              WARNING: RESTRICTED AREA. Unauthorized entry attempts are actively
              tracked. Any attempt to breach this panel will result in your IP
              address, device footprint, and network data being permanently
              logged and reported.
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>MASTER ADMIN EMAIL</label>
              <input
                type="email"
                value={masterEmail}
                onChange={(event) => onMasterEmailChange(event.target.value)}
                style={{
                  width: "100%",
                  padding: 12,
                  background: theme.surface || "rgba(0,0,0,0.15)",
                  border: `1px solid ${theme.border || "#374151"}`,
                  color: theme.text || "#fff",
                  borderRadius: 8,
                  fontFamily: theme.font,
                  fontSize: 14,
                  boxSizing: "border-box",
                  outline: "none",
                  transition: "border-color 0.2s ease",
                }}
                placeholder="Enter Master ID"
              />
            </div>
            {verificationError && (
              <div
                style={{
                  color: theme.red,
                  fontSize: 11,
                  marginBottom: 12,
                  fontWeight: 600,
                }}
              >
                {verificationError}
              </div>
            )}
            <button
              onClick={onSendVerificationCodes}
              style={authButton(theme.purple, false)}
              className="btn-glass"
            >
              SEND VERIFICATION CODES
            </button>
          </div>
        ) : !otpStep ? (
          <div style={{ marginBottom: 20 }}>
            <div
              style={{
                color: theme.muted,
                fontSize: 12,
                marginBottom: 16,
                textAlign: "center",
              }}
            >
              Master identity verified. OTP codes are being sent to three secure
              endpoints.
              <br />
              Click below to proceed to code entry.
            </div>
            <button
              onClick={onProceedToCodeEntry}
              style={authButton(theme.green, false)}
              className="btn-glass"
            >
              PROCEED TO CODE ENTRY
            </button>
          </div>
        ) : (
          <div style={{ marginBottom: 20 }}>
            <div
              style={{
                color: theme.muted,
                fontSize: 12,
                marginBottom: 16,
                textAlign: "center",
              }}
            >
              Enter the 6-digit codes sent to the three verification endpoints:
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
                marginBottom: 16,
              }}
            >
              {[
                ["otp1", "gunitsingh1994@gmail.com"],
                ["otp2", "arkgproductions@gmail.com"],
                ["otp3", "starg.unit@gmail.com"],
              ].map(([field, email]) => (
                <div key={field}>
                  <label style={{ ...labelStyle, fontSize: 11 }}>{email}</label>
                  <input
                    type="text"
                    value={otps[field]}
                    onChange={(event) => onOtpChange(field, event.target.value)}
                    style={{
                      width: "100%",
                      padding: 10,
                      background: "rgba(0,0,0,0.5)",
                      border: "1px solid #333",
                      color: "#fff",
                      borderRadius: 6,
                      fontFamily: "monospace",
                      textAlign: "center",
                      letterSpacing: "2px",
                    }}
                    placeholder="000000"
                    maxLength="6"
                  />
                </div>
              ))}
            </div>

            {verificationError && (
              <div
                style={{
                  color: theme.red,
                  fontSize: 11,
                  marginBottom: 12,
                  fontWeight: 600,
                }}
              >
                {verificationError}
              </div>
            )}

            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <button
                onClick={onVerifyCodes}
                style={authButton(theme.green, false)}
                className="btn-glass"
              >
                VERIFY CODES
              </button>
              <button
                onClick={onRequestNew}
                style={{
                  ...authButton(theme.muted, false),
                  background: "transparent",
                }}
                className="btn-glass"
              >
                REQUEST NEW
              </button>
            </div>
          </div>
        )}

        {otpsVerified && (
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>MASTER ADMIN PASSWORD</label>
            <div style={{ position: "relative", width: "100%" }}>
              <input
                type={showPassword ? "text" : "password"}
                value={passwordValue}
                onChange={(event) => onPasswordChange(event.target.value)}
                style={{
                  width: "100%",
                  padding: 12,
                  paddingRight: 60,
                  background: theme.surface || "rgba(0,0,0,0.5)",
                  border: `1px solid ${theme.border || "#333"}`,
                  color: theme.text || "#fff",
                  borderRadius: 8,
                  fontFamily: theme.font,
                  fontSize: 14,
                  boxSizing: "border-box",
                }}
                placeholder="Enter Master Admin Password"
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    onUnlockAdmin();
                  }
                }}
              />
              <button
                type="button"
                onClick={onTogglePasswordVisibility}
                aria-label={showPassword ? "Hide password" : "Show password"}
                style={{
                  position: "absolute",
                  right: 8,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "transparent",
                  border: "none",
                  color: theme.muted || "#9CA3AF",
                  cursor: "pointer",
                  fontSize: 11,
                  fontWeight: 700,
                  fontFamily: theme.font,
                  letterSpacing: 1,
                  padding: "6px 8px",
                  borderRadius: 4,
                  zIndex: 1,
                  lineHeight: 1,
                  minWidth: 40,
                  textAlign: "center",
                  transition: "color 0.15s ease",
                }}
                onMouseEnter={(event) => {
                  event.currentTarget.style.color = theme.blue || "#3B82F6";
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.color = theme.muted || "#9CA3AF";
                }}
              >
                {showPassword ? "HIDE" : "SHOW"}
              </button>
            </div>
            {passwordError && (
              <div
                style={{
                  color: theme.red,
                  fontSize: 11,
                  marginTop: 8,
                  fontWeight: 600,
                }}
              >
                {passwordError}
              </div>
            )}

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginTop: 14,
                marginBottom: 4,
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={rememberDevice}
                onChange={(event) =>
                  handleRememberChange(event.target.checked)
                }
                style={{
                  width: 16,
                  height: 16,
                  cursor: "pointer",
                  accentColor: theme.blue || "#3B82F6",
                }}
              />
              <div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: theme.blue || "#3B82F6",
                    fontFamily: theme.font,
                    letterSpacing: 0.5,
                  }}
                >
                  Remember this device
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: theme.muted || "#9CA3AF",
                    fontFamily: theme.font,
                    marginTop: 2,
                  }}
                >
                  {deviceInfo}
                </div>
              </div>
            </label>
          </div>
        )}

        <div style={{ display: "flex", gap: 12 }}>
          {otpsVerified && (
            <button
              onClick={onUnlockAdmin}
              style={authButton(theme.purple, false)}
              className="btn-glass"
            >
              UNLOCK ADMIN
            </button>
          )}
          <button
            onClick={onCancel}
            style={{
              ...authButton(theme.muted, false),
              background: "transparent",
            }}
            className="btn-glass"
          >
            CANCEL
          </button>
        </div>
      </div>
    </div>
  );
}

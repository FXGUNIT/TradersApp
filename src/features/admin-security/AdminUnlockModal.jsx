import React, { useState } from "react";
import {
  getRememberDevice,
  setRememberDevice,
  getDeviceFingerprint,
  parseUserAgent,
} from "../../services/adminAuthService.js";
import AdminEmailOtpPanel from "./AdminEmailOtpPanel.jsx";

export default function AdminUnlockModal({
  authButton,
  authCardStyle,
  labelStyle,
  onCancel,
  onMasterEmailChange,
  onPasswordChange,
  onOtpChange,
  onRequestNew,
  onSendVerificationCodes,
  onUnlockAdmin,
  onVerifyCodes,
  passwordError,
  passwordValue,
  show,
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

  if (!show) return null;

  const {
    masterEmail,
    masterEmailVerified,
    otpStep,
    otps,
  } = verificationState;
  const { browser, os, device } = parseUserAgent();
  const fp = getDeviceFingerprint();
  const deviceInfo = `${browser} on ${os}${device !== "desktop" ? ` (${device})` : ""} - ${fp.substring(0, 12)}...`;

  const inputStyle = {
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
  };

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
          <div style={{ color: theme.purple, fontSize: 20 }}>ADM</div>
          <div
            style={{
              color: theme.purple,
              fontSize: 12,
              letterSpacing: 1.5,
              fontWeight: 800,
            }}
          >
            ADMIN MFA LOGIN
          </div>
        </div>

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
          Restricted admin area. Access attempts are logged for security review.
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={labelStyle}>AUTHENTICATOR CODE</label>
          <input
            type="text"
            inputMode="numeric"
            value={passwordValue}
            onChange={(event) =>
              onPasswordChange(event.target.value.replace(/\D/g, "").slice(0, 6))
            }
            style={{
              ...inputStyle,
              fontFamily: "monospace",
              textAlign: "center",
              letterSpacing: 2,
            }}
            placeholder="000000"
            maxLength="6"
            onKeyDown={(event) => {
              if (event.key === "Enter") onUnlockAdmin();
            }}
          />
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
              marginBottom: 12,
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={rememberDevice}
              onChange={(event) => handleRememberChange(event.target.checked)}
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

          <button
            onClick={onUnlockAdmin}
            style={authButton(theme.purple, false)}
            className="btn-glass"
          >
            UNLOCK WITH AUTHENTICATOR
          </button>
        </div>

        <div
          style={{
            height: 1,
            background: theme.border || "rgba(255,255,255,0.14)",
            margin: "18px 0",
          }}
        />

        <AdminEmailOtpPanel
          authButton={authButton}
          inputStyle={inputStyle}
          labelStyle={labelStyle}
          masterEmail={masterEmail}
          masterEmailVerified={masterEmailVerified}
          onMasterEmailChange={onMasterEmailChange}
          onOtpChange={onOtpChange}
          onRequestNew={onRequestNew}
          onSendVerificationCodes={onSendVerificationCodes}
          onVerifyCodes={onVerifyCodes}
          otpStep={otpStep}
          otps={otps}
          theme={theme}
          verificationError={verificationError}
        />

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
  );
}

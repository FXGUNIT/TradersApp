import React, { useState } from "react";
import { useFocusTrap } from "../../hooks/useFocusTrap.js";
import {
  getDeviceFingerprint,
  getRememberDevice,
  parseUserAgent,
  setRememberDevice,
} from "../../services/adminAuthService.js";
import AdminEmailOtpPanel from "./AdminEmailOtpPanel.jsx";
import AdminTotpGatePanel from "./AdminTotpGatePanel.jsx";
import AdminUnlockStepIndicator from "./AdminUnlockStepIndicator.jsx";

export default function AdminUnlockModal({
  authButton,
  authCardStyle,
  labelStyle,
  onCancel,
  onTotpCodeChange,
  onOtpChange,
  onRequestNew,
  onSendVerificationCodes,
  onUnlockAdmin,
  onUnlockPasskey,
  onVerifyCodes,
  totpError,
  totpValue,
  show,
  theme,
  verificationError,
  verificationState,
}) {
  const [rememberDevice, setRememberDeviceState] = useState(() =>
    getRememberDevice(),
  );
  const modalRef = useFocusTrap(show);

  if (!show) return null;

  const {
    masterEmailVerified: authenticatorVerified,
    otpStep,
    otps,
    recipients,
  } = verificationState;
  const activeStep = authenticatorVerified ? 2 : 1;
  const { browser, os, device } = parseUserAgent();
  const fp = getDeviceFingerprint();
  const deviceInfo = `${browser} on ${os}${device !== "desktop" ? ` (${device})` : ""} - ${fp.substring(0, 12)}...`;

  const handleRememberChange = (checked) => {
    setRememberDeviceState(checked);
    setRememberDevice(checked);
  };

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

  const panelStyle = {
    border: `1px solid ${theme.border || "rgba(255,255,255,0.14)"}`,
    borderRadius: 8,
    padding: 16,
    background: "rgba(255,255,255,0.045)",
  };

  return (
    <div
      ref={modalRef}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.85)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        backdropFilter: "blur(10px)",
        padding: 16,
      }}
    >
      <div
        style={{
          ...authCardStyle,
          width: "min(560px, 100%)",
          maxHeight: "calc(100vh - 32px)",
          overflowY: "auto",
        }}
        className="glass-panel"
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 14,
          }}
        >
          <div>
            <div
              style={{
                color: theme.purple,
                fontSize: 12,
                letterSpacing: 1.5,
                fontWeight: 900,
              }}
            >
              ADMIN MFA LOGIN
            </div>
            <div
              style={{
                color: theme.text || "#FFFFFF",
                fontSize: 20,
                fontWeight: 900,
                marginTop: 4,
              }}
            >
              Two-gate admin verification
            </div>
          </div>
          <div
            style={{
              color: theme.red,
              fontSize: 11,
              fontWeight: 800,
              border: `1px solid ${theme.red}`,
              borderRadius: 8,
              padding: "6px 8px",
              whiteSpace: "nowrap",
            }}
          >
            LOGGED
          </div>
        </div>

        <div
          style={{
            color: theme.muted || "#9CA3AF",
            fontSize: 12,
            lineHeight: 1.5,
            marginBottom: 16,
          }}
        >
          Admin access requires an authenticator code first, then all three
          backend-sent email OTPs. Authenticator setup is not available here.
        </div>

        <AdminUnlockStepIndicator activeStep={activeStep} theme={theme} />

        {!authenticatorVerified ? (
          <AdminTotpGatePanel
            authButton={authButton}
            inputStyle={inputStyle}
            labelStyle={labelStyle}
            onTotpCodeChange={onTotpCodeChange}
            onUnlockAdmin={onUnlockAdmin}
            onUnlockPasskey={onUnlockPasskey}
            panelStyle={panelStyle}
            theme={theme}
            totpError={totpError}
            totpValue={totpValue}
          />
        ) : (
          <div style={panelStyle}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 900,
                letterSpacing: 2,
                color: theme.muted || "#9CA3AF",
                marginBottom: 12,
                textTransform: "uppercase",
              }}
            >
              Gate 2
            </div>

            <AdminEmailOtpPanel
              authButton={authButton}
              inputStyle={inputStyle}
              labelStyle={labelStyle}
              onOtpChange={onOtpChange}
              onRequestNew={onRequestNew}
              onSendVerificationCodes={onSendVerificationCodes}
              onVerifyCodes={onVerifyCodes}
              otpStep={otpStep}
              otps={otps}
              recipients={recipients}
              theme={theme}
              verificationError={verificationError}
            />

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginTop: 14,
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
                    fontWeight: 800,
                    color: theme.blue || "#3B82F6",
                    fontFamily: theme.font,
                  }}
                >
                  Remember this device after both gates pass
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

        <button
          onClick={onCancel}
          style={{
            ...authButton(theme.muted, false),
            background: "transparent",
            marginTop: 14,
          }}
          className="btn-glass"
        >
          CANCEL
        </button>
      </div>
    </div>
  );
}

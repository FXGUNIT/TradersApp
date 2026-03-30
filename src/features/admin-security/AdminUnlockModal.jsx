import React from "react";

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
          <div style={{ color: theme.purple, fontSize: 20 }}>🛡️</div>
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
                  padding: 10,
                  background: "rgba(0,0,0,0.5)",
                  border: "1px solid #333",
                  color: "#fff",
                  borderRadius: 6,
                  fontFamily: theme.font,
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
                  background: "rgba(0,0,0,0.5)",
                  border: "1px solid #333",
                  color: "#fff",
                  borderRadius: 8,
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

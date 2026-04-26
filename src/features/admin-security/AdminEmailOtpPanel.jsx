import React from "react";

export default function AdminEmailOtpPanel({
  authButton,
  inputStyle,
  labelStyle,
  masterEmail,
  masterEmailVerified,
  onMasterEmailChange,
  onOtpChange,
  onRequestNew,
  onSendVerificationCodes,
  onVerifyCodes,
  otpStep,
  otps,
  theme,
  verificationError,
}) {
  if (!masterEmailVerified || !otpStep) {
    return (
      <div style={{ marginBottom: 20 }}>
        <label style={labelStyle}>MASTER ADMIN EMAIL</label>
        <input
          type="email"
          value={masterEmail}
          onChange={(event) => onMasterEmailChange(event.target.value)}
          style={inputStyle}
          placeholder="Enter master admin email"
        />
        {verificationError && (
          <div
            style={{
              color: theme.red,
              fontSize: 11,
              marginTop: 8,
              marginBottom: 12,
              fontWeight: 600,
            }}
          >
            {verificationError}
          </div>
        )}
        <button
          onClick={onSendVerificationCodes}
          style={{
            ...authButton(theme.green || theme.purple, false),
            marginTop: 12,
          }}
          className="btn-glass"
        >
          SEND THREE EMAIL OTP CODES
        </button>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 20 }}>
      <div
        style={{
          color: theme.muted,
          fontSize: 12,
          marginBottom: 16,
          textAlign: "center",
        }}
      >
        Enter the 6-digit codes sent to the three admin email endpoints.
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
              inputMode="numeric"
              value={otps[field]}
              onChange={(event) =>
                onOtpChange(
                  field,
                  event.target.value.replace(/\D/g, "").slice(0, 6),
                )
              }
              style={{
                ...inputStyle,
                padding: 10,
                fontFamily: "monospace",
                textAlign: "center",
                letterSpacing: 2,
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

      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={onVerifyCodes}
          style={authButton(theme.green, false)}
          className="btn-glass"
        >
          VERIFY THREE CODES
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
  );
}

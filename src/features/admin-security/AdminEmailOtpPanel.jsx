import React from "react";

export default function AdminEmailOtpPanel({
  authButton,
  inputStyle,
  labelStyle,
  onOtpChange,
  onRequestNew,
  onSendVerificationCodes,
  onVerifyCodes,
  otpStep,
  otps,
  recipients = [],
  theme,
  verificationError,
}) {
  const fields = ["otp1", "otp2", "otp3"];
  const allCodesReady = fields.every(
    (field) => String(otps?.[field] || "").length === 6,
  );
  const recipientLabel = (index) =>
    recipients[index] || `Admin email ${index + 1}`;

  if (!otpStep) {
    return (
      <div style={{ marginBottom: 4 }}>
        <div
          style={{
            color: theme.muted || "#9CA3AF",
            fontSize: 12,
            lineHeight: 1.5,
            marginBottom: 14,
          }}
        >
          Authenticator accepted. Send the second-gate codes to the
          backend-configured admin email recipients.
        </div>

        {recipients.length > 0 && (
          <div
            style={{
              display: "grid",
              gap: 8,
              marginBottom: 14,
            }}
          >
            {recipients.slice(0, 3).map((recipient, index) => (
              <div
                key={`${recipient}-${index}`}
                style={{
                  padding: "8px 10px",
                  borderRadius: 8,
                  border: `1px solid ${theme.border || "#374151"}`,
                  color: theme.muted || "#9CA3AF",
                  fontSize: 12,
                  background: "rgba(255,255,255,0.035)",
                }}
              >
                {`Email ${index + 1}: ${recipient}`}
              </div>
            ))}
          </div>
        )}

        {verificationError && (
          <div
            style={{
              color: theme.red,
              fontSize: 11,
              marginTop: 8,
              marginBottom: 12,
              fontWeight: 700,
            }}
          >
            {verificationError}
          </div>
        )}

        <button
          onClick={onSendVerificationCodes}
          style={authButton(theme.green || theme.purple, false)}
          className="btn-glass"
        >
          SEND THREE EMAIL OTP CODES
        </button>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 4 }}>
      <div
        style={{
          color: theme.muted || "#9CA3AF",
          fontSize: 12,
          marginBottom: 16,
          lineHeight: 1.5,
        }}
      >
        Enter all three 6-digit codes. The backend verifies them together.
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          marginBottom: 16,
        }}
      >
        {fields.map((field, index) => (
          <div key={field}>
            <label style={{ ...labelStyle, fontSize: 11 }}>
              {recipientLabel(index)}
            </label>
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
              onKeyDown={(event) => {
                if (event.key === "Enter" && allCodesReady) onVerifyCodes();
              }}
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
            fontWeight: 700,
          }}
        >
          {verificationError}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          onClick={onVerifyCodes}
          disabled={!allCodesReady}
          style={{
            ...authButton(theme.green, false),
            opacity: allCodesReady ? 1 : 0.55,
          }}
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
          SEND NEW CODES
        </button>
      </div>
    </div>
  );
}

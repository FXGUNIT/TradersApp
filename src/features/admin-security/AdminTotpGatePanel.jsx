import React from "react";

export default function AdminTotpGatePanel({
  authButton,
  inputStyle,
  labelStyle,
  onTotpCodeChange,
  onUnlockAdmin,
  panelStyle,
  theme,
  totpError,
  totpValue,
}) {
  const ready = String(totpValue || "").length === 6;

  return (
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
        Gate 1
      </div>
      <label style={labelStyle}>AUTHENTICATOR CODE</label>
      <input
        type="text"
        inputMode="numeric"
        value={totpValue}
        onChange={(event) =>
          onTotpCodeChange(event.target.value.replace(/\D/g, "").slice(0, 6))
        }
        style={{
          ...inputStyle,
          fontFamily: "monospace",
          textAlign: "center",
          letterSpacing: 2,
        }}
        placeholder="000000"
        maxLength="6"
        autoFocus
        onKeyDown={(event) => {
          if (event.key === "Enter" && ready) onUnlockAdmin();
        }}
      />
      {totpError && (
        <div
          style={{
            color: theme.red,
            fontSize: 11,
            marginTop: 8,
            fontWeight: 700,
          }}
        >
          {totpError}
        </div>
      )}

      <button
        onClick={onUnlockAdmin}
        disabled={!ready}
        style={{
          ...authButton(theme.purple, false),
          marginTop: 14,
          opacity: ready ? 1 : 0.55,
        }}
        className="btn-glass"
      >
        VERIFY AUTHENTICATOR
      </button>
    </div>
  );
}

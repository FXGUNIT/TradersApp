import React from "react";

export default function AdminUnlockStepIndicator({ activeStep, theme }) {
  const steps = [
    ["1", "Authenticator"],
    ["2", "Email OTPs"],
  ];
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 8,
        marginBottom: 18,
      }}
    >
      {steps.map(([number, label], index) => {
        const active = activeStep === index + 1;
        const complete = activeStep > index + 1;
        const color = complete
          ? theme.green || "#22C55E"
          : active
            ? theme.purple || "#A855F7"
            : theme.muted || "#9CA3AF";
        return (
          <div
            key={label}
            style={{
              minHeight: 44,
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "9px 10px",
              borderRadius: 8,
              border: `1px solid ${active || complete ? color : theme.border || "#374151"}`,
              background: active
                ? "rgba(168,85,247,0.12)"
                : complete
                  ? "rgba(34,197,94,0.10)"
                  : "rgba(255,255,255,0.04)",
            }}
          >
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: color,
                color: "#06070A",
                fontSize: 12,
                fontWeight: 900,
              }}
            >
              {complete ? "OK" : number}
            </div>
            <div
              style={{
                color,
                fontSize: 11,
                fontWeight: 800,
                textTransform: "uppercase",
              }}
            >
              {label}
            </div>
          </div>
        );
      })}
    </div>
  );
}

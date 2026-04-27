import React, { useState } from "react";
import { Linkedin } from "lucide-react";

export const FounderCard = ({
  linkedInUrl = "https://linkedin.com/in/singhgunit",
  theme = "lumiere",
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  const normalizedTheme =
    theme === "day"
      ? "lumiere"
      : theme === "night"
        ? "midnight"
        : theme === "eye-comfort"
          ? "amber"
          : theme;

  const themeColors = {
    lumiere: {
      bg: "var(--surface-glass, rgba(255, 255, 255, 0.95))",
      border: "var(--border-subtle, rgba(0, 0, 0, 0.1))",
      text: "var(--text-primary, #1A1D23)",
      subtext: "var(--text-secondary, #64748B)",
      linkBg: "var(--accent-primary, #2563eb)",
      linkBorder: "var(--accent-primary, #2563eb)",
      linkText: "var(--accent-text, #FFFFFF)",
    },
    midnight: {
      bg: "var(--surface-glass, rgba(30, 41, 59, 0.95))",
      border: "var(--border-subtle, rgba(51, 65, 85, 0.5))",
      text: "var(--text-primary, #F8FAFC)",
      subtext: "var(--text-secondary, #94A3B8)",
      linkBg: "var(--accent-primary, #2563eb)",
      linkBorder: "var(--accent-primary, #2563eb)",
      linkText: "var(--accent-text, #FFFFFF)",
    },
    amber: {
      bg: "var(--surface-glass, rgba(238, 232, 213, 0.95))",
      border: "var(--border-subtle, rgba(211, 198, 170, 0.5))",
      text: "var(--text-primary, #586E75)",
      subtext: "var(--text-secondary, #657B83)",
      linkBg: "var(--accent-primary, #2563eb)",
      linkBorder: "var(--accent-primary, #2563eb)",
      linkText: "var(--accent-text, #FFFFFF)",
    },
  };

  const colors = themeColors[normalizedTheme] || themeColors.lumiere;

  return (
    <div
      data-testid="founder-card"
      style={{ padding: 0, borderTop: "none", background: "transparent" }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "12px",
          padding: "32px",
          background: colors.bg,
          backdropFilter: "blur(8px)",
          border: `1px solid ${colors.border}`,
          borderRadius: "12px",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.08)",
          cursor: "pointer",
          minWidth: "240px",
          position: "relative",
        }}
      >
        <div
          style={{
            width: "60px",
            height: "60px",
            borderRadius: "50%",
            overflow: "hidden",
            border: "3px solid var(--accent-primary, #D4AF37)",
            boxShadow:
              "0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
            background: "var(--surface-elevated, #FFFFFF)",
          }}
        >
          <img
            src="/founder.jpeg"
            alt="Gunit Singh"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>

        <div style={{ textAlign: "center", position: "relative" }}>
          <div
            style={{
              fontSize: "14px",
              fontWeight: 700,
              color: colors.text,
              fontFamily: var(--font-ui),
            }}
          >
            Gunit Singh
          </div>
          <div
            style={{
              fontSize: "11px",
              color: colors.subtext,
              fontFamily: var(--font-ui),
              marginTop: "4px",
              fontWeight: 500,
            }}
          >
            Commander-in-Chief
          </div>

          {showTooltip && (
            <div
              data-testid="founder-tooltip"
              style={{
                position: "absolute",
                bottom: "100%",
                left: "50%",
                transform: "translateX(-50%) translateY(-8px)",
                background: colors.bg,
                backdropFilter: "blur(10px)",
                border: `1px solid ${colors.border}`,
                borderRadius: "8px",
                padding: "12px 16px",
                whiteSpace: "nowrap",
                fontSize: "11px",
                color: colors.text,
                fontFamily:
                  var(--font-ui),
                fontWeight: 500,
                zIndex: 1000,
                boxShadow: "0 8px 32px rgba(0, 0, 0, 0.1)",
                pointerEvents: "none",
              }}
            >
              Built with Enterprise Security
              <br />
              by Gunit Singh - Meerut, India
            </div>
          )}
        </div>

        <a
          href={linkedInUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
            padding: "10px 20px",
            background: colors.linkBg,
            border: `1px solid ${colors.linkBorder}`,
            borderRadius: "9999px",
            color: colors.linkText,
            fontSize: "12px",
            fontWeight: 600,
            textDecoration: "none",
            boxShadow: "0 4px 12px rgba(0, 119, 181, 0.2)",
          }}
        >
          <Linkedin size={14} />
          LinkedIn
        </a>
      </div>
    </div>
  );
};

export default FounderCard;

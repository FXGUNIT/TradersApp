import React, { useState } from "react";
import { Linkedin } from "lucide-react";

/**
 * FounderCard Component
 * Displays founder profile with hover glassmorphism tooltip
 *
 * Props:
 * - linkedInUrl: LinkedIn profile URL (optional)
 * - theme: Current app theme for styling
 */
export const FounderCard = ({
  linkedInUrl = "https://linkedin.com/in/singhgunit",
  theme = "day",
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  // Theme-aware colors
  const themeColors = {
    day: {
      bg: "rgba(255, 255, 255, 0.95)",
      border: "rgba(0, 0, 0, 0.1)",
      text: "#1A1D23",
      subtext: "#64748B",
      hover: "rgba(0, 0, 0, 0.05)",
    },
    night: {
      bg: "rgba(30, 41, 59, 0.95)",
      border: "rgba(51, 65, 85, 0.5)",
      text: "#F8FAFC",
      subtext: "#94A3B8",
      hover: "rgba(51, 65, 85, 0.5)",
    },
    "eye-comfort": {
      bg: "rgba(238, 232, 213, 0.95)",
      border: "rgba(211, 198, 170, 0.5)",
      text: "#586E75",
      subtext: "#657B83",
      hover: "rgba(211, 198, 170, 0.3)",
    },
  };

  const colors = themeColors[theme] || themeColors.day;

  return (
    <div
      data-testid="founder-card"
      style={{
        padding: "0px",
        borderTop: "none",
        background: "transparent",
        position: "relative",
      }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onMouseOver={() => setShowTooltip(true)}
      onMouseOut={() => setShowTooltip(false)}
    >
      {/* Founder Card Container */}
        <div
          style={{
            display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "12px",
          padding: "32px",
          background: "var(--surface-elevated, rgba(255, 255, 255, 0.8))",
          backdropFilter: "blur(8px)",
          border: "1px solid #F3F4F6",
          borderRadius: "12px",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.08)",
          transition: "all 0.3s ease",
          cursor: "pointer",
          minWidth: "240px",
        }}
      >
        {/* Founder Profile Picture */}
        <div
          style={{
            position: "relative",
            width: "60px",
            height: "60px",
            borderRadius: "50%",
            overflow: "hidden",
            border: "3px solid #D4AF37",
            boxShadow:
              "0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
            background: "var(--surface-elevated, #FFFFFF)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* Founder Profile Image */}
          <img
            src="/founder.jpeg"
            alt="Gunit Singh"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        </div>

        {/* Founder Name with Hover Effect */}
        <div
          style={{
            textAlign: "center",
            position: "relative",
          }}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          <div
            style={{
              fontSize: "14px",
              fontWeight: "700",
              color: colors.text,
              fontFamily:
                "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
              letterSpacing: "-0.02em",
              marginBottom: "2px",
            }}
          >
            Gunit Singh
          </div>
          <div
            style={{
              fontSize: "11px",
              color: colors.subtext,
              fontFamily:
                "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
              marginTop: "4px",
              fontWeight: "500",
              letterSpacing: "-0.02em",
            }}
          >
            Commander-in-Chief
          </div>

          {/* Glassmorphism Tooltip */}
          {showTooltip && (
            <div
              data-testid="founder-tooltip"
              style={{
                position: "absolute",
                bottom: "100%",
                left: "50%",
                transform: "translateX(-50%) translateY(-8px)",
                background: "rgba(255, 255, 255, 0.15)",
                backdropFilter: "blur(10px)",
                border: "1px solid rgba(255, 255, 255, 0.25)",
                borderRadius: "8px",
                padding: "12px 16px",
                whiteSpace: "nowrap",
                fontSize: "11px",
                color: colors.text,
                fontFamily:
                  "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
                fontWeight: "500",
                zIndex: 1000,
                boxShadow: "0 8px 32px rgba(0, 0, 0, 0.1)",
                animation: "fadeIn 0.2s ease-out",
                pointerEvents: "none",
              }}
            >
              Built with Enterprise Security
              <br />
              by Gunit Singh — Meerut, India
              {/* Arrow pointing down */}
              <div
                style={{
                  position: "absolute",
                  bottom: "-4px",
                  left: "50%",
                  width: "8px",
                  height: "8px",
                  background: "rgba(255, 255, 255, 0.15)",
                  borderRight: "1px solid rgba(255, 255, 255, 0.25)",
                  borderBottom: "1px solid rgba(255, 255, 255, 0.25)",
                  transform: "translateX(-50%) rotate(45deg)",
                  backdropFilter: "blur(10px)",
                }}
              />
            </div>
          )}
        </div>

        {/* LinkedIn Button */}
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
            background: "var(--accent-primary, #2563eb)",
            border: `1px solid var(--accent-primary, #2563eb)`,
            borderRadius: "9999px",
            color: "white",
            fontSize: "12px",
            fontWeight: "600",
            cursor: "pointer",
            transition: "all 0.2s ease",
            fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
            textDecoration: "none",
            boxShadow: "0 4px 12px rgba(0, 119, 181, 0.2)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow =
              "0 8px 20px rgba(0, 119, 181, 0.3)";
            e.currentTarget.style.transform = "translateY(-2px)";
            e.currentTarget.style.background = "#006699";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow =
              "0 4px 12px rgba(0, 119, 181, 0.2)";
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.background = "#0077B5";
          }}
        >
          <Linkedin size={14} />
          <span>Connect</span>
        </a>
      </div>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(-12px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(-8px);
          }
        }
      `}</style>
    </div>
  );
};

export default FounderCard;

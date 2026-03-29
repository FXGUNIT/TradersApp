import React, { useEffect, useMemo, useState } from "react";
import ThemeSwitcher from "../components/ThemeSwitcher.jsx";
import AiEnginesStatus from "../components/AiEnginesStatus.jsx";
import { getHubContent } from "../services/clients/ContentClient.js";

export default function RegimentHub({
  onNavigate,
  theme,
  currentTheme,
  onThemeChange,
  aiStatuses = [],
}) {
  const normalizedTheme = currentTheme || theme || "lumiere";
  const isDark = normalizedTheme === "midnight" || normalizedTheme === "night";
  const [hoveredCard, setHoveredCard] = useState(null);
  const [hubContent, setHubContent] = useState({
    eyebrow: "TRADERS REGIMENT",
    title: "Command Centre",
    description: "Select your operational wing to proceed.",
    cards: [],
  });

  useEffect(() => {
    let active = true;
    getHubContent().then((content) => {
      if (active) setHubContent(content);
    });
    return () => {
      active = false;
    };
  }, []);

  const icons = useMemo(
    () => ({
      artillery: (
        <svg
          width="48"
          height="48"
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle
            cx="24"
            cy="24"
            r="22"
            stroke="currentColor"
            strokeWidth="1.5"
            opacity="0.3"
          />
          <circle
            cx="24"
            cy="24"
            r="14"
            stroke="currentColor"
            strokeWidth="1.5"
            opacity="0.5"
          />
          <circle
            cx="24"
            cy="24"
            r="6"
            stroke="currentColor"
            strokeWidth="1.5"
            opacity="0.8"
          />
          <circle cx="24" cy="24" r="2" fill="currentColor" />
          <line
            x1="24"
            y1="0"
            x2="24"
            y2="10"
            stroke="currentColor"
            strokeWidth="1"
            opacity="0.4"
          />
          <line
            x1="24"
            y1="38"
            x2="24"
            y2="48"
            stroke="currentColor"
            strokeWidth="1"
            opacity="0.4"
          />
          <line
            x1="0"
            y1="24"
            x2="10"
            y2="24"
            stroke="currentColor"
            strokeWidth="1"
            opacity="0.4"
          />
          <line
            x1="38"
            y1="24"
            x2="48"
            y2="24"
            stroke="currentColor"
            strokeWidth="1"
            opacity="0.4"
          />
        </svg>
      ),
      consciousness: (
        <svg
          width="48"
          height="48"
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="24" cy="12" r="4" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="12" cy="30" r="4" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="36" cy="30" r="4" stroke="currentColor" strokeWidth="1.5" />
          <circle
            cx="24"
            cy="38"
            r="3"
            stroke="currentColor"
            strokeWidth="1.5"
            opacity="0.6"
          />
          <circle
            cx="8"
            cy="18"
            r="3"
            stroke="currentColor"
            strokeWidth="1.5"
            opacity="0.6"
          />
          <circle
            cx="40"
            cy="18"
            r="3"
            stroke="currentColor"
            strokeWidth="1.5"
            opacity="0.6"
          />
          <line
            x1="24"
            y1="16"
            x2="14"
            y2="27"
            stroke="currentColor"
            strokeWidth="1"
            opacity="0.5"
          />
          <line
            x1="24"
            y1="16"
            x2="34"
            y2="27"
            stroke="currentColor"
            strokeWidth="1"
            opacity="0.5"
          />
          <line
            x1="15"
            y1="32"
            x2="33"
            y2="32"
            stroke="currentColor"
            strokeWidth="1"
            opacity="0.5"
          />
          <line
            x1="10"
            y1="20"
            x2="12"
            y2="27"
            stroke="currentColor"
            strokeWidth="1"
            opacity="0.3"
          />
          <line
            x1="38"
            y1="20"
            x2="36"
            y2="27"
            stroke="currentColor"
            strokeWidth="1"
            opacity="0.3"
          />
          <line
            x1="14"
            y1="33"
            x2="22"
            y2="36"
            stroke="currentColor"
            strokeWidth="1"
            opacity="0.3"
          />
          <line
            x1="34"
            y1="33"
            x2="26"
            y2="36"
            stroke="currentColor"
            strokeWidth="1"
            opacity="0.3"
          />
          <circle cx="24" cy="24" r="1.5" fill="currentColor" opacity="0.8" />
        </svg>
      ),
    }),
    [],
  );

  const cards = hubContent.cards.map((card) => ({
    ...card,
    icon: icons[card.id],
    accentColor: card.accentToken,
    glowColor: card.glowToken,
  }));

  const textColor = "var(--text-primary, #111827)";
  const mutedColor = "var(--text-secondary, #9CA3AF)";
  const cardBg = "var(--surface-glass, rgba(255,255,255,0.72))";
  const cardBorder = "var(--border-subtle, rgba(0,0,0,0.08))";

  return (
    <div
      style={{
        minHeight: "100vh",
        background: isDark
          ? "radial-gradient(ellipse at 30% 20%, rgba(10,132,255,0.08) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(191,90,242,0.08) 0%, transparent 50%), var(--base-layer, #05070A)"
          : "radial-gradient(ellipse at 30% 20%, rgba(10,132,255,0.04) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(191,90,242,0.04) 0%, transparent 50%), var(--base-layer, #FFFFFF)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 24px",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif',
      }}
    >
      <div
        style={{
          textAlign: "center",
          marginBottom: 56,
          width: "100%",
          maxWidth: 900,
          display: "flex",
          flexDirection: "column",
          gap: 32,
        }}
      >
        <div
          style={{
            display: "flex",
            width: "100%",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <AiEnginesStatus statuses={aiStatuses} />
          {currentTheme && onThemeChange && (
            <ThemeSwitcher
              currentTheme={currentTheme}
              onThemeChange={onThemeChange}
            />
          )}
        </div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 6,
            color: mutedColor,
            textTransform: "uppercase",
            marginBottom: 16,
          }}
        >
          {hubContent.eyebrow}
        </div>
        <h1
          style={{
            fontSize: "clamp(28px, 5vw, 44px)",
            fontWeight: 800,
            color: textColor,
            margin: 0,
            letterSpacing: -1,
            lineHeight: 1.1,
          }}
        >
          {hubContent.title}
        </h1>
        <p
          style={{
            fontSize: 14,
            color: mutedColor,
            marginTop: 12,
            maxWidth: 400,
            lineHeight: 1.6,
          }}
        >
          {hubContent.description}
        </p>
      </div>

      <div
        style={{
          display: "flex",
          gap: 28,
          flexWrap: "wrap",
          justifyContent: "center",
          maxWidth: 900,
          width: "100%",
        }}
      >
        {cards.map((card) => {
          const isHovered = hoveredCard === card.id;
          return (
            <button
              key={card.id}
              onClick={() => onNavigate(card.action)}
              onMouseEnter={() => setHoveredCard(card.id)}
              onMouseLeave={() => setHoveredCard(null)}
              style={{
                flex: "1 1 360px",
                maxWidth: 420,
                minHeight: 320,
                background: cardBg,
                backdropFilter: "blur(24px)",
                WebkitBackdropFilter: "blur(24px)",
                border: `1px solid ${
                  isHovered ? `${card.accentColor}55` : cardBorder
                }`,
                borderRadius: 20,
                padding: "44px 36px",
                cursor: "pointer",
                transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                transform: isHovered
                  ? "translateY(-6px) scale(1.015)"
                  : "translateY(0) scale(1)",
                boxShadow: isHovered
                  ? `0 20px 60px ${card.glowColor}, 0 0 80px ${card.glowColor}`
                  : "var(--aura-shadow, 0 4px 24px rgba(0,0,0,0.08))",
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: 20,
                textAlign: "left",
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: 20,
                  background: `radial-gradient(circle at 50% 50%, ${card.accentColor}08 0%, transparent 70%)`,
                  opacity: isHovered ? 1 : 0,
                  transition: "opacity 0.6s ease",
                  animation: isHovered ? "hub-pulse 3s ease-in-out infinite" : "none",
                  pointerEvents: "none",
                }}
              />

              <div
                style={{
                  color: card.accentColor,
                  transition: "transform 0.4s ease",
                  transform: isHovered ? "scale(1.1)" : "scale(1)",
                }}
              >
                {card.icon}
              </div>

              <h2
                style={{
                  fontSize: 15,
                  fontWeight: 800,
                  letterSpacing: 2.5,
                  color: isHovered ? card.accentColor : textColor,
                  margin: 0,
                  textTransform: "uppercase",
                  transition: "color 0.3s ease",
                  lineHeight: 1.4,
                }}
              >
                {card.title}
              </h2>

              <p
                style={{
                  fontSize: 13,
                  color: mutedColor,
                  margin: 0,
                  lineHeight: 1.7,
                  flex: 1,
                }}
              >
                {card.description}
              </p>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 12,
                  fontWeight: 700,
                  color: card.accentColor,
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                  opacity: isHovered ? 1 : 0.5,
                  transition: "opacity 0.3s ease, transform 0.3s ease",
                  transform: isHovered ? "translateX(4px)" : "translateX(0)",
                }}
              >
                Enter Wing -&gt;
              </div>
            </button>
          );
        })}
      </div>

      <div
        style={{
          marginTop: 56,
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: 3,
          color: mutedColor,
          textTransform: "uppercase",
          opacity: 0.5,
        }}
      >
        ENCRYPTED · MULTI-MODEL · INSTITUTIONAL GRADE
      </div>

      <style>{`
        @keyframes hub-pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

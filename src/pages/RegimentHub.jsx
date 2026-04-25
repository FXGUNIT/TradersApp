import React, { useEffect, useMemo, useState } from "react";
import ThemeSwitcher from "../components/ThemeSwitcher.jsx";
import AiEnginesStatus from "../components/AiEnginesStatus.jsx";
import { getHubContent } from "../services/clients/ContentClient.js";

// ─── Inline SVG Chart Components ─────────────────────────────────────────────

function FounderStoryChart() {
  const bars = [30, 55, 45, 70, 60, 85, 75];
  const max = Math.max(...bars);
  const W = 120, H = 52;
  const barW = W / bars.length - 4;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible" }}>
      {bars.map((h, i) => {
        const bh = (h / max) * H * 0.9;
        const x = i * (W / bars.length) + 2;
        const y = H - bh;
        return (
          <rect
            key={i} x={x} y={y} width={barW} height={bh}
            rx={3}
            fill={i === bars.length - 1 ? "#d4a520" : "rgba(212,165,32,0.35)"}
          >
            <animate attributeName="height" from="0" to={bh} dur="0.6s" begin={`${i * 0.07}s`} fill="freeze" />
            <animate attributeName="y" from={H} to={y} dur="0.6s" begin={`${i * 0.07}s`} fill="freeze" />
          </rect>
        );
      })}
      <line x1={0} y1={H + 2} x2={W} y2={H + 2} stroke="rgba(212,165,32,0.2)" strokeWidth={1} />
    </svg>
  );
}

function ProductVisionChart() {
  const data = [
    { label: "Signals", value: 22, color: "rgba(239,68,68,0.5)" },
    { label: "Consensus", value: 78, color: "#4ade80" },
    { label: "Governance", value: 91, color: "#60a5fa" },
    { label: "Self-Improve", value: 85, color: "#d4a520" },
  ];
  const W = 120, H = 52;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      {data.map((d, i) => {
        const bx = 4, by = i * (H / data.length) + 4;
        const bw = (d.value / 100) * (W - 8);
        const bh = H / data.length - 6;
        return (
          <g key={i}>
            <rect x={bx} y={by} width={bw} height={bh} rx={3} fill={d.color}>
              <animate attributeName="width" from="0" to={bw} dur="0.7s" begin={`${i * 0.1}s`} fill="freeze" />
            </rect>
          </g>
        );
      })}
    </svg>
  );
}

function ArchitectureChart() {
  const nodes = [
    { x: 60, y: 18, r: 8, label: "BFF" },
    { x: 18, y: 44, r: 6, label: "ML" },
    { x: 60, y: 44, r: 6, label: "Telegram" },
    { x: 102, y: 44, r: 6, label: "Firebase" },
  ];
  const W = 120, H = 60;
  const cx = 60, cy = 30;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      {nodes.filter(n => n.label !== "BFF").map((n, i) => (
        <line
          key={i} x1={cx} y1={cy} x2={n.x} y2={n.y}
          stroke="rgba(212,165,32,0.3)" strokeWidth={1.5}
          strokeDasharray="3,3"
        >
          <animate attributeName="stroke-dashoffset" from="100" to="0" dur="0.8s" fill="freeze" />
        </line>
      ))}
      {nodes.map((n, i) => (
        <g key={i}>
          <circle cx={n.x} cy={n.y} r={n.r + 3} fill="none" stroke="rgba(212,165,32,0.2)" strokeWidth={1} />
          <circle cx={n.x} cy={n.y} r={n.r} fill={n.label === "BFF" ? "#d4a520" : "rgba(212,165,32,0.2)"} stroke="#d4a520" strokeWidth={1.5} />
          <animate attributeName="opacity" from="0" to="1" dur="0.4s" begin={`${i * 0.12}s`} fill="freeze" />
        </g>
      ))}
    </svg>
  );
}

function AnimatedLineChart() {
  const points = [
    [0, 42], [15, 38], [30, 45], [45, 28], [60, 35], [75, 18], [90, 22], [105, 12], [120, 8]
  ];
  const maxY = 50, H = 36, W = 120;
  const pathD = points.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x} ${H - (y / maxY) * H}`).join(" ");
  const fillD = pathD + ` L ${W} ${H} L 0 ${H} Z`;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#d4a520" stopOpacity={0.4} />
          <stop offset="100%" stopColor="#d4a520" stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={fillD} fill="url(#areaGrad)" />
      <path d={pathD} fill="none" stroke="#d4a520" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
        strokeDasharray="300" strokeDashoffset="300">
        <animate attributeName="stroke-dashoffset" from="300" to="0" dur="1.2s" fill="freeze" />
      </path>
      {points.filter((_, i) => i % 3 === 0).map(([x, y], i) => (
        <circle key={i} cx={x} cy={H - (y / maxY) * H} r={2.5} fill="#d4a520">
          <animate attributeName="opacity" from="0" to="1" dur="0.3s" begin={`${0.8 + i * 0.15}s`} fill="freeze" />
        </circle>
      ))}
    </svg>
  );
}

function MiniRadarChart() {
  const arms = 5;
  const R = 22;
  const cx = 30, cy = 26;
  const values = [0.9, 0.6, 0.75, 0.85, 0.7];
  const angles = values.map((_, i) => (i * 2 * Math.PI) / arms - Math.PI / 2);
  const pts = values.map((v, i) => ({
    x: cx + R * v * Math.cos(angles[i]),
    y: cy + R * v * Math.sin(angles[i]),
  }));
  const poly = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";
  const polyFill = poly.replace("M", "M") + ` L ${cx} ${cy} Z`;
  return (
    <svg width={60} height={52} viewBox="0 0 60 52">
      {values.map((_, i) => {
        const ax = cx + R * Math.cos(angles[i]);
        const ay = cy + R * Math.sin(angles[i]);
        return <line key={i} x1={cx} y1={cy} x2={ax} y2={ay} stroke="rgba(212,165,32,0.2)" strokeWidth={1} />;
      })}
      {[0.33, 0.66, 1].map((r, i) => (
        <polygon
          key={i}
          points={angles.map(a => `${cx + R * r * Math.cos(a)},${cy + R * r * Math.sin(a)}`).join(" ")}
          fill="none" stroke="rgba(212,165,32,0.15)" strokeWidth={1}
        />
      ))}
      <polygon
        points={pts.map(p => `${p.x},${p.y}`).join(" ")}
        fill="rgba(212,165,32,0.2)" stroke="#d4a520" strokeWidth={1.5}
      />
      <circle cx={cx} cy={cy} r={3} fill="#d4a520" />
    </svg>
  );
}

// ─── Blog Post Data ────────────────────────────────────────────────────────────

const BLOG_POSTS = [
  {
    id: "founder-story",
    url: "/blog/founder-story/",
    eyebrow: "Founder's Story",
    title: "From BCCI Dugouts to Building the World's Most Advanced Trading AI",
    excerpt: "I played cricket at BCCI and UPCA level. I've been a retail trader staring at MNQ and Nifty charts alone. I know exactly what institutional traders have that retail traders don't. So I built it.",
    tags: ["EDGE", "INSTITUTIONAL", "RETAIL"],
    chart: <FounderStoryChart />,
    stat: "15 Years of Cricket + 7 Years of Sales = This",
  },
  {
    id: "product-vision",
    url: "/blog/product-vision/",
    eyebrow: "Product Vision",
    title: "Why 'Signals' Was Never the Point — And What We Actually Built Instead",
    excerpt: "A signals service tells you what to trade. Traders Regiment tells you what the institutional quant desk thinks — and why. Here's the complete product vision.",
    tags: ["QUANT", "ALPHA", "HEDGE FUND"],
    chart: <ProductVisionChart />,
    stat: "78/100 Consensus Score vs 22/100 Signal Service",
  },
  {
    id: "architecture",
    url: "/blog/architecture/",
    eyebrow: "Technical Deep Dive",
    title: "How We Built a Self-Improving AI That Thinks Like a Quant Team",
    excerpt: "12 AI models voting on every decision. A Watchtower that self-corrects. A Board Room that governs every signal. Here's the complete architecture.",
    tags: ["MACHINE LEARNING", "SYSTEM", "SELF-IMPROVING"],
    chart: <ArchitectureChart />,
    stat: "12 Models · Board Room · Watchtower · Self-Improving",
  },
];

export default function RegimentHub({
  onNavigate,
  profile,
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
  const daysUsed = Number(profile?.daysUsed ?? profile?.days_used ?? profile?.dayCounter ?? 0);
  const daysRemaining = Math.max(10 - daysUsed, 0);
  const eligibilityMessage = profile?.trainingEligibilityMessage || "";

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
        {eligibilityMessage ? (
          <div
            style={{
              alignSelf: "center",
              maxWidth: 540,
              padding: "16px 18px",
              borderRadius: 18,
              background: isDark
                ? "rgba(59,130,246,0.12)"
                : "rgba(37,99,235,0.08)",
              border: isDark
                ? "1px solid rgba(96,165,250,0.26)"
                : "1px solid rgba(37,99,235,0.16)",
              textAlign: "left",
            }}
          >
            <div
              style={{
                color: isDark ? "#93C5FD" : "#1D4ED8",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 2,
                textTransform: "uppercase",
                marginBottom: 8,
              }}
            >
              Training Data Policy
            </div>
            <div
              style={{
                fontSize: 13,
                lineHeight: 1.7,
                color: textColor,
              }}
            >
              {eligibilityMessage}
              {!profile?.isTrainingEligible
                ? ` ${daysRemaining} more distinct app-use day${daysRemaining === 1 ? "" : "s"} before your data can train the models.`
                : ""}
            </div>
          </div>
        ) : null}
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

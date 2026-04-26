/**
 * BlogSection — shared blog insight cards for Traders Regiment
 * Displays 3 blog posts + 1 stats card with inline SVG charts
 * Used on: CollectiveConsciousness (default home), RegimentHub
 */
import React from "react";

const BLOG_POSTS = [
  {
    id: "founder-story",
    url: "/blog/founder-story/",
    eyebrow: "Founder's Story",
    title: "From BCCI Dugouts to Building the World's Most Advanced Trading AI",
    excerpt:
      "I played cricket at BCCI and UPCA level. I've been a retail trader staring at MNQ and Nifty charts alone. I know exactly what institutional traders have that retail traders don't. So I built it.",
    tags: ["EDGE", "INSTITUTIONAL", "RETAIL"],
    metric: "01",
    metricLabel: "Operator origin",
    summary: "Founder-led product thesis grounded in market pain.",
  },
  {
    id: "product-vision",
    url: "/blog/product-vision/",
    eyebrow: "Product Vision",
    title: "Why 'Signals' Was Never the Point — And What We Actually Built Instead",
    excerpt:
      "A signals service tells you what to trade. Traders Regiment tells you what the institutional quant desk thinks — and why.",
    tags: ["QUANT", "ALPHA", "HEDGE FUND"],
    metric: "02",
    metricLabel: "Product differentiation",
    summary: "Institutional quant desk intelligence, not generic signals.",
  },
  {
    id: "architecture",
    url: "/blog/architecture/",
    eyebrow: "Technical Deep Dive",
    title: "How We Built a Self-Improving Trading AI That Thinks Like a Quant Team",
    excerpt:
      "12 AI models voting on every decision. A Watchtower that self-corrects. A Board Room that governs every signal.",
    tags: ["SELF-IMPROVING", "SYSTEM", "QUANTITATIVE ANALYSIS"],
    metric: "03",
    metricLabel: "System architecture",
    summary: "12-model ensemble with Board Room governance and self-correction.",
  },
];

function MiniBarChart() {
  const bars = [30, 55, 45, 70, 60, 85, 75];
  const max = Math.max(...bars);
  const W = 80,
    H = 36;
  const barW = W / bars.length - 3;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      {bars.map((h, i) => {
        const bh = (h / max) * H * 0.88;
        const x = i * (W / bars.length) + 2;
        const y = H - bh;
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={barW}
            height={bh}
            rx={2}
            fill={i === bars.length - 1 ? "#d4a520" : "rgba(212,165,32,0.35)"}
          />
        );
      })}
    </svg>
  );
}

function MiniLineChart() {
  const pts = [
    [0, 28],
    [13, 22],
    [26, 30],
    [39, 16],
    [52, 22],
    [65, 10],
    [78, 14],
  ];
  const maxY = 34,
    H = 36,
    W = 80;
  const pathD = pts
    .map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x} ${H - y}`)
    .join(" ");
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <defs>
        <linearGradient id="liGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#d4a520" stopOpacity={0.3} />
          <stop offset="100%" stopColor="#d4a520" stopOpacity={0} />
        </linearGradient>
      </defs>
      <path
        d={pathD + ` L ${W} ${H} L 0 ${H} Z`}
        fill="url(#liGrad)"
      />
      <path
        d={pathD}
        fill="none"
        stroke="#d4a520"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </svg>
  );
}

function MiniProgressChart() {
  const rows = [
    { label: "EDGE", pct: 95 },
    { label: "INSTITUTIONAL", pct: 88 },
    { label: "SELF-IMPROVING", pct: 82 },
    { label: "QUANTITATIVE", pct: 91 },
  ];
  return (
    <svg width={80} height={36} viewBox="0 0 80 36">
      {rows.map((r, i) => {
        const y = i * 9 + 4;
        const pw = (r.pct / 100) * 60;
        return (
          <g key={i}>
            <rect x={0} y={y} width={pw} height={4} rx={2} fill="#d4a520" />
            <rect
              x={0}
              y={y}
              width={60}
              height={4}
              rx={2}
              fill="rgba(212,165,32,0.15)"
            />
          </g>
        );
      })}
    </svg>
  );
}

const CHARTS = [MiniBarChart, MiniLineChart, MiniProgressChart];

function BlogCard({ post, chart: Chart }) {
  return (
    <a
      href={post.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: "16px 18px",
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(212,165,32,0.12)",
        borderRadius: 14,
        textDecoration: "none",
        transition: "border-color 0.2s, transform 0.2s",
        cursor: "pointer",
        minWidth: 0,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "rgba(212,165,32,0.4)";
        e.currentTarget.style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "rgba(212,165,32,0.12)";
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: 2,
              color: "#d4a520",
              textTransform: "uppercase",
              marginBottom: 5,
            }}
          >
            {post.eyebrow}
          </div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 800,
              color: "#f1f5f9",
              lineHeight: 1.3,
              letterSpacing: -0.2,
              marginBottom: 5,
            }}
          >
            {post.title}
          </div>
          <div
            style={{
              fontSize: 11,
              color: "#94a3b8",
              lineHeight: 1.5,
            }}
          >
            {post.excerpt.slice(0, 80)}…
          </div>
        </div>
        <div style={{ flexShrink: 0, alignSelf: "center" }}>
          <Chart />
        </div>
      </div>
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
        {post.tags.map((t) => (
          <span
            key={t}
            style={{
              fontSize: 8,
              fontWeight: 700,
              letterSpacing: 1.5,
              color: "rgba(212,165,32,0.6)",
              padding: "2px 7px",
              border: "1px solid rgba(212,165,32,0.18)",
              borderRadius: 999,
            }}
          >
            {t}
          </span>
        ))}
      </div>
    </a>
  );
}

export function BlogSection({ style = {} }) {
  return (
    <div
      style={{
        width: "100%",
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        gap: 10,
        padding: "16px 0",
        ...style,
      }}
    >
      {BLOG_POSTS.map((post, i) => {
        const Chart = CHARTS[i];
        return <BlogCard key={post.id} post={post} chart={Chart} />;
      })}
    </div>
  );
}
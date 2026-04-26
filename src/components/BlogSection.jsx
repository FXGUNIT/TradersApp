import React from "react";

export const BLOG_POSTS = [
  {
    id: "founder-story",
    url: "/blog/founder-story/",
    eyebrow: "Founder's Story",
    title: "From BCCI Dugouts to Building the World's Most Advanced Trading AI",
    excerpt: "Operator background, retail pain, and why the product exists.",
    metric: "01",
    metricLabel: "Operator origin",
  },
  {
    id: "product-vision",
    url: "/blog/product-vision/",
    eyebrow: "Product Vision",
    title: "Why 'Signals' Was Never the Point - And What We Actually Built Instead",
    excerpt: "Decision support over blind alerts, with institutional framing.",
    metric: "02",
    metricLabel: "Decision engine",
  },
  {
    id: "architecture",
    url: "/blog/architecture/",
    eyebrow: "Technical Deep Dive",
    title: "How We Built a Self-Improving Trading AI That Thinks Like a Quant Team",
    excerpt: "Twelve-model consensus, active monitoring, and governance.",
    metric: "03",
    metricLabel: "System proof",
  },
];

const BLOG_SPARKLINES = {
  "founder-story": [0.38, 0.58, 0.44, 0.72, 0.88],
  "product-vision": [0.24, 0.74, 0.92, 0.84, 0.66],
  architecture: [0.55, 0.36, 0.82, 0.62, 0.9],
};

function SparkBars({ values = [] }) {
  const width = 62;
  const height = 24;
  const gap = 4;
  const barWidth = (width - gap * (values.length - 1)) / values.length;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
    >
      {values.map((value, index) => {
        const barHeight = Math.max(5, value * height);
        const x = index * (barWidth + gap);
        const y = height - barHeight;

        return (
          <rect
            key={index}
            x={x}
            y={y}
            width={barWidth}
            height={barHeight}
            rx={2}
            fill={
              index === values.length - 1
                ? "var(--accent-primary, #d4a520)"
                : "rgba(212,165,32,0.32)"
            }
          />
        );
      })}
    </svg>
  );
}

function BlogButton({ post }) {
  return (
    <a
      href={post.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "grid",
        gridTemplateColumns: "56px minmax(0, 1fr) auto",
        gap: 14,
        alignItems: "center",
        padding: "14px 16px",
        background:
          "linear-gradient(135deg, var(--surface-glass, rgba(255,255,255,0.84)), var(--surface-elevated, #ffffff))",
        border: "1px solid rgba(212,165,32,0.16)",
        borderRadius: 18,
        textDecoration: "none",
        color: "inherit",
        minWidth: 0,
        boxShadow: "0 10px 30px rgba(15,23,42,0.06)",
        transition:
          "transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease",
      }}
      onMouseEnter={(event) => {
        event.currentTarget.style.transform = "translateY(-2px)";
        event.currentTarget.style.borderColor = "rgba(212,165,32,0.34)";
        event.currentTarget.style.boxShadow = "0 14px 36px rgba(15,23,42,0.1)";
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.transform = "translateY(0)";
        event.currentTarget.style.borderColor = "rgba(212,165,32,0.16)";
        event.currentTarget.style.boxShadow = "0 10px 30px rgba(15,23,42,0.06)";
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 16,
          border: "1px solid rgba(212,165,32,0.18)",
          background: "rgba(212,165,32,0.08)",
          display: "grid",
          placeItems: "center",
          color: "var(--accent-primary, #d4a520)",
          textAlign: "center",
          flexShrink: 0,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 900,
              lineHeight: 1,
            }}
          >
            {post.metric}
          </div>
          <div
            style={{
              marginTop: 4,
              fontSize: 8,
              fontWeight: 800,
              letterSpacing: 1.4,
              textTransform: "uppercase",
            }}
          >
            read
          </div>
        </div>
      </div>

      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 9,
            fontWeight: 800,
            letterSpacing: 2.2,
            color: "var(--accent-primary, #d4a520)",
            textTransform: "uppercase",
            marginBottom: 5,
          }}
        >
          {post.eyebrow}
        </div>
        <div
          style={{
            fontSize: 13,
            fontWeight: 800,
            lineHeight: 1.35,
            color: "var(--text-primary, #0f172a)",
            marginBottom: 4,
          }}
        >
          {post.title}
        </div>
        <div
          style={{
            fontSize: 11,
            lineHeight: 1.55,
            color: "var(--text-secondary, #64748b)",
          }}
        >
          {post.excerpt}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gap: 6,
          justifyItems: "end",
          flexShrink: 0,
        }}
      >
        <SparkBars values={BLOG_SPARKLINES[post.id] || []} />
        <div
          style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: 1.6,
            color: "var(--accent-primary, #d4a520)",
            textTransform: "uppercase",
          }}
        >
          {post.metricLabel}
        </div>
      </div>
    </a>
  );
}

export function BlogSection({
  style = {},
  heading = "From the Trading Desk",
  description = "Three compact research threads. Open them one by one.",
  showFrame = true,
}) {
  const sectionStyle = showFrame
    ? {
        width: "100%",
        display: "grid",
        gap: 14,
        padding: "16px",
        borderRadius: 22,
        border: "1px solid rgba(212,165,32,0.16)",
        background:
          "linear-gradient(180deg, rgba(212,165,32,0.05), rgba(255,255,255,0.02))",
        boxShadow: "0 16px 40px rgba(15,23,42,0.06)",
        ...style,
      }
    : {
        width: "100%",
        display: "grid",
        gap: 14,
        ...style,
      };

  return (
    <section style={sectionStyle}>
      <div style={{ display: "grid", gap: 6 }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: 3,
            color: "var(--accent-primary, #d4a520)",
            textTransform: "uppercase",
          }}
        >
          {heading}
        </div>
        <div
          style={{
            fontSize: 12,
            lineHeight: 1.65,
            color: "var(--text-secondary, #64748b)",
          }}
        >
          {description}
        </div>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {BLOG_POSTS.map((post) => (
          <BlogButton key={post.id} post={post} />
        ))}
      </div>

      <a
        href="/blog/"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          alignSelf: "flex-start",
          padding: "9px 14px",
          borderRadius: 999,
          border: "1px solid rgba(212,165,32,0.22)",
          textDecoration: "none",
          color: "var(--accent-primary, #d4a520)",
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: 1.6,
          textTransform: "uppercase",
          background: "rgba(212,165,32,0.06)",
        }}
      >
        Open full blog
        <span aria-hidden="true">-&gt;</span>
      </a>
    </section>
  );
}

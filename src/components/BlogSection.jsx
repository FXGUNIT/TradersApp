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
    title: "Why 'Signals' Was Never the Point — And What We Actually Built Instead",
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

function BlogRow({ post, isDark }) {
  const labelColor = isDark ? "rgba(212,165,32,0.6)" : "rgba(139,92,24,0.6)";
  const borderColor = isDark ? "rgba(212,165,32,0.2)" : "rgba(139,92,24,0.2)";
  const arrowColor = isDark ? "rgba(212,165,32,0.35)" : "rgba(139,92,24,0.35)";

  return (
    <a
      href={post.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
        padding: "5px 10px",
        border: `1px solid ${borderColor}`,
        borderRadius: 4,
        textDecoration: "none",
        background: "transparent",
        transition: "border-color 160ms ease, background 160ms ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = isDark
          ? "rgba(212,165,32,0.5)"
          : "rgba(139,92,24,0.5)";
        e.currentTarget.style.background = isDark
          ? "rgba(212,165,32,0.06)"
          : "rgba(139,92,24,0.06)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = borderColor;
        e.currentTarget.style.background = "transparent";
      }}
    >
      <span
        style={{
          fontSize: 8,
          fontWeight: 700,
          letterSpacing: 2.2,
          color: labelColor,
          textTransform: "uppercase",
        }}
      >
        {post.eyebrow}
      </span>
      <svg
        width="8"
        height="8"
        viewBox="0 0 8 8"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M1 4h6M5 2l2 2-2 2"
          stroke={arrowColor}
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </a>
  );
}

export function BlogSection({ isDark = false, style = {} }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        ...style,
      }}
    >
      {BLOG_POSTS.map((post) => (
        <BlogRow key={post.id} post={post} isDark={isDark} />
      ))}
    </div>
  );
}

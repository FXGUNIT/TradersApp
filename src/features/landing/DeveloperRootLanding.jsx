import React from "react";
import "./developerRootLanding.css";

const DEVELOPER_ROOT_HOST = "tradergunit.pages.dev";
const GITHUB_PROFILE = "https://github.com/FXGUNIT";
const PREVIEW_ROUTE = "/developer";
const WORKSTREAMS = [
  "React + Vite shell for the operator-facing frontend",
  "Node.js BFF for auth, policy, orchestration, and API fan-out",
  "Python ML engine for inference, research, and model services",
  "Windows thin client packaging for low-friction local access",
  "Contabo-hosted runtime with Redis and containerized service edges",
];
const TIMELINE = [
  {
    step: "01",
    title: "Cloudflare root",
    body:
      "tradergunit.pages.dev is the stable public developer root and portfolio surface.",
  },
  {
    step: "02",
    title: "Live project runtime",
    body:
      "The trading application stays on the existing Contabo-backed runtime until the frontend and BFF boundary are cleaned up for a wider move.",
  },
  {
    step: "03",
    title: "Custom domain later",
    body:
      "Once branding and domain ownership are finalized, the same public root can be moved behind a custom domain without changing the product stack first.",
  },
];

function normalizeAbsoluteUrl(value, fallback) {
  const candidate = String(value || "").trim();
  if (!candidate) {
    return fallback;
  }

  return candidate.endsWith("/") ? candidate : `${candidate}/`;
}

function normalizeHealthUrl(value, fallback) {
  const candidate = String(value || "").trim();
  return candidate || fallback;
}

function hostLabel(url) {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname && parsed.pathname !== "/" ? parsed.pathname : "";
    return `${parsed.host}${path}`;
  } catch {
    return url;
  }
}

const PRIMARY_PROJECT_HOST = normalizeAbsoluteUrl(
  import.meta.env.VITE_PUBLIC_PROJECT_PREVIEW_URL,
  "https://173.249.18.14.sslip.io/"
);
const BFF_HEALTH_HOST = normalizeHealthUrl(
  import.meta.env.VITE_PUBLIC_BFF_HEALTH_URL,
  "https://bff.173.249.18.14.sslip.io/health"
);
const API_HEALTH_HOST = normalizeHealthUrl(
  import.meta.env.VITE_PUBLIC_API_HEALTH_URL,
  "https://api.173.249.18.14.sslip.io/health"
);

const STACK_STATUS = [
  {
    label: "Developer root",
    value: DEVELOPER_ROOT_HOST,
  },
  {
    label: "Project frontend",
    value: hostLabel(PRIMARY_PROJECT_HOST),
  },
  {
    label: "BFF health",
    value: hostLabel(BFF_HEALTH_HOST),
  },
  {
    label: "API health",
    value: hostLabel(API_HEALTH_HOST),
  },
];

const PROOF_TARGETS = [
  {
    href: PRIMARY_PROJECT_HOST,
    label: "Current frontend preview",
  },
  {
    href: BFF_HEALTH_HOST,
    label: "Current BFF health",
  },
  {
    href: API_HEALTH_HOST,
    label: "Current API health",
  },
];

function currentPreviewUrl() {
  if (typeof window === "undefined") {
    return PREVIEW_ROUTE;
  }

  return `${window.location.origin}${PREVIEW_ROUTE}`;
}

function currentHostname() {
  if (typeof window === "undefined") {
    return DEVELOPER_ROOT_HOST;
  }

  return window.location.hostname || DEVELOPER_ROOT_HOST;
}

export default function DeveloperRootLanding() {
  const previewUrl = currentPreviewUrl();
  const hostname = currentHostname();

  return (
    <main className="developer-root-shell">
      <section className="developer-root-hero">
        <div className="developer-root-copy">
          <p className="developer-root-kicker">FXGUNIT // software systems</p>
          <h1>Developer root for Gunit&apos;s live trading infrastructure.</h1>
          <p className="developer-root-summary">
            This Cloudflare Pages root is the public developer-facing home for
            the stack behind TradersApp: a React trading shell, Node BFF,
            Python ML engine, Windows thin client, and Contabo-backed runtime.
          </p>
          <div className="developer-root-actions">
            <a href={GITHUB_PROFILE} target="_blank" rel="noreferrer">
              GitHub Profile
            </a>
            <a href={PRIMARY_PROJECT_HOST} target="_blank" rel="noreferrer">
              Project Preview
            </a>
            <a href={previewUrl} target="_blank" rel="noreferrer">
              This Landing Route
            </a>
          </div>
        </div>

        <aside className="developer-root-status">
          <div>
            <span>Current host</span>
            <strong>{hostname}</strong>
          </div>
          {STACK_STATUS.map(({ label, value }) => (
            <div key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </aside>
      </section>

      <section className="developer-root-grid">
        <article>
          <h2>Current build focus</h2>
          <p>
            Shipping a globally reachable trading workstation without local
            sidecars on user machines. The public root stays developer-facing
            while the live product runtime continues on the current Contabo
            fallback host family.
          </p>
        </article>

        <article>
          <h2>Core stack</h2>
          <ul>
            {WORKSTREAMS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>

        <article>
          <h2>Live proof targets</h2>
          <ul>
            {PROOF_TARGETS.map(({ href, label }) => (
              <li key={href}>
                <a href={href} target="_blank" rel="noreferrer">
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </article>

        <article>
          <h2>Active workstreams</h2>
          <ul>
            <li>session-aware ML config and feature pipeline wiring</li>
            <li>multi-instrument routing foundations inside the BFF</li>
            <li>Windows 4 GB certification harness and runbook evidence</li>
            <li>event-driven backtesting rig for NSE session-aware research</li>
          </ul>
        </article>
      </section>

      <section className="developer-root-timeline">
        {TIMELINE.map(({ step, title, body }) => (
          <div key={step}>
            <span>{step}</span>
            <h3>{title}</h3>
            <p>{body}</p>
          </div>
        ))}
      </section>
    </main>
  );
}

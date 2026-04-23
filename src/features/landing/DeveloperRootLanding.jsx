import React from "react";
import {
  API_HEALTH_HOST,
  BFF_HEALTH_HOST,
  CANONICAL_PUBLIC_FRONTEND_HOST,
  CANONICAL_PUBLIC_FRONTEND_URL,
  DEVELOPER_PREVIEW_PATH,
} from "../../config/proofHosts";
import "./developerRootLanding.css";

const DEVELOPER_ROOT_HOST = CANONICAL_PUBLIC_FRONTEND_HOST;
const LIVE_APP_URL = CANONICAL_PUBLIC_FRONTEND_URL;
const GITHUB_PROFILE = "https://github.com/FXGUNIT";
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
    title: "Live app root",
    body: `The public frontend now lives at ${LIVE_APP_URL} and should always open the real TradersApp shell first.`,
  },
  {
    step: "02",
    title: "Developer proof page",
    body: `This diagnostics surface is explicit-only at ${DEVELOPER_PREVIEW_PATH} so it cannot silently replace the live app again.`,
  },
  {
    step: "03",
    title: "Runtime services",
    body:
      "Contabo continues to carry the current runtime edge for the BFF and API while the canonical public entry stays fixed on Pages.",
  },
];

function hostLabel(url) {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname && parsed.pathname !== "/" ? parsed.pathname : "";
    return `${parsed.host}${path}`;
  } catch {
    return url;
  }
}

const STACK_STATUS = [
  {
    label: "Live app root",
    value: hostLabel(LIVE_APP_URL),
  },
  {
    label: "Developer preview path",
    value: DEVELOPER_PREVIEW_PATH,
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
    href: LIVE_APP_URL,
    label: "Open live TradersApp",
  },
  {
    href: BFF_HEALTH_HOST,
    label: "Runtime BFF health",
  },
  {
    href: API_HEALTH_HOST,
    label: "Runtime API health",
  },
];

function currentPreviewUrl() {
  if (typeof window === "undefined") {
    return DEVELOPER_PREVIEW_PATH;
  }

  return `${window.location.origin}${DEVELOPER_PREVIEW_PATH}`;
}

function currentHostname() {
  if (typeof window === "undefined") {
    return DEVELOPER_ROOT_HOST;
  }

  return window.location.hostname || DEVELOPER_ROOT_HOST;
}

export default function DeveloperRootLanding() {
  const hostname = currentHostname();

  return (
    <main className="developer-root-shell">
      <section className="developer-root-hero">
        <div className="developer-root-copy">
          <p className="developer-root-kicker">FXGUNIT // software systems</p>
          <h1>Developer diagnostics for the TradersApp runtime.</h1>
          <p className="developer-root-summary">
            The live public app is the root of
            {` ${DEVELOPER_ROOT_HOST} `}
            and this page exists only as an explicit developer preview at
            {` ${DEVELOPER_PREVIEW_PATH} `}.
            Use it to inspect the current runtime contract behind the app shell:
            React frontend, Node BFF, Python ML engine, Windows thin client,
            and Contabo-backed services.
          </p>
          <div className="developer-root-actions">
            <a href={LIVE_APP_URL}>Open Live App</a>
            <a href={GITHUB_PROFILE} target="_blank" rel="noreferrer">
              GitHub Profile
            </a>
            <a href={BFF_HEALTH_HOST} target="_blank" rel="noreferrer">
              Runtime BFF Health
            </a>
            <a href={API_HEALTH_HOST} target="_blank" rel="noreferrer">
              Runtime API Health
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
          <h2>Current contract</h2>
          <p>
            Root `/` must always open the full TradersApp frontend. This page is
            intentionally isolated under
            {` ${DEVELOPER_PREVIEW_PATH} `}
            so the live public entry cannot drift back to a splash screen.
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

      <section className="developer-root-grid">
        <article>
          <h2>Current preview URL</h2>
          <p>{currentPreviewUrl()}</p>
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

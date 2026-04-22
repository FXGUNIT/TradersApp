import React from "react";
import "./developerRootLanding.css";

const PRIMARY_PROJECT_HOST = "https://173.249.18.14.sslip.io/";
const BFF_HEALTH_HOST = "https://bff.173.249.18.14.sslip.io/health";
const API_HEALTH_HOST = "https://api.173.249.18.14.sslip.io/health";
const GITHUB_PROFILE = "https://github.com/FXGUNIT";
const PREVIEW_ROUTE = "/developer";

function currentPreviewUrl() {
  if (typeof window === "undefined") {
    return PREVIEW_ROUTE;
  }

  return `${window.location.origin}${PREVIEW_ROUTE}`;
}

function currentHostname() {
  if (typeof window === "undefined") {
    return "tradergunit.is-a.dev";
  }

  return window.location.hostname || "tradergunit.is-a.dev";
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
            This root host is the software-development home for the stack behind
            TradersApp: a React trading shell, Node BFF, Python ML engine,
            Windows thin client, and self-hosted deployment path on Contabo.
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
            <span>Root host mode</span>
            <strong>{hostname}</strong>
          </div>
          <div>
            <span>Project frontend</span>
            <strong>traders.tradergunit.is-a.dev</strong>
          </div>
          <div>
            <span>BFF host</span>
            <strong>bff.traders.tradergunit.is-a.dev</strong>
          </div>
          <div>
            <span>API host</span>
            <strong>api.traders.tradergunit.is-a.dev</strong>
          </div>
        </aside>
      </section>

      <section className="developer-root-grid">
        <article>
          <h2>Current build focus</h2>
          <p>
            Shipping a globally reachable trading workstation without local
            sidecars on user machines. The root host stays developer-facing;
            the project itself lives under nested subdomains to match the
            is-a.dev policy.
          </p>
        </article>

        <article>
          <h2>Core stack</h2>
          <ul>
            <li>React + Vite frontend for the trading shell</li>
            <li>Node.js BFF for orchestration, policy, and transport</li>
            <li>Python ML engine for consensus, regime, and research loops</li>
            <li>Windows thin client with packaged web assets</li>
            <li>Contabo edge with Caddy, Redis, and containerized services</li>
          </ul>
        </article>

        <article>
          <h2>Live proof targets</h2>
          <ul>
            <li>
              <a href={PRIMARY_PROJECT_HOST} target="_blank" rel="noreferrer">
                Current frontend fallback host
              </a>
            </li>
            <li>
              <a href={BFF_HEALTH_HOST} target="_blank" rel="noreferrer">
                Current BFF health
              </a>
            </li>
            <li>
              <a href={API_HEALTH_HOST} target="_blank" rel="noreferrer">
                Current API health
              </a>
            </li>
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
        <div>
          <span>01</span>
          <h3>Dev root</h3>
          <p>
            tradergunit.is-a.dev remains the developer-facing home and
            portfolio surface.
          </p>
        </div>
        <div>
          <span>02</span>
          <h3>Project host</h3>
          <p>
            TradersApp frontend moves to traders.tradergunit.is-a.dev once the
            root is approved.
          </p>
        </div>
        <div>
          <span>03</span>
          <h3>Service hosts</h3>
          <p>
            BFF and ML engine use nested service hosts under the project label
            so the production surface stays consistent.
          </p>
        </div>
      </section>
    </main>
  );
}

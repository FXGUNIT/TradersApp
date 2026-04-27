import React, { useEffect, useState } from "react";
import {
  fetchDocumentMeta,
  getDocumentMeta,
} from "../services/clients/ContentClient.js";

export default function TermsOfService({ onClose }) {
  const [meta, setMeta] = useState(() => getDocumentMeta("tos"));
  const T = {
    bg: "var(--surface-elevated, #FFFFFF)",
    fg: "var(--text-primary, #111827)",
    muted: "var(--text-secondary, #64748B)",
    blue: "var(--accent-primary, #2563EB)",
    border: "var(--border-subtle, rgba(0,0,0,0.08))",
  };

  useEffect(() => {
    let active = true;

    fetchDocumentMeta("tos").then((nextMeta) => {
      if (active && nextMeta) {
        setMeta(nextMeta);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--aura-overlay, rgba(0, 0, 0, 0.5))",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "20px",
        fontFamily: "var(--font-ui)",
        backdropFilter: "blur(10px)",
      }}
    >
      <div
        style={{
          background: T.bg,
          borderRadius: 12,
          maxWidth: 700,
          maxHeight: "90vh",
          overflowY: "auto",
          padding: 40,
          border: `1px solid ${T.border}`,
          boxShadow: "var(--aura-shadow, 0 10px 40px rgba(0, 0, 0, 0.2))",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 32,
          }}
        >
          <h1
            style={{
              fontSize: 24,
              fontWeight: 700,
              color: T.fg,
              margin: 0,
            }}
          >
            {meta?.title || "Terms of Service"}
          </h1>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: 24,
              color: T.muted,
              cursor: "pointer",
            }}
          >
            x
          </button>
        </div>

        <div style={{ lineHeight: 1.8, color: T.fg, fontSize: 14 }}>
          <p style={{ color: T.muted, marginBottom: 24 }}>
            <strong>Last Updated:</strong> March 18, 2026
          </p>

          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
              1. Acceptance of Terms
            </h2>
            <p>
              By accessing and using the Traders Regiment platform
              ("Platform"), you accept and agree to be bound by the terms and
              provision of this agreement. If you do not agree to abide by the
              above, please do not use this service.
            </p>
          </section>

          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
              2. Use License
            </h2>
            <p>
              Permission is granted to temporarily download one copy of the
              materials (information or software) on the Traders Regiment
              Platform for personal, non-commercial transitory viewing only.
              This is the grant of a license, not a transfer of title, and
              under this license you may not:
            </p>
            <ul style={{ marginLeft: 20 }}>
              <li>Modify or copy the materials</li>
              <li>Use the materials for any commercial purpose or public display</li>
              <li>Attempt to decompile or reverse engineer platform software</li>
              <li>Remove copyright or proprietary notices</li>
              <li>Transfer or mirror the materials elsewhere</li>
              <li>Violate applicable laws or regulations</li>
            </ul>
          </section>

          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
              3. User Accounts
            </h2>
            <p>
              You are responsible for maintaining the confidentiality of your
              account information and password. You agree to accept
              responsibility for all activities that occur under your account.
              You must notify us immediately of any unauthorized use.
            </p>
          </section>

          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
              4. Limitation of Liability
            </h2>
            <p>
              The materials on the Traders Regiment Platform are provided "as
              is". Traders Regiment makes no warranties, expressed or implied,
              including merchantability, fitness for a particular purpose, or
              non-infringement.
            </p>
          </section>

          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
              5. Revisions
            </h2>
            <p>
              Traders Regiment may revise these terms at any time without
              notice. By using the Platform, you agree to be bound by the then
              current version.
            </p>
          </section>

          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
              6. Trading Risks
            </h2>
            <p>
              Futures trading involves substantial risk of loss. Past
              performance is not indicative of future results. You acknowledge
              these risks and invest only capital you can afford to lose.
            </p>
          </section>

          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
              7. Governing Law
            </h2>
            <p>
              These terms and conditions are governed by the laws of the
              jurisdiction in which Traders Regiment operates, and you submit to
              the exclusive jurisdiction of the courts there.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
              8. Contact Information
            </h2>
            <p>
              If you have questions about these Terms of Service, contact us at
              legal@traders-regiment.com.
            </p>
          </section>
        </div>

        <button
          onClick={onClose}
          style={{
            width: "100%",
            marginTop: 32,
            padding: "12px 24px",
            background: T.blue,
            color: "var(--accent-text, #fff)",
            border: "none",
            borderRadius: 6,
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
            transition: "filter 0.2s ease",
          }}
          onMouseOver={(event) => {
            event.currentTarget.style.filter = "brightness(0.95)";
          }}
          onMouseOut={(event) => {
            event.currentTarget.style.filter = "none";
          }}
        >
          I UNDERSTAND & ACCEPT
        </button>
      </div>
    </div>
  );
}

import React, { useEffect, useState } from "react";
import {
  fetchDocumentMeta,
  getDocumentMeta,
} from "../services/clients/ContentClient.js";

export default function PrivacyPolicy({ onClose }) {
  const [meta, setMeta] = useState(() => getDocumentMeta("privacy"));
  const T = {
    bg: "var(--surface-elevated, #FFFFFF)",
    fg: "var(--text-primary, #111827)",
    muted: "var(--text-secondary, #64748B)",
    blue: "var(--accent-primary, #2563EB)",
    border: "var(--border-subtle, rgba(0,0,0,0.08))",
  };

  useEffect(() => {
    let active = true;

    fetchDocumentMeta("privacy").then((nextMeta) => {
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
            {meta?.title || "Privacy Policy"}
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
              1. Information We Collect
            </h2>
            <p>
              We collect information you provide directly to us when you create
              an account, including your email address, credentials, trading
              history, and platform activity.
            </p>
          </section>

          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
              2. How We Use Your Information
            </h2>
            <p>
              We use collected information for operating the platform,
              processing transactions, sending important notices, preventing
              fraud, complying with legal obligations, and improving the
              product.
            </p>
          </section>

          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
              3. Just-In-Time Permissions
            </h2>
            <p>
              We request access to sensitive device capabilities only when you
              actively use features that need them. We do not request these
              permissions at signup.
            </p>
          </section>

          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
              4. Data Security
            </h2>
            <p>
              We implement technical and organizational safeguards to protect
              personal information. No system is completely secure, so please
              contact us immediately if you suspect a breach.
            </p>
          </section>

          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
              5. Data Sharing
            </h2>
            <p>
              We do not sell personal data. We may share information with
              service providers, legal authorities when required, and other
              parties with your explicit consent.
            </p>
          </section>

          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
              6. Data Retention
            </h2>
            <p>
              We retain information only as long as necessary to provide
              services and satisfy legal obligations. You may request deletion
              of your account data at any time.
            </p>
          </section>

          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
              7. Your Rights
            </h2>
            <p>
              You have the right to access, correct, delete, and port personal
              data, and to opt out of marketing communications where applicable.
            </p>
          </section>

          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
              8. GDPR & CCPA Compliance
            </h2>
            <p>
              This Platform is designed to support GDPR and CCPA compliance,
              including access and deletion requests and transparency around
              collected data.
            </p>
          </section>

          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
              9. Third-Party Services
            </h2>
            <p>
              We use Firebase for infrastructure and Google services for
              authentication. These providers have their own privacy policies.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
              10. Contact Us
            </h2>
            <p>
              For privacy inquiries or data requests, contact
              privacy@traders-regiment.com.
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

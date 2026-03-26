import React from 'react';

const PrivacyPolicy = ({ onClose }) => {
  const T = {
  bg: 'var(--surface-elevated, #FFFFFF)',
    fg: '#111827',
    muted: '#64748B',
    blue: '#2563EB',
    border: '#E2E8F0',
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px',
      fontFamily: 'Inter, sans-serif',
    }}>
      <div style={{
        background: T.bg,
        borderRadius: 12,
        maxWidth: 700,
        maxHeight: '90vh',
        overflowY: 'auto',
        padding: 40,
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
      }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
          <h1 style={{
            fontSize: 24,
            fontWeight: 700,
            color: T.fg,
            margin: 0,
          }}>
            Privacy Policy
          </h1>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 24,
              color: T.muted,
              cursor: 'pointer',
            }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div style={{ lineHeight: 1.8, color: T.fg, fontSize: 14 }}>
          <p style={{ color: T.muted, marginBottom: 24 }}>
            <strong>Last Updated:</strong> March 18, 2026
          </p>

          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>1. Information We Collect</h2>
            <p>
              We collect information you provide directly to us, such as when you create an account, including:
            </p>
            <ul style={{ marginLeft: 20 }}>
              <li>Email address</li>
              <li>Account credentials</li>
              <li>Trading history and performance data</li>
              <li>Payment information (processed by secure third-party providers)</li>
            </ul>
            <p>
              We also automatically collect certain information when you use the Platform, including:
            </p>
            <ul style={{ marginLeft: 20 }}>
              <li>IP address and browser information</li>
              <li>Usage patterns and analytics</li>
              <li>Trading activity and preferences</li>
              <li>Device identifiers</li>
            </ul>
          </section>

          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>2. How We Use Your Information</h2>
            <p>We use collected information for:</p>
            <ul style={{ marginLeft: 20 }}>
              <li>Providing and improving the Platform</li>
              <li>Processing transactions</li>
              <li>Sending important notices and updates</li>
              <li>Preventing fraud and abuse</li>
              <li>Complying with legal obligations</li>
              <li>Analyzing Platform usage and trends</li>
            </ul>
          </section>

          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>3. Just-In-Time Permissions</h2>
            <p>
              We follow a "Just-In-Time" permissions philosophy. We request access to sensitive features 
              (camera, microphone, location) only when you actively use features that require them. We never 
              request these permissions at signup.
            </p>
          </section>

          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>4. Data Security</h2>
            <p>
              We implement appropriate technical and organizational measures to protect your personal information. 
              Your account is protected by encryption and authentication mechanisms. However, no system is completely 
              secure. If you believe there has been a breach, please contact us immediately.
            </p>
          </section>

          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>5. Data Sharing</h2>
            <p>
              We do not sell your personal data. We may share information with:
            </p>
            <ul style={{ marginLeft: 20 }}>
              <li>Service providers who assist in operations (under confidentiality agreements)</li>
              <li>Legal authorities if required by law</li>
              <li>Other parties with your explicit consent</li>
            </ul>
          </section>

          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>6. Data Retention</h2>
            <p>
              We retain personal information for as long as necessary to provide services and comply with legal 
              obligations. You may request deletion of your account data at any time. Some information may be retained 
              for legal or regulatory purposes.
            </p>
          </section>

          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>7. Your Rights</h2>
            <p>You have the right to:</p>
            <ul style={{ marginLeft: 20 }}>
              <li>Access your personal information</li>
              <li>Correct inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Opt-out of marketing communications</li>
              <li>Port your data to another service</li>
            </ul>
          </section>

          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>8. GDPR & CCPA Compliance</h2>
            <p>
              This Platform complies with GDPR and CCPA regulations. California residents have the right to know 
              what personal information is collected, how it is used, and with whom it is shared. EU residents have 
              additional rights under GDPR.
            </p>
          </section>

          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>9. Third-Party Services</h2>
            <p>
              We use Firebase for cloud infrastructure and Google Services for authentication. These providers have 
              their own privacy policies. We encourage you to review them.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>10. Contact Us</h2>
            <p>
              For privacy inquiries or data requests, contact us at privacy@traders-regiment.com. We will respond 
              to all requests within 30 days.
            </p>
          </section>
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            width: '100%',
            marginTop: 32,
            padding: '12px 24px',
            background: T.blue,
            color: 'var(--accent-text, #fff)',
            border: 'none',
            borderRadius: 6,
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          onMouseOver={(e) => e.target.style.background = '#1d4ed8'}
          onMouseOut={(e) => e.target.style.background = T.blue}
        >
          I UNDERSTAND & ACCEPT
        </button>
      </div>
    </div>
  );
};

export default PrivacyPolicy;

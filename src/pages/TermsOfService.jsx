import React from 'react';

const TermsOfService = ({ onClose }) => {
  const T = {
    bg: '#FFFFFF',
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
            Terms of Service
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
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>1. Acceptance of Terms</h2>
            <p>
              By accessing and using the Traders Regiment platform ("Platform"), you accept and agree to be bound by 
              the terms and provision of this agreement. If you do not agree to abide by the above, please do not 
              use this service.
            </p>
          </section>

          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>2. Use License</h2>
            <p>
              Permission is granted to temporarily download one copy of the materials (information or software) on the 
              Traders Regiment Platform for personal, non-commercial transitory viewing only. This is the grant of a 
              license, not a transfer of title, and under this license you may not:
            </p>
            <ul style={{ marginLeft: 20 }}>
              <li>Modify or copy the materials</li>
              <li>Use the materials for any commercial purpose or for any public display</li>
              <li>Attempt to decompile or reverse engineer any software contained on the Platform</li>
              <li>Remove any copyright or other proprietary notations from the materials</li>
              <li>Transfer the materials to another person or "mirror" the materials on any other server</li>
              <li>Violate any applicable laws or regulations</li>
            </ul>
          </section>

          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>3. User Accounts</h2>
            <p>
              You are responsible for maintaining the confidentiality of your account information and password. You 
              agree to accept responsibility for all activities that occur under your account. You must notify us 
              immediately of any unauthorized use of your account.
            </p>
          </section>

          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>4. Limitation of Liability</h2>
            <p>
              The materials on the Traders Regiment Platform are provided "as is". Traders Regiment makes no warranties, 
              expressed or implied, and hereby disclaims and negates all other warranties including, without limitation, 
              implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement 
              of intellectual property or other violation of rights.
            </p>
          </section>

          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>5. Revisions</h2>
            <p>
              Traders Regiment may revise these terms of service at any time without notice. By using this Platform, 
              you are agreeing to be bound by the then current version of these terms of service.
            </p>
          </section>

          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>6. Trading Risks</h2>
            <p>
              Futures trading involves substantial risk of loss. Past performance is not indicative of future results. 
              Performance results represent past performance and do not guarantee future results. You acknowledge that 
              you understand these risks and invest only capital you can afford to lose.
            </p>
          </section>

          <section style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>7. Governing Law</h2>
            <p>
              These terms and conditions are governed by and construed in accordance with the laws of the jurisdiction 
              in which Traders Regiment operates, and you irrevocably submit to the exclusive jurisdiction of the courts 
              in that location.
            </p>
          </section>

          <section>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>8. Contact Information</h2>
            <p>
              If you have questions about these Terms of Service, please contact us at legal@traders-regiment.com
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
            color: '#FFFFFF',
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

export default TermsOfService;

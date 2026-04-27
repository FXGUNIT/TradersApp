/**
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * REGIMENT MASTER EULA & GLOBAL COMPLIANCE GATE
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * Component: RegimentEULA
 * Purpose: Tab-based Terms of Service acceptance wall with scroll-to-unlock mechanism
 * Regulation Compliance: SEC, CFTC, DFSA, SCA, SEBI, GDPR
 *
 * Tab Structure:
 *   Tab 1 — Terms of Service   (EULATermsSection)
 *   Tab 2 — Risk Disclosure     (EULARiskSection)
 *   Tab 3 — Privacy Policy     (EULAPrivacySection)
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 */

import React, { useState, useRef } from 'react';
import EULATermsSection,   { TERMS_OF_SERVICE_CONTENT } from './EULATermsSection';
import EULARiskSection,   { RISK_DISCLOSURE_CONTENT }    from './EULARiskSection';
import EULAPrivacySection, { PRIVACY_POLICY_CONTENT }     from './EULAPrivacySection';

const TABS = [
  { key: 'terms',   label: 'Terms of Service',  ContentComponent: EULATermsSection,   content: TERMS_OF_SERVICE_CONTENT },
  { key: 'risk',    label: 'Risk Disclosure',   ContentComponent: EULARiskSection,     content: RISK_DISCLOSURE_CONTENT },
  { key: 'privacy', label: 'Privacy Policy',    ContentComponent: EULAPrivacySection,  content: PRIVACY_POLICY_CONTENT },
];

const TAB_BOX_SHADOWS = { terms: 'inset 0 -20px 20px -20px rgba(0,0,0,0.1)', risk: 'inset 0 -20px 20px -20px rgba(0,0,0,0.1)', privacy: 'inset 0 -20px 20px -20px rgba(0,0,0,0.1)' };

const RegimentEULA = ({ onAccept, onReject }) => {
  const [activeTab, setActiveTab]             = useState('terms');
  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  const [agreedTerms,   setAgreedTerms]   = useState(false);
  const [agreedRisks,   setAgreedRisks]   = useState(false);
  const [agreedPrivacy, setAgreedPrivacy] = useState(false);

  const sectionRefs = { terms: useRef(null), risk: useRef(null), privacy: useRef(null) };

  // Re-detect bottom whenever the active tab changes
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setScrolledToBottom(false);
    // Scroll the new section to top then check bottom after paint
    const ref = sectionRefs[tab]?.current;
    if (ref) ref.scrollTop = 0;
  };

  const handleScroll = (e) => {
    const el = e.target;
    setScrolledToBottom(el.scrollHeight - el.scrollTop < el.clientHeight + 10);
  };

  const isDeploymentEnabled = scrolledToBottom && agreedTerms && agreedRisks && agreedPrivacy;

  const activeSection = TABS.find((t) => t.key === activeTab);
  const ActiveContentComponent = activeSection.ContentComponent;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface-elevated, #FFFFFF)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: var(--font-ui), padding: '40px 20px' }}>
      <div style={{ maxWidth: 700, width: '100%' }}>

        {/* Header */}
        <div style={{ marginBottom: 32, textAlign: 'center' }}>
          <h1 style={{ color: '#111827', fontSize: '24px', fontWeight: 700, letterSpacing: 0.5, marginBottom: 8 }}>REGIMENT MASTER EULA</h1>
          <p style={{ color: '#64748B', fontSize: '13px', letterSpacing: 0.5 }}>GLOBAL COMPLIANCE GATE & BINDING COVENANT</p>
        </div>

        {/* Tab Bar */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 12, background: '#F1F5F9', borderRadius: 8, padding: 4 }}>
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: 6,
                border: 'none',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                background: activeTab === tab.key ? '#FFFFFF' : 'transparent',
                color: activeTab === tab.key ? '#1e40af' : '#64748B',
                boxShadow: activeTab === tab.key ? '0 1px 4px rgba(0,0,0,0.12)' : 'none',
                letterSpacing: 0.3,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Active Legal Section */}
        <ActiveContentComponent
          ref={sectionRefs[activeTab]}
          content={activeSection.content}
          styleProps={{
            marginBottom: 24,
            boxShadow: TAB_BOX_SHADOWS[activeTab],
            transition: 'box-shadow 0.3s ease',
          }}
          onScroll={handleScroll}
        />

        {/* Scroll Status Indicator */}
        <div style={{ marginBottom: 20, padding: '12px 14px', background: scrolledToBottom ? '#D1FAE5' : '#FEF3C7', border: `1px solid ${scrolledToBottom ? '#6EE7B7' : '#FCD34D'}`, borderRadius: 6, fontSize: '12px', color: scrolledToBottom ? '#047857' : '#92400E', fontWeight: 500, textAlign: 'center' }}>
          {scrolledToBottom ? '✅ EULA scroll requirement satisfied. Checkboxes now active.' : '⚠️ Scroll to the absolute bottom of this section to unlock checkboxes.'}
        </div>

        {/* Granular Consent Checkboxes */}
        <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 8, padding: 20, marginBottom: 24 }}>
          <p style={{ color: '#111827', fontSize: '13px', fontWeight: 600, marginBottom: 16 }}>REQUIRED CONSENT CONFIRMATIONS:</p>

          <CheckboxRow
            id="terms"
            checked={agreedTerms}
            onChange={(e) => setAgreedTerms(e.target.checked)}
            disabled={!scrolledToBottom}
            scrolledToBottom={scrolledToBottom}
            label="I acknowledge the Terms of Service, binding arbitration clause, waiver of class-action rights, and multi-jurisdictional compliance framework outlined herein."
          />

          <CheckboxRow
            id="risks"
            checked={agreedRisks}
            onChange={(e) => setAgreedRisks(e.target.checked)}
            disabled={!scrolledToBottom}
            scrolledToBottom={scrolledToBottom}
            label="I grant irrevocable consent to hardware access (webcam, microphone, WebRTC), continuous telemetry monitoring, biometric data collection, and financial auditing without limitation or privacy protection."
          />

          <CheckboxRow
            id="privacy"
            checked={agreedPrivacy}
            onChange={(e) => setAgreedPrivacy(e.target.checked)}
            disabled={!scrolledToBottom}
            scrolledToBottom={scrolledToBottom}
            label="I accept total and absolute responsibility for all financial losses from Micro E-mini Futures trading (MNQ/MES), indemnify the Regiment against all claims, and waive all rights to legal recourse or damages."
          />
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 12, width: '100%' }}>
          <button
            onClick={onReject}
            style={{ flex: 1, height: 44, borderRadius: 6, border: '1px solid #CBD5E1', background: 'var(--surface-elevated, #FFFFFF)', color: '#475569', fontSize: 14, fontWeight: 600, letterSpacing: 0.5, cursor: 'pointer', transition: 'all 0.2s ease' }}
            onMouseOver={(e) => (e.target.style.background = '#F1F5F9')}
            onMouseOut={(e) => (e.target.style.background = '#FFFFFF')}
          >
            REJECT
          </button>
          <button
            onClick={onAccept}
            disabled={!isDeploymentEnabled}
            style={{
              flex: 1, height: 44, borderRadius: 6,
              background: isDeploymentEnabled ? '#0F172A' : '#E2E8F0',
              color: isDeploymentEnabled ? '#FFFFFF' : '#94A3B8',
              fontSize: 14, fontWeight: 600, letterSpacing: 0.5,
              border: 'none',
              cursor: isDeploymentEnabled ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s ease',
              transform: isDeploymentEnabled ? 'scale(1.02)' : 'scale(1)',
              boxShadow: isDeploymentEnabled ? '0 4px 12px rgba(15,23,42,0.3)' : 'none',
            }}
            onMouseOver={(e) => { if (isDeploymentEnabled) { e.target.style.boxShadow = '0 6px 16px rgba(15,23,42,0.4)'; } }}
            onMouseOut={(e) => { if (isDeploymentEnabled) { e.target.style.boxShadow = '0 4px 12px rgba(15,23,42,0.3)'; } }}
          >
            ⚡ INITIALIZE DEPLOYMENT
          </button>
        </div>

        {/* Status Message */}
        <div style={{ marginTop: 16, fontSize: '11px', color: '#64748B', textAlign: 'center' }}>
          {!scrolledToBottom && <p>Scroll to bottom of the active section to proceed</p>}
          {scrolledToBottom && !isDeploymentEnabled && <p>Confirm all three checkboxes to unlock deployment</p>}
          {isDeploymentEnabled && <p style={{ color: '#047857', fontWeight: 600 }}>✅ All requirements met. Ready to initialize.</p>}
        </div>

        {/* Custom Scrollbar */}
        <style>{`
          [data-eula-section]::-webkit-scrollbar { width: 8px; }
          [data-eula-section]::-webkit-scrollbar-track { background: #F1F5F9; border-radius: 4px; }
          [data-eula-section]::-webkit-scrollbar-thumb { background: #94A8B8; border-radius: 4px; border: 2px solid #F1F5F9; }
          [data-eula-section]::-webkit-scrollbar-thumb:hover { background: #64748B; }
        `}</style>
      </div>
    </div>
  );
};

// Extracted presentational component — no logic, no hooks
const CheckboxRow = React.memo(({ id: _id, checked, onChange, disabled, scrolledToBottom, label }) => (
  <label
    style={{
      display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16, padding: 12, borderRadius: 8,
      cursor: scrolledToBottom ? 'pointer' : 'not-allowed',
      opacity: scrolledToBottom ? 1 : 0.5,
      transition: 'background 0.2s ease',
      backgroundColor: 'transparent',
    }}
    onMouseOver={(e) => scrolledToBottom && (e.currentTarget.style.backgroundColor = '#F1F5F9')}
    onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
  >
    <input
      type="checkbox"
      checked={checked}
      onChange={onChange}
      disabled={disabled}
      style={{ marginTop: 3, cursor: scrolledToBottom ? 'pointer' : 'not-allowed', accentColor: '#1e40af' }}
    />
    <span style={{ color: '#475569', fontSize: '12px', lineHeight: 1.5 }}>{label}</span>
  </label>
));

export default RegimentEULA;

import React, { useState } from 'react';

export default function AdminGate({ onCancel }) {
  const [adminMasterEmail, setAdminMasterEmail] = useState('');
  const [otp, setOtp] = useState({ otp1: '', otp2: '', otp3: '' });
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Placeholder for sendAdminOTPs and handleAdminAccess logic
  const sendAdminOTPs = async () => {
    setLoading(true);
    setTimeout(() => {
      setStep(2);
      setLoading(false);
    }, 1000);
  };

  const handleAdminAccess = async () => {
    setLoading(true);
    setTimeout(() => {
      if (
        otp.otp1 === 'gunitsingh1994' &&
        otp.otp2 === 'arkgproductions' &&
        otp.otp3 === 'starg.unit'
      ) {
        setStep(3);
        setError('');
      } else {
        setError('Invalid OTPs. Access denied.');
      }
      setLoading(false);
    }, 1000);
  };

  return (
    <div className="glass-panel" style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
      background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 32, minWidth: 320, boxShadow: '0 4px 32px rgba(0,0,0,0.2)', position: 'relative' }}>
        <div style={{ position: 'absolute', top: 16, right: 16, cursor: 'pointer', fontWeight: 700, color: '#f00' }} onClick={onCancel}>X</div>
        <div style={{ background: '#ffeded', color: '#b91c1c', padding: 12, borderRadius: 8, marginBottom: 24, fontWeight: 700, textAlign: 'center', fontSize: 18 }}>
          WARNING: RESTRICTED AREA
        </div>
        {step === 1 && (
          <>
            <label style={{ fontWeight: 500 }}>Admin Master Email</label>
            <input
              className="input-glass"
              type="email"
              value={adminMasterEmail}
              onChange={e => setAdminMasterEmail(e.target.value)}
              placeholder="Enter admin email"
              style={{ width: '100%', marginBottom: 16 }}
              disabled={loading}
            />
            <button className="btn-glass" style={{ width: '100%' }} onClick={sendAdminOTPs} disabled={loading || !adminMasterEmail}>
              {loading ? 'Sending OTPs...' : 'Send Admin OTPs'}
            </button>
          </>
        )}
        {step === 2 && (
          <>
            <label style={{ fontWeight: 500 }}>Triple OTP Verification</label>
            <input
              className="input-glass"
              type="text"
              value={otp.otp1}
              onChange={e => setOtp({ ...otp, otp1: e.target.value })}
              placeholder="OTP 1"
              style={{ width: '100%', marginBottom: 8 }}
              disabled={loading}
            />
            <input
              className="input-glass"
              type="text"
              value={otp.otp2}
              onChange={e => setOtp({ ...otp, otp2: e.target.value })}
              placeholder="OTP 2"
              style={{ width: '100%', marginBottom: 8 }}
              disabled={loading}
            />
            <input
              className="input-glass"
              type="text"
              value={otp.otp3}
              onChange={e => setOtp({ ...otp, otp3: e.target.value })}
              placeholder="OTP 3"
              style={{ width: '100%', marginBottom: 16 }}
              disabled={loading}
            />
            <button className="btn-glass" style={{ width: '100%' }} onClick={handleAdminAccess} disabled={loading}>
              {loading ? 'Verifying...' : 'Verify & Enter'}
            </button>
            {error && <div style={{ color: '#b91c1c', marginTop: 12 }}>{error}</div>}
          </>
        )}
        {step === 3 && (
          <div style={{ color: '#16a34a', fontWeight: 700, textAlign: 'center', fontSize: 18 }}>
            Admin Access Granted!
          </div>
        )}
      </div>
    </div>
  );
}

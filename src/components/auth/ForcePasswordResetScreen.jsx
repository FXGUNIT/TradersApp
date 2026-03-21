import { useState } from 'react';
import { T } from '../../constants/theme.js';
import { authBtn, authInp, lbl, authCard } from '../../utils/styleUtils.js';
import { calculatePasswordStrength, getStrengthLabel } from '../../utils/validationUtils.js';
import { AuthLogo } from '../SharedUI.jsx';

// ═══════════════════════════════════════════════════════════════════
//  FORCE PASSWORD RESET SCREEN — RULE 18 (120-DAY EXPIRY)
// ═══════════════════════════════════════════════════════════════════
export function ForcePasswordResetScreen({ onReset, onLogout }) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [capsLock, setCapsLock] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);

  const handlePasswordChange = (e) => {
    const pwd = e.target.value;
    setNewPassword(pwd);
    setPasswordStrength(calculatePasswordStrength(pwd));
  };

  const handleKeyDown = (e) => {
    setCapsLock(e.getModifierState('CapsLock'));
  };

  const handleKeyUp = (e) => {
    setCapsLock(e.getModifierState('CapsLock'));
  };

  const resetPassword = async () => {
    setErr('');
    setMsg('');

    if (!newPassword || !confirmPassword) {
      setErr('Both password fields are required.');
      return;
    }

    if (newPassword.length < 8) {
      setErr('Password must be at least 8 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErr('Passwords do not match.');
      return;
    }

    if (passwordStrength < 2) {
      setErr('Password is too weak. Use uppercase, numbers, and symbols.');
      return;
    }

    setLoading(true);
    try {
      // Call parent handler to update password
      await onReset(newPassword);
      setMsg('\u2713 Password reset successfully. Redirecting...');
      setTimeout(() => {
        // Will be handled by parent
      }, 1500);
    } catch (error) {
      setErr(error.message || 'Password reset failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: T.font, padding: "20px" }}>
      <div style={authCard} className="glass-panel">
        <AuthLogo />
        <div style={{ color: T.red, fontSize: 12, letterSpacing: 2, textAlign: "center", marginBottom: 24, fontWeight: 700 }}>{"\u23F0"} MANDATORY PASSWORD RESET</div>
        
        <div style={{ background: "rgba(255,69,58,0.1)", border: `1px solid rgba(255,69,58,0.3)`, borderRadius: 8, padding: 12, marginBottom: 20 }}>
          <p style={{ color: T.muted, fontSize: 12, margin: 0, lineHeight: 1.6 }}>
            Your password was last changed <strong>over 120 days ago</strong>. For security compliance, you must reset it before accessing your account.
          </p>
        </div>

        {err && <div style={{ color: T.red, fontSize: 12, marginBottom: 16, padding: "10px 14px", background: "rgba(255,69,58,0.1)", border: `1px solid rgba(255,69,58,0.3)`, borderRadius: 6, fontWeight: 500 }}>{err}</div>}
        {msg && <div style={{ color: T.green, fontSize: 12, marginBottom: 16, padding: "10px 14px", background: "rgba(48,209,88,0.1)", border: `1px solid rgba(48,209,88,0.3)`, borderRadius: 6, fontWeight: 500 }}>{msg}</div>}

        <div style={{ marginBottom: 16 }}>
          <label style={lbl}>NEW PASSWORD *</label>
          <div style={{ position: 'relative', width: '100%', marginBottom: 8 }}>
            <input 
              type={showPwd ? "text" : "password"} 
              value={newPassword} 
              onChange={handlePasswordChange}
              onKeyDown={handleKeyDown}
              onKeyUp={handleKeyUp}
              placeholder="Min 8 characters" 
              style={{...authInp, letterSpacing: 2, width: '100%', marginBottom: 0}} 
              className="input-glass" 
            />
            <button 
              type="button"
              onClick={() => setShowPwd(!showPwd)}
              style={{ 
                position: 'absolute', 
                right: '10px', 
                top: '50%', 
                transform: 'translateY(-50%)', 
                background: 'none', 
                border: 'none', 
                color: '#888', 
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              {showPwd ? "HIDE" : "SHOW"}
            </button>
          </div>

          {capsLock && (
            <div style={{ color: T.red, fontSize: 10, marginBottom: 6, padding: '6px 8px', background: 'rgba(255,69,58,0.1)', borderRadius: 3 }}>
              {"\u26A0\uFE0F"} Caps Lock is ON
            </div>
          )}

          {newPassword && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', gap: 3, height: 3, marginBottom: 4 }}>
                {[0, 1, 2].map((idx) => (
                  <div
                    key={idx}
                    style={{
                      flex: 1,
                      height: '100%',
                      background: passwordStrength > idx ? getStrengthLabel(passwordStrength).color : 'rgba(255,255,255,0.1)',
                      borderRadius: 2,
                      transition: 'all 0.2s ease'
                    }}
                  />
                ))}
              </div>
              <div style={{ fontSize: 9, color: getStrengthLabel(passwordStrength).color }}>
                Strength: <strong>{getStrengthLabel(passwordStrength).label}</strong>
              </div>
            </div>
          )}
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={lbl}>CONFIRM PASSWORD *</label>
          <div style={{ position: 'relative', width: '100%' }}>
            <input 
              type={showConfirm ? "text" : "password"} 
              value={confirmPassword} 
              onChange={(e) => setConfirmPassword(e.target.value)} 
              placeholder="Re-enter password" 
              style={{...authInp, letterSpacing: 2, width: '100%', marginBottom: 0}} 
              className="input-glass" 
            />
            <button 
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              style={{ 
                position: 'absolute', 
                right: '10px', 
                top: '50%', 
                transform: 'translateY(-50%)', 
                background: 'none', 
                border: 'none', 
                color: '#888', 
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              {showConfirm ? "HIDE" : "SHOW"}
            </button>
          </div>
        </div>

        <button 
          onClick={resetPassword} 
          disabled={loading || !newPassword || !confirmPassword}
          style={{ ...authBtn(T.green, loading || !newPassword || !confirmPassword), marginBottom: 12 }} 
          className="btn-glass"
        >
          {loading ? 'RESETTING...' : '\uD83D\uDD10 RESET PASSWORD'}
        </button>

        <button onClick={onLogout} style={{ background: "transparent", border: "none", cursor: "pointer", color: T.dim, fontSize: 12, fontFamily: T.font, display: "block", width: "100%", fontWeight: 600, transition: "color 0.2s" }} onMouseEnter={e=>e.target.style.color=T.red} onMouseLeave={e=>e.target.style.color=T.dim}>{"\u2190"} LOGOUT</button>
      </div>
    </div>
  );
}

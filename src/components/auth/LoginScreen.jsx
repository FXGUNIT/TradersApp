import { useState } from 'react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { T } from '../../constants/theme.js';
import { authBtn, authInp, lbl, authCard } from '../../utils/styleUtils.js';
import { AuthLogo } from '../SharedUI.jsx';
import { GoogleSignInButton } from './GoogleSignInButton.jsx';

// \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
//  LOGIN SCREEN \u2014 WITH PASSWORD RESET
// \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
export function LoginScreen({ onLogin, onSignup, onAdmin, firebaseAuth, googleProvider }) {
  const [email, setEmail] = useState(''); 
  const [pass, setPass] = useState(''); 
  const [err, setErr] = useState(''); 
  const [loading, setLoading] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [resetMsg, setResetMsg] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [stayLoggedIn, setStayLoggedIn] = useState(false);

  const handleForgotPassword = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) { 
      setErr('Please enter your email address.'); 
      return; 
    }
    
    setLoading(true); 
    setErr(''); 
    setResetMsg('');
    
    try {
      await sendPasswordResetEmail(firebaseAuth, cleanEmail);
      setResetMsg('\u2713 Password reset email sent! Check your inbox and spam folder.');
      setErr('');
    } catch (error) {
      const errorCode = error.code;
      let errorMessage = 'Failed to send reset email.';
      
      if (errorCode === 'auth/user-not-found') {
        errorMessage = 'No account found with this email address.';
      } else if (errorCode === 'auth/invalid-email') {
        errorMessage = 'Please enter a valid email address.';
      } else if (errorCode === 'auth/too-many-requests') {
        errorMessage = 'Too many attempts. Please try again later.';
      } else if (errorCode === 'auth/user-disabled') {
        errorMessage = 'This account has been disabled.';
      } else {
        errorMessage = 'Error: ' + (error.message || 'Failed to send reset email.');
      }
      
      setErr(errorMessage);
      setResetMsg('');
    } finally {
      setLoading(false);
    }
  };

  const submit = async () => {
    if (!email || !pass) { setErr('Email and password required.'); return; }
    setErr(''); setLoading(true);
    try { await onLogin(email, pass, stayLoggedIn); } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#FFFFFF", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: T.font, padding: 20, gap: 40 }}>
      <AuthLogo />
      <div style={authCard} className="glass-panel">

        {resetMsg && <div style={{ color: T.green, fontSize: 12, marginBottom: 16, padding: "12px 14px", background: "rgba(48,209,88,0.1)", border: `1px solid rgba(48,209,88,0.3)`, borderRadius: 8, fontWeight: 500, lineHeight: 1.5 }}>{resetMsg}</div>}
        {err && <div style={{ color: T.red, fontSize: 12, marginBottom: 16, padding: "12px 14px", background: "rgba(255,69,58,0.1)", border: `1px solid rgba(255,69,58,0.3)`, borderRadius: 8, fontWeight: 500 }}>{err}</div>}

        {resetMode && <div style={{ color: "#111827", fontSize: 16, letterSpacing: "-0.02em", textAlign: "center", marginBottom: 12, fontWeight: 700, lineHeight: 1.3 }}>ACCOUNT RECOVERY</div>}

        <div>
          <label style={lbl}>EMAIL</label>
          <div style={{ position: 'relative', width: '100%' }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: '#64748B', pointerEvents: 'none' }}>{"\uD83D\uDCE1"}</span>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" autoComplete="email" style={{...authInp, paddingLeft: 40, fontFamily: T.font}} className="input-glass" />
          </div>
        </div>

        {!resetMode ? (
          <>
            <div>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 6}}>
                <label style={{...lbl, marginBottom: 0}}>PASSWORD</label>
                <span onClick={() => {setResetMode(true); setErr(''); setResetMsg('');}} style={{...lbl, color: T.blue, cursor: 'pointer', textTransform: 'none', marginBottom: 0}}>Forgot Password?</span>
              </div>
              <div style={{ position: 'relative', width: '100%', marginBottom: 15 }}>
                <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: '#64748B', pointerEvents: 'none' }}>{"\uD83D\uDD11"}</span>
                <input 
                  type={showPwd ? "text" : "password"} 
                  value={pass} 
                  onChange={(e) => setPass(e.target.value)} 
                  style={{ ...authInp, width: '100%', marginBottom: 0, paddingLeft: 40, fontFamily: T.mono, letterSpacing: 4 }} 
                  placeholder={"\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"}
                  onKeyDown={e => e.key === 'Enter' && submit()}
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
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <input 
                type="checkbox" 
                id="stayLoggedIn" 
                checked={stayLoggedIn} 
                onChange={(e) => setStayLoggedIn(e.target.checked)}
                style={{ cursor: "pointer" }}
              />
              <label htmlFor="stayLoggedIn" style={{ fontSize: 12, color: T.muted, cursor: "pointer", fontFamily: T.font }}>Stay Logged In</label>
            </div>
            <button onClick={submit} disabled={loading} style={authBtn(T.green, loading)} className="btn-glass">{loading ? "\u27F3 AUTHENTICATING..." : "\u26A1 INITIALIZE DEPLOYMENT"}</button>
            
            <GoogleSignInButton 
              onSuccess={(user) => {
                setEmail(user.email);
                onLogin(user.email, user.uid, true);
              }}
              onError={(error) => setErr(error)}
              buttonText="CONTINUE WITH GOOGLE"
              isLoading={loading}
              firebaseAuth={firebaseAuth}
              googleProvider={googleProvider}
            />
            
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24 }}>
              <button onClick={onSignup} style={{ background: "transparent", border: "none", cursor: "pointer", color: T.muted, fontSize: 11, fontFamily: T.font, letterSpacing: 1, fontWeight: 600 }}>NEW RECRUIT {"\u2192"} APPLY</button>
              <button onClick={onAdmin} style={{ background: "transparent", border: "none", cursor: "pointer", color: T.muted, fontSize: 11, fontFamily: T.font, letterSpacing: 1, fontWeight: 600 }}>{"\u2699"} ADMIN</button>
            </div>
          </>
        ) : (
          <>
            <button onClick={handleForgotPassword} disabled={loading || !email} style={authBtn(T.blue, loading || !email)} className="btn-glass">
              {loading ? "\u27F3 TRANSMITTING..." : "\u2709 SEND RECOVERY LINK"}
            </button>
            <button onClick={() => {setResetMode(false); setErr(''); setResetMsg('');}} style={{ ...authBtn(T.muted, false), background: "transparent", border: "none", marginTop: 12 }} className="btn-glass">
              {"\u2190"} BACK TO LOGIN
            </button>
          </>
        )}
      </div>
    </div>
  );
}

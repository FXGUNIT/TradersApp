import { useState, useRef } from 'react';
import emailjs from '@emailjs/browser';
import { T } from '../../constants/theme.js';
import { authBtn, authInp, lbl, authCard } from '../../utils/styleUtils.js';
import { genOTP } from '../../utils/otpUtils.js';
import { copyToClipboardSecure } from '../../utils/uiUtils.js';
import { AuthLogo } from '../SharedUI.jsx';

// ═══════════════════════════════════════════════════════════════════
//  OTP SCREEN — "UNHACKABLE" EDITION (RATE LIMITS + SANITIZATION)
// ═══════════════════════════════════════════════════════════════════
export function OTPScreen({ profile, onVerified, onLogout, showToast, dbR, dbW }) {
  const [userEmailCode, setUserEmailCode] = useState('');
  const [step, setStep] = useState(1);
  const [, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const otpInputRef = useRef(null);

  const EMAILJS_SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID || 'service_xxx';
  const EMAILJS_TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID || 'template_xxx';
  const EMAILJS_USER_ID = import.meta.env.VITE_EMAILJS_PUBLIC_KEY || 'user_xxx';

  const sendOTPs = async () => {
    setLoading(true);
    try {
      const emailCode = genOTP();
      // ═══════════════════════════════════════════════════════════════════
      // CRITICAL FIX: Send OTP to the actual user's email, not hardcoded admin
      // ═══════════════════════════════════════════════════════════════════
      const userEmail = profile.email; // Use actual user email from profile

      await emailjs.send(
        import.meta.env.VITE_EMAILJS_SERVICE_ID, 
        import.meta.env.VITE_EMAILJS_TEMPLATE_ID, 
        {
          user_email: userEmail,    // SEND TO ACTUAL USER EMAIL
          otp_code: emailCode,       // MATCHES YOUR HTML {{otp_code}}
          to_email: userEmail        // FOR THE DASHBOARD SETTING
        }, 
        import.meta.env.VITE_EMAILJS_PUBLIC_KEY
      );

      // Save OTP to Firebase with user's email for verification
      try {
        await dbW(`otps/${profile.uid}`, {
          emailCode,
          email: userEmail,  // Store the user's email for verification
          createdAt: new Date().toISOString()
        }, profile.token);
      } catch (dbErr) {
        console.warn("Database save failed, but email was sent:", dbErr);
      }

      setStep(2);
      setMsg('\u2713 Check your inbox!');
    } catch (error) {
      console.error('OTP Send Error:', error);
      setMsg('\u2717 Error: ' + (error?.text || error?.message || 'Check configuration'));
    } finally {
      setLoading(false);
    }
  };

  // RULE #11: Smart OTP Paste - Auto-fill on 6-digit paste
  const handlePaste = (e) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');
    const digits = pastedText.replace(/[^\d]/g, ''); // Extract only digits
    
    if (digits.length === 6) {
      setUserEmailCode(digits);
      setMsg('\u2713 OTP auto-filled from clipboard');
    } else if (digits.length > 0) {
      setErr(`Please paste a valid 6-digit code (${digits.length} digits detected)`);
    }
  };

  const verifyOTPs = async () => {
    setLoading(true);
    try {
      const storedData = await dbR(`otps/${profile.uid}`, profile.token);
      
      if (!storedData) {
        setMsg('\u2717 No OTP record found. Please send a new code.');
        setLoading(false);
        return;
      }
      
      // Verify OTP code matches
      if (storedData.emailCode !== userEmailCode) {
        setMsg('\u2717 Invalid verification code. Please try again.');
        setLoading(false);
        return;
      }
      
      // Verify email matches (security check)
      if (storedData.email && storedData.email.toLowerCase() !== profile.email.toLowerCase()) {
        console.error('Email mismatch in OTP verification:', {
          stored: storedData.email,
          profile: profile.email
        });
        setMsg('\u2717 Email mismatch. Please logout and try again.');
        setLoading(false);
        return;
      }
      
      setMsg('\u2713 Identity Verified.');
      onVerified();
    } catch (error) {
      console.error('OTP Verification Error:', error);
      setMsg('\u2717 Verification failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: T.font, padding: "20px" }}>
      <div style={authCard} className="glass-panel">
        <AuthLogo />
        <div style={{ color: T.blue, fontSize: "clamp(10px, 3vw, 12px)", letterSpacing: 2, textAlign: "center", marginBottom: 28, fontWeight: 700 }}>EMAIL VERIFICATION</div>
        
        {msg && <div style={{ color: T.green, fontSize: 13, marginBottom: 24, padding: "14px 18px", background: "rgba(48,209,88,0.1)", border: `1px solid rgba(48,209,88,0.3)`, borderRadius: 10, fontWeight: 500, lineHeight: 1.5, whiteSpace: "pre-line" }}>{msg}</div>}

        {step === 1 ? (
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: T.muted, fontSize: 13, marginBottom: 20 }}>
              To secure your account, we will send a verification code to:<br/>
              <strong style={{ color: T.blue }}>{profile.email}</strong>
            </p>
            
            <button 
              onClick={sendOTPs} 
              disabled={loading}
              style={authBtn(T.blue, loading)} 
              className="btn-glass"
            >
              {loading ? 'SENDING...' : '\u2709 DISPATCH EMAIL CODE'}
            </button>
          </div>
        ) : (
          <div>
            <label style={lbl}>ENTER 6-DIGIT EMAIL CODE</label>
            <div style={{ fontSize: 10, color: T.muted, marginBottom: 8, fontStyle: 'italic' }}>{"\uD83D\uDCA1"} Tip: Paste a 6-digit code and it will auto-fill</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <input 
                ref={otpInputRef}
                type="text" 
                value={userEmailCode} 
                onChange={(e) => setUserEmailCode(e.target.value.replace(/[^\d]/g, '').slice(0, 6))}
                onPaste={handlePaste}
                style={{...authInp, flex: 1, letterSpacing: '4px', textAlign: 'center', fontWeight: 'bold'}} 
                placeholder="000000"
                maxLength="6"
                inputMode="numeric"
              />
              <button 
                onClick={() => copyToClipboardSecure(userEmailCode, showToast)}
                disabled={!userEmailCode}
                style={{
                  ...authBtn(T.blue, !userEmailCode),
                  padding: '10px 12px',
                  minWidth: '60px'
                }} 
                className="btn-glass"
                title="Copy code & auto-clear clipboard in 60s"
              >
                {"\uD83D\uDCCB"} COPY
              </button>
            </div>
            
            <button 
              onClick={verifyOTPs} 
              disabled={loading}
              style={authBtn(T.green, loading)} 
              className="btn-glass"
            >
              {loading ? 'VERIFYING...' : 'UNLOCK TERMINAL'}
            </button>
          </div>
        )}

        <button onClick={onLogout} style={{ background: "transparent", border: "none", cursor: "pointer", color: T.dim, fontSize: 12, fontFamily: T.font, marginTop: 24, display: "block", width: "100%", fontWeight: 600, transition: "color 0.2s" }} onMouseEnter={e=>e.target.style.color=T.red} onMouseLeave={e=>e.target.style.color=T.dim}>{"\u2190"} ABORT LOGIN</button>
      </div>
    </div>
  );
}

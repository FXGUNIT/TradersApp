import { useState } from 'react';
import { T } from '../../constants/theme.js';
import { authBtn, authInp, lbl, authCard } from '../../utils/styleUtils.js';
import { calculatePasswordStrength, getStrengthLabel, isValidGmailAddress } from '../../utils/validationUtils.js';
import { formatPhoneNumber } from '../../utils/businessLogicUtils.jsx';
import { AuthLogo } from '../SharedUI.jsx';
import { GoogleSignInButton } from './GoogleSignInButton.jsx';
import { ImageCropper } from '../ImageCropper.jsx';
import { IdentityVerificationComponent } from './IdentityVerificationComponent.jsx';
import { getDevice } from '../../utils/deviceUtils.js';

// \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
//  SIGNUP SCREEN
// \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
// NOTE: This component is currently superseded by CleanOnboarding.jsx
// Preserved here as a reference implementation / potential fallback.
export function SignupScreen({ onBack, onSubmit, firebaseAuth, googleProvider, uploadIdentityDoc }) {
  const [f, setF] = useState({ 
    fullName: '', email: '', password: '', mobile: '', 
    address: '', instagram: '', linkedin: '', proficiency: 'beginner' 
  }); 
  const [device, setDevice] = useState(null); 
  const [geoOk, setGeoOk] = useState(false); 
  const [tncAccepted, setTncAccepted] = useState(false); 
  const [privacyAccepted, setPrivacyAccepted] = useState(false); 
  const [devPermsGranted, setDevPermsGranted] = useState(false); 
  const [err, setErr] = useState(''); 
  const [loading, setLoading] = useState(false); 
  const [showTnc, setShowTnc] = useState(false); 
  const [showSignupPwd, setShowSignupPwd] = useState(false);
  const [stayLoggedIn, setStayLoggedIn] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [profilePicture, setProfilePicture] = useState(null);
  const [showImageCropper, setShowImageCropper] = useState(false);
  const [selectedImageFile, setSelectedImageFile] = useState(null);
  
  const sf = k => v => setF(p => ({ ...p, [k]: v }));
  
  const isFormValid = () => {
    return isValidGmailAddress(f.email) && f.password.length >= 8;
  };
  
  const handlePasswordChange = (e) => {
    const pwd = e.target.value;
    sf('password')(pwd);
    setPasswordStrength(calculatePasswordStrength(pwd));
  };

  const handlePasswordKeyDown = (e) => {
    if (e.getModifierState('CapsLock')) {
      setCapsLockOn(true);
    } else {
      setCapsLockOn(false);
    }
  };

  const handlePasswordKeyUp = (e) => {
    setCapsLockOn(e.getModifierState('CapsLock'));
  };
  
  const requestPerms = async () => { 
    const d = getDevice(); 
    setDevice(d); 
    try { 
      navigator.geolocation.getCurrentPosition(
        (pos) => { setGeoOk(Boolean(pos)); }, 
        () => setGeoOk(false)
      ); 
      if (Notification.permission === 'default') {
        await Notification.requestPermission(); 
      }
    } catch { 
      // Geolocation or notification permission failed silently
    } 
    setDevPermsGranted(true); 
  };
  
  const submit = async () => { 
    if (!f.fullName || !f.email || !f.password || !f.mobile) { 
      setErr('Full Name, Email, Password, and Mobile are required.'); 
      return; 
    }

    if (!isValidGmailAddress(f.email)) {
      setErr('Institutional Rule: Only @gmail.com accounts are permitted for the Regiment.');
      return;
    }
    
    if (!tncAccepted || !privacyAccepted) { 
      setErr('You must accept Terms & Conditions and the Privacy Notice.'); 
      return; 
    } 
    if (!devPermsGranted) { 
      setErr('You must grant device permissions to proceed.'); 
      return; 
    } 
    
    setErr(''); 
    setLoading(true); 
    
    try { 
      await onSubmit({ ...f, device, geoGranted: geoOk, stayLoggedIn }); 
    } catch (e) { 
      setErr(e.message); 
    } finally { 
      setLoading(false); 
    } 
  };
  
  return (
    <div style={{ minHeight: "100vh", background: T.bg, overflowY: "auto", fontFamily: T.font, padding: 20 }}>
      <div style={{ ...authCard, maxWidth: 560 }} className="glass-panel">
        <AuthLogo />
        <div style={{ color: T.gold, fontSize: 12, letterSpacing: 2, textAlign: "center", marginBottom: 24, fontWeight: 700 }}>
          RECRUIT APPLICATION FORM
        </div>
        
        {/* RULE #23: Google Sign-In Alternative */}
        <div style={{ marginBottom: 16 }}>
          <GoogleSignInButton 
            onSuccess={(user) => {
              sf('email')(user.email);
              if (user.displayName) {
                sf('fullName')(user.displayName);
              }
            }}
            onError={(error) => setErr(error)}
            buttonText="SIGN UP WITH GOOGLE"
            isLoading={loading}
            firebaseAuth={firebaseAuth}
            googleProvider={googleProvider}
          />
        </div>
        
        <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1, height: '1px', background: `${T.muted}40` }} />
          <span style={{ fontSize: 11, color: T.muted }}>OR MANUAL ENTRY</span>
          <div style={{ flex: 1, height: '1px', background: `${T.muted}40` }} />
        </div>
        
        <div style={{ color: T.muted, fontSize: 11, letterSpacing: 2, marginBottom: 12, paddingBottom: 8, borderBottom: `1px solid rgba(255,255,255,0.1)`, fontWeight: 600 }}>
          PERSONAL INFORMATION
        </div>
        
        <div>
          <label style={lbl}>FULL NAME *</label>
          <input value={f.fullName} onChange={e => sf('fullName')(e.target.value)} placeholder="Your full legal name" style={{...authInp, fontFamily: T.font}} className="input-glass" />
        </div>
        
        <div>
          <label style={lbl}>EMAIL ADDRESS *</label>
          <input type="email" value={f.email} onChange={e => sf('email')(e.target.value)} placeholder="your@email.com" style={{...authInp, fontFamily: T.font}} className="input-glass" />
        </div>

        {/* LAYER 4 SECURITY: ANTI-SPAM HONEYPOT FIELD - Hidden from humans, visible to bots */}
        <div style={{display: 'none', visibility: 'hidden', position: 'absolute', left: '-9999px'}}>
          <input 
            type="text" 
            id="phone_number_verify_alt_opt"
            name="phone_number_verify_alt_opt"
            value={f['phone_number_verify_alt_opt'] || ''}
            onChange={e => sf('phone_number_verify_alt_opt')(e.target.value)}
            placeholder="Do not fill this field"
            aria-hidden="true"
            tabIndex="-1"
            autoComplete="off"
          />
        </div>
        
        {/* RULE #21 & #22: Profile Picture Upload & Cropper */}
        <div style={{ 
          background: 'rgba(52,199,89,0.1)', 
          border: `1px solid ${T.green}50`, 
          padding: 16, 
          borderRadius: 10, 
          marginBottom: 16 
        }}>
          <div style={{ color: T.green, fontSize: 12, fontWeight: 700, marginBottom: 12 }}>{"\uD83D\uDCF7"} PROFESSIONAL HEADSHOT (OPTIONAL)</div>
          
          {!showImageCropper && !profilePicture ? (
            <>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (file) {
                    setSelectedImageFile(file);
                    setShowImageCropper(true);
                  }
                }}
                style={{ display: 'none' }}
                id="profileUpload"
              />
              <button
                onClick={() => document.getElementById('profileUpload')?.click()}
                style={{...authBtn(T.green, false), width: '100%'}}
                className="btn-glass"
              >
                {"\uD83D\uDCE4"} UPLOAD & CROP PHOTO
              </button>
              <div style={{ fontSize: 10, color: T.muted, marginTop: 8, textAlign: 'center' }}>
                If no photo is uploaded, Gravatar will be used as fallback
              </div>
            </>
          ) : showImageCropper && selectedImageFile ? (
            <ImageCropper 
              file={selectedImageFile}
              onCrop={(blob) => {
                setProfilePicture(blob);
                setShowImageCropper(false);
              }}
              onCancel={() => {
                setShowImageCropper(false);
                setSelectedImageFile(null);
              }}
            />
          ) : profilePicture ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 100, height: 100, borderRadius: '50%', border: `2px solid ${T.green}`, background: `url(${URL.createObjectURL(profilePicture)}) center / cover`, margin: '0 auto 12px' }} />
              <div style={{ color: T.green, fontSize: 11, fontWeight: 600, marginBottom: 8 }}>{"\u2714"} Photo ready</div>
              <button
                onClick={() => {
                  setProfilePicture(null);
                  setSelectedImageFile(null);
                }}
                style={{...authBtn(T.red, false), width: '100%'}}
                className="btn-glass"
              >
                {"\uD83D\uDD04"} CHANGE PHOTO
              </button>
            </div>
          ) : null}
        </div>
        
        <div>
          <label style={lbl}>PASSWORD *</label>
          <div style={{ position: 'relative', width: '100%', marginBottom: 8 }}>
            <input 
              type={showSignupPwd ? "text" : "password"} 
              value={f.password} 
              onChange={handlePasswordChange}
              onKeyDown={handlePasswordKeyDown}
              onKeyUp={handlePasswordKeyUp}
              placeholder="Min 8 characters" 
              style={{...authInp, letterSpacing: 4, width: '100%', marginBottom: 0}} 
              className="input-glass" 
            />
            <button 
              type="button"
              onClick={() => setShowSignupPwd(!showSignupPwd)}
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
              {showSignupPwd ? "HIDE" : "SHOW"}
            </button>
          </div>
          
          {/* Caps Lock Warning */}
          {capsLockOn && (
            <div style={{ color: T.red, fontSize: 11, marginBottom: 8, padding: '8px 10px', background: 'rgba(255,69,58,0.1)', border: `1px solid rgba(255,69,58,0.3)`, borderRadius: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
              {"\u26A0\uFE0F"} <strong>Caps Lock is ON</strong>
            </div>
          )}

          {/* Password Strength Meter */}
          {f.password && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', gap: 4, height: 4, marginBottom: 6 }}>
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
              <div style={{ fontSize: 10, color: getStrengthLabel(passwordStrength).color, fontWeight: 600 }}>
                Password Strength: <strong>{getStrengthLabel(passwordStrength).label}</strong>
              </div>
            </div>
          )}
        </div>
        
        <div>
          <label style={lbl}>MOBILE NUMBER *</label>
          <input value={f.mobile} onChange={e => sf('mobile')(formatPhoneNumber(e.target.value))} placeholder="10-digit phone number" style={authInp} className="input-glass" />
        </div>
        
        <div>
          <label style={lbl}>ADDRESS</label>
          <input value={f.address} onChange={e => sf('address')(e.target.value)} placeholder="City, State, Country" style={{...authInp, fontFamily: T.font}} className="input-glass" />
        </div>
        
        {/* RULE #24: Identity Verification */}
        <IdentityVerificationComponent 
          uid={f.email}
          token=""
          onSuccess={() => {}}
          onError={() => {}}
          showToast={() => {}}
          uploadIdentityDoc={uploadIdentityDoc}
        />
        
        <div style={{ color: T.muted, fontSize: 11, letterSpacing: 2, margin: "20px 0 12px", paddingTop: 12, borderTop: `1px solid rgba(255,255,255,0.1)`, fontWeight: 600 }}>
          SOCIAL PROFILES
        </div>
        
        <div>
          <label style={lbl}>INSTAGRAM ID</label>
          <input value={f.instagram} onChange={e => sf('instagram')(e.target.value)} placeholder="@username" style={{...authInp, fontFamily: T.font}} className="input-glass" />
        </div>
        
        <div>
          <label style={lbl}>LINKEDIN ID</label>
          <input value={f.linkedin} onChange={e => sf('linkedin')(e.target.value)} placeholder="linkedin.com/in/username" style={{...authInp, fontFamily: T.font}} className="input-glass" />
        </div>
        
        <div style={{ marginBottom: 16 }}>
          <label style={lbl}>TRADING PROFICIENCY</label>
          <select value={f.proficiency} onChange={e => sf('proficiency')(e.target.value)} style={{ ...authInp, marginBottom: 0, fontFamily: T.font }} className="input-glass">
            <option value="beginner">{`Beginner \u2014 Under 1 year experience`}</option>
            <option value="intermediate">{`Intermediate \u2014 1-3 years`}</option>
            <option value="advanced">{`Advanced \u2014 3-5 years`}</option>
            <option value="expert">{`Expert \u2014 5+ years, prop funded`}</option>
          </select>
        </div>
        
        <div style={{ padding: "16px 20px", background: "rgba(0,0,0,0.3)", border: `1px solid rgba(255,255,255,0.1)`, borderRadius: 10, marginBottom: 20 }} className="glass-panel">
          <div style={{ color: T.blue, fontSize: 11, letterSpacing: 2, marginBottom: 10, fontWeight: 700 }}>
            {"\u2699"} SYSTEM DEVICE ACCESS
          </div>
          <div style={{ color: "#A1A1A6", fontSize: 12, lineHeight: 1.6, marginBottom: 14 }}>
            For security and session monitoring, this terminal requires access to your device's location and notification services. <strong style={{ color: T.gold }}>This system is STRICTLY PROHIBITED from accessing your banking details, personal passwords, or financial credentials.</strong> All data collection is limited to trading activity and session security only.
          </div>
          {!devPermsGranted ? 
            <button onClick={requestPerms} style={{ ...authBtn(T.blue, false), padding: "12px 0", fontSize: 12 }} className="btn-glass">{"\u229E"} GRANT DEVICE ACCESS</button> : 
            <div style={{ color: T.green, fontSize: 12, fontWeight: 600 }}>{"\u2714"} Device permissions granted{geoOk ? ` \u00B7 Location OK` : ` \u00B7 Location denied (optional)`}</div>
          }
        </div>
        
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
            <div onClick={() => setTncAccepted(v => !v)} style={{ width: 20, height: 20, border: `2px solid ${tncAccepted ? T.green : T.muted}`, borderRadius: 4, background: tncAccepted ? "rgba(48,209,88,0.2)" : "transparent", cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s ease" }}>
              {tncAccepted && <span style={{ color: T.green, fontSize: 14, fontWeight: 800 }}>{"\u2714"}</span>}
            </div>
            <div style={{ color: "#A1A1A6", fontSize: 12, lineHeight: 1.6 }}>
              I accept the <button onClick={() => setShowTnc(v => !v)} style={{ background: "none", border: "none", cursor: "pointer", color: T.blue, fontFamily: T.font, fontSize: 12, padding: 0, textDecoration: "underline", fontWeight: 600 }}>Terms & Conditions</button> of Traders Regiment and understand this is a professional trading system.
            </div>
          </div>
          
          {showTnc && 
            <div style={{ background: "rgba(0,0,0,0.5)", border: `1px solid rgba(255,255,255,0.1)`, borderRadius: 8, padding: 16, marginBottom: 16, maxHeight: 200, overflowY: "auto", color: T.muted, fontSize: 11, lineHeight: 1.8 }} className="glass-panel">
              <strong style={{ color: T.gold }}>TRADERS REGIMENT {"\u2014"} TERMS & CONDITIONS</strong><br /><br />
              1. This terminal is for professional futures trading use only. All trades carry significant financial risk.<br />
              2. The system may collect device metadata for session security. It does NOT collect banking information or passwords.<br />
              3. Account access is subject to Admin approval. Traders Regiment reserves the right to revoke access at any time.<br />
              4. All trading decisions remain the sole responsibility of the user. The system's AI guidance is informational only.<br />
              5. Your data is stored securely in our encrypted database and never sold to third parties.<br />
              6. Dual-OTP is required for every session login. No exceptions.<br />
              7. AMD analysis and trade signals are analytical tools, not guaranteed outcomes.
            </div>
          }
          
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <div onClick={() => setPrivacyAccepted(v => !v)} style={{ width: 20, height: 20, border: `2px solid ${privacyAccepted ? T.green : T.muted}`, borderRadius: 4, background: privacyAccepted ? "rgba(48,209,88,0.2)" : "transparent", cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s ease" }}>
              {privacyAccepted && <span style={{ color: T.green, fontSize: 14, fontWeight: 800 }}>{"\u2714"}</span>}
            </div>
            <div style={{ color: "#A1A1A6", fontSize: 12, lineHeight: 1.6 }}>I confirm this system has NO access to my banking details, personal passwords, or financial credentials. I grant only the stated device permissions for security purposes.</div>
          </div>
        </div>
        
        {err && <div style={{ color: T.red, fontSize: 12, marginBottom: 16, padding: "10px 14px", background: "rgba(255,69,58,0.1)", border: `1px solid rgba(255,69,58,0.3)`, borderRadius: 6, fontWeight: 500 }}>{err}</div>}
        
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <input 
            type="checkbox" 
            id="signupStayLoggedIn" 
            checked={stayLoggedIn} 
            onChange={(e) => setStayLoggedIn(e.target.checked)}
            style={{ cursor: "pointer" }}
          />
          <label htmlFor="signupStayLoggedIn" style={{ fontSize: 12, color: T.muted, cursor: "pointer", fontFamily: T.font }}>Stay Logged In</label>
        </div>
        
        <button onClick={submit} disabled={loading || !isFormValid()} style={authBtn(T.green, loading || !isFormValid())} className="btn-glass">
          {loading ? "\u27F3 SUBMITTING APPLICATION..." : "\u2192 SUBMIT APPLICATION"}
        </button>
        
        <button onClick={onBack} style={{ ...authBtn(T.muted, false), marginTop: 12, background: "transparent" }} className="btn-glass">
          {"\u2190"} BACK TO LOGIN
        </button>
      </div>
    </div>
  );
}

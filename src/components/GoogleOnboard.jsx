import React from 'react'

export default function GoogleOnboard({ onContinue }) {
  return (
    <div style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', background: 'rgba(0,0,0,.5)', zIndex: 9999 }}>
      <div style={{ width: 640, maxWidth: '92%', borderRadius: 16, padding: 20, background: '#0b1220', color: '#fff', boxShadow: '0 20px 60px rgba(0,0,0,.4)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>WELCOME TO THE REGIMENT</h2>
          <button onClick={onContinue} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>
        <p style={{ color: '#d1e3f5', lineHeight: 1.6, marginTop: 12 }}>
          You’ve signed in with Google. This is an invite‑only ecosystem. The Chief will verify your identity within 48 hours. You’ll receive a welcome message if approved.
        </p>
        <div style={{ display:'flex', justifyContent:'flex-end', gap:12, marginTop: 8 }}>
          <button onClick={onContinue} className="btn-glass" style={{ padding: '12px 18px' }}>Continue</button>
        </div>
      </div>
    </div>
  )
}

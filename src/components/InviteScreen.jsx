import React, { useEffect, useState } from 'react'

// A minimal invite screen with army-flavor messaging.
export default function InviteScreen({ onApprove, onClose }) {
  const [countdown, setCountdown] = useState(48 * 60 * 60); // seconds

  useEffect(() => {
    const t = setInterval(() => {
      setCountdown((c) => Math.max(0, c - 1))
    }, 1000)
    return () => clearInterval(t)
  }, [])

  const hours = Math.floor(countdown / 3600)
  const minutes = Math.floor((countdown % 3600) / 60)

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'white', zIndex: 9999, display: 'grid', placeItems: 'center' }}>
      <div style={{ width: 860, maxWidth: '92%', borderRadius: 20, padding: 28, boxShadow: '0 20px 60px rgba(0,0,0,.15)', background: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontWeight: 800, letterSpacing: 1, fontSize: 20, color: '#1f2937' }}>INVITE-ONLY AREA</div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', fontSize: 18, cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 420px', gap: 20 }}>
          <div style={{ padding: 16, borderRadius: 14, border: '1px solid #e5e7eb', alignSelf: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#111827', marginBottom: 6 }}>Welcome, Recruit</div>
            <div style={{ color: '#6b7280', fontSize: 14, lineHeight: 1.6 }}>
              You are invited to Traders Regiment. The Chief will review your identity within 48 hours. Expect a welcome email once approved.
            </div>
            <div style={{ marginTop: 14, fontWeight: 700, fontSize: 12, color: '#374151' }}>
              48 HRS TO APPROVAL • 1st STEP: Identity verification
            </div>
          </div>
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ padding: 16, borderRadius: 12, border: '1px solid #e5e7eb', textAlign: 'center', background: '#fff' }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#374151' }}>Invite Verification</div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>Chief reviews within 48 hours</div>
              <div style={{ marginTop: 12 }}>
                <span style={{ fontWeight: 800, color: '#1f2937', fontSize: 28 }}>{hours.toString().padStart(2, '0')}:{minutes.toString().padStart(2, '0')}</span>
                <span style={{ display: 'block', color: '#6b7280', fontSize: 11, marginTop: 6 }}>HH:MM remaining</span>
              </div>
            </div>
            <button onClick={onApprove} style={{ padding: '12px 18px', background: '#0b5ed7', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}>REQUEST INVITE</button>
          </div>
        </div>
        <div style={{ textAlign: 'center', marginTop: 14, color: '#6b7280', fontSize: 12 }}>
          Army language: Welcome aboard, recruit. The Regiment will brief you shortly.
        </div>
      </div>
    </div>
  )
}

import React from 'react'
import { sendInviteEmail, sendWelcomeEmail } from '../utils/email.js'

export default function AdminInvitesPanel({ invites, onApproveInvite, onAddDemoInvite, onResetInvites, showToast }) {
  return (
    <div className="glass-panel" style={{ padding: 16, borderRadius: 12, marginTop: 16 }}>
      <div style={{ fontWeight: 700, fontSize: 14, color: '#4B5563', marginBottom: 8 }}>Invite Approvals (Test)</div>
      {invites.length === 0 ? (
        <div style={{ color: '#6B7280', textAlign: 'center', padding: '12px 0' }}>No pending invites</div>
      ) : (
        invites.map((iv) => (
          <div key={iv.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #e5e7eb' }}>
            <div>
              <div style={{ fontWeight: 700 }}>{iv.name || iv.email}</div>
              <div style={{ fontSize: 12, color: '#6B7280' }}>{iv.email}</div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, background: iv.status === 'APPROVED' ? '#d1fae5' : '#f1f5f9', color: '#374151', fontWeight: 700 }}>{iv.status}</span>
              {iv.status === 'PENDING' && (
                <button
                  className="btn-glass"
                  style={{ padding: '6px 10px' }}
                  onClick={() => onApproveInvite(iv.id, iv.email, iv.name)}
                >Approve</button>
              )}
            </div>
          </div>
        ))
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button className="btn-glass" onClick={onAddDemoInvite}>Add Demo Invite</button>
        <button className="btn-glass" onClick={onResetInvites}>Reset Invites</button>
      </div>
    </div>
  )
}

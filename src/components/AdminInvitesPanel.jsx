import React from 'react'

export default function AdminInvitesPanel({ invites, onApproveInvite, onAddDemoInvite, onResetInvites, showToast: _showToast }) {
  return (
    <div className="glass-panel" style={{ padding: 16, borderRadius: 12, marginTop: 16 }}>
      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary, #111827)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
        Invite Approvals
        <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(59,130,246,0.1)', color: '#3B82F6', fontWeight: 700, letterSpacing: 1 }}>DEMO</span>
      </div>
      {invites.length === 0 ? (
        <div style={{ color: 'var(--text-secondary, #6B7280)', textAlign: 'center', padding: '12px 0', fontSize: 13 }}>No pending invites</div>
      ) : (
        invites.map((iv) => (
          <div key={iv.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border-subtle, #e5e7eb)' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{iv.name || iv.email}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary, #6B7280)' }}>{iv.email}</div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, background: iv.status === 'APPROVED' ? '#d1fae5' : '#f1f5f9', color: '#374151', fontWeight: 700 }}>{iv.status}</span>
              {iv.status === 'PENDING' && (
                <button
                  className="btn-glass"
                  style={{ padding: '6px 10px', fontSize: 12 }}
                  onClick={() => onApproveInvite(iv.id, iv.email, iv.name)}
                >Approve</button>
              )}
            </div>
          </div>
        ))
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button className="btn-glass" style={{ fontSize: 12, padding: '6px 12px' }} onClick={onAddDemoInvite}>Add Demo Invite</button>
        <button className="btn-glass" style={{ fontSize: 12, padding: '6px 12px' }} onClick={onResetInvites}>Reset Invites</button>
      </div>
    </div>
  )
}

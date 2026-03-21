import { useState } from 'react';

// ═══════════════════════════════════════════════════════════════════
// RULE #315: ADMIN DEBUG OVERLAY - System Audit & Monitoring
// ═══════════════════════════════════════════════════════════════════
export function DebugOverlay({ logs, latencies, tti, componentStatus, isOpen, onToggle, auth }) {
  const [expandedSection, setExpandedSection] = useState(null);
  const [hoveredComponent, setHoveredComponent] = useState(null);
  
  // Only show for Master Admin
  if (!auth?.uid || auth.uid !== 'ADMIN_UID_PLACEHOLDER') return null;

  const logsByType = {
    log: logs.filter(l => l.type === 'log'),
    warn: logs.filter(l => l.type === 'warn'),
    error: logs.filter(l => l.type === 'error'),
    info: logs.filter(l => l.type === 'info')
  };

  const avgLatency = latencies.length > 0 
    ? (latencies.reduce((a, b) => a + b.ms, 0) / latencies.length).toFixed(0)
    : 0;

  const slowRequests = latencies.filter(l => l.ms > 2000);

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={onToggle}
        title="Toggle Debug Overlay"
        style={{
          position: 'fixed',
          bottom: isOpen ? 330 : 20,
          left: 20,
          zIndex: 9998,
          width: 44,
          height: 44,
          borderRadius: '50%',
          background: 'rgba(191,90,242,0.9)',
          border: '2px solid rgba(191,90,242,1)',
          color: '#fff',
          fontSize: 22,
          fontWeight: 700,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.3s ease',
          boxShadow: '0 0 20px rgba(191,90,242,0.5)'
        }}
      >
        {"\uD83D\uDD27"}
      </button>

      {/* Main Debug Panel */}
      {isOpen && (
        <div style={{
          position: 'fixed',
          bottom: 20,
          left: 70,
          width: 420,
          maxHeight: '80vh',
          background: 'rgba(10,10,15,0.95)',
          border: '1px solid rgba(191,90,242,0.3)',
          borderRadius: 12,
          backdropFilter: 'blur(20px)',
          zIndex: 9997,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 0 40px rgba(191,90,242,0.2)'
        }}>
          {/* Header */}
          <div style={{
            padding: '12px 16px',
            borderBottom: '1px solid rgba(191,90,242,0.2)',
            background: 'rgba(191,90,242,0.1)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div style={{ color: '#BF5AF2', fontSize: 13, fontWeight: 700, letterSpacing: 1 }}>
              {"\uD83D\uDD0D"} SYSTEM AUDIT
            </div>
            <button
              onClick={onToggle}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#BF5AF2',
                cursor: 'pointer',
                fontSize: 16
              }}
            >
              {"\u2715"}
            </button>
          </div>

          {/* TTI & Performance Summary */}
          <div style={{
            padding: '12px 16px',
            background: 'rgba(191,90,242,0.05)',
            borderBottom: '1px solid rgba(191,90,242,0.1)',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 12,
            fontSize: 11
          }}>
            <div>
              <div style={{ color: '#A1A1A6', fontSize: 10, marginBottom: 4 }}>Time-to-Interactive</div>
              <div style={{ color: '#BF5AF2', fontSize: 14, fontWeight: 700 }}>
                {tti}ms
              </div>
            </div>
            <div>
              <div style={{ color: '#A1A1A6', fontSize: 10, marginBottom: 4 }}>Avg API Latency</div>
              <div style={{ color: tti < 3000 ? '#30D158' : '#FF453A', fontSize: 14, fontWeight: 700 }}>
                {avgLatency}ms
              </div>
            </div>
            <div>
              <div style={{ color: '#A1A1A6', fontSize: 10, marginBottom: 4 }}>Total Logs</div>
              <div style={{ color: '#FFD60A', fontSize: 14, fontWeight: 700 }}>
                {logs.length}
              </div>
            </div>
            <div>
              <div style={{ color: '#A1A1A6', fontSize: 10, marginBottom: 4 }}>Errors: {Object.keys(logsByType).map(key => logsByType[key].length).reduce((a, b) => a + b, 0) === logs.length ? logs.filter(l => l.type === 'error').length : 0}</div>
              <div style={{ color: logs.filter(l => l.type === 'error').length > 0 ? '#FF453A' : '#30D158', fontSize: 14, fontWeight: 700 }}>
                {logs.filter(l => l.type === 'error').length}
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div style={{
            display: 'flex',
            gap: 0,
            borderBottom: '1px solid rgba(191,90,242,0.1)',
            background: 'rgba(0,0,0,0.2)'
          }}>
            {['Console', 'Network', 'Components'].map(tab => (
              <button
                key={tab}
                onClick={() => setExpandedSection(expandedSection === tab ? null : tab)}
                style={{
                  flex: 1,
                  padding: '8px',
                  background: expandedSection === tab ? 'rgba(191,90,242,0.15)' : 'transparent',
                  border: 'none',
                  borderBottom: expandedSection === tab ? '2px solid #BF5AF2' : '1px solid rgba(191,90,242,0.1)',
                  color: expandedSection === tab ? '#BF5AF2' : '#A1A1A6',
                  fontSize: 10,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {tab} {tab === 'Console' && `(${logs.length})`}
              </button>
            ))}
          </div>

          {/* Content Area */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            fontSize: 11,
            fontFamily: 'Consolas, monospace'
          }}>
            {/* Console Logs */}
            {expandedSection === 'Console' && (
              <div style={{ padding: '8px' }}>
                {logs.length === 0 ? (
                  <div style={{ color: '#A1A1A6', padding: '8px' }}>No logs yet</div>
                ) : (
                  logs.slice(-15).map((log, i) => (
                    <div
                      key={i}
                      style={{
                        padding: '6px',
                        marginBottom: '4px',
                        background: log.type === 'error' ? 'rgba(255,69,58,0.1)' : 
                                    log.type === 'warn' ? 'rgba(255,214,10,0.1)' : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${
                          log.type === 'error' ? 'rgba(255,69,58,0.3)' :
                          log.type === 'warn' ? 'rgba(255,214,10,0.3)' : 'rgba(255,255,255,0.1)'
                        }`,
                        borderRadius: 4,
                        color: log.type === 'error' ? '#FF453A' : 
                               log.type === 'warn' ? '#FFD60A' : log.type === 'info' ? '#0A84FF' : '#D1D1D6',
                        wordBreak: 'break-word'
                      }}
                    >
                      <span style={{ opacity: 0.6, fontSize: 10 }}>[{log.timestamp}]</span>
                      <span style={{ marginLeft: 4 }}>{log.message}</span>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Network Latency */}
            {expandedSection === 'Network' && (
              <div style={{ padding: '8px' }}>
                <div style={{ color: '#BF5AF2', fontSize: 10, fontWeight: 700, marginBottom: 8 }}>
                  Slow Requests ({slowRequests.length}):
                </div>
                {slowRequests.length === 0 ? (
                  <div style={{ color: '#30D158' }}>{"\u2713"} All requests fast (&lt;2s)</div>
                ) : (
                  slowRequests.slice(-8).map((req, i) => (
                    <div
                      key={i}
                      style={{
                        padding: '6px',
                        background: 'rgba(255,69,58,0.1)',
                        border: '1px solid rgba(255,69,58,0.3)',
                        borderRadius: 4,
                        marginBottom: 4,
                        color: '#FF453A',
                        fontSize: 10
                      }}
                    >
                      {"\uD83D\uDC22"} {req.endpoint || 'API'}: <strong>{req.ms}ms</strong>
                    </div>
                  ))
                )}
                <div style={{ color: '#BF5AF2', fontSize: 10, fontWeight: 700, marginTop: 8, marginBottom: 8 }}>
                  All Requests ({latencies.length}):
                </div>
                {latencies.slice(-8).map((req, i) => (
                  <div
                    key={i}
                    style={{
                      padding: '4px 6px',
                      background: req.ms > 2000 ? 'rgba(255,69,58,0.05)' : 'rgba(48,209,88,0.05)',
                      color: req.ms > 2000 ? '#FF453A' : '#30D158',
                      fontSize: 9,
                      borderLeft: `2px solid ${req.ms > 2000 ? '#FF453A' : '#30D158'}`,
                      paddingLeft: 8
                    }}
                  >
                    {req.endpoint || 'request'}: {req.ms}ms
                  </div>
                ))}
              </div>
            )}

            {/* Components Status */}
            {expandedSection === 'Components' && (
              <div style={{ padding: '8px' }}>
                {Object.entries(componentStatus).length === 0 ? (
                  <div style={{ color: '#A1A1A6', padding: '8px' }}>Inspecting components... Hover over buttons to see status</div>
                ) : (
                  Object.entries(componentStatus).slice(-12).map(([key, comp], i) => (
                    <div
                      key={i}
                      onMouseEnter={() => setHoveredComponent(key)}
                      onMouseLeave={() => setHoveredComponent(null)}
                      style={{
                        padding: '6px',
                        background: hoveredComponent === key ? 'rgba(191,90,242,0.15)' : 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(191,90,242,0.2)',
                        borderRadius: 4,
                        marginBottom: 4,
                        color: '#D1D1D6',
                        fontSize: 9,
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      <div style={{ fontWeight: 600, color: '#BF5AF2' }}>{comp.name}</div>
                      <div style={{ fontSize: 8, color: '#A1A1A6', marginTop: 2 }}>{comp.element}</div>
                      <div style={{
                        marginTop: 4,
                        display: 'inline-block',
                        padding: '2px 6px',
                        background: comp.status === 'loading' ? 'rgba(255,214,10,0.2)' : 
                                    comp.status === 'error' ? 'rgba(255,69,58,0.2)' : 'rgba(48,209,88,0.2)',
                        color: comp.status === 'loading' ? '#FFD60A' : 
                               comp.status === 'error' ? '#FF453A' : '#30D158',
                        borderRadius: 3,
                        fontSize: 8,
                        fontWeight: 600
                      }}>
                        {"\u25CF"} {comp.status.toUpperCase()}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

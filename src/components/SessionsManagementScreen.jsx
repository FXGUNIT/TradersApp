import { useState, useEffect } from 'react';
import { T } from '../constants/theme.js';
import { authBtn } from '../utils/styleUtils.js';

// \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
//  SESSIONS MANAGEMENT SCREEN \u2014 Rules #5, #6
// \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
export function SessionsManagementScreen({ profile, auth, currentSessionId, onBack, showToast, dbR, logoutOtherDevices }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [logoutLoading, setLogoutLoading] = useState(false);

  useEffect(() => {
    const fetchSessions = async () => {
      if (!auth || !profile) return;
      
      try {
        const sessionsData = await dbR(`users/${auth.uid}/sessions`, auth.token);
        if (sessionsData) {
          const sessionsList = Object.entries(sessionsData).map(([sessionId, sessionData]) => ({
            sessionId,
            ...sessionData,
            isCurrentSession: sessionId === currentSessionId
          }));
          setSessions(sessionsList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
        }
      } catch (error) {
        console.error('Failed to fetch sessions:', error);
        showToast('Session data not responding. Running recovery sequence..', 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchSessions();
  }, [auth, currentSessionId, profile, showToast]);

  const handleLogoutOtherDevices = async () => {
    if (!auth || !currentSessionId) return;
    
    setLogoutLoading(true);
    try {
      const success = await logoutOtherDevices(auth.uid, currentSessionId, auth.token);
      if (success) {
        showToast('Session termination sequence complete. All terminals closed.', 'success');
        setSessions(sessions.filter(s => s.isCurrentSession));
      }
    } catch (error) {
      console.error('Logout other devices failed:', error);
      showToast('Logout signal fading across network. Persist and retry.', 'error');
    } finally {
      setLogoutLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: T.font, padding: 20 }}>
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <h1 style={{ margin: 0, color: T.gold, fontSize: 20, fontWeight: 700, letterSpacing: 2 }}>
            ACTIVE SESSIONS
          </h1>
          <button 
            onClick={onBack}
            style={{ background: 'transparent', border: 'none', color: T.blue, cursor: 'pointer', fontSize: 14 }}
          >
            {"\u2190"} Back to Dashboard
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', color: T.muted, padding: 40 }}>loading...</div>
        ) : sessions.length === 0 ? (
          <div style={{ background: 'rgba(0,0,0,0.3)', border: `1px solid rgba(255,255,255,0.1)`, borderRadius: 8, padding: 20, textAlign: 'center', color: T.muted }}>
            No active sessions
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 20, background: 'rgba(0,0,0,0.2)', border: `1px solid rgba(255,255,255,0.1)`, borderRadius: 8, overflow: 'hidden' }}>
              {sessions.map((session) => (
                <div key={session.sessionId} style={{ padding: 16, borderBottom: `1px solid rgba(255,255,255,0.05)`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ color: T.blue, fontWeight: 700, marginBottom: 4 }}>
                      {session.device}
                      {session.isCurrentSession && <span style={{ color: T.green, fontSize: 11, marginLeft: 8 }}>(Current Device)</span>}
                    </div>
                    <div style={{ fontSize: 12, color: T.muted }}>
                      {"\uD83D\uDCCD"} {session.city}, {session.country}
                    </div>
                    <div style={{ fontSize: 11, color: T.dim, marginTop: 4 }}>
                      Last Active: {new Date(session.lastActive).toLocaleDateString()} {new Date(session.lastActive).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {sessions.filter(s => !s.isCurrentSession).length > 0 && (
              <button 
                onClick={handleLogoutOtherDevices}
                disabled={logoutLoading}
                style={{
                  ...authBtn(T.red, logoutLoading),
                  width: '100%'
                }} 
                className="btn-glass"
              >
                {logoutLoading ? 'LOGGING OUT...' : `${"\uD83D\uDD12"} LOGOUT ALL OTHER DEVICES`}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

import React from 'react';
import { ref, get } from 'firebase/database';
import { T } from '../../constants/theme.js';
import { LED, UserSwitcher, SystemThemeSync, FullScreenToggle } from '../../components/SharedUI.jsx';
import { getTimeBasedGreeting } from '../../utils/istUtils.js';

export function AdminHeaderBar({
  filterStatus, setFilterStatus,
  groupByStatus, setGroupByStatus,
  showAdvancedFilter, setShowAdvancedFilter,
  megaMenuOpen, setMegaMenuOpen,
  notificationCenterOpen, setNotificationCenterOpen,
  isDarkMode, setIsDarkMode,
  ghostMode,
  maintenanceModeActive, handleToggleMaintenanceMode,
  currentViewAsUser, setCurrentViewAsUser,
  notifications,
  statusCounts,
  activeSection,
  ADMIN_EMAIL,
  users,
  firebaseDb,
  setLoading, setDbError, setUsers,
  onLogout, showToast
}) {
  return (
    <>
      {/* Admin Dashboard Header */}
      <div style={{ background: "#FFFFFF", borderBottom: `1px solid #E5E7EB`, padding: "16px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16, boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)" }} className="glass-panel">
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <LED color={T.purple} size={12} pulse />
          <div>
            <div style={{ color: T.purple, fontSize: 15, letterSpacing: 3, fontWeight: 800 }}>
              {getTimeBasedGreeting('Admin').fullGreeting} ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â GOD MODE
            </div>
            <div style={{ color: T.muted, fontSize: 11, letterSpacing: 2, marginTop: 4, fontWeight: 600 }}>
              MASTER ADMIN DASHBOARD ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· {ADMIN_EMAIL}
            </div>
          </div>
        </div>
        
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", zIndex: 50 }}>
          {['ALL', 'ACTIVE', 'PENDING', 'BLOCKED'].map(status => (
            <button 
              key={status}
              onClick={() => setFilterStatus(status)}
              style={{ 
                background: filterStatus === status ? `rgba(${status === 'ACTIVE' ? '48,209,88' : status === 'PENDING' ? '255,214,10' : status === 'BLOCKED' ? '255,69,58' : '0,122,255'},0.2)` : "transparent",
                border: `1px solid ${filterStatus === status ? (status === 'ACTIVE' ? 'rgba(48,209,88,0.6)' : status === 'PENDING' ? 'rgba(255,214,10,0.6)' : status === 'BLOCKED' ? 'rgba(255,69,58,0.6)' : 'rgba(0,122,255,0.6)') : 'rgba(255,255,255,0.2)'}`,
                borderRadius: 6, 
                padding: "8px 16px", 
                cursor: "pointer", 
                color: filterStatus === status ? (status === 'ACTIVE' ? T.green : status === 'PENDING' ? T.gold : status === 'BLOCKED' ? T.red : T.blue) : T.muted,
                fontFamily: T.font, 
                fontSize: 11, 
                letterSpacing: 1, 
                fontWeight: 700,
                transition: "all 0.2s ease-in-out"
              }}
              onMouseEnter={e => {
                if (filterStatus !== status) {
                  e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                  e.currentTarget.style.transform = "translateY(-2px)";
                }
              }}
              onMouseLeave={e => {
                if (filterStatus !== status) {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.transform = "translateY(0)";
                }
              }}
              className="btn-glass"
            >
              {status === 'ALL' ? `${status} (${statusCounts.ALL})` : status === 'ACTIVE' ? `${status} (${statusCounts.ACTIVE})` : status === 'PENDING' ? `${status} (${statusCounts.PENDING})` : `BANNED (${statusCounts.BLOCKED})`}
            </button>
          ))}
          
          {/* RULE #56: Group By Status Toggle */}
          <button
            onClick={() => setGroupByStatus(!groupByStatus)}
            style={{
              background: groupByStatus ? "rgba(0,122,255,0.2)" : "transparent",
              border: `1px solid ${groupByStatus ? "rgba(0,122,255,0.5)" : "rgba(255,255,255,0.2)"}`,
              borderRadius: 6,
              padding: "8px 16px",
              cursor: "pointer",
              color: groupByStatus ? T.blue : T.muted,
              fontFamily: T.font,
              fontSize: 11,
              letterSpacing: 1,
              fontWeight: 700,
              transition: "all 0.2s ease-in-out"
            }}
            onMouseEnter={e => {
              if (!groupByStatus) {
                e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                e.currentTarget.style.transform = "translateY(-2px)";
              }
            }}
            onMouseLeave={e => {
              if (!groupByStatus) {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.transform = "translateY(0)";
              }
            }}
            className="btn-glass"
            title="Group users by their status"
          >
            {groupByStatus ? 'ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã‚Â Ãƒâ€¦Ã‚Â¸ Grouped' : 'ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã‚Â Ãƒâ€¦Ã‚Â¾ Group By'}
          </button>
          
          {/* RULE #58: Advanced Filter Toggle */}
          <button
            onClick={() => setShowAdvancedFilter(!showAdvancedFilter)}
            style={{
              background: showAdvancedFilter ? "rgba(0,122,255,0.2)" : "transparent",
              border: `1px solid ${showAdvancedFilter ? "rgba(0,122,255,0.5)" : "rgba(255,255,255,0.2)"}`,
              borderRadius: 6,
              padding: "8px 16px",
              cursor: "pointer",
              color: showAdvancedFilter ? T.blue : T.muted,
              fontFamily: T.font,
              fontSize: 11,
              letterSpacing: 1,
              fontWeight: 700,
              transition: "all 0.2s ease-in-out"
            }}
            onMouseEnter={e => {
              if (!showAdvancedFilter) {
                e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                e.currentTarget.style.transform = "translateY(-2px)";
              }
            }}
            onMouseLeave={e => {
              if (!showAdvancedFilter) {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.transform = "translateY(0)";
              }
            }}
            className="btn-glass"
            title="Show advanced filtering options"
          >
            {showAdvancedFilter ? 'ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã‚Â Ãƒâ€¦Ã‚Â¸ Filters' : 'ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã‚Â¡ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ Filters'}
          </button>
          
          <button 
            onClick={async () => {
              // Optional: Manual refresh for users who prefer it, though real-time listener handles updates
              setLoading(true);
              setDbError('');
              try {
                const usersRef = ref(firebaseDb, 'users');
                const snapshot = await get(usersRef);
                if (snapshot.exists()) {
                  setUsers(snapshot.val());
                } else {
                  setUsers({});
                }
              } catch (error) {
                console.error('Failed to refresh users:', error);
                setDbError(`Network Error: ${error.message}`);
              } finally {
                setLoading(false);
              }
            }}
            style={{ background: "transparent", border: `1px solid rgba(255,255,255,0.1)`, borderRadius: 6, padding: "8px 16px", cursor: "pointer", color: T.muted, fontFamily: T.font, fontSize: 11, letterSpacing: 1, fontWeight: 600, transition: "all 0.2s ease-in-out" }} 
            onMouseEnter={e => {
              e.currentTarget.style.background = "rgba(255,255,255,0.05)";
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.3)";
              e.currentTarget.style.transform = "translateY(-2px)";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
              e.currentTarget.style.transform = "translateY(0)";
            }}
            className="btn-glass">
            ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â Ãƒâ€šÃ‚Âº REFRESH
          </button>
          
          {/* RULE #109 & #111: User Switcher - Shadow Mode */}
          <UserSwitcher 
            users={Array.isArray(users) ? users : Object.values(users || {})} 
            currentViewAsUser={currentViewAsUser} 
            onSwitchUser={setCurrentViewAsUser}
            ghostMode={ghostMode}
          />
          
          {/* RULE #94: Mega Menu Tools Button */}
          <button 
            onClick={() => setMegaMenuOpen(!megaMenuOpen)}
            style={{ background: megaMenuOpen ? "rgba(0,122,255,0.2)" : "transparent", border: `1px solid ${megaMenuOpen ? "rgba(0,122,255,0.5)" : "rgba(255,255,255,0.2)"}`, borderRadius: 6, padding: "8px 16px", cursor: "pointer", color: megaMenuOpen ? T.blue : T.muted, fontFamily: T.font, fontSize: 11, letterSpacing: 1, fontWeight: 600, transition: "all 0.2s ease-in-out" }}
            onMouseEnter={e => {
              if (!megaMenuOpen) {
                e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.3)";
                e.currentTarget.style.transform = "translateY(-2px)";
              }
            }}
            onMouseLeave={e => {
              if (!megaMenuOpen) {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
                e.currentTarget.style.transform = "translateY(0)";
              }
            }}
            className="btn-glass"
            title="Open Tools Menu"
          >
            ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂºÃƒâ€šÃ‚Â ÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚Â TOOLS
          </button>
          
          {/* RULE #119: Notification Center Button */}
          <button 
            onClick={() => setNotificationCenterOpen(!notificationCenterOpen)}
            style={{ 
              background: notificationCenterOpen ? "rgba(0,122,255,0.2)" : "transparent", 
              border: `1px solid ${notificationCenterOpen ? "rgba(0,122,255,0.5)" : "rgba(255,255,255,0.2)"}`, 
              borderRadius: 6, 
              padding: "8px 12px", 
              cursor: "pointer", 
              color: notificationCenterOpen ? T.blue : T.muted, 
              fontFamily: T.font, 
              fontSize: 11, 
              letterSpacing: 1, 
              fontWeight: 700,
              transition: "all 0.2s ease-in-out",
              position: 'relative'
            }}
            onMouseEnter={e => {
              if (!notificationCenterOpen) {
                e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.3)";
                e.currentTarget.style.transform = "translateY(-2px)";
              }
            }}
            onMouseLeave={e => {
              if (!notificationCenterOpen) {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)";
                e.currentTarget.style.transform = "translateY(0)";
              }
            }}
            className="btn-glass"
            title="Open Notification Center"
          >
            ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â€šÂ¬Ã‚Â {notifications.length > 0 && <span style={{ 
              position: 'absolute',
              top: '0px',
              right: '2px',
              background: T.red,
              color: T.text,
              borderRadius: '50%',
              width: '16px',
              height: '16px',
              fontSize: '9px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700
            }}>{notifications.length}</span>}
          </button>
          
          {/* RULE #121: System Theme Sync - Toggle dark/light mode */}
          <SystemThemeSync 
            isDarkMode={isDarkMode}
            onThemeChange={(newDarkMode) => {
              setIsDarkMode(newDarkMode);
              showToast(`${newDarkMode ? 'ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€¦Ã¢â‚¬â„¢ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ Dark' : 'ÃƒÆ’Ã‚Â¢Ãƒâ€¹Ã…â€œÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚Â Light'} Mode Enabled`, 'info');
            }}
          />
          
          {/* RULE #101: Full-Screen Toggle */}
          <FullScreenToggle showToast={showToast} />
          
          {/* RULE #295, #296: Maintenance Mode Toggle */}
          <button
            onClick={handleToggleMaintenanceMode}
            title={maintenanceModeActive ? 'Disable Maintenance Mode' : 'Enable Maintenance Mode'}
            style={{
              background: maintenanceModeActive ? 'rgba(255,165,0,0.2)' : 'transparent',
              border: `1px solid ${maintenanceModeActive ? 'rgba(255,165,0,0.6)' : 'rgba(255,255,255,0.2)'}`,
              borderRadius: 6,
              padding: '8px 16px',
              cursor: 'pointer',
              color: maintenanceModeActive ? '#FFB340' : T.muted,
              fontFamily: T.font,
              fontSize: 11,
              letterSpacing: 1,
              fontWeight: 700,
              transition: 'all 0.2s ease-in-out',
              animation: maintenanceModeActive ? 'pulse 1.5s ease-in-out infinite' : 'none'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(255,165,0,0.3)';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = maintenanceModeActive ? 'rgba(255,165,0,0.2)' : 'transparent';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
            className="btn-glass"
          >
            {maintenanceModeActive ? 'ÃƒÆ’Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒâ€šÃ‚Â±ÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚Â MAINTENANCE ON' : 'ÃƒÆ’Ã‚Â¢Ãƒâ€šÃ‚ÂÃƒâ€šÃ‚Â±ÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚Â MAINTENANCE OFF'}
          </button>
          
          <button 
            onClick={onLogout} 
            style={{ background: "rgba(255,69,58,0.1)", border: `1px solid rgba(255,69,58,0.3)`, borderRadius: 6, padding: "8px 16px", cursor: "pointer", color: T.red, fontFamily: T.font, fontSize: 11, letterSpacing: 1, fontWeight: 600, transition: "all 0.2s ease-in-out" }}
            onMouseEnter={e => {
              e.currentTarget.style.background = "rgba(255,69,58,0.2)";
              e.currentTarget.style.borderColor = "rgba(255,69,58,0.6)";
              e.currentTarget.style.transform = "translateY(-2px)";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = "rgba(255,69,58,0.1)";
              e.currentTarget.style.borderColor = "rgba(255,69,58,0.3)";
              e.currentTarget.style.transform = "translateY(0)";
            }}
            className="btn-glass">
            LOGOUT
          </button>
        </div>
      </div>
      
      {/* RULE #310: Scroll-Spy Navigation Menu */}
      <div style={{ padding: "8px 20px", borderBottom: `1px solid rgba(255,255,255,0.1)`, background: "rgba(0,0,0,0.3)", display: "flex", gap: 8, overflowX: "auto" }} className="glass-panel">
        <div
          className={`menu-item ${activeSection === 'users' ? 'active' : ''}`}
          onClick={() => document.getElementById('admin-users')?.scrollIntoView({ behavior: 'smooth' })}
          style={{
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            ...(activeSection === 'users' ? {
              color: T.blue,
              background: "rgba(10,132,255,0.15)",
              borderLeft: `3px solid ${T.blue}`,
              paddingLeft: '9px'
            } : {
              color: T.muted
            })
          }}
        >
          ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‹Å“Ãƒâ€šÃ‚Â¥ Users
        </div>
      </div>
    </>
  );
}

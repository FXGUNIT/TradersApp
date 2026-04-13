/* eslint-disable */
/* Auto-extracted from AdminDashboardScreen.jsx — header + nav */
import React from "react";
import { Home, Bell } from "lucide-react";
import NotificationCenter from "../../components/NotificationCenter.jsx";
import CommandPalette from "../../components/CommandPalette.jsx";
import UserSwitcher from "../../components/UserSwitcher.jsx";
import FullScreenToggle from "../../components/FullScreenToggle.jsx";
import MobileBottomNav from "../../components/MobileBottomNav.jsx";
import LoadingOverlay from "../../components/LoadingOverlay.jsx";
import { getTimeBasedGreeting } from "../../utils/userUtils.js";

export default function AdminDashboardHeader({
  T, LED, ADMIN_EMAIL,
  filterStatus, setFilterStatus, statusCounts,
  groupByStatus, setGroupByStatus,
  showAdvancedFilter, setShowAdvancedFilter,
  maintenanceModeActive, handleToggleMaintenanceMode,
  onLogout, loading,
  notificationCenterOpen, setNotificationCenterOpen, notifications,
  chatModalOpen, setChatModalOpen, chatWith, setChatWith,
  auth, SupportChatModal,
  currentViewAsUser, setCurrentViewAsUser,
  megaMenuOpen, setMegaMenuOpen,
  commandPaletteOpen, setCommandPaletteOpen,
  users, showToast, setLoading, setDbError, listAdminUsers,
}) {
  return (
    <>
      <LoadingOverlay isLoading={loading} />
      <NotificationCenter isOpen={notificationCenterOpen} onClose={() => setNotificationCenterOpen(false)} notifications={notifications} />
      <MobileBottomNav currentPage="users" onNavigate={() => {}} />
      <CommandPalette
        isOpen={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)}
        users={Array.isArray(users) ? users : Object.values(users || {})}
        onJumpToUser={(uid) => { setCurrentViewAsUser(uid); setCommandPaletteOpen(false); showToast(`Switched to user: ${uid}`, "info"); }}
        showToast={showToast}
      />
      {megaMenuOpen && (
        <div style={{ position: "fixed", top: 60, right: 20, background: "rgba(20,20,20,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: 16, zIndex: 200, minWidth: 200 }}>
          <div style={{ color: T.muted, fontSize: 11 }}>Tools Menu</div>
        </div>
      )}
      <SupportChatModal isOpen={chatModalOpen} userId={chatWith} userName="User" onClose={() => { setChatModalOpen(false); setChatWith(null); }} auth={auth} showToast={showToast} />
      <div style={{ padding: "8px 20px", borderBottom: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.3)", display: "flex", gap: 8, overflowX: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Home size={12} style={{ color: T.muted }} /><span style={{ color: T.muted, fontSize: 11 }}>Admin</span></div>
        <span style={{ color: T.dim, fontSize: 11 }}>/</span>
        <div style={{ color: T.blue, fontSize: 11, fontWeight: 700 }}>Users</div>
      </div>
      <div style={{ background: "var(--surface-elevated, #FFFFFF)", borderBottom: "1px solid #E5E7EB", padding: "16px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16, boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <LED color={T.purple} size={12} pulse />
          <div>
            <div style={{ color: T.purple, fontSize: 15, letterSpacing: 3, fontWeight: 800 }}>{getTimeBasedGreeting("Admin").fullGreeting} — GOD MODE</div>
            <div style={{ color: T.muted, fontSize: 11, letterSpacing: 2, marginTop: 4, fontWeight: 600 }}>MASTER ADMIN DASHBOARD · {ADMIN_EMAIL}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", zIndex: 50 }}>
          {["ALL", "ACTIVE", "PENDING", "BLOCKED"].map((status) => (
            <button key={status} onClick={() => setFilterStatus(status)}
              style={{ background: filterStatus === status ? `rgba(${status === "ACTIVE" ? "48,209,88" : status === "PENDING" ? "255,214,10" : status === "BLOCKED" ? "255,69,58" : "0,122,255"},0.2)` : "transparent", border: `1px solid ${filterStatus === status ? (status === "ACTIVE" ? "rgba(48,209,88,0.6)" : status === "PENDING" ? "rgba(255,214,10,0.6)" : status === "BLOCKED" ? "rgba(255,69,58,0.6)" : "rgba(0,122,255,0.6)") : "rgba(255,255,255,0.2)"}`, borderRadius: 6, padding: "8px 16px", cursor: "pointer", color: filterStatus === status ? (status === "ACTIVE" ? T.green : status === "PENDING" ? T.gold : status === "BLOCKED" ? T.red : T.blue) : T.muted, fontFamily: T.font, fontSize: 11, letterSpacing: 1, fontWeight: 700, transition: "all 0.2s ease-in-out" }}>
              {status === "ALL" ? `${status} (${statusCounts.ALL})` : status === "ACTIVE" ? `${status} (${statusCounts.ACTIVE})` : status === "PENDING" ? `${status} (${statusCounts.PENDING})` : `BANNED (${statusCounts.BLOCKED})`}
            </button>
          ))}
          <button onClick={() => setGroupByStatus(!groupByStatus)} style={{ background: groupByStatus ? "rgba(0,122,255,0.2)" : "transparent", border: `1px solid ${groupByStatus ? "rgba(0,122,255,0.5)" : "rgba(255,255,255,0.2)"}`, borderRadius: 6, padding: "8px 16px", cursor: "pointer", color: groupByStatus ? T.blue : T.muted, fontFamily: T.font, fontSize: 11, letterSpacing: 1, fontWeight: 700 }}>
            {groupByStatus ? "Grouped" : "Group By"}
          </button>
          <button onClick={() => setShowAdvancedFilter(!showAdvancedFilter)} style={{ background: showAdvancedFilter ? "rgba(0,122,255,0.2)" : "transparent", border: `1px solid ${showAdvancedFilter ? "rgba(0,122,255,0.5)" : "rgba(255,255,255,0.2)"}`, borderRadius: 6, padding: "8px 16px", cursor: "pointer", color: showAdvancedFilter ? T.blue : T.muted, fontFamily: T.font, fontSize: 11, letterSpacing: 1, fontWeight: 700 }}>
            {showAdvancedFilter ? "Hide Filters" : "Filters"}
          </button>
          <button onClick={async () => { if (!users) return; setLoading(true); setDbError(""); try { const response = await (typeof listAdminUsers !== "undefined" ? listAdminUsers : null)(); if (response?.success === false) throw new Error(response.error); } catch (e) { setDbError(e.message); } finally { setLoading(false); } }}
            style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "8px 16px", cursor: "pointer", color: T.muted, fontFamily: T.font, fontSize: 11, letterSpacing: 1, fontWeight: 600 }}>
            ↺ REFRESH
          </button>
          <UserSwitcher users={Array.isArray(users) ? users : Object.values(users || {})} currentViewAsUser={currentViewAsUser} onSwitchUser={setCurrentViewAsUser} />
          <button onClick={() => setMegaMenuOpen(!megaMenuOpen)} style={{ background: megaMenuOpen ? "rgba(0,122,255,0.2)" : "transparent", border: `1px solid ${megaMenuOpen ? "rgba(0,122,255,0.5)" : "rgba(255,255,255,0.2)"}`, borderRadius: 6, padding: "8px 16px", cursor: "pointer", color: megaMenuOpen ? T.blue : T.muted, fontFamily: T.font, fontSize: 11, letterSpacing: 1, fontWeight: 600 }}>
            TOOLS
          </button>
          <button onClick={() => setNotificationCenterOpen(!notificationCenterOpen)} style={{ background: notificationCenterOpen ? "rgba(0,122,255,0.2)" : "transparent", border: `1px solid ${notificationCenterOpen ? "rgba(0,122,255,0.5)" : "rgba(255,255,255,0.2)"}`, borderRadius: 6, padding: "8px 12px", cursor: "pointer", color: notificationCenterOpen ? T.blue : T.muted, fontFamily: T.font, fontSize: 11, letterSpacing: 1, fontWeight: 700, position: "relative" }}>
            <Bell size={14} />{notifications.length > 0 && <span style={{ position: "absolute", top: "0px", right: "2px", background: T.red, color: T.text, borderRadius: "50%", width: "16px", height: "16px", fontSize: "9px", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>{notifications.length}</span>}
          </button>
          <FullScreenToggle showToast={showToast} />
          <button onClick={handleToggleMaintenanceMode} style={{ background: maintenanceModeActive ? "rgba(255,165,0,0.2)" : "transparent", border: `1px solid ${maintenanceModeActive ? "rgba(255,165,0,0.6)" : "rgba(255,255,255,0.2)"}`, borderRadius: 6, padding: "8px 16px", cursor: "pointer", color: maintenanceModeActive ? "#FFB340" : T.muted, fontFamily: T.font, fontSize: 11, letterSpacing: 1, fontWeight: 700, animation: maintenanceModeActive ? "pulse 1.5s ease-in-out infinite" : "none" }}>
            {maintenanceModeActive ? "MAINTENANCE ON" : "MAINTENANCE OFF"}
          </button>
          <button onClick={onLogout} style={{ background: "rgba(255,69,58,0.1)", border: "1px solid rgba(255,69,58,0.3)", borderRadius: 6, padding: "8px 16px", cursor: "pointer", color: T.red, fontFamily: T.font, fontSize: 11, letterSpacing: 1, fontWeight: 600 }}>LOGOUT</button>
        </div>
      </div>
      <div style={{ padding: "8px 20px", borderBottom: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.3)", display: "flex", gap: 8, overflowX: "auto" }}>
        <div onClick={() => document.getElementById("admin-users")?.scrollIntoView({ behavior: "smooth" })} style={{ cursor: "pointer", whiteSpace: "nowrap", color: T.blue, background: "rgba(10,132,255,0.15)", borderLeft: `3px solid ${T.blue}`, paddingLeft: "9px" }}>Users</div>
      </div>
    </>
  );
}

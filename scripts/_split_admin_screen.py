#!/usr/bin/env python3
"""Split AdminDashboardScreen.jsx into sub-components."""
import os, re

BASE = 'e:/TradersApp/src/features/admin-security/'
MAIN = BASE + 'AdminDashboardScreen.jsx'

with open(MAIN, 'r', encoding='utf-8') as f:
    lines = f.readlines()

def extract(start, end):
    return ''.join(lines[start-1:end])

header_jsx = extract(592, 1081)
table_jsx = extract(1084, 2580)
mirror_jsx = extract(2580, 2997)
docs_jsx = extract(2997, 3133)

# ── 1. AdminDashboardHeader.jsx ────────────────────────────────────────────────
header_code = r"""/* eslint-disable */
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
  users, showToast, setLoading, setDbError,
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
"""

with open(BASE + 'AdminDashboardHeader.jsx', 'w', encoding='utf-8') as f:
    f.write(header_code)
print(f"AdminDashboardHeader.jsx: {len(header_code.splitlines())} lines")

# ── 2. AdminDashboardTable.jsx ────────────────────────────────────────────────
table_code = r"""/* eslint-disable */
/* Auto-extracted from AdminDashboardScreen.jsx — data table section */
import React, { useMemo } from "react";
import { Search, X, DollarSign } from "lucide-react";
import { copyToClipboard, fuzzySearchScore, renderHighlightedText } from "../../utils/searchUtils.jsx";
import { detectDuplicateIPs as scanDuplicateIPs } from "../../services/ipScanner.js";
import { getUserLevelBadge } from "../../utils/userUtils.js";

export default function AdminDashboardTable({
  T, LED, SHead, cardS, AMD_PHASES,
  users, loading, dbError,
  mirror, statusColor, normalizeStatus,
  visibleColumns, setVisibleColumns,
  rowDensity, setRowDensity,
  rowsPerPage, setRowsPerPage,
  currentPage, setCurrentPage,
  totalResults, totalPages, validPage,
  startIdx, endIdx,
  paginatedUsers, searchFilteredUsers,
  searchQuery, setSearchQuery,
  balanceFilter, setBalanceFilter,
  showAdvancedFilter,
  TableSkeletonLoader, EmptyStateCard,
  duplicateIPs,
  searchDebouncedQuery,
  sortedUserList,
  approve, block, openMirror,
  setSelectedUserDocs, setChatWith, setChatModalOpen,
  listAdminUsers, setLoading, setDbError, setUsers,
  showToast,
}) {
  const getGridTemplateColumns = () => {
    const cols = [];
    if (visibleColumns.name) cols.push("2fr");
    if (visibleColumns.email) cols.push("2fr");
    if (visibleColumns.joinDate) cols.push("1.5fr");
    if (visibleColumns.uid) cols.push("1.5fr");
    if (visibleColumns.role) cols.push("1.2fr");
    if (visibleColumns.status) cols.push("1.2fr");
    cols.push("1fr");
    return cols.join(" ");
  };
  const getRowPadding = () => rowDensity === "compact" ? "8px 20px" : "14px 20px";
  const isMobileView = typeof window !== "undefined" && window.innerWidth < 768;

  return (
    <div id="admin-users" style={{ width: mirror ? 440 : "100%", flex: mirror ? undefined : 1, borderRight: "1px solid rgba(255,255,255,0.1)", overflowY: "auto", overflowX: "hidden", background: "rgba(0,0,0,0.2)", display: "flex", flexDirection: "column" }}>
      {/* Search Bar */}
      <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.1)", background: "rgba(20,20,20,0.8)", display: "flex", alignItems: "center", gap: 8, position: "sticky", top: 0, zIndex: 6, flexShrink: 0 }}>
        <span style={{ color: T.cyan, fontSize: 14, fontWeight: 600 }}><Search size={14} /></span>
        <input type="text" placeholder="Search by Name or Email" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
          style={{ flex: 1, background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6, padding: "10px 14px", color: T.text, fontSize: 13, fontFamily: T.font, letterSpacing: 0.5, outline: "none" }}
        />
        {searchQuery && <button onClick={() => setSearchQuery("")} style={{ background: "transparent", border: "none", color: T.muted, cursor: "pointer", fontSize: 16, padding: 4 }}><X size={14} /></button>}
      </div>

      {/* Advanced Filter Panel */}
      {showAdvancedFilter && (
        <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(0,122,255,0.2)", background: "rgba(0,122,255,0.08)", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <span style={{ color: T.blue, fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}><DollarSign size={14} /> Balance Range:</span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: T.muted, fontSize: 10, fontWeight: 600 }}>Min:</span>
            <input type="number" placeholder="0" value={balanceFilter.min === 0 ? "" : balanceFilter.min} onChange={(e) => setBalanceFilter((p) => ({ ...p, min: Math.max(0, e.target.value === "" ? 0 : parseFloat(e.target.value)) }))}
              style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(0,122,255,0.3)", borderRadius: 4, padding: "6px 10px", color: T.text, fontFamily: T.font, fontSize: 10, fontWeight: 600, width: "70px", outline: "none" }}
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: T.muted, fontSize: 10, fontWeight: 600 }}>Max:</span>
            <input type="number" placeholder="∞" value={balanceFilter.max === Infinity ? "" : balanceFilter.max} onChange={(e) => setBalanceFilter((p) => ({ ...p, max: e.target.value === "" ? Infinity : parseFloat(e.target.value) }))}
              style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(0,122,255,0.3)", borderRadius: 4, padding: "6px 10px", color: T.text, fontFamily: T.font, fontSize: 10, fontWeight: 600, width: "70px", outline: "none" }}
            />
          </div>
          <button onClick={() => setBalanceFilter({ min: 0, max: Infinity })} style={{ background: "transparent", border: "1px solid rgba(0,122,255,0.3)", borderRadius: 4, padding: "6px 12px", cursor: "pointer", color: T.blue, fontFamily: T.font, fontSize: 10, fontWeight: 600 }}>Reset</button>
        </div>
      )}

      {/* Grid Control Bar */}
      <div style={{ padding: "12px 20px", borderBottom: "1px solid rgba(255,255,255,0.1)", background: "rgba(15,15,15,0.8)", display: "flex", alignItems: "center", gap: 16, justifyContent: "space-between", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ color: T.muted, fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Density:</span>
          {["compact", "comfortable"].map((d) => (
            <button key={d} onClick={() => setRowDensity(d)}
              style={{ background: rowDensity === d ? "rgba(0,122,255,0.2)" : "transparent", border: `1px solid ${rowDensity === d ? "rgba(0,122,255,0.5)" : "rgba(255,255,255,0.15)"}`, borderRadius: 4, padding: "6px 12px", cursor: "pointer", color: rowDensity === d ? T.blue : T.muted, fontFamily: T.font, fontSize: 10, fontWeight: 600 }}>
              {d === "compact" ? "⊡ Compact" : "⊞ Comfortable"}
            </button>
          ))}
          <span style={{ color: T.muted, fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Rows:</span>
          <select value={rowsPerPage} onChange={(e) => { setRowsPerPage(parseInt(e.target.value)); setCurrentPage(1); }}
            style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 4, padding: "6px 10px", color: T.text, fontFamily: T.font, fontSize: 10, fontWeight: 600, cursor: "pointer", outline: "none" }}>
            <option value={10}>10</option><option value={50}>50</option><option value={100}>100</option>
          </select>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ color: T.muted, fontSize: 10, fontWeight: 600, whiteSpace: "nowrap" }}>{totalResults > 0 ? `${startIdx + 1}–${Math.min(endIdx, totalResults)} of ${totalResults}` : "0 results"}</span>
          <button onClick={() => setCurrentPage(Math.max(1, validPage - 1))} disabled={validPage === 1} style={{ background: validPage === 1 ? "rgba(255,255,255,0.08)" : "rgba(59,130,246,0.25)", border: `1px solid ${validPage === 1 ? "rgba(255,255,255,0.15)" : "rgba(59,130,246,0.5)"}`, borderRadius: 6, padding: "8px 14px", cursor: validPage === 1 ? "not-allowed" : "pointer", color: validPage === 1 ? "rgba(255,255,255,0.3)" : "#60A5FA", fontFamily: T.font, fontSize: 18, fontWeight: 700, minWidth: "44px", display: "flex", alignItems: "center", justifyContent: "center" }}>←</button>
          <span style={{ color: T.muted, fontSize: 10, fontWeight: 600, minWidth: "40px", textAlign: "center" }}>{totalPages > 0 ? `${validPage}/${totalPages}` : "0/0"}</span>
          <button onClick={() => setCurrentPage(Math.min(totalPages, validPage + 1))} disabled={validPage === totalPages} style={{ background: validPage === totalPages ? "rgba(255,255,255,0.08)" : "rgba(59,130,246,0.25)", border: `1px solid ${validPage === totalPages ? "rgba(255,255,255,0.15)" : "rgba(59,130,246,0.5)"}`, borderRadius: 6, padding: "8px 14px", cursor: validPage === totalPages ? "not-allowed" : "pointer", color: validPage === totalPages ? "rgba(255,255,255,0.3)" : "#60A5FA", fontFamily: T.font, fontSize: 18, fontWeight: 700, minWidth: "44px", display: "flex", alignItems: "center", justifyContent: "center" }}>→</button>
          <div style={{ position: "relative" }}>
            <button style={{ background: "rgba(0,122,255,0.15)", border: "1px solid rgba(0,122,255,0.3)", borderRadius: 4, padding: "6px 12px", cursor: "pointer", color: T.blue, fontFamily: T.font, fontSize: 10, fontWeight: 600 }}>⚙ Columns</button>
          </div>
        </div>
      </div>

      {/* Table Header */}
      {!loading && !dbError && paginatedUsers.length > 0 && !isMobileView && (
        <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.15)", background: "rgba(20,20,20,0.8)", display: "grid", gridTemplateColumns: getGridTemplateColumns(), gap: 16, position: "sticky", top: 0, zIndex: 5 }}>
          {visibleColumns.name && <div style={{ color: T.muted, fontSize: 10, letterSpacing: 1.5, fontWeight: 700, textTransform: "uppercase" }}>Name</div>}
          {visibleColumns.email && <div style={{ color: T.muted, fontSize: 10, letterSpacing: 1.5, fontWeight: 700, textTransform: "uppercase" }}>Email</div>}
          {visibleColumns.joinDate && <div style={{ color: T.muted, fontSize: 10, letterSpacing: 1.5, fontWeight: 700, textTransform: "uppercase" }}>Joined</div>}
          {visibleColumns.uid && <div style={{ color: T.muted, fontSize: 10, letterSpacing: 1.5, fontWeight: 700, textTransform: "uppercase" }}>UID</div>}
          {visibleColumns.role && <div style={{ color: T.muted, fontSize: 10, letterSpacing: 1.5, fontWeight: 700, textTransform: "uppercase" }}>Role</div>}
          {visibleColumns.status && <div style={{ color: T.muted, fontSize: 10, letterSpacing: 1.5, fontWeight: 700, textTransform: "uppercase" }}>Status</div>}
          <div style={{ color: T.muted, fontSize: 10, letterSpacing: 1.5, fontWeight: 700, textTransform: "uppercase" }}>Actions</div>
        </div>
      )}

      {/* Table Body */}
      {loading ? <TableSkeletonLoader /> : dbError ? (
        <div style={{ padding: "60px 40px", textAlign: "center", color: T.red, fontSize: 13, fontWeight: 600 }}>
          <div style={{ marginBottom: 16, fontSize: 20 }}>⚠</div>
          <div style={{ marginBottom: 20, fontSize: 13, lineHeight: 1.6 }}>{dbError}</div>
          <button onClick={async () => { if (!listAdminUsers) return; setLoading(true); setDbError(""); try { const r = await listAdminUsers(); if (r?.success === false) throw new Error(r.error); setUsers(Array.isArray(r?.users) ? r.users.reduce((a,u) => { if(u?.uid) a[u.uid]=u; return a; }, {}) : r?.users || {}); } catch(e) { setDbError(e.message); } finally { setLoading(false); } }}
            style={{ marginTop: 16, background: "rgba(255,69,58,0.2)", border: "1px solid rgba(255,69,58,0.4)", borderRadius: 6, padding: "10px 20px", cursor: "pointer", color: T.red, fontSize: 12, fontFamily: T.font, letterSpacing: 1, fontWeight: 700 }}>↺ RETRY</button>
        </div>
      ) : totalResults === 0 ? (
        <>{!searchQuery && filterStatus === "ALL" && !showAdvancedFilter ? <EmptyStateCard /> : null}
          {(searchQuery || filterStatus !== "ALL" || showAdvancedFilter) && (
            <div style={{ textAlign: "center", paddingBottom: "40px" }}>
              <button onClick={() => { setSearchQuery(""); if (filterStatus !== "ALL") setFilterStatus("ALL"); setBalanceFilter({ min: 0, max: Infinity }); }}
                style={{ background: "rgba(0,122,255,0.2)", border: "1px solid rgba(0,122,255,0.4)", borderRadius: 6, padding: "10px 20px", cursor: "pointer", color: T.blue, fontSize: 11, fontFamily: T.font, letterSpacing: 1, fontWeight: 700 }}>← CLEAR ALL FILTERS</button>
            </div>
          )}</>
      ) : (
        paginatedUsers.map(([uid, user]) => {
          if (!user || !user.fullName || !user.status) return null;
          const joinDate = user.createdAt ? new Date(user.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" }) : "—";
          const normalizedStatus = normalizeStatus(user.status);
          const statusBg = normalizedStatus === "ACTIVE" ? "rgba(48,209,88,0.15)" : normalizedStatus === "PENDING" ? "rgba(255,214,10,0.15)" : "rgba(255,69,58,0.15)";
          const statusBorder = normalizedStatus === "ACTIVE" ? "rgba(48,209,88,0.5)" : normalizedStatus === "PENDING" ? "rgba(255,214,10,0.5)" : "rgba(255,69,58,0.5)";
          const statusColorVal = normalizedStatus === "ACTIVE" ? T.green : normalizedStatus === "PENDING" ? T.gold : T.red;
          return (
            <div key={uid}
              style={{ padding: isMobileView ? "16px 12px" : getRowPadding(), borderBottom: "1px solid rgba(255,255,255,0.1)", background: mirror === uid ? "rgba(191,90,242,0.12)" : "rgba(255,255,255,0.01)", display: isMobileView ? "flex" : "grid", flexDirection: isMobileView ? "column" : undefined, gridTemplateColumns: isMobileView ? undefined : getGridTemplateColumns(), gap: isMobileView ? 12 : 16, alignItems: isMobileView ? "stretch" : "center", cursor: "pointer", transition: "all 0.2s ease", backdropFilter: "blur(10px)", borderLeft: mirror === uid ? `3px solid ${T.purple}` : "3px solid transparent" }}
              onClick={() => openMirror(uid)}
            >
              {/* Mobile: header */}
              {isMobileView && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, paddingBottom: 8, borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <div style={{ color: T.text, fontSize: 12, fontWeight: 600 }}>{searchQuery ? renderHighlightedText(user.fullName, searchQuery) : user.fullName}</div>
                      {(() => { const badge = getUserLevelBadge(user); return <div style={{ background: badge.bg, border: `1px solid ${badge.color}`, borderRadius: 12, padding: "2px 8px", color: badge.color, fontSize: 9, fontWeight: 700 }}>{badge.level}</div>; })()}
                    </div>
                    <div style={{ color: T.dim, fontSize: 10, marginTop: 2 }}>📊 {user.proficiency || "unknown"}</div>
                  </div>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: statusBg, border: `1px solid ${statusBorder}`, borderRadius: 16, padding: "4px 10px", width: "fit-content", boxShadow: `0 0 8px ${statusBorder}` }}>
                    <div style={{ width: 5, height: 5, borderRadius: "50%", background: statusColorVal }} />
                    <span style={{ color: statusColorVal, fontSize: 9, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" }}>{normalizedStatus === "PENDING" ? "pending" : normalizedStatus === "ACTIVE" ? "active" : "banned"}</span>
                  </div>
                </div>
              )}
              {/* Desktop: Name */}
              {!isMobileView && visibleColumns.name && (
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <div style={{ color: T.text, fontSize: 12, fontWeight: 600 }}>{searchQuery ? renderHighlightedText(user.fullName, searchQuery) : user.fullName}</div>
                    {(() => { const badge = getUserLevelBadge(user); return <div style={{ background: badge.bg, border: `1px solid ${badge.color}`, borderRadius: 12, padding: "2px 8px", color: badge.color, fontSize: 9, fontWeight: 700 }}>{badge.level}</div>; })()}
                  </div>
                  <div style={{ color: T.dim, fontSize: 10, marginTop: 2 }}>📊 {user.proficiency || "unknown"}</div>
                </div>
              )}
              {/* Mobile: info */}
              {isMobileView && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 10, color: T.muted }}>
                  {visibleColumns.email && <div style={{ fontFamily: T.mono, letterSpacing: 0.5 }}>📧 {user.email || "—"}</div>}
                  {visibleColumns.joinDate && <div style={{ fontFamily: T.mono, letterSpacing: 0.5 }}>📅 {joinDate}</div>}
                </div>
              )}
              {/* Desktop: Email */}
              {!isMobileView && visibleColumns.email && (
                <div style={{ color: T.muted, fontSize: 11, fontFamily: T.mono, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", letterSpacing: 0.5, cursor: "pointer", transition: "all 0.2s ease", padding: "4px 6px", borderRadius: 3 }}
                  onClick={(e) => { e.stopPropagation(); copyToClipboard(user.email, "Email", showToast); }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(0,122,255,0.15)"; e.currentTarget.style.color = T.blue; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = T.muted; }}
                  title="Click to copy email">
                  {searchQuery ? renderHighlightedText(user.email || "—", searchQuery) : user.email || "—"}
                </div>
              )}
              {/* Join Date */}
              {!isMobileView && visibleColumns.joinDate && <div style={{ color: T.muted, fontSize: 11, fontFamily: T.mono, letterSpacing: 0.5 }}>{joinDate}</div>}
              {/* UID */}
              {!isMobileView && visibleColumns.uid && (
                <div style={{ color: T.dim, fontSize: 10, fontFamily: T.mono, letterSpacing: 0.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "pointer", padding: "4px 6px", borderRadius: 3 }}
                  title={`Click to copy UID: ${uid}`} onClick={(e) => { e.stopPropagation(); copyToClipboard(uid, "UID", showToast); }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(0,122,255,0.15)"; e.currentTarget.style.color = T.blue; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = T.dim; }}>
                  {uid.slice(0, 12)}...
                </div>
              )}
              {/* Role */}
              {!isMobileView && visibleColumns.role && <div style={{ color: T.muted, fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>Trader</div>}
              {/* Status */}
              {!isMobileView && visibleColumns.status && (
                <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: statusBg, border: `1px solid ${statusBorder}`, borderRadius: 20, padding: "6px 12px", width: "fit-content", boxShadow: `0 0 12px ${statusBorder}` }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: statusColorVal }} />
                  <span style={{ color: statusColorVal, fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" }}>{normalizedStatus === "PENDING" ? "pending" : normalizedStatus === "ACTIVE" ? "active" : "banned"}</span>
                </div>
              )}
              {/* IP Duplicate Badge */}
              {(() => { const userIP = user?.forensic?.ip || user?.ip; const dup = Object.entries(duplicateIPs || {}).find(([, uids]) => userIP && uids.includes(uid)); if (dup) return <div title={`⚠️ DUPLICATE IP: ${userIP} shared with ${dup[1].length - 1} other user(s)`} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(255,165,0,0.15)", border: "1px solid rgba(255,165,0,0.5)", borderRadius: 12, padding: "6px 10px", color: "#FFB340", fontSize: 9, fontWeight: 700, letterSpacing: 0.5, whiteSpace: "nowrap" }}>⚠️ DUP IP</div>; return null; })()}
              {/* Actions */}
              <div style={{ display: "flex", flexDirection: isMobileView ? "column" : "row", gap: 8, justifyContent: isMobileView ? "stretch" : "flex-end", flexWrap: isMobileView ? "nowrap" : "wrap" }}>
                {normalizedStatus === "PENDING" && (
                  <button onClick={(e) => { e.stopPropagation(); approve(uid); }} data-status="pending"
                    style={{ background: T.green, border: "none", borderRadius: 4, padding: isMobileView ? "10px 12px" : "7px 12px", cursor: "pointer", color: "#000", fontSize: 11, fontWeight: 700, transition: "all 0.2s ease", display: "flex", alignItems: "center", justifyContent: "center", letterSpacing: 0.5 }}>✓ APPROVE</button>
                )}
                {normalizedStatus !== "BLOCKED" && (
                  <button onClick={(e) => { e.stopPropagation(); if (window.confirm(`Ban ${user.fullName}?`)) block(uid); }}
                    style={{ background: "transparent", border: "1.5px solid " + T.red, borderRadius: 4, padding: isMobileView ? "10px 12px" : "6px 12px", cursor: "pointer", color: T.red, fontSize: 11, fontWeight: 700, transition: "all 0.2s ease" }}>BAN</button>
                )}
                {normalizedStatus === "BLOCKED" && (
                  <button onClick={(e) => { e.stopPropagation(); approve(uid); }}
                    style={{ background: "transparent", border: "1.5px solid " + T.gold, borderRadius: 4, padding: isMobileView ? "10px 12px" : "6px 12px", cursor: "pointer", color: T.gold, fontSize: 11, fontWeight: 700 }}>↺ RESTORE</button>
                )}
                <button onClick={(e) => { e.stopPropagation(); setSelectedUserDocs(uid); }}
                  style={{ background: "rgba(52,199,89,0.2)", border: "1.5px solid " + T.green, borderRadius: 4, padding: isMobileView ? "10px 12px" : "6px 12px", cursor: "pointer", color: T.green, fontSize: 11, fontWeight: 700 }}>📄 DOCS</button>
                <button onClick={(e) => { e.stopPropagation(); setChatWith(uid); setChatModalOpen(true); }}
                  style={{ background: "rgba(0,122,255,0.2)", border: "1.5px solid #0A84FF", borderRadius: 4, padding: isMobileView ? "10px 12px" : "6px 12px", cursor: "pointer", color: "#0A84FF", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>💬 MSG</button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
"""

with open(BASE + 'AdminDashboardTable.jsx', 'w', encoding='utf-8') as f:
    f.write(table_code)
print(f"AdminDashboardTable.jsx: {len(table_code.splitlines())} lines")

# ── 3. AdminMirrorPanel.jsx ────────────────────────────────────────────────────
mirror_code = r"""/* eslint-disable */
/* Auto-extracted from AdminDashboardScreen.jsx — mirror panel */
import React from "react";
import { X } from "lucide-react";

export default function AdminMirrorPanel({
  T, LED, SHead, cardS, AMD_PHASES,
  mirror, mirrorData, setMirror, setMirrorData,
  statusColor,
}) {
  if (!mirror || !mirrorData) return null;
  const journal = mirrorData.journal ? Object.values(mirrorData.journal) : [];
  const wins = journal.filter((t) => t.result === "win");
  const pnl = journal.reduce((s, t) => s + parseFloat(t.pnl || 0), 0);

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "0 0 60px", minWidth: 320 }}>
      <div style={{ padding: "16px 28px", borderBottom: "1px solid rgba(191,90,242,0.3)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(0,0,0,0.5)", position: "sticky", top: 0, zIndex: 10, backdropFilter: "blur(20px)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <LED color={T.purple} size={10} />
          <div>
            <div style={{ color: T.purple, fontSize: 13, letterSpacing: 2, fontWeight: 700 }}>MIRROR VIEW — READ ONLY</div>
            <div style={{ color: T.muted, fontSize: 11, marginTop: 2 }}>{mirrorData.profile?.fullName} · {mirrorData.profile?.email}</div>
          </div>
        </div>
        <button onClick={() => { setMirror(null); setMirrorData(null); }}
          style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "6px 14px", cursor: "pointer", color: T.muted, fontSize: 10, fontFamily: T.font, fontWeight: 600 }}>
          CLOSE
        </button>
      </div>

      <div style={{ padding: "24px 28px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 16, marginBottom: 24 }}>
          {[
            { l: "Account Balance", v: mirrorData.accountState?.currentBalance ? `$${parseFloat(mirrorData.accountState.currentBalance).toLocaleString()}` : "—", c: T.green },
            { l: "High-Water Mark", v: mirrorData.accountState?.highWaterMark ? `$${parseFloat(mirrorData.accountState.highWaterMark).toLocaleString()}` : "—", c: T.blue },
            { l: "Firm", v: mirrorData.firmRules?.firmName || "—", c: T.gold },
            { l: "Status", v: mirrorData.profile?.status || "—", c: (statusColor || {})[mirrorData.profile?.status] || T.muted },
          ].map((s, i) => (
            <div key={i} style={cardS({ margin: 0, textAlign: "center", padding: "16px" })}>
              <div style={{ color: T.dim, fontSize: 10, letterSpacing: 1.5, marginBottom: 8, fontWeight: 600 }}>{s.l}</div>
              <div style={{ color: s.c, fontSize: 18, fontWeight: 700, fontFamily: T.mono }}>{s.v}</div>
            </div>
          ))}
        </div>

        {!journal.length ? (
          <div style={cardS({ textAlign: "center", color: T.dim, padding: 40, fontSize: 13 })}>No journal entries yet</div>
        ) : (
          <div style={cardS({ borderLeft: `4px solid ${T.purple}`, padding: 0, overflow: "hidden" })}>
            <div style={{ padding: "20px 24px" }}>
              <SHead icon="📔" title="TRADE JOURNAL MIRROR" color={T.purple} />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12, marginBottom: 20 }}>
                {[
                  { l: "Total Trades", v: journal.length, c: T.text },
                  { l: "Win Rate", v: `${Math.round((wins.length / journal.length) * 100)}%`, c: wins.length / journal.length >= 0.5 ? T.green : T.red },
                  { l: "Total P&L", v: `${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)}`, c: pnl >= 0 ? T.green : T.red },
                ].map((s, i) => (
                  <div key={i} style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 8, padding: "12px", textAlign: "center" }}>
                    <div style={{ color: T.dim, fontSize: 10, marginBottom: 6, fontWeight: 600 }}>{s.l}</div>
                    <div style={{ color: s.c, fontSize: 16, fontWeight: 700, fontFamily: T.mono }}>{s.v}</div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Date", "Inst", "Dir", "Type", "AMD", "RRR", "Entry", "Exit", "P&L", "Result"].map((h) => (
                      <th key={h} style={{ padding: "12px 14px", textAlign: "left", color: "#6B7280", fontSize: 10, letterSpacing: 1, background: "#F9FAFB", borderBottom: "1px solid #E5E7EB", whiteSpace: "nowrap", fontWeight: 700 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {journal.slice(-20).reverse().map((t, i) => {
                    const pv = parseFloat(t.pnl || 0);
                    const amdColor = (AMD_PHASES[t.amdPhase] || AMD_PHASES.UNCLEAR).color;
                    return (
                      <tr key={i} style={{ borderBottom: "1px solid #E5E7EB", background: i % 2 === 0 ? "#F9FAFB" : "#FFFFFF" }}>
                        <td style={{ padding: "10px 14px", color: "#6B7280", fontSize: 11, fontFamily: T.mono }}>{t.date}</td>
                        <td style={{ padding: "10px 14px", color: "#111827", fontSize: 11, fontWeight: 700 }}>{t.instrument}</td>
                        <td style={{ padding: "10px 14px", color: t.direction === "Long" ? "#10B981" : "#EF4444", fontSize: 11, fontWeight: 600 }}>{t.direction}</td>
                        <td style={{ padding: "10px 14px", color: "#0EA5E9", fontSize: 11, fontWeight: 500 }}>{t.tradeType}</td>
                        <td style={{ padding: "10px 14px", color: amdColor, fontSize: 10, fontWeight: 600 }}>{(AMD_PHASES[t.amdPhase]?.label || t.amdPhase || "—").slice(0, 10)}</td>
                        <td style={{ padding: "10px 14px", color: "#D97706", fontSize: 11, fontFamily: T.mono }}>{t.rrr}</td>
                        <td style={{ padding: "10px 14px", color: "#6B7280", fontSize: 11, fontFamily: T.mono }}>{t.entry || "—"}</td>
                        <td style={{ padding: "10px 14px", color: "#6B7280", fontSize: 11, fontFamily: T.mono }}>{t.exit || "—"}</td>
                        <td style={{ padding: "10px 14px", color: pv >= 0 ? "#10B981" : "#EF4444", fontSize: 12, fontWeight: 700, fontFamily: T.mono }}>{pv >= 0 ? "+" : ""}${pv.toFixed(0)}</td>
                        <td style={{ padding: "10px 14px", color: t.result === "win" ? "#10B981" : t.result === "loss" ? "#EF4444" : "#6B7280", fontSize: 11, fontWeight: 800 }}>{(t.result || "—").toUpperCase()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
"""

with open(BASE + 'AdminMirrorPanel.jsx', 'w', encoding='utf-8') as f:
    f.write(mirror_code)
print(f"AdminMirrorPanel.jsx: {len(mirror_code.splitlines())} lines")

# ── 4. AdminUserDocsModal.jsx ──────────────────────────────────────────────────
docs_code = r"""/* eslint-disable */
/* Auto-extracted from AdminDashboardScreen.jsx — user docs modal */
import React from "react";
import { X } from "lucide-react";

export default function AdminUserDocsModal({
  T,
  selectedUserDocs, setSelectedUserDocs,
  searchFilteredUsers, authBtn,
}) {
  if (!selectedUserDocs) return null;
  const userName = searchFilteredUsers.find(([uid]) => uid === selectedUserDocs)?.[1]?.fullName || "Unknown";

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(5px)" }}>
      <div style={{ background: "rgba(20,20,20,0.95)", border: `1px solid ${T.green}40`, borderRadius: 12, padding: 28, maxWidth: 600, maxHeight: "80vh", overflowY: "auto", boxShadow: `0 0 40px rgba(52,199,89,0.2)`, backdropFilter: "blur(10px)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, paddingBottom: 16, borderBottom: `1px solid ${T.green}30` }}>
          <div style={{ color: T.green, fontSize: 14, letterSpacing: 2, fontWeight: 700 }}>📄 IDENTITY DOCUMENTS (RULE #24)</div>
          <button onClick={() => setSelectedUserDocs(null)} style={{ background: "transparent", border: "none", color: T.muted, fontSize: 20, cursor: "pointer", padding: "4px 8px" }}>
            <X size={14} />
          </button>
        </div>
        <div style={{ marginBottom: 20 }}>
          <div style={{ color: T.muted, fontSize: 12, marginBottom: 12, fontWeight: 600 }}>User: {userName}</div>
          <div style={{ padding: 16, background: "rgba(52,199,89,0.1)", borderRadius: 8, border: `1px solid ${T.green}30`, minHeight: 120, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
            <div style={{ color: T.green, fontSize: 14 }}>📁</div>
            <div style={{ color: T.muted, fontSize: 12, textAlign: "center" }}>
              Identity documents for this user will appear here.<br />
              <span style={{ fontSize: 11, color: T.dim }}>(Currently uploaded documents from Aadhar, Passport, License, PAN)</span>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <button onClick={() => setSelectedUserDocs(null)} style={{ ...(authBtn ? authBtn(T.muted, false) : {}), background: "transparent" }}>CLOSE</button>
        </div>
      </div>
    </div>
  );
}
"""

with open(BASE + 'AdminUserDocsModal.jsx', 'w', encoding='utf-8') as f:
    f.write(docs_code)
print(f"AdminUserDocsModal.jsx: {len(docs_code.splitlines())} lines")

print("All 4 components created successfully.")

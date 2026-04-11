/* eslint-disable */
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

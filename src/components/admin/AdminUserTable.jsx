import React from 'react';
import { ref, get } from 'firebase/database';
import { T } from '../../constants/theme.js';
import { cardS, authBtn } from '../../utils/styleUtils.js';
import { renderHighlightedText } from '../../utils/searchUtils.jsx';
import { getUserLevelBadge } from '../../utils/userUtils.jsx';
import { copyToClipboard } from '../../utils/uiUtils.js';
import { EmptyStateCard, TableSkeletonLoader } from '../../components/SharedUI.jsx';

export function AdminUserTable({
  paginatedUsers,
  totalResults,
  totalPages,
  validPage,
  searchFilteredUsers,
  loading,
  dbError,
  setLoading,
  setDbError,
  setUsers,
  filterStatus,
  setFilterStatus,
  searchQuery,
  setSearchQuery,
  showAdvancedFilter,
  setShowAdvancedFilter,
  balanceFilter,
  setBalanceFilter,
  rowDensity,
  setRowDensity,
  rowsPerPage,
  setRowsPerPage,
  currentPage,
  setCurrentPage,
  visibleColumns,
  setVisibleColumns,
  mirror,
  isMobileView,
  approve,
  block,
  openMirror,
  setChatModalOpen,
  setChatWith,
  setSelectedUserDocs,
  firebaseDb,
  showToast,
  duplicateIPs,
}) {
  const startIdx = (validPage - 1) * rowsPerPage;

  const getGridTemplateColumns = () => {
    const cols = [];
    if (visibleColumns.name) cols.push('2fr');
    if (visibleColumns.email) cols.push('2fr');
    if (visibleColumns.joinDate) cols.push('1.5fr');
    if (visibleColumns.uid) cols.push('1.5fr');
    if (visibleColumns.role) cols.push('1.2fr');
    if (visibleColumns.status) cols.push('1.2fr');
    cols.push('1fr');
    return cols.join(' ');
  };

  const getRowPadding = () => rowDensity === 'compact' ? '8px 20px' : '14px 20px';

  const normalizeStatus = (status) => {
    if (!status) return '';
    return status.toLowerCase() === 'pending' ? 'PENDING'
         : status.toUpperCase() === 'ACTIVE' ? 'ACTIVE'
         : status.toUpperCase() === 'BLOCKED' ? 'BLOCKED'
         : status.toUpperCase();
  };

  return (
        <div id="admin-users" style={{ width: mirror ? 440 : "100%", flex: mirror ? undefined : 1, borderRight: `1px solid rgba(255,255,255,0.1)`, overflowY: "auto", overflowX: "hidden", background: "rgba(0,0,0,0.2)", display: "flex", flexDirection: "column" }}>
          
          {/* Search Bar - Sticky Header */}
          <div style={{ padding: "16px 20px", borderBottom: `1px solid rgba(255,255,255,0.1)`, background: "rgba(20,20,20,0.8)", display: "flex", alignItems: "center", gap: 8, position: "sticky", top: 0, zIndex: 6, flexShrink: 0 }} className="glass-panel">
            <span style={{ color: T.cyan, fontSize: 14, fontWeight: 600 }}>ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒâ€šÃ‚Â</span>
            <input 
              type="text"
              placeholder="Search by Name or Email"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ 
                flex: 1,
                background: "rgba(0,0,0,0.4)", 
                border: `1px solid rgba(255,255,255,0.15)`,
                borderRadius: 6,
                padding: "10px 14px",
                color: T.text,
                fontSize: 13,
                fontFamily: T.font,
                letterSpacing: 0.5,
                outline: "none",
                transition: "all 0.2s ease-in-out"
              }}
              onFocus={(e) => {
                e.target.style.background = "rgba(0,0,0,0.6)";
                e.target.style.borderColor = "rgba(0,122,255,0.5)";
                e.target.style.boxShadow = "0 0 12px rgba(0,122,255,0.2)";
              }}
              onBlur={(e) => {
                e.target.style.background = "rgba(0,0,0,0.4)";
                e.target.style.borderColor = "rgba(255,255,255,0.15)";
                e.target.style.boxShadow = "none";
              }}
              className="input-glass"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  background: "transparent",
                  border: "none",
                  color: T.muted,
                  cursor: "pointer",
                  fontSize: 16,
                  padding: 4,
                  transition: "all 0.2s ease"
                }}
                onMouseEnter={e => e.currentTarget.style.color = T.text}
                onMouseLeave={e => e.currentTarget.style.color = T.muted}
              >
                ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢
              </button>
            )}
          </div>
          
          {/* RULE #58: Advanced Filter Panel - Balance range filter */}
          {showAdvancedFilter && (
            <div style={{ padding: "16px 20px", borderBottom: `1px solid rgba(0,122,255,0.2)`, background: "rgba(0,122,255,0.08)", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }} className="glass-panel">
              <span style={{ color: T.blue, fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢Ãƒâ€šÃ‚Â° Balance Range:</span>
              
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: T.muted, fontSize: 10, fontWeight: 600 }}>Min:</span>
                  <input
                    type="number"
                    placeholder="0"
                    value={balanceFilter.min === 0 ? '' : balanceFilter.min}
                    onChange={(e) => {
                      const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                      setBalanceFilter(prev => ({ ...prev, min: Math.max(0, val) }));
                    }}
                    style={{
                      background: "rgba(0,0,0,0.4)",
                      border: `1px solid rgba(0,122,255,0.3)`,
                      borderRadius: 4,
                      padding: "6px 10px",
                      color: T.text,
                      fontFamily: T.font,
                      fontSize: 10,
                      fontWeight: 600,
                      width: "70px",
                      outline: "none",
                      transition: "all 0.2s ease-in-out"
                    }}
                    onFocus={e => {
                      e.target.style.background = "rgba(0,0,0,0.6)";
                      e.target.style.borderColor = "rgba(0,122,255,0.5)";
                    }}
                    onBlur={e => {
                      e.target.style.background = "rgba(0,0,0,0.4)";
                      e.target.style.borderColor = "rgba(0,122,255,0.3)";
                    }}
                  />
                </div>
                
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: T.muted, fontSize: 10, fontWeight: 600 }}>Max:</span>
                  <input
                    type="number"
                    placeholder="ÃƒÆ’Ã‚Â¢Ãƒâ€¹Ã¢â‚¬Â Ãƒâ€¦Ã‚Â¾"
                    value={balanceFilter.max === Infinity ? '' : balanceFilter.max}
                    onChange={(e) => {
                      const val = e.target.value === '' ? Infinity : parseFloat(e.target.value);
                      setBalanceFilter(prev => ({ ...prev, max: val }));
                    }}
                    style={{
                      background: "rgba(0,0,0,0.4)",
                      border: `1px solid rgba(0,122,255,0.3)`,
                      borderRadius: 4,
                      padding: "6px 10px",
                      color: T.text,
                      fontFamily: T.font,
                      fontSize: 10,
                      fontWeight: 600,
                      width: "70px",
                      outline: "none",
                      transition: "all 0.2s ease-in-out"
                    }}
                    onFocus={e => {
                      e.target.style.background = "rgba(0,0,0,0.6)";
                      e.target.style.borderColor = "rgba(0,122,255,0.5)";
                    }}
                    onBlur={e => {
                      e.target.style.background = "rgba(0,0,0,0.4)";
                      e.target.style.borderColor = "rgba(0,122,255,0.3)";
                    }}
                  />
                </div>
                
                <button
                  onClick={() => {
                    setBalanceFilter({ min: 0, max: Infinity });
                  }}
                  style={{
                    background: "transparent",
                    border: `1px solid rgba(0,122,255,0.3)`,
                    borderRadius: 4,
                    padding: "6px 12px",
                    cursor: "pointer",
                    color: T.blue,
                    fontFamily: T.font,
                    fontSize: 10,
                    fontWeight: 600,
                    transition: "all 0.2s ease-in-out"
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = "rgba(0,122,255,0.15)";
                    e.currentTarget.style.borderColor = "rgba(0,122,255,0.5)";
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.borderColor = "rgba(0,122,255,0.3)";
                  }}
                >
                  Reset
                </button>
              </div>
            </div>
          )}
          
          {/* RULE #39, #40, #50: Grid Control Bar - Density, Pagination, Column Picker */}
          <div style={{ padding: "12px 20px", borderBottom: `1px solid rgba(255,255,255,0.1)`, background: "rgba(15,15,15,0.8)", display: "flex", alignItems: "center", gap: 16, justifyContent: "space-between", flexWrap: "wrap" }} className="glass-panel">
            
            {/* Left: Row Density Toggle & Rows Per Page */}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {/* Row Density Toggle */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: T.muted, fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Density:</span>
                {['compact', 'comfortable'].map(density => (
                  <button
                    key={density}
                    onClick={() => setRowDensity(density)}
                    style={{
                      background: rowDensity === density ? "rgba(0,122,255,0.2)" : "transparent",
                      border: `1px solid ${rowDensity === density ? "rgba(0,122,255,0.5)" : "rgba(255,255,255,0.15)"}`,
                      borderRadius: 4,
                      padding: "6px 12px",
                      cursor: "pointer",
                      color: rowDensity === density ? T.blue : T.muted,
                      fontFamily: T.font,
                      fontSize: 10,
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                      transition: "all 0.2s ease-in-out"
                    }}
                    onMouseEnter={e => {
                      if (rowDensity !== density) {
                        e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                        e.currentTarget.style.borderColor = "rgba(255,255,255,0.3)";
                      }
                    }}
                    onMouseLeave={e => {
                      if (rowDensity !== density) {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)";
                      }
                    }}
                  >
                    {density === 'compact' ? 'ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã‚Â Ãƒâ€šÃ‚Â¡ Compact' : 'ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã‚Â Ãƒâ€¦Ã‚Â¾ Comfortable'}
                  </button>
                ))}
              </div>
              
              {/* Rows Per Page Selector */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: T.muted, fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Rows:</span>
                <select
                  value={rowsPerPage}
                  onChange={(e) => {
                    setRowsPerPage(parseInt(e.target.value));
                    setCurrentPage(1);
                  }}
                  style={{
                    background: "rgba(0,0,0,0.4)",
                    border: `1px solid rgba(255,255,255,0.15)`,
                    borderRadius: 4,
                    padding: "6px 10px",
                    color: T.text,
                    fontFamily: T.font,
                    fontSize: 10,
                    fontWeight: 600,
                    cursor: "pointer",
                    outline: "none",
                    transition: "all 0.2s ease-in-out"
                  }}
                  onFocus={e => {
                    e.target.style.background = "rgba(0,0,0,0.6)";
                    e.target.style.borderColor = "rgba(0,122,255,0.5)";
                  }}
                  onBlur={e => {
                    e.target.style.background = "rgba(0,0,0,0.4)";
                    e.target.style.borderColor = "rgba(255,255,255,0.15)";
                  }}
                >
                  <option value={10}>10</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>
            
            {/* Right: Column Picker & Pagination Info */}
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              {/* Pagination Info */}
              <div style={{ color: T.muted, fontSize: 10, fontWeight: 600, whiteSpace: "nowrap" }}>
                {totalResults > 0 ? `${startIdx + 1}ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œ${Math.min(endIdx, totalResults)} of ${totalResults}` : '0 results'}
              </div>
              
              {/* Pagination Controls */}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button
                  onClick={() => setCurrentPage(Math.max(1, validPage - 1))}
                  disabled={validPage === 1}
                  style={{
                    background: validPage === 1 ? "rgba(255,255,255,0.05)" : "rgba(0,122,255,0.15)",
                    border: `1px solid ${validPage === 1 ? "rgba(255,255,255,0.1)" : "rgba(0,122,255,0.3)"}`,
                    borderRadius: 4,
                    padding: "6px 8px",
                    cursor: validPage === 1 ? "not-allowed" : "pointer",
                    color: validPage === 1 ? T.dim : T.blue,
                    fontFamily: T.font,
                    fontSize: 11,
                    fontWeight: 600,
                    transition: "all 0.2s ease-in-out"
                  }}
                  onMouseEnter={e => {
                    if (validPage !== 1) {
                      e.currentTarget.style.background = "rgba(0,122,255,0.25)";
                      e.currentTarget.style.borderColor = "rgba(0,122,255,0.5)";
                    }
                  }}
                  onMouseLeave={e => {
                    if (validPage !== 1) {
                      e.currentTarget.style.background = "rgba(0,122,255,0.15)";
                      e.currentTarget.style.borderColor = "rgba(0,122,255,0.3)";
                    }
                  }}
                >
                  ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â Ãƒâ€šÃ‚Â
                </button>
                
                <span style={{ color: T.muted, fontSize: 10, fontWeight: 600, minWidth: "40px", textAlign: "center" }}>
                  {totalPages > 0 ? `${validPage}/${totalPages}` : '0/0'}
                </span>
                
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, validPage + 1))}
                  disabled={validPage === totalPages}
                  style={{
                    background: validPage === totalPages ? "rgba(255,255,255,0.05)" : "rgba(0,122,255,0.15)",
                    border: `1px solid ${validPage === totalPages ? "rgba(255,255,255,0.1)" : "rgba(0,122,255,0.3)"}`,
                    borderRadius: 4,
                    padding: "6px 8px",
                    cursor: validPage === totalPages ? "not-allowed" : "pointer",
                    color: validPage === totalPages ? T.dim : T.blue,
                    fontFamily: T.font,
                    fontSize: 11,
                    fontWeight: 600,
                    transition: "all 0.2s ease-in-out"
                  }}
                  onMouseEnter={e => {
                    if (validPage !== totalPages) {
                      e.currentTarget.style.background = "rgba(0,122,255,0.25)";
                      e.currentTarget.style.borderColor = "rgba(0,122,255,0.5)";
                    }
                  }}
                  onMouseLeave={e => {
                    if (validPage !== totalPages) {
                      e.currentTarget.style.background = "rgba(0,122,255,0.15)";
                      e.currentTarget.style.borderColor = "rgba(0,122,255,0.3)";
                    }
                  }}
                >
                  ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢
                </button>
              </div>
              
              {/* Column Picker Dropdown */}
              <div style={{ position: "relative" }}>
                <button
                  onClick={(e) => {
                    const menu = e.currentTarget.nextElementSibling;
                    menu.style.display = menu.style.display === "none" ? "block" : "none";
                  }}
                  style={{
                    background: "rgba(0,122,255,0.15)",
                    border: `1px solid rgba(0,122,255,0.3)`,
                    borderRadius: 4,
                    padding: "6px 12px",
                    cursor: "pointer",
                    color: T.blue,
                    fontFamily: T.font,
                    fontSize: 10,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                    transition: "all 0.2s ease-in-out"
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = "rgba(0,122,255,0.25)";
                    e.currentTarget.style.borderColor = "rgba(0,122,255,0.5)";
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = "rgba(0,122,255,0.15)";
                    e.currentTarget.style.borderColor = "rgba(0,122,255,0.3)";
                  }}
                >
                  ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã‚Â¡ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ Columns
                </button>
                
                <div
                  style={{
                    display: "none",
                    position: "absolute",
                    right: 0,
                    top: "100%",
                    marginTop: 4,
                    background: "rgba(20,20,20,0.95)",
                    border: `1px solid rgba(0,122,255,0.3)`,
                    borderRadius: 6,
                    padding: "8px 0",
                    minWidth: "160px",
                    zIndex: 100,
                    boxShadow: "0 8px 24px rgba(0,0,0,0.5)"
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {[
                    { key: 'name', label: 'Name' },
                    { key: 'email', label: 'Email' },
                    { key: 'joinDate', label: 'Join Date' },
                    { key: 'status', label: 'Status' },
                    { key: 'uid', label: 'UID' },
                    { key: 'role', label: 'Role' }
                  ].map(col => (
                    <label
                      key={col.key}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "8px 16px",
                        cursor: "pointer",
                        color: T.muted,
                        fontSize: 11,
                        fontWeight: 600,
                        transition: "all 0.15s ease",
                        userSelect: "none"
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = "rgba(0,122,255,0.15)";
                        e.currentTarget.style.color = T.text;
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.color = T.muted;
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={visibleColumns[col.key]}
                        onChange={(e) => {
                          setVisibleColumns(prev => ({
                            ...prev,
                            [col.key]: e.target.checked
                          }));
                        }}
                        style={{
                          cursor: "pointer",
                          width: 14,
                          height: 14,
                          accentColor: T.blue
                        }}
                      />
                      <span>{col.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
          
          {/* Table Header - Hidden on Mobile */}
          {!loading && !dbError && paginatedUsers.length > 0 && !isMobileView && (
            <div style={{ padding: "16px 20px", borderBottom: `1px solid rgba(255,255,255,0.15)`, background: "rgba(20,20,20,0.8)", display: "grid", gridTemplateColumns: getGridTemplateColumns(), gap: 16, position: "sticky", top: 0, zIndex: 5 }} className="glass-panel">
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
          {loading ? (
            <TableSkeletonLoader />
          ) : dbError ? (
            <div style={{ padding: "60px 40px", textAlign: "center", color: T.red, fontSize: 13, fontWeight: 600 }}>
              <div style={{ marginBottom: 16, fontSize: 20 }}>ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã‚Â¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚Â</div>
              <div style={{ marginBottom: 20, fontSize: 13, lineHeight: 1.6 }}>{dbError}</div>
              <button 
                onClick={async () => {
                  // Retry: Manual refresh when error occurs
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
                    console.error('Failed to retry:', error);
                    setDbError(`Network Error: ${error.message}`);
                  } finally {
                    setLoading(false);
                  }
                }}
                style={{ marginTop: 16, background: "rgba(255,69,58,0.2)", border: `1px solid rgba(255,69,58,0.4)`, borderRadius: 6, padding: "10px 20px", cursor: "pointer", color: T.red, fontSize: 12, fontFamily: T.font, letterSpacing: 1, fontWeight: 700, transition: "all 0.2s ease-in-out" }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = "rgba(255,69,58,0.3)";
                  e.currentTarget.style.boxShadow = `0 0 16px rgba(255,69,58,0.4)`;
                  e.currentTarget.style.transform = "translateY(-2px)";
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = "rgba(255,69,58,0.2)";
                  e.currentTarget.style.boxShadow = "none";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
                className="btn-glass">
                ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â Ãƒâ€šÃ‚Âº RETRY
              </button>
            </div>
          ) : totalResults === 0 ? (
            <>
              <EmptyStateCard searchQuery={searchQuery} filterStatus={filterStatus} />
              {(searchQuery || filterStatus !== 'ALL' || showAdvancedFilter) && (
                <div style={{ textAlign: "center", paddingBottom: "40px" }}>
                  <button 
                    onClick={() => { 
                      setSearchQuery(''); 
                      if (filterStatus !== 'ALL') setFilterStatus('ALL');
                      if (showAdvancedFilter) setShowAdvancedFilter(false);
                      setBalanceFilter({ min: 0, max: Infinity });
                    }} 
                    style={{ background: "rgba(0,122,255,0.2)", border: `1px solid rgba(0,122,255,0.4)`, borderRadius: 6, padding: "10px 20px", cursor: "pointer", color: T.blue, fontSize: 11, fontFamily: T.font, letterSpacing: 1, fontWeight: 700, transition: "all 0.2s ease-in-out" }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = "rgba(0,122,255,0.3)";
                      e.currentTarget.style.borderColor = "rgba(0,122,255,0.6)";
                      e.currentTarget.style.transform = "translateY(-2px)";
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = "rgba(0,122,255,0.2)";
                      e.currentTarget.style.borderColor = "rgba(0,122,255,0.4)";
                      e.currentTarget.style.transform = "translateY(0)";
                    }}
                    className="btn-glass">
                    ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â Ãƒâ€šÃ‚Â CLEAR ALL FILTERS
                  </button>
                </div>
              )}
            </>
          ) : (
            paginatedUsers.map(([uid, user]) => {
              if (!user || !user.fullName || !user.status) return null;
              
              const joinDate = user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) : 'ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â';
              const normalizedStatus = normalizeStatus(user.status);
              const statusBg = normalizedStatus === 'ACTIVE' ? 'rgba(48,209,88,0.15)' 
                             : normalizedStatus === 'PENDING' ? 'rgba(255,214,10,0.15)'
                             : 'rgba(255,69,58,0.15)';
              const statusBorder = normalizedStatus === 'ACTIVE' ? 'rgba(48,209,88,0.5)' 
                                 : normalizedStatus === 'PENDING' ? 'rgba(255,214,10,0.5)'
                                 : 'rgba(255,69,58,0.5)';
              const statusColor = normalizedStatus === 'ACTIVE' ? T.green
                                : normalizedStatus === 'PENDING' ? T.gold
                                : T.red;
              
              return (
                <div 
                  key={uid} 
                  style={{ 
                    padding: isMobileView ? "16px 12px" : getRowPadding(),
                    borderBottom: `1px solid rgba(255,255,255,0.1)`,
                    background: mirror === uid ? "rgba(191,90,242,0.12)" : "rgba(255,255,255,0.01)",
                    display: isMobileView ? "flex" : "grid",
                    flexDirection: isMobileView ? "column" : undefined,
                    gridTemplateColumns: isMobileView ? undefined : getGridTemplateColumns(),
                    gap: isMobileView ? 12 : 16,
                    alignItems: isMobileView ? "stretch" : "center",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    backdropFilter: "blur(10px)",
                    borderLeft: mirror === uid ? `3px solid ${T.purple}` : "3px solid transparent"
                  }}
                  onMouseEnter={e => {
                    if (!isMobileView) {
                      e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                      e.currentTarget.style.borderBottom = `1px solid rgba(255,255,255,0.2)`;
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isMobileView) {
                      e.currentTarget.style.background = mirror === uid ? "rgba(191,90,242,0.12)" : "rgba(255,255,255,0.01)";
                      e.currentTarget.style.borderBottom = `1px solid rgba(255,255,255,0.1)`;
                    }
                  }}
                  onClick={() => openMirror(uid)}
                  className="glass-panel"
                >
                  {/* Mobile Card Header - Name + Status */}
                  {isMobileView && (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, paddingBottom: 8, borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <div style={{ color: T.text, fontSize: 12, fontWeight: 600 }}>
                            {searchQuery ? renderHighlightedText(user.fullName, searchQuery) : user.fullName}
                          </div>
                          {(() => {
                            const badge = getUserLevelBadge(user);
                            return (
                              <div style={{
                                background: badge.bg,
                                border: `1px solid ${badge.color}`,
                                borderRadius: 12,
                                padding: "2px 8px",
                                color: badge.color,
                                fontSize: 9,
                                fontWeight: 700,
                                letterSpacing: 0.5,
                                whiteSpace: "nowrap"
                              }}>
                                {badge.level}
                              </div>
                            );
                          })()}
                        </div>
                        <div style={{ color: T.dim, fontSize: 10, marginTop: 2 }}>ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒâ€¦Ã‚Â  {user.proficiency || 'unknown'}</div>
                      </div>
                      <div style={{ 
                        display: "inline-flex", 
                        alignItems: "center", 
                        gap: 6,
                        background: statusBg,
                        border: `1px solid ${statusBorder}`,
                        borderRadius: 16,
                        padding: "4px 10px",
                        width: "fit-content",
                        boxShadow: `0 0 8px ${statusBorder}`
                      }}>
                        <div style={{ width: 5, height: 5, borderRadius: "50%", background: statusColor }} />
                        <span style={{ color: statusColor, fontSize: 9, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" }}>
                          {normalizedStatus === 'PENDING' ? 'pending' : normalizedStatus === 'ACTIVE' ? 'active' : 'banned'}
                        </span>
                      </div>
                    </div>
                  )}
                  
                  {/* Desktop: Name */}
                  {!isMobileView && visibleColumns.name && <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <div style={{ color: T.text, fontSize: 12, fontWeight: 600 }}>
                        {searchQuery ? renderHighlightedText(user.fullName, searchQuery) : user.fullName}
                      </div>
                      {(() => {
                        const badge = getUserLevelBadge(user);
                        return (
                          <div style={{
                            background: badge.bg,
                            border: `1px solid ${badge.color}`,
                            borderRadius: 12,
                            padding: "2px 8px",
                            color: badge.color,
                            fontSize: 9,
                            fontWeight: 700,
                            letterSpacing: 0.5,
                            whiteSpace: "nowrap"
                          }}>
                            {badge.level}
                          </div>
                        );
                      })()}
                    </div>
                    <div style={{ color: T.dim, fontSize: 10, marginTop: 2 }}>ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒâ€¦Ã‚Â  {user.proficiency || 'unknown'}</div>
                  </div>}
                  
                  {/* Mobile: Info Row */}
                  {isMobileView && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 10, color: T.muted }}>
                      {visibleColumns.email && <div style={{ fontFamily: T.mono, letterSpacing: 0.5 }}>ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒâ€šÃ‚Â§ {user.email || 'ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â'}</div>}
                      {visibleColumns.joinDate && <div style={{ fontFamily: T.mono, letterSpacing: 0.5 }}>ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ {joinDate}</div>}
                    </div>
                  )}
                  
                  {/* Desktop: Email */}
                  {!isMobileView && visibleColumns.email && <div 
                    style={{ 
                      color: T.muted, 
                      fontSize: 11, 
                      fontFamily: T.mono, 
                      overflow: "hidden", 
                      textOverflow: "ellipsis", 
                      whiteSpace: "nowrap", 
                      letterSpacing: 0.5,
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                      padding: "4px 6px",
                      borderRadius: 3
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      copyToClipboard(user.email, 'Email', showToast);
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = "rgba(0,122,255,0.15)";
                      e.currentTarget.style.color = T.blue;
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.color = T.muted;
                    }}
                    title="Click to copy email"
                  >
                    {searchQuery ? renderHighlightedText(user.email || 'ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â', searchQuery) : (user.email || 'ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â')}
                  </div>}
                  
                  {/* Desktop: Join Date */}
                  {!isMobileView && visibleColumns.joinDate && <div style={{ color: T.muted, fontSize: 11, fontFamily: T.mono, letterSpacing: 0.5 }}>{joinDate}</div>}
                  
                  {/* Desktop: UID */}
                  {!isMobileView && visibleColumns.uid && <div 
                    style={{ 
                      color: T.dim, 
                      fontSize: 10, 
                      fontFamily: T.mono, 
                      letterSpacing: 0.5, 
                      overflow: "hidden", 
                      textOverflow: "ellipsis", 
                      whiteSpace: "nowrap",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                      padding: "4px 6px",
                      borderRadius: 3
                    }}
                    title={`Click to copy UID: ${uid}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      copyToClipboard(uid, 'UID', showToast);
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = "rgba(0,122,255,0.15)";
                      e.currentTarget.style.color = T.blue;
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.color = T.dim;
                    }}
                  >
                    {uid.slice(0, 12)}...
                  </div>}
                  
                  {/* Desktop: Role */}
                  {!isMobileView && visibleColumns.role && <div style={{ color: T.muted, fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>Trader</div>}
                  
                  {/* Desktop: Status Pill */}
                  {!isMobileView && visibleColumns.status && <div style={{ 
                    display: "inline-flex", 
                    alignItems: "center", 
                    gap: 8,
                    background: statusBg,
                    border: `1px solid ${statusBorder}`,
                    borderRadius: 20,
                    padding: "6px 12px",
                    width: "fit-content",
                    boxShadow: `0 0 12px ${statusBorder}`
                  }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: statusColor }} />
                    <span style={{ color: statusColor, fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" }}>
                      {normalizedStatus === 'PENDING' ? 'pending' : normalizedStatus === 'ACTIVE' ? 'active' : 'banned'}
                    </span>
                  </div>}
                  
                  {/* RULE #244: IP Fraud Detection Flag */}
                  {(() => {
                    const userIP = user?.forensic?.ip || user?.ip;
                    const duplicateEntry = Object.entries(duplicateIPs).find(([, uids]) => userIP && uids.includes(uid));
                    
                    if (duplicateEntry) {
                      return (
                        <div
                          title={`ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã‚Â¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚Â DUPLICATE IP: ${userIP} shared with ${duplicateEntry[1].length - 1} other user(s)`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            background: 'rgba(255,165,0,0.15)',
                            border: '1px solid rgba(255,165,0,0.5)',
                            borderRadius: 12,
                            padding: '6px 10px',
                            color: '#FFB340',
                            fontSize: 9,
                            fontWeight: 700,
                            letterSpacing: 0.5,
                            whiteSpace: 'nowrap'
                          }}
                        >
                          ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã‚Â¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚Â DUP IP
                        </div>
                      );
                    }
                    return null;
                  })()}
                  
                  {/* Action Buttons - Flex Column on Mobile */}
                  <div style={{ display: "flex", flexDirection: isMobileView ? "column" : "row", gap: 8, justifyContent: isMobileView ? "stretch" : "flex-end", flexWrap: isMobileView ? "nowrap" : "wrap" }}>
                    {normalizedStatus === 'PENDING' && (
                      <button 
                        onClick={e => { e.stopPropagation(); approve(uid); }} 
                        title="Approve User"
                        data-status="pending"
                        style={{ 
                          background: T.green, 
                          border: "none", 
                          borderRadius: 4, 
                          padding: isMobileView ? "10px 12px" : "7px 12px", 
                          cursor: "pointer", 
                          color: "#000", 
                          fontSize: 11,
                          fontWeight: 700,
                          transition: "all 0.2s ease",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          letterSpacing: 0.5
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.boxShadow = `0 0 16px ${T.green}`;
                          e.currentTarget.style.transform = "scale(1.05)";
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.boxShadow = "none";
                          e.currentTarget.style.transform = "scale(1)";
                        }}
                        className="btn-glass"
                      >
                        ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œ APPROVE
                      </button>
                    )}
                    {normalizedStatus !== 'BLOCKED' && (
                      <button 
                        onClick={e => { e.stopPropagation(); if (window.confirm(`Ban ${user.fullName}? This cannot be undone.`)) block(uid); }} 
                        title="Ban User"
                        style={{ 
                          background: "transparent", 
                          border: `1.5px solid ${T.red}`, 
                          borderRadius: 4, 
                          padding: isMobileView ? "10px 12px" : "6px 12px", 
                          cursor: "pointer", 
                          color: T.red, 
                          fontSize: 11,
                          fontWeight: 700,
                          transition: "all 0.2s ease",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          letterSpacing: 0.5
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.background = `rgba(255,69,58,0.2)`;
                          e.currentTarget.style.boxShadow = `0 0 12px rgba(255,69,58,0.5)`;
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = "transparent";
                          e.currentTarget.style.boxShadow = "none";
                        }}
                        className="btn-glass"
                      >
                        ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢ BAN
                      </button>
                    )}
                    {normalizedStatus === 'BLOCKED' && (
                      <button 
                        onClick={e => { e.stopPropagation(); approve(uid); }} 
                        title="Restore User"
                        style={{ 
                          background: "transparent", 
                          border: `1.5px solid ${T.gold}`, 
                          borderRadius: 4, 
                          padding: isMobileView ? "10px 12px" : "6px 12px", 
                          cursor: "pointer", 
                          color: T.gold, 
                          fontSize: 11,
                          fontWeight: 700,
                          transition: "all 0.2s ease",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          letterSpacing: 0.5
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.background = `rgba(255,214,10,0.2)`;
                          e.currentTarget.style.boxShadow = `0 0 12px rgba(255,214,10,0.5)`;
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = "transparent";
                          e.currentTarget.style.boxShadow = "none";
                        }}
                        className="btn-glass"
                      >
                        ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â Ãƒâ€šÃ‚Âº RESTORE
                      </button>
                    )}
                    {/* RULE #24: View Identity Documents */}
                    <button 
                      onClick={e => { 
                        e.stopPropagation(); 
                        setSelectedUserDocs(uid);
                      }} 
                      title="View uploaded identity documents"
                      style={{ 
                        background: "rgba(52,199,89,0.2)", 
                        border: `1.5px solid ${T.green}`, 
                        borderRadius: 4, 
                        padding: isMobileView ? "10px 12px" : "6px 12px", 
                        cursor: "pointer", 
                        color: T.green, 
                        fontSize: 11,
                        fontWeight: 700,
                        transition: "all 0.2s ease",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        letterSpacing: 0.5
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = `rgba(52,199,89,0.3)`;
                        e.currentTarget.style.boxShadow = `0 0 12px rgba(52,199,89,0.5)`;
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = "rgba(52,199,89,0.2)";
                        e.currentTarget.style.boxShadow = "none";
                      }}
                      className="btn-glass"
                    >
                      ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾ DOCS
                    </button>
                    {/* RULE #244, #246, #247, #266, #270: Direct Support Chat */}
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        setChatWith(uid);
                        setChatModalOpen(true);
                      }}
                      title="Open direct chat with trader"
                      style={{
                        background: 'rgba(0,122,255,0.2)',
                        border: '1.5px solid #0A84FF',
                        borderRadius: 4,
                        padding: isMobileView ? '10px 12px' : '6px 12px',
                        cursor: 'pointer',
                        color: '#0A84FF',
                        fontSize: 11,
                        fontWeight: 700,
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        letterSpacing: 0.5,
                        whiteSpace: 'nowrap'
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = 'rgba(0,122,255,0.3)';
                        e.currentTarget.style.boxShadow = '0 0 12px rgba(0,122,255,0.5)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = 'rgba(0,122,255,0.2)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                      className="btn-glass"
                    >
                      ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢Ãƒâ€šÃ‚Â¬ MSG
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
  );
}

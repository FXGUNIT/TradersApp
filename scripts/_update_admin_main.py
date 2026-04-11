#!/usr/bin/env python3
"""Update AdminDashboardScreen.jsx to use extracted sub-components."""
import os

BASE = 'e:/TradersApp/src/features/admin-security/'
MAIN = BASE + 'AdminDashboardScreen.jsx'

with open(MAIN, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Build new file:
# 1. Keep lines 1-591 (all hooks, state, effects, computed values)
# 2. Remove lines 592-3133 (the extracted JSX sections)
# 3. Replace with composed component usage

hooks_and_state = ''.join(lines[:591])  # lines 1-591
# Remove the extracted sections
# sections to keep: nothing between 592-3133 (all extracted)

new_return = r"""
  return (
    <div
      style={{
        minHeight: "100vh",
        background: T.bg,
        color: T.text,
        fontFamily: T.font,
        animation: "fadeInDashboard 0.6s ease-out",
      }}
    >
      <AdminDashboardHeader
        T={T} LED={LED} ADMIN_EMAIL={ADMIN_EMAIL}
        filterStatus={filterStatus} setFilterStatus={setFilterStatus}
        statusCounts={statusCounts}
        groupByStatus={groupByStatus} setGroupByStatus={setGroupByStatus}
        showAdvancedFilter={showAdvancedFilter} setShowAdvancedFilter={setShowAdvancedFilter}
        maintenanceModeActive={maintenanceModeActive}
        handleToggleMaintenanceMode={handleToggleMaintenanceMode}
        onLogout={onLogout} loading={loading}
        notificationCenterOpen={notificationCenterOpen} setNotificationCenterOpen={setNotificationCenterOpen}
        notifications={notifications}
        chatModalOpen={chatModalOpen} setChatModalOpen={setChatModalOpen}
        chatWith={chatWith} setChatWith={setChatWith}
        auth={auth} SupportChatModal={SupportChatModal}
        currentViewAsUser={currentViewAsUser} setCurrentViewAsUser={setCurrentViewAsUser}
        megaMenuOpen={megaMenuOpen} setMegaMenuOpen={setMegaMenuOpen}
        commandPaletteOpen={commandPaletteOpen} setCommandPaletteOpen={setCommandPaletteOpen}
        users={users} showToast={showToast} setLoading={setLoading} setDbError={setDbError}
      />

      {/* Data Table & Mirror Layout */}
      <div style={{ display: "flex", height: "calc(100vh - 75px - 48px)", flexWrap: "wrap" }}>
        <AdminDashboardTable
          T={T} LED={LED} SHead={SHead} cardS={cardS} AMD_PHASES={AMD_PHASES}
          users={users} loading={loading} dbError={dbError}
          mirror={mirror} statusColor={statusColor} normalizeStatus={normalizeStatus}
          visibleColumns={visibleColumns} setVisibleColumns={setVisibleColumns}
          rowDensity={rowDensity} setRowDensity={setRowDensity}
          rowsPerPage={rowsPerPage} setRowsPerPage={setRowsPerPage}
          currentPage={currentPage} setCurrentPage={setCurrentPage}
          totalResults={totalResults} totalPages={totalPages} validPage={validPage}
          startIdx={startIdx} endIdx={endIdx}
          paginatedUsers={paginatedUsers} searchFilteredUsers={searchFilteredUsers}
          searchQuery={searchQuery} setSearchQuery={setSearchQuery}
          balanceFilter={balanceFilter} setBalanceFilter={setBalanceFilter}
          showAdvancedFilter={showAdvancedFilter}
          TableSkeletonLoader={TableSkeletonLoader} EmptyStateCard={EmptyStateCard}
          duplicateIPs={duplicateIPs}
          sortedUserList={sortedUserList}
          approve={approve} block={block} openMirror={openMirror}
          setSelectedUserDocs={setSelectedUserDocs}
          setChatWith={setChatWith} setChatModalOpen={setChatModalOpen}
          listAdminUsers={listAdminUsers} setLoading={setLoading}
          setDbError={setDbError} setUsers={setUsers} showToast={showToast}
        />

        <AdminMirrorPanel
          T={T} LED={LED} SHead={SHead} cardS={cardS} AMD_PHASES={AMD_PHASES}
          mirror={mirror} mirrorData={mirrorData}
          setMirror={setMirror} setMirrorData={setMirrorData}
          statusColor={statusColor}
        />

        <AdminUserDocsModal
          T={T}
          selectedUserDocs={selectedUserDocs} setSelectedUserDocs={setSelectedUserDocs}
          searchFilteredUsers={searchFilteredUsers} authBtn={authBtn}
        />

        <BackToTopButton theme={T} />
      </div>
    </div>
  );
}
"""

new_content = hooks_and_state + new_return

with open(MAIN, 'w', encoding='utf-8') as f:
    f.write(new_content)

new_lines = new_content.count('\n') + 1
print(f"Updated AdminDashboardScreen.jsx: {new_lines} lines")

# Verify
if new_lines <= 300:
    print("SUCCESS: File is now under 300 lines!")
else:
    print(f"WARNING: Still {new_lines} lines (limit is 300)")

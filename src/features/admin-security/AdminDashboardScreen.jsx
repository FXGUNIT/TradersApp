/* eslint-disable */
import { useEffect, useMemo, useState } from "react";
import {
  Home, Shield, Users, Search, X, DollarSign, Wrench, Bell, Clock,
} from "lucide-react";
import NotificationCenter from "../../components/NotificationCenter.jsx";
import CommandPalette from "../../components/CommandPalette.jsx";
import UserSwitcher from "../../components/UserSwitcher.jsx";
import FullScreenToggle from "../../components/FullScreenToggle.jsx";
import MobileBottomNav from "../../components/MobileBottomNav.jsx";
import LoadingOverlay from "../../components/LoadingOverlay.jsx";
import { useUserList } from "./UserListContext.jsx";
import { Breadcrumbs, MegaMenu, BackToTopButton } from "../shell/ShellPrimitives.jsx";
import { getTimeBasedGreeting, getUserLevelBadge } from "../../utils/userUtils.js";
import { triggerConfetti } from "../../utils/uiUtils.js";
import {
  copyToClipboard,
  fuzzySearchScore,
  renderHighlightedText,
} from "../../utils/searchUtils.jsx";
import { detectDuplicateIPs as scanDuplicateIPs } from "../../services/ipScanner.js";
import useAdminSecuritySentinel from "./useAdminSecuritySentinel.js";

export default function AdminDashboardScreen({
  auth,
  onLogout,
  isAdminAuthenticated,
  showToast,
  maintenanceModeActive,
  handleToggleMaintenanceMode,
  T,
  authBtn,
  ADMIN_UID,
  ADMIN_EMAIL,
  listAdminUsers,
  approveAdminUser,
  blockAdminUser,
  AMD_PHASES,
  LED,
  SHead,
  TableSkeletonLoader,
  EmptyStateCard,
  SupportChatModal,
}) {
  // Import global user list from context
  const { users, setUsers, loading, setLoading, dbError, setDbError } =
    useUserList();
  // Phase 1: Gate alerts bell to only show when there are pending approvals
  const hasPendingApprovals = useMemo(() => {
    if (!users) return false;
    const arr = Object.values(users);
    return arr.some((u) => {
      const s = u && u.status ? String(u.status) : "";
      return s.toUpperCase() === "PENDING";
    });
  }, [users]);

  // ALL HOOKS MUST BE AT THE TOP (Before any conditional checks)
  const [, _setUsers] = useState({});
  const [mirror, setMirror] = useState(null);
  const [mirrorData, setMirrorData] = useState(null);
  const [, setActionMsg] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // RULE #39, #40, #50: Grid Control - Row Density, Pagination, Column Picker
  const [rowDensity, setRowDensity] = useState("comfortable"); // 'compact' or 'comfortable'
  const [rowsPerPage, setRowsPerPage] = useState(10); // 10, 50, or 100
  const [currentPage, setCurrentPage] = useState(1); // Pagination page number
  const [visibleColumns, setVisibleColumns] = useState({
    name: true,
    email: true,
    joinDate: true,
    status: true,
    uid: false,
    role: false,
  });

  // RULE #56, #58: Grouping & Advanced Filtering
  const [groupByStatus, setGroupByStatus] = useState(false); // Toggle to group by status
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false); // Toggle advanced filter panel
  const [balanceFilter, setBalanceFilter] = useState({ min: 0, max: Infinity }); // Balance range filter

  // MODULE 4: Command Center & Navigation (#99, #109, #111)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false); // Toggle command palette
  const [currentViewAsUser, setCurrentViewAsUser] = useState(null); // Shadow mode: view as another user

  // MODULE 5: Navigation Hierarchy (#91, #92, #94, #95, #105, #108)
  const [megaMenuOpen, setMegaMenuOpen] = useState(false); // Toggle Mega Menu

  // MODULE 7: Mobile & Layout Integrity (#113, #116, #118, #119, #120)
  const [notificationCenterOpen, setNotificationCenterOpen] = useState(false); // Toggle notification center
  // If there are no pending approvals, keep the notification center closed
  useEffect(() => {
    if (notificationCenterOpen && !hasPendingApprovals) {
      setNotificationCenterOpen(false);
    }
  }, [notificationCenterOpen, hasPendingApprovals]);
  const [currentMobilePage, setCurrentMobilePage] = useState("users"); // Current mobile nav page
  const [notifications] = useState([]); // loaded from Firebase in production

  // MODULE 8: Visual Polish & Experience (#121, #126, #134, #137, #138)

  // RULE #313: Session Recovery - Restore modal state from sessionStorage
  const [selectedUserDocs, setSelectedUserDocs] = useState(() => {
    try {
      const saved = sessionStorage.getItem("TradersApp_SelectedUserDocs");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // RULE #244, #246, #247, #266, #270: Support chat modal state with session recovery
  const [chatModalOpen, setChatModalOpen] = useState(() => {
    try {
      const saved = sessionStorage.getItem("TradersApp_ChatModalOpen");
      return saved === "true";
    } catch {
      return false;
    }
  });

  const [chatWith, setChatWith] = useState(() => {
    try {
      const saved = sessionStorage.getItem("TradersApp_ChatWith");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [duplicateIPs, setDuplicateIPs] = useState({});

  // RULE #310: Scroll-spy for menu items - track which section user is viewing
  const [activeSection, setActiveSection] = useState("users");
  const { recordAdminActivity } = useAdminSecuritySentinel({
    auth,
    isAdminAuthenticated,
    adminUid: ADMIN_UID,
    showToast,
  });

  // ═══════════════════════════════════════════════════════════════════
  // SCROLL-SPY: Highlight menu item matching current view
  // ═══════════════════════════════════════════════════════════════════
  useEffect(() => {
    const handleScroll = () => {
      const sections = [
        { id: "users", offset: 0 },
        {
          id: "stats",
          offset: document.getElementById("admin-stats")?.offsetTop || 2000,
        },
        {
          id: "settings",
          offset: document.getElementById("admin-settings")?.offsetTop || 4000,
        },
      ];

      const scrollPos = window.scrollY + 100; // Offset for header
      let currentSection = "users";

      for (let i = sections.length - 1; i >= 0; i--) {
        if (scrollPos >= sections[i].offset) {
          currentSection = sections[i].id;
          break;
        }
      }

      setActiveSection(currentSection);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // RULE #244: IP Fraud Detection - Detect users sharing same IP address

  // RULE #313: Save modal states to sessionStorage for session recovery
  useEffect(() => {
    try {
      sessionStorage.setItem(
        "TradersApp_SelectedUserDocs",
        JSON.stringify(selectedUserDocs),
      );
    } catch {
      // Fail silently in private mode
    }
  }, [selectedUserDocs]);

  useEffect(() => {
    try {
      sessionStorage.setItem(
        "TradersApp_ChatModalOpen",
        chatModalOpen.toString(),
      );
    } catch {
      // Fail silently in private mode
    }
  }, [chatModalOpen]);

  useEffect(() => {
    try {
      sessionStorage.setItem("TradersApp_ChatWith", JSON.stringify(chatWith));
    } catch {
      // Fail silently in private mode
    }
  }, [chatWith]);

  // ═══════════════════════════════════════════════════════════════════
  // MODULE 6: PERFORMANCE & CONNECTIVITY - DATA OPTIMIZATION
  // ═══════════════════════════════════════════════════════════════════

  // RULE #154: Search Debouncing - Wait 300ms after last keystroke before filtering
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");

  useEffect(() => {
    // Timer ID for debounce cleanup
    const timerRef = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300); // 300ms debounce delay

    // Cleanup: Cancel the previous timer if component unmounts or searchQuery changes
    return () => clearTimeout(timerRef);
  }, [searchQuery]);

  useEffect(() => {
    if (!isAdminAuthenticated && !auth?.token) return;
    let active = true;
    let intervalId = null;

    const applyUsersPayload = (payload) => {
      const usersData = Array.isArray(payload)
        ? payload.reduce((acc, user) => {
            if (user?.uid) {
              acc[user.uid] = user;
            }
            return acc;
          }, {})
        : payload && typeof payload === "object"
          ? payload.users && typeof payload.users === "object"
            ? payload.users
            : payload
          : {};

      if (!active) return;
      setUsers(usersData);
      setLoading(false);
      setDbError("");
    };

    const loadUsers = async ({ background = false } = {}) => {
      if (!background) {
        setLoading(true);
      }
      setDbError("");

      if (listAdminUsers) {
        try {
          const response = await listAdminUsers();
          if (!active) return;

          if (response?.success === false) {
            throw new Error(response.error || "Failed to load admin users.");
          }

          applyUsersPayload(response?.users || response?.data || response);
          return;
        } catch (error) {
          if (!active) return;
          console.warn("Admin client user load failed, falling back:", error);
        }
      }

      if (!active) return;
      if (!background) {
        setUsers({});
      }
      setLoading(false);
      setDbError("Admin user list unavailable.");
    };

    void loadUsers();
    intervalId = window.setInterval(() => {
      void loadUsers({ background: true });
    }, 10000);

    return () => {
      active = false;
      if (intervalId) {
        window.clearInterval(intervalId);
      }
    };
  }, [isAdminAuthenticated, auth?.token, setUsers, setLoading, setDbError]);

  // RULE #99: Keyboard listener for Command Palette (Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl+K or Cmd+K opens command palette
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen(!commandPaletteOpen);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [commandPaletteOpen]);

  // RULE #244, #246, #247, #266, #270: Detect duplicate IPs for fraud detection
  useEffect(() => {
    if (users && typeof users === "object") {
      const duplicates = scanDuplicateIPs(users);
      setDuplicateIPs(duplicates);
    }
  }, [users]);

  // ═══════════════════════════════════════════════════════════════════
  // ADMIN ACTIVITY TRACKING - Layer 3: Anti-Hacker Sentinel
  // ═══════════════════════════════════════════════════════════════════
  /**
   * Record admin action for click speed detection
   * If clicks exceed 5/second, auto-lock admin panel
   */
  const approve = async (uid) => {
    // Record admin activity
    if (!recordAdminActivity("APPROVE_USER", uid)) return;

    try {
      const result = approveAdminUser
        ? await approveAdminUser(uid, auth?.uid || ADMIN_UID)
        : null;
      if (result?.success === false) {
        throw new Error(result.error || "Approval failed.");
      }

      if (result?.user?.uid) {
        setUsers((current) => ({
          ...(current || {}),
          [result.user.uid]: {
            ...(current?.[result.user.uid] || {}),
            ...result.user,
          },
        }));
      }
      setActionMsg(`✓ User ${uid.slice(0, 8)}... APPROVED`);
      showToast(
        `Authorization granted. User ${uid.slice(0, 8)}... now have system access.`,
        "success",
      );

      // RULE #123: Confetti Success Animation on approval
      triggerConfetti(40, 2.5);

      // No need to manually reload - onSnapshot listener will update automatically
    } catch {
      showToast(
        "Approval protocol disrupted. Check your authorization vectors.",
        "error",
      );
    }
  };

  const block = async (uid) => {
    try {
      const result = blockAdminUser
        ? await blockAdminUser(uid, auth?.uid || ADMIN_UID)
        : null;
      if (result?.success === false) {
        throw new Error(result.error || "Block failed.");
      }

      if (result?.user?.uid) {
        setUsers((current) => ({
          ...(current || {}),
          [result.user.uid]: {
            ...(current?.[result.user.uid] || {}),
            ...result.user,
          },
        }));
      }
      setActionMsg(`🚫 User ${uid.slice(0, 8)}... BLOCKED`);
      showToast(
        `User ${uid.slice(0, 8)}... removed from active roster. Access revoked.`,
        "warning",
      );
      // No need to manually reload - onSnapshot listener will update automatically
      if (mirror === uid) {
        setMirror(null);
        setMirrorData(null);
      }
    } catch {
      showToast(
        "Block command rejected. User still occupying bandwidth.",
        "error",
      );
    }
  };

  const openMirror = async (uid) => {
    setMirror(uid);
    let data = users?.[uid] || null;
    if (!data && listAdminUsers) {
      try {
        const response = await listAdminUsers();
        if (response?.success !== false) {
          const nextUsers = response?.users || response?.data || response;
          if (Array.isArray(nextUsers)) {
            data = nextUsers.find((user) => user?.uid === uid) || null;
          } else if (
            nextUsers &&
            typeof nextUsers === "object" &&
            nextUsers.users
          ) {
            data = nextUsers.users?.[uid] || null;
          } else if (nextUsers && typeof nextUsers === "object") {
            data = nextUsers?.[uid] || null;
          }
        }
      } catch (error) {
        console.warn("Admin mirror refresh failed:", error);
      }
    }
    setMirrorData(data);
  };

  const statusColor = { ACTIVE: T.green, PENDING: T.gold, BLOCKED: T.red };
  const userList = Object.entries(users || {});
  const getUserSortTimestamp = (userData) => {
    const candidates = [
      userData?.updatedAt,
      userData?.submittedAt,
      userData?.createdAt,
      userData?.approvedAt,
      userData?.blockedAt,
      userData?.lastLoginAt,
      userData?.lastLoginAttempt,
    ];

    for (const candidate of candidates) {
      const timestamp = Date.parse(candidate || "");
      if (Number.isFinite(timestamp)) {
        return timestamp;
      }
    }

    return 0;
  };

  const sortedUserList = [...userList].sort(
    ([leftUid, leftUser], [rightUid, rightUser]) => {
      const timestampDelta =
        getUserSortTimestamp(rightUser) - getUserSortTimestamp(leftUser);
      if (timestampDelta !== 0) {
        return timestampDelta;
      }

      return String(rightUid || "").localeCompare(String(leftUid || ""));
    },
  );

  // Normalize status comparison: case-insensitive
  const normalizeStatus = (status) => {
    if (!status) return "";
    return status.toLowerCase() === "pending"
      ? "PENDING"
      : status.toUpperCase() === "ACTIVE"
        ? "ACTIVE"
        : status.toUpperCase() === "BLOCKED"
          ? "BLOCKED"
          : status.toUpperCase();
  };

  // Filter users by status with proper case-insensitive logic
  const filteredUsers =
    filterStatus === "ALL"
      ? sortedUserList
      : sortedUserList.filter(
          ([, u]) => normalizeStatus(u.status) === filterStatus,
        );

  // RULE #34, #35: Apply fuzzy search filter with scoring and relevance ranking
  // RULE #154: Uses debouncedSearchQuery (300ms debounce) for performance optimization
  const searchFilteredUsers = debouncedSearchQuery.trim()
    ? filteredUsers
        .map(([uid, u]) => {
          const nameScore = fuzzySearchScore(
            debouncedSearchQuery,
            u.fullName || "",
          );
          const emailScore = fuzzySearchScore(
            debouncedSearchQuery,
            u.email || "",
          );
          const maxScore = Math.max(nameScore, emailScore);

          return {
            uid,
            user: u,
            score: maxScore,
            matchedField: nameScore > emailScore ? "name" : "email",
          };
        })
        .filter((item) => item.score >= 0) // Only include matches
        .sort((a, b) => b.score - a.score) // Sort by relevance (highest score first)
        .map((item) => [item.uid, item.user])
    : filteredUsers;

  // RULE #58: Apply Advanced Filter - Balance range filter
  const advancedFilteredUsers = showAdvancedFilter
    ? searchFilteredUsers.filter(([, u]) => {
        const balance = parseFloat(u.accountBalance || 0);
        return balance >= balanceFilter.min && balance <= balanceFilter.max;
      })
    : searchFilteredUsers;

  // Debug: Log if filter results are empty but counts show data
  if (
    filterStatus !== "ALL" &&
    filteredUsers.length === 0 &&
    sortedUserList.length > 0
  ) {
    console.warn(
      `Filter '${filterStatus}' returned 0 results. User statuses in DB:`,
      sortedUserList.map(([, d]) => d.status).filter(Boolean),
    );
  }

  // Calculate status counts using the full sorted list
  const statusCounts = {
    ALL: sortedUserList.length,
    ACTIVE: sortedUserList.filter(
      ([, u]) => normalizeStatus(u.status) === "ACTIVE",
    ).length,
    PENDING: sortedUserList.filter(
      ([, u]) => normalizeStatus(u.status) === "PENDING",
    ).length,
    BLOCKED: sortedUserList.filter(
      ([, u]) => normalizeStatus(u.status) === "BLOCKED",
    ).length,
  };

  // RULE #39, #40, #50: Pagination Logic - Calculate displayed rows
  let finalUsers = advancedFilteredUsers;

  // RULE #56: Group by Status - Organize users into sections
  if (groupByStatus) {
    const grouped = {
      ACTIVE: advancedFilteredUsers.filter(
        ([, u]) => normalizeStatus(u.status) === "ACTIVE",
      ),
      PENDING: advancedFilteredUsers.filter(
        ([, u]) => normalizeStatus(u.status) === "PENDING",
      ),
      BLOCKED: advancedFilteredUsers.filter(
        ([, u]) => normalizeStatus(u.status) === "BLOCKED",
      ),
    };
    // Flatten back to array but preserve grouping order
    finalUsers = [...grouped.ACTIVE, ...grouped.PENDING, ...grouped.BLOCKED];
  }

  const totalResults = finalUsers.length;
  const totalPages = Math.ceil(totalResults / rowsPerPage);
  const validPage = Math.min(currentPage, Math.max(1, totalPages));
  const startIdx = (validPage - 1) * rowsPerPage;
  const endIdx = startIdx + rowsPerPage;
  const paginatedUsers = finalUsers.slice(startIdx, endIdx);

  // Helper function to generate grid template columns based on visible columns
  const getGridTemplateColumns = () => {
    const cols = [];
    if (visibleColumns.name) cols.push("2fr");
    if (visibleColumns.email) cols.push("2fr");
    if (visibleColumns.joinDate) cols.push("1.5fr");
    if (visibleColumns.uid) cols.push("1.5fr");
    if (visibleColumns.role) cols.push("1.2fr");
    if (visibleColumns.status) cols.push("1.2fr");
    cols.push("1fr"); // Actions column always visible
    return cols.join(" ");
  };

  // RULE #283, #285, #290, #294, #299: Mobile detection for responsive action cards
  const isMobileView = typeof window !== "undefined" && window.innerWidth < 768;

  // Helper function to get row padding based on density
  const getRowPadding = () => {
    return rowDensity === "compact" ? "8px 20px" : "14px 20px";
  };


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

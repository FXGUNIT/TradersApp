/* eslint-disable */
import { useEffect, useMemo, useState } from "react";
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
  const [notifications] = useState([
    // Sample notifications
    {
      title: "✓ User Approved",
      message: "John Doe has been approved",
      time: "2 hrs ago",
    },
    {
      title: "🚫 Account Blocked",
      message: "Suspicious activity detected",
      time: "5 hrs ago",
    },
  ]);

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

    const loadUsers = async () => {
      setLoading(true);
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
      setUsers({});
      setLoading(false);
      setDbError("Admin user list unavailable.");
    };

    void loadUsers();
    intervalId = window.setInterval(() => {
      void loadUsers();
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
  const userList = Object.entries(users);

  // Deduplicate users by email, keeping only the most recent entry (by createdAt)
  const uniqueUserMap = {};
  userList.forEach(([uid, userData]) => {
    if (!userData || !userData.email) return; // Skip invalid entries
    const email = userData.email.toLowerCase().trim();

    // If email not seen before, add it
    if (!uniqueUserMap[email]) {
      uniqueUserMap[email] = [uid, userData];
    } else {
      // If email exists, compare createdAt and keep the newer one
      const existingCreatedAt = new Date(
        uniqueUserMap[email][1].createdAt || 0,
      ).getTime();
      const currentCreatedAt = new Date(userData.createdAt || 0).getTime();

      if (currentCreatedAt > existingCreatedAt) {
        uniqueUserMap[email] = [uid, userData];
      }
    }
  });

  // Convert back to array format
  const deduplicatedUserList = Object.values(uniqueUserMap);

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

  // Filter users by status with proper case-insensitive logic (using deduplicated list)
  const filteredUsers =
    filterStatus === "ALL"
      ? deduplicatedUserList
      : deduplicatedUserList.filter(
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
    deduplicatedUserList.length > 0
  ) {
    console.warn(
      `Filter '${filterStatus}' returned 0 results. User statuses in DB:`,
      deduplicatedUserList.map(([, d]) => d.status).filter(Boolean),
    );
  }

  // Calculate status counts using the deduplicated list
  const statusCounts = {
    ALL: deduplicatedUserList.length,
    ACTIVE: deduplicatedUserList.filter(
      ([, u]) => normalizeStatus(u.status) === "ACTIVE",
    ).length,
    PENDING: deduplicatedUserList.filter(
      ([, u]) => normalizeStatus(u.status) === "PENDING",
    ).length,
    BLOCKED: deduplicatedUserList.filter(
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
      {/* RULE #54: Loading Overlay - Shows while syncing with database */}
      <LoadingOverlay isLoading={loading} />

      {/* RULE #119: Notification Center - Sidebar/Overlay */}
      <NotificationCenter
        isOpen={notificationCenterOpen}
        onClose={() => setNotificationCenterOpen(false)}
        notifications={notifications}
      />

      {/* RULE #113: Mobile Bottom Navigation */}
      <MobileBottomNav
        currentPage={currentMobilePage}
        onNavigate={setCurrentMobilePage}
      />

      {/* RULE #99 & #111: Command Palette - Ctrl+K to search users/commands */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        users={Array.isArray(users) ? users : Object.values(users || {})}
        onJumpToUser={(uid) => {
          setCurrentViewAsUser(uid);
          setCommandPaletteOpen(false);
          showToast(`Switched to user: ${uid}`, "info");
        }}
        showToast={showToast}
      />

      {/* RULE #92: Mega Menu for Tools */}
      <MegaMenu
        isOpen={megaMenuOpen}
        onClose={() => setMegaMenuOpen(false)}
        theme={T}
      />
      {/* RULE #244, #246, #247, #266, #270: Support Chat Modal */}
      <SupportChatModal
        isOpen={chatModalOpen}
        userId={chatWith}
        userName={users?.[chatWith]?.fullName || "User"}
        onClose={() => {
          setChatModalOpen(false);
          setChatWith(null);
        }}
        auth={auth}
        showToast={showToast}
      />

      {/* RULE #91: Breadcrumbs Navigation */}
      <Breadcrumbs
        items={[
          { icon: "🏠", label: "Home", path: "/", onNavigate: true },
          { icon: "🛡️", label: "Admin", path: "/admin", onNavigate: true },
          { icon: "👥", label: "Users", path: "/admin/users", active: true },
        ]}
        onNavigate={() => void 0}
        theme={T}
      />

      {/* Admin Dashboard Header */}
      <div
        style={{
          background: "var(--surface-elevated, #FFFFFF)",
          borderBottom: `1px solid #E5E7EB`,
          padding: "16px 32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 16,
          boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)",
        }}
        className="glass-panel"
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <LED color={T.purple} size={12} pulse />
          <div>
            <div
              style={{
                color: T.purple,
                fontSize: 15,
                letterSpacing: 3,
                fontWeight: 800,
              }}
            >
              {getTimeBasedGreeting("Admin").fullGreeting} — GOD MODE
            </div>
            <div
              style={{
                color: T.muted,
                fontSize: 11,
                letterSpacing: 2,
                marginTop: 4,
                fontWeight: 600,
              }}
            >
              MASTER ADMIN DASHBOARD · {ADMIN_EMAIL}
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
            zIndex: 50,
          }}
        >
          {["ALL", "ACTIVE", "PENDING", "BLOCKED"].map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              style={{
                background:
                  filterStatus === status
                    ? `rgba(${status === "ACTIVE" ? "48,209,88" : status === "PENDING" ? "255,214,10" : status === "BLOCKED" ? "255,69,58" : "0,122,255"},0.2)`
                    : "transparent",
                border: `1px solid ${filterStatus === status ? (status === "ACTIVE" ? "rgba(48,209,88,0.6)" : status === "PENDING" ? "rgba(255,214,10,0.6)" : status === "BLOCKED" ? "rgba(255,69,58,0.6)" : "rgba(0,122,255,0.6)") : "rgba(255,255,255,0.2)"}`,
                borderRadius: 6,
                padding: "8px 16px",
                cursor: "pointer",
                color:
                  filterStatus === status
                    ? status === "ACTIVE"
                      ? T.green
                      : status === "PENDING"
                        ? T.gold
                        : status === "BLOCKED"
                          ? T.red
                          : T.blue
                    : T.muted,
                fontFamily: T.font,
                fontSize: 11,
                letterSpacing: 1,
                fontWeight: 700,
                transition: "all 0.2s ease-in-out",
              }}
              onMouseEnter={(e) => {
                if (filterStatus !== status) {
                  e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                  e.currentTarget.style.transform = "translateY(-2px)";
                }
              }}
              onMouseLeave={(e) => {
                if (filterStatus !== status) {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.transform = "translateY(0)";
                }
              }}
              className="btn-glass"
            >
              {status === "ALL"
                ? `${status} (${statusCounts.ALL})`
                : status === "ACTIVE"
                  ? `${status} (${statusCounts.ACTIVE})`
                  : status === "PENDING"
                    ? `${status} (${statusCounts.PENDING})`
                    : `BANNED (${statusCounts.BLOCKED})`}
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
              transition: "all 0.2s ease-in-out",
            }}
            onMouseEnter={(e) => {
              if (!groupByStatus) {
                e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                e.currentTarget.style.transform = "translateY(-2px)";
              }
            }}
            onMouseLeave={(e) => {
              if (!groupByStatus) {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.transform = "translateY(0)";
              }
            }}
            className="btn-glass"
            title="Group users by their status"
          >
            {groupByStatus ? "⊟ Grouped" : "⊞ Group By"}
          </button>

          {/* RULE #58: Advanced Filter Toggle */}
          <button
            onClick={() => setShowAdvancedFilter(!showAdvancedFilter)}
            style={{
              background: showAdvancedFilter
                ? "rgba(0,122,255,0.2)"
                : "transparent",
              border: `1px solid ${showAdvancedFilter ? "rgba(0,122,255,0.5)" : "rgba(255,255,255,0.2)"}`,
              borderRadius: 6,
              padding: "8px 16px",
              cursor: "pointer",
              color: showAdvancedFilter ? T.blue : T.muted,
              fontFamily: T.font,
              fontSize: 11,
              letterSpacing: 1,
              fontWeight: 700,
              transition: "all 0.2s ease-in-out",
            }}
            onMouseEnter={(e) => {
              if (!showAdvancedFilter) {
                e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                e.currentTarget.style.transform = "translateY(-2px)";
              }
            }}
            onMouseLeave={(e) => {
              if (!showAdvancedFilter) {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.transform = "translateY(0)";
              }
            }}
            className="btn-glass"
            title="Show advanced filtering options"
          >
            {showAdvancedFilter ? "⊟ Filters" : "⚙ Filters"}
          </button>

          <button
            onClick={async () => {
              if (!listAdminUsers) {
                setDbError("Admin user list client unavailable.");
                return;
              }

              setLoading(true);
              setDbError("");
              try {
                const response = await listAdminUsers();
                if (response?.success === false) {
                  throw new Error(response.error || "Failed to refresh users.");
                }
                const nextUsers = response?.users || response?.data || response;
                setUsers(
                  Array.isArray(nextUsers)
                    ? nextUsers.reduce((acc, user) => {
                        if (user?.uid) {
                          acc[user.uid] = user;
                        }
                        return acc;
                      }, {})
                    : nextUsers &&
                        typeof nextUsers === "object" &&
                        nextUsers.users &&
                        typeof nextUsers.users === "object"
                      ? nextUsers.users
                      : nextUsers && typeof nextUsers === "object"
                        ? nextUsers
                        : {},
                );
              } catch (error) {
                console.error("Failed to refresh users via client:", error);
                setDbError(
                  `Network Error: ${error.message || "Failed to refresh users"}`,
                );
              } finally {
                setLoading(false);
              }
            }}
            style={{
              background: "transparent",
              border: `1px solid rgba(255,255,255,0.1)`,
              borderRadius: 6,
              padding: "8px 16px",
              cursor: "pointer",
              color: T.muted,
              fontFamily: T.font,
              fontSize: 11,
              letterSpacing: 1,
              fontWeight: 600,
              transition: "all 0.2s ease-in-out",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.05)";
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.3)";
              e.currentTarget.style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
              e.currentTarget.style.transform = "translateY(0)";
            }}
            className="btn-glass"
          >
            ↺ REFRESH
          </button>

          {/* RULE #109 & #111: User Switcher - Shadow Mode */}
          <UserSwitcher
            users={Array.isArray(users) ? users : Object.values(users || {})}
            currentViewAsUser={currentViewAsUser}
            onSwitchUser={setCurrentViewAsUser}
          />

          {/* RULE #94: Mega Menu Tools Button */}
          <button
            onClick={() => setMegaMenuOpen(!megaMenuOpen)}
            style={{
              background: megaMenuOpen ? "rgba(0,122,255,0.2)" : "transparent",
              border: `1px solid ${megaMenuOpen ? "rgba(0,122,255,0.5)" : "rgba(255,255,255,0.2)"}`,
              borderRadius: 6,
              padding: "8px 16px",
              cursor: "pointer",
              color: megaMenuOpen ? T.blue : T.muted,
              fontFamily: T.font,
              fontSize: 11,
              letterSpacing: 1,
              fontWeight: 600,
              transition: "all 0.2s ease-in-out",
            }}
            onMouseEnter={(e) => {
              if (!megaMenuOpen) {
                e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.3)";
                e.currentTarget.style.transform = "translateY(-2px)";
              }
            }}
            onMouseLeave={(e) => {
              if (!megaMenuOpen) {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
                e.currentTarget.style.transform = "translateY(0)";
              }
            }}
            className="btn-glass"
            title="Open Tools Menu"
          >
            🛠️ TOOLS
          </button>

          {/* RULE #119: Notification Center Button */}
          <button
            onClick={() => setNotificationCenterOpen(!notificationCenterOpen)}
            style={{
              background: notificationCenterOpen
                ? "rgba(0,122,255,0.2)"
                : "transparent",
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
              position: "relative",
            }}
            onMouseEnter={(e) => {
              if (!notificationCenterOpen) {
                e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.3)";
                e.currentTarget.style.transform = "translateY(-2px)";
              }
            }}
            onMouseLeave={(e) => {
              if (!notificationCenterOpen) {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)";
                e.currentTarget.style.transform = "translateY(0)";
              }
            }}
            className="btn-glass"
            title="Open Notification Center"
          >
            🔔{" "}
            {notifications.length > 0 && (
              <span
                style={{
                  position: "absolute",
                  top: "0px",
                  right: "2px",
                  background: T.red,
                  color: T.text,
                  borderRadius: "50%",
                  width: "16px",
                  height: "16px",
                  fontSize: "9px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                }}
              >
                {notifications.length}
              </span>
            )}
          </button>

          {/* RULE #101: Full-Screen Toggle */}
          <FullScreenToggle showToast={showToast} />

          {/* RULE #295, #296: Maintenance Mode Toggle */}
          <button
            onClick={handleToggleMaintenanceMode}
            title={
              maintenanceModeActive
                ? "Disable Maintenance Mode"
                : "Enable Maintenance Mode"
            }
            style={{
              background: maintenanceModeActive
                ? "rgba(255,165,0,0.2)"
                : "transparent",
              border: `1px solid ${maintenanceModeActive ? "rgba(255,165,0,0.6)" : "rgba(255,255,255,0.2)"}`,
              borderRadius: 6,
              padding: "8px 16px",
              cursor: "pointer",
              color: maintenanceModeActive ? "#FFB340" : T.muted,
              fontFamily: T.font,
              fontSize: 11,
              letterSpacing: 1,
              fontWeight: 700,
              transition: "all 0.2s ease-in-out",
              animation: maintenanceModeActive
                ? "pulse 1.5s ease-in-out infinite"
                : "none",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255,165,0,0.3)";
              e.currentTarget.style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = maintenanceModeActive
                ? "rgba(255,165,0,0.2)"
                : "transparent";
              e.currentTarget.style.transform = "translateY(0)";
            }}
            className="btn-glass"
          >
            {maintenanceModeActive ? "⏱️ MAINTENANCE ON" : "⏱️ MAINTENANCE OFF"}
          </button>

          <button
            onClick={onLogout}
            style={{
              background: "rgba(255,69,58,0.1)",
              border: `1px solid rgba(255,69,58,0.3)`,
              borderRadius: 6,
              padding: "8px 16px",
              cursor: "pointer",
              color: T.red,
              fontFamily: T.font,
              fontSize: 11,
              letterSpacing: 1,
              fontWeight: 600,
              transition: "all 0.2s ease-in-out",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255,69,58,0.2)";
              e.currentTarget.style.borderColor = "rgba(255,69,58,0.6)";
              e.currentTarget.style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255,69,58,0.1)";
              e.currentTarget.style.borderColor = "rgba(255,69,58,0.3)";
              e.currentTarget.style.transform = "translateY(0)";
            }}
            className="btn-glass"
          >
            LOGOUT
          </button>
        </div>
      </div>

      {/* RULE #310: Scroll-Spy Navigation Menu */}
      <div
        style={{
          padding: "8px 20px",
          borderBottom: `1px solid rgba(255,255,255,0.1)`,
          background: "rgba(0,0,0,0.3)",
          display: "flex",
          gap: 8,
          overflowX: "auto",
        }}
        className="glass-panel"
      >
        <div
          className={`menu-item ${activeSection === "users" ? "active" : ""}`}
          onClick={() =>
            document
              .getElementById("admin-users")
              ?.scrollIntoView({ behavior: "smooth" })
          }
          style={{
            cursor: "pointer",
            whiteSpace: "nowrap",
            ...(activeSection === "users"
              ? {
                  color: T.blue,
                  background: "rgba(10,132,255,0.15)",
                  borderLeft: `3px solid ${T.blue}`,
                  paddingLeft: "9px",
                }
              : {
                  color: T.muted,
                }),
          }}
        >
          👥 Users
        </div>
      </div>

      {/* Data Table & Mirror Layout */}
      <div
        style={{
          display: "flex",
          height: "calc(100vh - 75px - 48px)",
          flexWrap: "wrap",
        }}
      >
        {/* RULE #92: Left Column - Sticky Sidebar with Professional Data Table */}
        <div
          id="admin-users"
          style={{
            width: mirror ? 440 : "100%",
            flex: mirror ? undefined : 1,
            borderRight: `1px solid rgba(255,255,255,0.1)`,
            overflowY: "auto",
            overflowX: "hidden",
            background: "rgba(0,0,0,0.2)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Search Bar - Sticky Header */}
          <div
            style={{
              padding: "16px 20px",
              borderBottom: `1px solid rgba(255,255,255,0.1)`,
              background: "rgba(20,20,20,0.8)",
              display: "flex",
              alignItems: "center",
              gap: 8,
              position: "sticky",
              top: 0,
              zIndex: 6,
              flexShrink: 0,
            }}
            className="glass-panel"
          >
            <span style={{ color: T.cyan, fontSize: 14, fontWeight: 600 }}>
              🔍
            </span>
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
                transition: "all 0.2s ease-in-out",
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
                onClick={() => setSearchQuery("")}
                style={{
                  background: "transparent",
                  border: "none",
                  color: T.muted,
                  cursor: "pointer",
                  fontSize: 16,
                  padding: 4,
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = T.text)}
                onMouseLeave={(e) => (e.currentTarget.style.color = T.muted)}
              >
                ✕
              </button>
            )}
          </div>

          {/* RULE #58: Advanced Filter Panel - Balance range filter */}
          {showAdvancedFilter && (
            <div
              style={{
                padding: "16px 20px",
                borderBottom: `1px solid rgba(0,122,255,0.2)`,
                background: "rgba(0,122,255,0.08)",
                display: "flex",
                alignItems: "center",
                gap: 16,
                flexWrap: "wrap",
              }}
              className="glass-panel"
            >
              <span
                style={{
                  color: T.blue,
                  fontSize: 10,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: 1,
                }}
              >
                💰 Balance Range:
              </span>

              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{ color: T.muted, fontSize: 10, fontWeight: 600 }}
                  >
                    Min:
                  </span>
                  <input
                    type="number"
                    placeholder="0"
                    value={balanceFilter.min === 0 ? "" : balanceFilter.min}
                    onChange={(e) => {
                      const val =
                        e.target.value === "" ? 0 : parseFloat(e.target.value);
                      setBalanceFilter((prev) => ({
                        ...prev,
                        min: Math.max(0, val),
                      }));
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
                      transition: "all 0.2s ease-in-out",
                    }}
                    onFocus={(e) => {
                      e.target.style.background = "rgba(0,0,0,0.6)";
                      e.target.style.borderColor = "rgba(0,122,255,0.5)";
                    }}
                    onBlur={(e) => {
                      e.target.style.background = "rgba(0,0,0,0.4)";
                      e.target.style.borderColor = "rgba(0,122,255,0.3)";
                    }}
                  />
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{ color: T.muted, fontSize: 10, fontWeight: 600 }}
                  >
                    Max:
                  </span>
                  <input
                    type="number"
                    placeholder="∞"
                    value={
                      balanceFilter.max === Infinity ? "" : balanceFilter.max
                    }
                    onChange={(e) => {
                      const val =
                        e.target.value === ""
                          ? Infinity
                          : parseFloat(e.target.value);
                      setBalanceFilter((prev) => ({ ...prev, max: val }));
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
                      transition: "all 0.2s ease-in-out",
                    }}
                    onFocus={(e) => {
                      e.target.style.background = "rgba(0,0,0,0.6)";
                      e.target.style.borderColor = "rgba(0,122,255,0.5)";
                    }}
                    onBlur={(e) => {
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
                    transition: "all 0.2s ease-in-out",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(0,122,255,0.15)";
                    e.currentTarget.style.borderColor = "rgba(0,122,255,0.5)";
                  }}
                  onMouseLeave={(e) => {
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
          <div
            style={{
              padding: "12px 20px",
              borderBottom: `1px solid rgba(255,255,255,0.1)`,
              background: "rgba(15,15,15,0.8)",
              display: "flex",
              alignItems: "center",
              gap: 16,
              justifyContent: "space-between",
              flexWrap: "wrap",
            }}
            className="glass-panel"
          >
            {/* Left: Row Density Toggle & Rows Per Page */}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {/* Row Density Toggle */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    color: T.muted,
                    fontSize: 10,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                  }}
                >
                  Density:
                </span>
                {["compact", "comfortable"].map((density) => (
                  <button
                    key={density}
                    onClick={() => setRowDensity(density)}
                    style={{
                      background:
                        rowDensity === density
                          ? "rgba(0,122,255,0.2)"
                          : "transparent",
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
                      transition: "all 0.2s ease-in-out",
                    }}
                    onMouseEnter={(e) => {
                      if (rowDensity !== density) {
                        e.currentTarget.style.background =
                          "rgba(255,255,255,0.05)";
                        e.currentTarget.style.borderColor =
                          "rgba(255,255,255,0.3)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (rowDensity !== density) {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.borderColor =
                          "rgba(255,255,255,0.15)";
                      }
                    }}
                  >
                    {density === "compact" ? "⊡ Compact" : "⊞ Comfortable"}
                  </button>
                ))}
              </div>

              {/* Rows Per Page Selector */}
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    color: T.muted,
                    fontSize: 10,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                  }}
                >
                  Rows:
                </span>
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
                    transition: "all 0.2s ease-in-out",
                  }}
                  onFocus={(e) => {
                    e.target.style.background = "rgba(0,0,0,0.6)";
                    e.target.style.borderColor = "rgba(0,122,255,0.5)";
                  }}
                  onBlur={(e) => {
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
              <div
                style={{
                  color: T.muted,
                  fontSize: 10,
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                }}
              >
                {totalResults > 0
                  ? `${startIdx + 1}–${Math.min(endIdx, totalResults)} of ${totalResults}`
                  : "0 results"}
              </div>

              {/* Pagination Controls */}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button
                  onClick={() => setCurrentPage(Math.max(1, validPage - 1))}
                  disabled={validPage === 1}
                  style={{
                    background:
                      validPage === 1
                        ? "rgba(255,255,255,0.08)"
                        : "rgba(59, 130, 246, 0.25)",
                    border: `1px solid ${validPage === 1 ? "rgba(255,255,255,0.15)" : "rgba(59, 130, 246, 0.5)"}`,
                    borderRadius: 6,
                    padding: "8px 14px",
                    cursor: validPage === 1 ? "not-allowed" : "pointer",
                    color:
                      validPage === 1 ? "rgba(255,255,255,0.3)" : "#60A5FA",
                    fontFamily: T.font,
                    fontSize: 18,
                    fontWeight: 700,
                    transition: "all 0.2s ease-in-out",
                    minWidth: "44px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  onMouseEnter={(e) => {
                    if (validPage !== 1) {
                      e.currentTarget.style.background =
                        "rgba(59, 130, 246, 0.4)";
                      e.currentTarget.style.borderColor =
                        "rgba(59, 130, 246, 0.8)";
                      e.currentTarget.style.transform = "scale(1.05)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (validPage !== 1) {
                      e.currentTarget.style.background =
                        "rgba(59, 130, 246, 0.25)";
                      e.currentTarget.style.borderColor =
                        "rgba(59, 130, 246, 0.5)";
                      e.currentTarget.style.transform = "scale(1)";
                    }
                  }}
                >
                  ←
                </button>

                <span
                  style={{
                    color: T.muted,
                    fontSize: 10,
                    fontWeight: 600,
                    minWidth: "40px",
                    textAlign: "center",
                  }}
                >
                  {totalPages > 0 ? `${validPage}/${totalPages}` : "0/0"}
                </span>

                <button
                  onClick={() =>
                    setCurrentPage(Math.min(totalPages, validPage + 1))
                  }
                  disabled={validPage === totalPages}
                  style={{
                    background:
                      validPage === totalPages
                        ? "rgba(255,255,255,0.08)"
                        : "rgba(59, 130, 246, 0.25)",
                    border: `1px solid ${validPage === totalPages ? "rgba(255,255,255,0.15)" : "rgba(59, 130, 246, 0.5)"}`,
                    borderRadius: 6,
                    padding: "8px 14px",
                    cursor:
                      validPage === totalPages ? "not-allowed" : "pointer",
                    color:
                      validPage === totalPages
                        ? "rgba(255,255,255,0.3)"
                        : "#60A5FA",
                    fontFamily: T.font,
                    fontSize: 18,
                    fontWeight: 700,
                    transition: "all 0.2s ease-in-out",
                    minWidth: "44px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  onMouseEnter={(e) => {
                    if (validPage !== totalPages) {
                      e.currentTarget.style.background =
                        "rgba(59, 130, 246, 0.4)";
                      e.currentTarget.style.borderColor =
                        "rgba(59, 130, 246, 0.8)";
                      e.currentTarget.style.transform = "scale(1.05)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (validPage !== totalPages) {
                      e.currentTarget.style.background =
                        "rgba(59, 130, 246, 0.25)";
                      e.currentTarget.style.borderColor =
                        "rgba(59, 130, 246, 0.5)";
                      e.currentTarget.style.transform = "scale(1)";
                    }
                  }}
                >
                  →
                </button>
              </div>

              {/* Column Picker Dropdown */}
              <div style={{ position: "relative" }}>
                <button
                  onClick={(e) => {
                    const menu = e.currentTarget.nextElementSibling;
                    menu.style.display =
                      menu.style.display === "none" ? "block" : "none";
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
                    transition: "all 0.2s ease-in-out",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(0,122,255,0.25)";
                    e.currentTarget.style.borderColor = "rgba(0,122,255,0.5)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(0,122,255,0.15)";
                    e.currentTarget.style.borderColor = "rgba(0,122,255,0.3)";
                  }}
                >
                  ⚙ Columns
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
                    boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {[
                    { key: "name", label: "Name" },
                    { key: "email", label: "Email" },
                    { key: "joinDate", label: "Join Date" },
                    { key: "status", label: "Status" },
                    { key: "uid", label: "UID" },
                    { key: "role", label: "Role" },
                  ].map((col) => (
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
                        userSelect: "none",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background =
                          "rgba(0,122,255,0.15)";
                        e.currentTarget.style.color = T.text;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.color = T.muted;
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={visibleColumns[col.key]}
                        onChange={(e) => {
                          setVisibleColumns((prev) => ({
                            ...prev,
                            [col.key]: e.target.checked,
                          }));
                        }}
                        style={{
                          cursor: "pointer",
                          width: 14,
                          height: 14,
                          accentColor: T.blue,
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
          {!loading &&
            !dbError &&
            paginatedUsers.length > 0 &&
            !isMobileView && (
              <div
                style={{
                  padding: "16px 20px",
                  borderBottom: `1px solid rgba(255,255,255,0.15)`,
                  background: "rgba(20,20,20,0.8)",
                  display: "grid",
                  gridTemplateColumns: getGridTemplateColumns(),
                  gap: 16,
                  position: "sticky",
                  top: 0,
                  zIndex: 5,
                }}
                className="glass-panel"
              >
                {visibleColumns.name && (
                  <div
                    style={{
                      color: T.muted,
                      fontSize: 10,
                      letterSpacing: 1.5,
                      fontWeight: 700,
                      textTransform: "uppercase",
                    }}
                  >
                    Name
                  </div>
                )}
                {visibleColumns.email && (
                  <div
                    style={{
                      color: T.muted,
                      fontSize: 10,
                      letterSpacing: 1.5,
                      fontWeight: 700,
                      textTransform: "uppercase",
                    }}
                  >
                    Email
                  </div>
                )}
                {visibleColumns.joinDate && (
                  <div
                    style={{
                      color: T.muted,
                      fontSize: 10,
                      letterSpacing: 1.5,
                      fontWeight: 700,
                      textTransform: "uppercase",
                    }}
                  >
                    Joined
                  </div>
                )}
                {visibleColumns.uid && (
                  <div
                    style={{
                      color: T.muted,
                      fontSize: 10,
                      letterSpacing: 1.5,
                      fontWeight: 700,
                      textTransform: "uppercase",
                    }}
                  >
                    UID
                  </div>
                )}
                {visibleColumns.role && (
                  <div
                    style={{
                      color: T.muted,
                      fontSize: 10,
                      letterSpacing: 1.5,
                      fontWeight: 700,
                      textTransform: "uppercase",
                    }}
                  >
                    Role
                  </div>
                )}
                {visibleColumns.status && (
                  <div
                    style={{
                      color: T.muted,
                      fontSize: 10,
                      letterSpacing: 1.5,
                      fontWeight: 700,
                      textTransform: "uppercase",
                    }}
                  >
                    Status
                  </div>
                )}
                <div
                  style={{
                    color: T.muted,
                    fontSize: 10,
                    letterSpacing: 1.5,
                    fontWeight: 700,
                    textTransform: "uppercase",
                  }}
                >
                  Actions
                </div>
              </div>
            )}

          {/* Table Body */}
          {loading ? (
            <TableSkeletonLoader />
          ) : dbError ? (
            <div
              style={{
                padding: "60px 40px",
                textAlign: "center",
                color: T.red,
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              <div style={{ marginBottom: 16, fontSize: 20 }}>⚠️</div>
              <div style={{ marginBottom: 20, fontSize: 13, lineHeight: 1.6 }}>
                {dbError}
              </div>
              <button
                onClick={async () => {
                  if (!listAdminUsers) {
                    setDbError("Admin user list client unavailable.");
                    return;
                  }

                  setLoading(true);
                  setDbError("");
                  try {
                    const response = await listAdminUsers();
                    if (response?.success === false) {
                      throw new Error(response.error || "Failed to retry.");
                    }
                    const nextUsers =
                      response?.users || response?.data || response;
                    setUsers(
                      Array.isArray(nextUsers)
                        ? nextUsers.reduce((acc, user) => {
                            if (user?.uid) {
                              acc[user.uid] = user;
                            }
                            return acc;
                          }, {})
                        : nextUsers &&
                            typeof nextUsers === "object" &&
                            nextUsers.users &&
                            typeof nextUsers.users === "object"
                          ? nextUsers.users
                          : nextUsers && typeof nextUsers === "object"
                            ? nextUsers
                            : {},
                    );
                  } catch (error) {
                    console.error("Failed to retry via client:", error);
                    setDbError(
                      `Network Error: ${error.message || "Failed to retry"}`,
                    );
                  } finally {
                    setLoading(false);
                  }
                }}
                style={{
                  marginTop: 16,
                  background: "rgba(255,69,58,0.2)",
                  border: `1px solid rgba(255,69,58,0.4)`,
                  borderRadius: 6,
                  padding: "10px 20px",
                  cursor: "pointer",
                  color: T.red,
                  fontSize: 12,
                  fontFamily: T.font,
                  letterSpacing: 1,
                  fontWeight: 700,
                  transition: "all 0.2s ease-in-out",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(255,69,58,0.3)";
                  e.currentTarget.style.boxShadow = `0 0 16px rgba(255,69,58,0.4)`;
                  e.currentTarget.style.transform = "translateY(-2px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(255,69,58,0.2)";
                  e.currentTarget.style.boxShadow = "none";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
                className="btn-glass"
              >
                ↺ RETRY
              </button>
            </div>
          ) : totalResults === 0 ? (
            <>
              <EmptyStateCard
                searchQuery={searchQuery}
                filterStatus={filterStatus}
              />
              {(searchQuery ||
                filterStatus !== "ALL" ||
                showAdvancedFilter) && (
                <div style={{ textAlign: "center", paddingBottom: "40px" }}>
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      if (filterStatus !== "ALL") setFilterStatus("ALL");
                      if (showAdvancedFilter) setShowAdvancedFilter(false);
                      setBalanceFilter({ min: 0, max: Infinity });
                    }}
                    style={{
                      background: "rgba(0,122,255,0.2)",
                      border: `1px solid rgba(0,122,255,0.4)`,
                      borderRadius: 6,
                      padding: "10px 20px",
                      cursor: "pointer",
                      color: T.blue,
                      fontSize: 11,
                      fontFamily: T.font,
                      letterSpacing: 1,
                      fontWeight: 700,
                      transition: "all 0.2s ease-in-out",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "rgba(0,122,255,0.3)";
                      e.currentTarget.style.borderColor = "rgba(0,122,255,0.6)";
                      e.currentTarget.style.transform = "translateY(-2px)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "rgba(0,122,255,0.2)";
                      e.currentTarget.style.borderColor = "rgba(0,122,255,0.4)";
                      e.currentTarget.style.transform = "translateY(0)";
                    }}
                    className="btn-glass"
                  >
                    ← CLEAR ALL FILTERS
                  </button>
                </div>
              )}
            </>
          ) : (
            paginatedUsers.map(([uid, user]) => {
              if (!user || !user.fullName || !user.status) return null;

              const joinDate = user.createdAt
                ? new Date(user.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "2-digit",
                  })
                : "—";
              const normalizedStatus = normalizeStatus(user.status);
              const statusBg =
                normalizedStatus === "ACTIVE"
                  ? "rgba(48,209,88,0.15)"
                  : normalizedStatus === "PENDING"
                    ? "rgba(255,214,10,0.15)"
                    : "rgba(255,69,58,0.15)";
              const statusBorder =
                normalizedStatus === "ACTIVE"
                  ? "rgba(48,209,88,0.5)"
                  : normalizedStatus === "PENDING"
                    ? "rgba(255,214,10,0.5)"
                    : "rgba(255,69,58,0.5)";
              const statusColor =
                normalizedStatus === "ACTIVE"
                  ? T.green
                  : normalizedStatus === "PENDING"
                    ? T.gold
                    : T.red;

              return (
                <div
                  key={uid}
                  style={{
                    padding: isMobileView ? "16px 12px" : getRowPadding(),
                    borderBottom: `1px solid rgba(255,255,255,0.1)`,
                    background:
                      mirror === uid
                        ? "rgba(191,90,242,0.12)"
                        : "rgba(255,255,255,0.01)",
                    display: isMobileView ? "flex" : "grid",
                    flexDirection: isMobileView ? "column" : undefined,
                    gridTemplateColumns: isMobileView
                      ? undefined
                      : getGridTemplateColumns(),
                    gap: isMobileView ? 12 : 16,
                    alignItems: isMobileView ? "stretch" : "center",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    backdropFilter: "blur(10px)",
                    borderLeft:
                      mirror === uid
                        ? `3px solid ${T.purple}`
                        : "3px solid transparent",
                  }}
                  onMouseEnter={(e) => {
                    if (!isMobileView) {
                      e.currentTarget.style.background =
                        "rgba(255,255,255,0.05)";
                      e.currentTarget.style.borderBottom = `1px solid rgba(255,255,255,0.2)`;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isMobileView) {
                      e.currentTarget.style.background =
                        mirror === uid
                          ? "rgba(191,90,242,0.12)"
                          : "rgba(255,255,255,0.01)";
                      e.currentTarget.style.borderBottom = `1px solid rgba(255,255,255,0.1)`;
                    }
                  }}
                  onClick={() => openMirror(uid)}
                  className="glass-panel"
                >
                  {/* Mobile Card Header - Name + Status */}
                  {isMobileView && (
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: 12,
                        paddingBottom: 8,
                        borderBottom: "1px solid rgba(255,255,255,0.1)",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            marginBottom: 4,
                          }}
                        >
                          <div
                            style={{
                              color: T.text,
                              fontSize: 12,
                              fontWeight: 600,
                            }}
                          >
                            {searchQuery
                              ? renderHighlightedText(
                                  user.fullName,
                                  searchQuery,
                                )
                              : user.fullName}
                          </div>
                          {(() => {
                            const badge = getUserLevelBadge(user);
                            return (
                              <div
                                style={{
                                  background: badge.bg,
                                  border: `1px solid ${badge.color}`,
                                  borderRadius: 12,
                                  padding: "2px 8px",
                                  color: badge.color,
                                  fontSize: 9,
                                  fontWeight: 700,
                                  letterSpacing: 0.5,
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {badge.level}
                              </div>
                            );
                          })()}
                        </div>
                        <div
                          style={{ color: T.dim, fontSize: 10, marginTop: 2 }}
                        >
                          📊 {user.proficiency || "unknown"}
                        </div>
                      </div>
                      <div
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          background: statusBg,
                          border: `1px solid ${statusBorder}`,
                          borderRadius: 16,
                          padding: "4px 10px",
                          width: "fit-content",
                          boxShadow: `0 0 8px ${statusBorder}`,
                        }}
                      >
                        <div
                          style={{
                            width: 5,
                            height: 5,
                            borderRadius: "50%",
                            background: statusColor,
                          }}
                        />
                        <span
                          style={{
                            color: statusColor,
                            fontSize: 9,
                            fontWeight: 700,
                            letterSpacing: 0.5,
                            textTransform: "uppercase",
                          }}
                        >
                          {normalizedStatus === "PENDING"
                            ? "pending"
                            : normalizedStatus === "ACTIVE"
                              ? "active"
                              : "banned"}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Desktop: Name */}
                  {!isMobileView && visibleColumns.name && (
                    <div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          marginBottom: 4,
                        }}
                      >
                        <div
                          style={{
                            color: T.text,
                            fontSize: 12,
                            fontWeight: 600,
                          }}
                        >
                          {searchQuery
                            ? renderHighlightedText(user.fullName, searchQuery)
                            : user.fullName}
                        </div>
                        {(() => {
                          const badge = getUserLevelBadge(user);
                          return (
                            <div
                              style={{
                                background: badge.bg,
                                border: `1px solid ${badge.color}`,
                                borderRadius: 12,
                                padding: "2px 8px",
                                color: badge.color,
                                fontSize: 9,
                                fontWeight: 700,
                                letterSpacing: 0.5,
                                whiteSpace: "nowrap",
                              }}
                            >
                              {badge.level}
                            </div>
                          );
                        })()}
                      </div>
                      <div style={{ color: T.dim, fontSize: 10, marginTop: 2 }}>
                        📊 {user.proficiency || "unknown"}
                      </div>
                    </div>
                  )}

                  {/* Mobile: Info Row */}
                  {isMobileView && (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                        fontSize: 10,
                        color: T.muted,
                      }}
                    >
                      {visibleColumns.email && (
                        <div style={{ fontFamily: T.mono, letterSpacing: 0.5 }}>
                          📧 {user.email || "—"}
                        </div>
                      )}
                      {visibleColumns.joinDate && (
                        <div style={{ fontFamily: T.mono, letterSpacing: 0.5 }}>
                          📅 {joinDate}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Desktop: Email */}
                  {!isMobileView && visibleColumns.email && (
                    <div
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
                        borderRadius: 3,
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        copyToClipboard(user.email, "Email", showToast);
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background =
                          "rgba(0,122,255,0.15)";
                        e.currentTarget.style.color = T.blue;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.color = T.muted;
                      }}
                      title="Click to copy email"
                    >
                      {searchQuery
                        ? renderHighlightedText(user.email || "—", searchQuery)
                        : user.email || "—"}
                    </div>
                  )}

                  {/* Desktop: Join Date */}
                  {!isMobileView && visibleColumns.joinDate && (
                    <div
                      style={{
                        color: T.muted,
                        fontSize: 11,
                        fontFamily: T.mono,
                        letterSpacing: 0.5,
                      }}
                    >
                      {joinDate}
                    </div>
                  )}

                  {/* Desktop: UID */}
                  {!isMobileView && visibleColumns.uid && (
                    <div
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
                        borderRadius: 3,
                      }}
                      title={`Click to copy UID: ${uid}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        copyToClipboard(uid, "UID", showToast);
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background =
                          "rgba(0,122,255,0.15)";
                        e.currentTarget.style.color = T.blue;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.color = T.dim;
                      }}
                    >
                      {uid.slice(0, 12)}...
                    </div>
                  )}

                  {/* Desktop: Role */}
                  {!isMobileView && visibleColumns.role && (
                    <div
                      style={{
                        color: T.muted,
                        fontSize: 10,
                        fontWeight: 600,
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                      }}
                    >
                      Trader
                    </div>
                  )}

                  {/* Desktop: Status Pill */}
                  {!isMobileView && visibleColumns.status && (
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                        background: statusBg,
                        border: `1px solid ${statusBorder}`,
                        borderRadius: 20,
                        padding: "6px 12px",
                        width: "fit-content",
                        boxShadow: `0 0 12px ${statusBorder}`,
                      }}
                    >
                      <div
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          background: statusColor,
                        }}
                      />
                      <span
                        style={{
                          color: statusColor,
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: 0.5,
                          textTransform: "uppercase",
                        }}
                      >
                        {normalizedStatus === "PENDING"
                          ? "pending"
                          : normalizedStatus === "ACTIVE"
                            ? "active"
                            : "banned"}
                      </span>
                    </div>
                  )}

                  {/* RULE #244: IP Fraud Detection Flag */}
                  {(() => {
                    const userIP = user?.forensic?.ip || user?.ip;
                    const duplicateEntry = Object.entries(duplicateIPs).find(
                      ([, uids]) => userIP && uids.includes(uid),
                    );

                    if (duplicateEntry) {
                      return (
                        <div
                          title={`⚠️ DUPLICATE IP: ${userIP} shared with ${duplicateEntry[1].length - 1} other user(s)`}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            background: "rgba(255,165,0,0.15)",
                            border: "1px solid rgba(255,165,0,0.5)",
                            borderRadius: 12,
                            padding: "6px 10px",
                            color: "#FFB340",
                            fontSize: 9,
                            fontWeight: 700,
                            letterSpacing: 0.5,
                            whiteSpace: "nowrap",
                          }}
                        >
                          ⚠️ DUP IP
                        </div>
                      );
                    }
                    return null;
                  })()}

                  {/* Action Buttons - Flex Column on Mobile */}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: isMobileView ? "column" : "row",
                      gap: 8,
                      justifyContent: isMobileView ? "stretch" : "flex-end",
                      flexWrap: isMobileView ? "nowrap" : "wrap",
                    }}
                  >
                    {normalizedStatus === "PENDING" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          approve(uid);
                        }}
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
                          letterSpacing: 0.5,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.boxShadow = `0 0 16px ${T.green}`;
                          e.currentTarget.style.transform = "scale(1.05)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.boxShadow = "none";
                          e.currentTarget.style.transform = "scale(1)";
                        }}
                        className="btn-glass"
                      >
                        ✓ APPROVE
                      </button>
                    )}
                    {normalizedStatus !== "BLOCKED" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (
                            window.confirm(
                              `Ban ${user.fullName}? This cannot be undone.`,
                            )
                          )
                            block(uid);
                        }}
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
                          letterSpacing: 0.5,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = `rgba(255,69,58,0.2)`;
                          e.currentTarget.style.boxShadow = `0 0 12px rgba(255,69,58,0.5)`;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "transparent";
                          e.currentTarget.style.boxShadow = "none";
                        }}
                        className="btn-glass"
                      >
                        ✕ BAN
                      </button>
                    )}
                    {normalizedStatus === "BLOCKED" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          approve(uid);
                        }}
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
                          letterSpacing: 0.5,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = `rgba(255,214,10,0.2)`;
                          e.currentTarget.style.boxShadow = `0 0 12px rgba(255,214,10,0.5)`;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "transparent";
                          e.currentTarget.style.boxShadow = "none";
                        }}
                        className="btn-glass"
                      >
                        ↺ RESTORE
                      </button>
                    )}
                    {/* RULE #24: View Identity Documents */}
                    <button
                      onClick={(e) => {
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
                        letterSpacing: 0.5,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = `rgba(52,199,89,0.3)`;
                        e.currentTarget.style.boxShadow = `0 0 12px rgba(52,199,89,0.5)`;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background =
                          "rgba(52,199,89,0.2)";
                        e.currentTarget.style.boxShadow = "none";
                      }}
                      className="btn-glass"
                    >
                      📄 DOCS
                    </button>
                    {/* RULE #244, #246, #247, #266, #270: Direct Support Chat */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setChatWith(uid);
                        setChatModalOpen(true);
                      }}
                      title="Open direct chat with trader"
                      style={{
                        background: "rgba(0,122,255,0.2)",
                        border: "1.5px solid #0A84FF",
                        borderRadius: 4,
                        padding: isMobileView ? "10px 12px" : "6px 12px",
                        cursor: "pointer",
                        color: "#0A84FF",
                        fontSize: 11,
                        fontWeight: 700,
                        transition: "all 0.2s ease",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        letterSpacing: 0.5,
                        whiteSpace: "nowrap",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background =
                          "rgba(0,122,255,0.3)";
                        e.currentTarget.style.boxShadow =
                          "0 0 12px rgba(0,122,255,0.5)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background =
                          "rgba(0,122,255,0.2)";
                        e.currentTarget.style.boxShadow = "none";
                      }}
                      className="btn-glass"
                    >
                      💬 MSG
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
        {/* Right Column: Mirror View */}
        {mirror && mirrorData && (
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "0 0 60px",
              minWidth: 320,
            }}
          >
            <div
              style={{
                padding: "16px 28px",
                borderBottom: `1px solid rgba(191,90,242,0.3)`,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "rgba(0,0,0,0.5)",
                position: "sticky",
                top: 0,
                zIndex: 10,
                backdropFilter: "blur(20px)",
              }}
              className="glass-panel"
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <LED color={T.purple} size={10} />
                <div>
                  <div
                    style={{
                      color: T.purple,
                      fontSize: 13,
                      letterSpacing: 2,
                      fontWeight: 700,
                    }}
                  >
                    MIRROR VIEW — READ ONLY
                  </div>
                  <div style={{ color: T.muted, fontSize: 11, marginTop: 2 }}>
                    {mirrorData.profile?.fullName} · {mirrorData.profile?.email}
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  setMirror(null);
                  setMirrorData(null);
                }}
                style={{
                  background: "transparent",
                  border: `1px solid rgba(255,255,255,0.1)`,
                  borderRadius: 6,
                  padding: "6px 14px",
                  cursor: "pointer",
                  color: T.muted,
                  fontSize: 10,
                  fontFamily: T.font,
                  fontWeight: 600,
                }}
                className="btn-glass"
              >
                ✕ CLOSE
              </button>
            </div>

            <div style={{ padding: "24px 28px" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                  gap: 16,
                  marginBottom: 24,
                }}
              >
                {[
                  {
                    l: "Account Balance",
                    v: mirrorData.accountState?.currentBalance
                      ? `$${parseFloat(mirrorData.accountState.currentBalance).toLocaleString()}`
                      : "—",
                    c: T.green,
                  },
                  {
                    l: "High-Water Mark",
                    v: mirrorData.accountState?.highWaterMark
                      ? `$${parseFloat(mirrorData.accountState.highWaterMark).toLocaleString()}`
                      : "—",
                    c: T.blue,
                  },
                  {
                    l: "Firm",
                    v: mirrorData.firmRules?.firmName || "—",
                    c: T.gold,
                  },
                  {
                    l: "Status",
                    v: mirrorData.profile?.status || "—",
                    c: statusColor[mirrorData.profile?.status] || T.muted,
                  },
                ].map((s, i) => (
                  <div
                    key={i}
                    style={cardS({
                      margin: 0,
                      textAlign: "center",
                      padding: "16px",
                    })}
                    className="glass-panel"
                  >
                    <div
                      style={{
                        color: T.dim,
                        fontSize: 10,
                        letterSpacing: 1.5,
                        marginBottom: 8,
                        fontWeight: 600,
                      }}
                    >
                      {s.l}
                    </div>
                    <div
                      style={{
                        color: s.c,
                        fontSize: 18,
                        fontWeight: 700,
                        fontFamily: T.mono,
                      }}
                    >
                      {s.v}
                    </div>
                  </div>
                ))}
              </div>

              {(() => {
                const journal = mirrorData.journal
                  ? Object.values(mirrorData.journal)
                  : [];
                if (!journal.length)
                  return (
                    <div
                      style={cardS({
                        textAlign: "center",
                        color: T.dim,
                        padding: 40,
                        fontSize: 13,
                      })}
                      className="glass-panel"
                    >
                      No journal entries yet
                    </div>
                  );

                const wins = journal.filter((t) => t.result === "win");
                const pnl = journal.reduce(
                  (s, t) => s + parseFloat(t.pnl || 0),
                  0,
                );

                return (
                  <div
                    style={cardS({
                      borderLeft: `4px solid ${T.purple}`,
                      padding: 0,
                      overflow: "hidden",
                    })}
                    className="glass-panel"
                  >
                    <div style={{ padding: "20px 24px" }}>
                      <SHead
                        icon="📔"
                        title="TRADE JOURNAL MIRROR"
                        color={T.purple}
                      />
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "repeat(auto-fit, minmax(120px, 1fr))",
                          gap: 12,
                          marginBottom: 20,
                        }}
                      >
                        {[
                          { l: "Total Trades", v: journal.length, c: T.text },
                          {
                            l: "Win Rate",
                            v: `${Math.round((wins.length / journal.length) * 100)}%`,
                            c:
                              wins.length / journal.length >= 0.5
                                ? T.green
                                : T.red,
                          },
                          {
                            l: "Total P&L",
                            v: `${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)}`,
                            c: pnl >= 0 ? T.green : T.red,
                          },
                        ].map((s, i) => (
                          <div
                            key={i}
                            style={{
                              background: "rgba(0,0,0,0.3)",
                              border: `1px solid rgba(255,255,255,0.05)`,
                              borderRadius: 8,
                              padding: "12px",
                              textAlign: "center",
                            }}
                            className="glass-panel"
                          >
                            <div
                              style={{
                                color: T.dim,
                                fontSize: 10,
                                marginBottom: 6,
                                fontWeight: 600,
                              }}
                            >
                              {s.l}
                            </div>
                            <div
                              style={{
                                color: s.c,
                                fontSize: 16,
                                fontWeight: 700,
                                fontFamily: T.mono,
                              }}
                            >
                              {s.v}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div style={{ overflowX: "auto" }}>
                      <table
                        style={{ width: "100%", borderCollapse: "collapse" }}
                      >
                        <thead>
                          <tr>
                            {[
                              "Date",
                              "Inst",
                              "Dir",
                              "Type",
                              "AMD",
                              "RRR",
                              "Entry",
                              "Exit",
                              "P&L",
                              "Result",
                            ].map((h) => (
                              <th
                                key={h}
                                style={{
                                  padding: "12px 14px",
                                  textAlign: "left",
                                  color: "#6B7280",
                                  fontSize: 10,
                                  letterSpacing: 1,
                                  background: "#F9FAFB",
                                  borderBottom: `1px solid #E5E7EB`,
                                  whiteSpace: "nowrap",
                                  fontWeight: 700,
                                }}
                                className="gemini-gradient-text"
                              >
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {journal
                            .slice(-20)
                            .reverse()
                            .map((t, i) => {
                              const pv = parseFloat(t.pnl || 0);
                              const amdColor = (
                                AMD_PHASES[t.amdPhase] || AMD_PHASES.UNCLEAR
                              ).color;
                              return (
                                <tr
                                  key={i}
                                  style={{
                                    borderBottom: `1px solid #E5E7EB`,
                                    background:
                                      i % 2 === 0 ? "#F9FAFB" : "#FFFFFF",
                                  }}
                                >
                                  <td
                                    style={{
                                      padding: "10px 14px",
                                      color: "#6B7280",
                                      fontSize: 11,
                                      fontFamily: T.mono,
                                    }}
                                  >
                                    {t.date}
                                  </td>
                                  <td
                                    style={{
                                      padding: "10px 14px",
                                      color: "#111827",
                                      fontSize: 11,
                                      fontWeight: 700,
                                    }}
                                  >
                                    {t.instrument}
                                  </td>
                                  <td
                                    style={{
                                      padding: "10px 14px",
                                      color:
                                        t.direction === "Long"
                                          ? "#10B981"
                                          : "#EF4444",
                                      fontSize: 11,
                                      fontWeight: 600,
                                    }}
                                  >
                                    {t.direction}
                                  </td>
                                  <td
                                    style={{
                                      padding: "10px 14px",
                                      color: "#0EA5E9",
                                      fontSize: 11,
                                      fontWeight: 500,
                                    }}
                                  >
                                    {t.tradeType}
                                  </td>
                                  <td
                                    style={{
                                      padding: "10px 14px",
                                      color: amdColor,
                                      fontSize: 10,
                                      fontWeight: 600,
                                    }}
                                  >
                                    {(
                                      AMD_PHASES[t.amdPhase]?.label ||
                                      t.amdPhase ||
                                      "—"
                                    ).slice(0, 10)}
                                  </td>
                                  <td
                                    style={{
                                      padding: "10px 14px",
                                      color: "#D97706",
                                      fontSize: 11,
                                      fontFamily: T.mono,
                                    }}
                                  >
                                    {t.rrr}
                                  </td>
                                  <td
                                    style={{
                                      padding: "10px 14px",
                                      color: "#6B7280",
                                      fontSize: 11,
                                      fontFamily: T.mono,
                                    }}
                                  >
                                    {t.entry || "—"}
                                  </td>
                                  <td
                                    style={{
                                      padding: "10px 14px",
                                      color: "#6B7280",
                                      fontSize: 11,
                                      fontFamily: T.mono,
                                    }}
                                  >
                                    {t.exit || "—"}
                                  </td>
                                  <td
                                    style={{
                                      padding: "10px 14px",
                                      color: pv >= 0 ? "#10B981" : "#EF4444",
                                      fontSize: 12,
                                      fontWeight: 700,
                                      fontFamily: T.mono,
                                    }}
                                  >
                                    {pv >= 0 ? "+" : ""}${pv.toFixed(0)}
                                  </td>
                                  <td
                                    style={{
                                      padding: "10px 14px",
                                      color:
                                        t.result === "win"
                                          ? "#10B981"
                                          : t.result === "loss"
                                            ? "#EF4444"
                                            : "#6B7280",
                                      fontSize: 11,
                                      fontWeight: 800,
                                    }}
                                  >
                                    {(t.result || "—").toUpperCase()}
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* RULE #24: Identity Documents Viewer Modal */}
        {selectedUserDocs && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.8)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
              backdropFilter: "blur(5px)",
            }}
          >
            <div
              style={{
                background: "rgba(20,20,20,0.95)",
                border: `1px solid ${T.green}40`,
                borderRadius: 12,
                padding: 28,
                maxWidth: 600,
                maxHeight: "80vh",
                overflowY: "auto",
                boxShadow: `0 0 40px rgba(52,199,89,0.2)`,
                backdropFilter: "blur(10px)",
              }}
              className="glass-panel"
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 20,
                  paddingBottom: 16,
                  borderBottom: `1px solid ${T.green}30`,
                }}
              >
                <div
                  style={{
                    color: T.green,
                    fontSize: 14,
                    letterSpacing: 2,
                    fontWeight: 700,
                  }}
                >
                  📄 IDENTITY DOCUMENTS (RULE #24)
                </div>
                <button
                  onClick={() => setSelectedUserDocs(null)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: T.muted,
                    fontSize: 20,
                    cursor: "pointer",
                    padding: "4px 8px",
                  }}
                >
                  ✕
                </button>
              </div>

              <div style={{ marginBottom: 20 }}>
                <div
                  style={{
                    color: T.muted,
                    fontSize: 12,
                    marginBottom: 12,
                    fontWeight: 600,
                  }}
                >
                  User:{" "}
                  {searchFilteredUsers.find(
                    ([uid]) => uid === selectedUserDocs,
                  )?.[1]?.fullName || "Unknown"}
                </div>

                <div
                  style={{
                    padding: 16,
                    background: "rgba(52,199,89,0.1)",
                    borderRadius: 8,
                    border: `1px solid ${T.green}30`,
                    minHeight: 120,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexDirection: "column",
                    gap: 12,
                  }}
                >
                  <div style={{ color: T.green, fontSize: 14 }}>📁</div>
                  <div
                    style={{
                      color: T.muted,
                      fontSize: 12,
                      textAlign: "center",
                    }}
                  >
                    Identity documents for this user will appear here.
                    <br />
                    <span style={{ fontSize: 11, color: T.dim }}>
                      (Currently uploaded documents from Aadhar, Passport,
                      License, PAN)
                    </span>
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 12,
                  justifyContent: "flex-end",
                }}
              >
                <button
                  onClick={() => setSelectedUserDocs(null)}
                  style={{
                    ...authBtn(T.muted, false),
                    background: "transparent",
                  }}
                  className="btn-glass"
                >
                  CLOSE
                </button>
              </div>
            </div>
          </div>
        )}

        {/* RULE #95: Back-to-Top Button */}
        <BackToTopButton theme={T} />
      </div>
    </div>
  );
}

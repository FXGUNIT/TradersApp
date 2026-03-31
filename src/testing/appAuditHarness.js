function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function buildFixtures({ adminUid, adminEmail }) {
  const now = new Date();
  const iso = now.toISOString();
  const today = iso.slice(0, 10);

  const userAuth = {
    uid: "audit-user-001",
    token: "audit-token-user",
    email: "audit.user@example.com",
  };

  const adminAuth = {
    uid: adminUid,
    token: "audit-token-admin",
    email: adminEmail,
  };

  const userProfile = {
    uid: userAuth.uid,
    token: userAuth.token,
    fullName: "Audit User",
    email: userAuth.email,
    role: "user",
    status: "ACTIVE",
    createdAt: iso,
    journal: {
      entry_0: {
        id: "entry-0",
        date: today,
        instrument: "MNQ",
        result: "win",
        entry: "18540",
        exit: "18562",
        pnl: "110",
      },
      entry_1: {
        id: "entry-1",
        date: today,
        instrument: "MNQ",
        result: "loss",
        entry: "18580",
        exit: "18570",
        pnl: "-50",
      },
    },
    accountState: {
      startingBalance: "50000",
      currentBalance: "50060",
      highWaterMark: "50060",
      dailyStartBalance: "50000",
    },
    firmRules: {
      firmName: "Audit Capital",
      maxDailyLoss: "1000",
      maxDrawdown: "2500",
      drawdownType: "trailing",
      profitTarget: "3000",
      parsed: true,
    },
  };

  const sessions = {
    "session-current": {
      device: "Audit Chrome",
      city: "Delhi",
      country: "India",
      createdAt: iso,
      lastActive: iso,
    },
    "session-other": {
      device: "Audit iPhone",
      city: "Mumbai",
      country: "India",
      createdAt: new Date(now.getTime() - 3600 * 1000).toISOString(),
      lastActive: new Date(now.getTime() - 1800 * 1000).toISOString(),
    },
  };

  const users = {
    [userAuth.uid]: {
      fullName: "Audit User",
      email: userAuth.email,
      status: "ACTIVE",
      role: "user",
      createdAt: iso,
      proficiency: "advanced",
      accountBalance: "50060",
      forensic: { ip: "10.0.0.5" },
      city: "Delhi",
      country: "India",
    },
    "audit-pending-002": {
      fullName: "Pending Recruit",
      email: "pending.recruit@example.com",
      status: "PENDING",
      role: "user",
      createdAt: new Date(now.getTime() - 7200 * 1000).toISOString(),
      proficiency: "intermediate",
      accountBalance: "15000",
      forensic: { ip: "10.0.0.5" },
      city: "Delhi",
      country: "India",
    },
    "audit-blocked-003": {
      fullName: "Blocked Operator",
      email: "blocked.operator@example.com",
      status: "BLOCKED",
      role: "user",
      createdAt: new Date(now.getTime() - 86400 * 1000).toISOString(),
      proficiency: "beginner",
      accountBalance: "12000",
      forensic: { ip: "10.0.0.9" },
      city: "Pune",
      country: "India",
    },
  };

  return {
    userAuth,
    adminAuth,
    userProfile,
    adminProfile: {
      uid: adminAuth.uid,
      token: adminAuth.token,
      fullName: "Audit Admin",
      email: adminAuth.email,
      role: "admin",
      status: "ACTIVE",
      createdAt: iso,
    },
    sessions,
    users,
  };
}

export function registerAppAuditHarness({
  adminUid,
  adminEmail,
  setScreen,
  setAuth,
  setProfile,
  setIsAdminAuthenticated,
  setCurrentSessionId,
  setTheme,
  setAccentColor,
  setShowThemePicker,
  setMaintenanceModeActive,
}) {
  if (typeof window === "undefined") return () => {};

  const fixtures = buildFixtures({ adminUid, adminEmail });

  const applyBaseState = () => {
    setShowThemePicker(false);
    setMaintenanceModeActive(false);
    setTheme("lumiere");
    setAccentColor("BLUE");
  };

  const setAuditData = (extra = {}) => {
    window.__TRADERS_AUDIT_DATA = {
      active: true,
      ...clone(fixtures),
      ...clone(extra),
    };
  };

  const clearAuditData = () => {
    delete window.__TRADERS_AUDIT_DATA;
  };

  const loadScenario = (scenarioName) => {
    applyBaseState();

    switch (scenarioName) {
      case "login":
        setAuditData({ scenario: "login" });
        localStorage.removeItem("isAdminAuthenticated");
        setCurrentSessionId(null);
        setAuth(null);
        setProfile(null);
        setIsAdminAuthenticated(false);
        setScreen("login");
        break;

      case "signup":
        setAuditData({ scenario: "signup" });
        setCurrentSessionId(null);
        setAuth(null);
        setProfile(null);
        setIsAdminAuthenticated(false);
        setScreen("signup");
        break;

      case "waiting":
        setAuditData({
          scenario: "waiting",
          sessions: fixtures.sessions,
          userProfile: clone({
            ...fixtures.userProfile,
            status: "PENDING",
          }),
          users: {
            ...fixtures.users,
            [fixtures.userAuth.uid]: {
              ...fixtures.users[fixtures.userAuth.uid],
              status: "PENDING",
            },
          },
        });
        setCurrentSessionId("session-current");
        setAuth(clone(fixtures.userAuth));
        setProfile(
          clone({
            ...fixtures.userProfile,
            status: "PENDING",
          }),
        );
        setIsAdminAuthenticated(false);
        setScreen("waiting");
        break;

      case "forcePasswordReset":
        setAuditData();
        setCurrentSessionId("session-current");
        setAuth(clone(fixtures.userAuth));
        setProfile(
          clone({
            ...fixtures.userProfile,
            passwordLastChanged: "2000-01-01T00:00:00.000Z",
          }),
        );
        setIsAdminAuthenticated(false);
        setScreen("forcePasswordReset");
        // Re-assert the screen for a short window so auth listeners that race
        // during dev bootstrap cannot bounce this scenario back to login.
        window.setTimeout(() => setScreen("forcePasswordReset"), 80);
        window.setTimeout(() => setScreen("forcePasswordReset"), 320);
        break;

      case "hub":
        setAuditData();
        setCurrentSessionId("session-current");
        setAuth(clone(fixtures.userAuth));
        setProfile(clone(fixtures.userProfile));
        setIsAdminAuthenticated(false);
        setScreen("hub");
        break;

      case "consciousness":
        setAuditData();
        setCurrentSessionId("session-current");
        setAuth(clone(fixtures.userAuth));
        setProfile(clone(fixtures.userProfile));
        setIsAdminAuthenticated(false);
        setScreen("consciousness");
        break;

      case "app":
        setAuditData({ scenario: "app", sessions: fixtures.sessions });
        setCurrentSessionId("session-current");
        setAuth(clone(fixtures.userAuth));
        setProfile(clone(fixtures.userProfile));
        setIsAdminAuthenticated(false);
        setScreen("app");
        break;

      case "sessions":
        setAuditData({ sessions: fixtures.sessions });
        setCurrentSessionId("session-current");
        setAuth(clone(fixtures.userAuth));
        setProfile(clone(fixtures.userProfile));
        setIsAdminAuthenticated(false);
        setScreen("sessions");
        break;

      case "admin":
        localStorage.setItem("isAdminAuthenticated", "true");
        setAuditData({ users: fixtures.users, sessions: fixtures.sessions });
        setCurrentSessionId("session-current");
        setAuth(clone(fixtures.adminAuth));
        setProfile(clone(fixtures.adminProfile));
        setIsAdminAuthenticated(true);
        setScreen("admin");
        break;

      default:
        throw new Error(`Unknown audit scenario: ${scenarioName}`);
    }
  };

  window.__TradersAppAudit = {
    loadScenario,
    getFixtures: () => clone(fixtures),
    setFakeUsers: (users) => {
      const currentData = window.__TRADERS_AUDIT_DATA || {};
      window.__TRADERS_AUDIT_DATA = {
        ...currentData,
        active: true,
        users: clone(users),
      };
    },
    clear: () => {
      clearAuditData();
      localStorage.removeItem("isAdminAuthenticated");
    },
  };

  return () => {
    delete window.__TradersAppAudit;
  };
}

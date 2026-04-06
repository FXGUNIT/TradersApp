import { sendApprovalConfirmationEmail } from "../emailService.js";
import {
  approveAdminUser as approveAdminUserGateway,
  blockAdminUser as blockAdminUserGateway,
  fetchAdminUsers as fetchAdminUsersGateway,
  fetchMaintenanceState as fetchMaintenanceStateGateway,
  lockAdminUser as lockAdminUserGateway,
  toggleMaintenanceState as toggleMaintenanceStateGateway,
} from "../gateways/adminGateway.js";
import { createBffUnavailableResult, hasBff } from "../gateways/base.js";
import { sendSecurityAlert } from "../telegramService.js";

const AUDIT_MODE_KEY = "TradersApp_AuditMode";

function normalizeUsers(users) {
  if (!users) {
    return {};
  }

  if (Array.isArray(users)) {
    return users.reduce((acc, user) => {
      if (user?.uid) {
        acc[user.uid] = user;
      }
      return acc;
    }, {});
  }

  return users;
}

function normalizeResponse(result, fallback = {}) {
  if (!result) {
    return null;
  }

  return {
    ...fallback,
    ...result,
    success: result.success !== false && result.ok !== false,
  };
}

function clone(value) {
  if (value == null) {
    return value;
  }

  return JSON.parse(JSON.stringify(value));
}

function isAuditMode() {
  if (typeof window === "undefined") {
    return false;
  }

  if (window.__TRADERS_AUDIT_DATA?.active === true) {
    return true;
  }

  try {
    return localStorage.getItem(AUDIT_MODE_KEY) === "true";
  } catch {
    return false;
  }
}

function getAuditData() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.__TRADERS_AUDIT_DATA || null;
}

function writeAuditData(nextData) {
  if (typeof window === "undefined") {
    return;
  }

  window.__TRADERS_AUDIT_DATA = {
    ...(window.__TRADERS_AUDIT_DATA || {}),
    ...nextData,
    active: true,
  };
}

export async function approveUser(uid, adminUid) {
  if (isAuditMode()) {
    const users = normalizeUsers(clone(getAuditData()?.users));
    const user = {
      ...(users[uid] || {}),
      uid,
      status: "ACTIVE",
      approvedBy: adminUid,
    };
    writeAuditData({
      users: {
        ...users,
        [uid]: user,
      },
    });
    return { success: true, user };
  }

  if (!hasBff()) {
    return createBffUnavailableResult("approveUser", {
      user: null,
      uid,
      approvedBy: adminUid,
    });
  }

  const response = await approveAdminUserGateway(uid, adminUid);
  const normalized = normalizeResponse(response, {
    user: response?.user || { uid, approvedBy: adminUid },
  });
  if (normalized?.user?.email) {
    void sendApprovalConfirmationEmail(
      normalized.user.email,
      normalized.user.fullName,
    );
    void sendSecurityAlert("USER_APPROVED", {
      uid,
      email: normalized.user.email,
      approvedBy: adminUid,
    });
  }

  return normalized || createBffUnavailableResult("approveUser", {
    user: null,
    uid,
    approvedBy: adminUid,
  });
}

export async function blockUser(uid, adminUid) {
  if (isAuditMode()) {
    const users = normalizeUsers(clone(getAuditData()?.users));
    const user = {
      ...(users[uid] || {}),
      uid,
      status: "BLOCKED",
      blockedBy: adminUid,
    };
    writeAuditData({
      users: {
        ...users,
        [uid]: user,
      },
    });
    return { success: true, user };
  }

  if (!hasBff()) {
    return createBffUnavailableResult("blockUser", {
      user: null,
      uid,
      blockedBy: adminUid,
    });
  }

  const response = await blockAdminUserGateway(uid, adminUid);
  return (
    normalizeResponse(response, {
      user: response?.user || { uid, blockedBy: adminUid },
    }) ||
    createBffUnavailableResult("blockUser", {
      user: null,
      uid,
      blockedBy: adminUid,
    })
  );
}

export async function lockUser(uid, adminUid) {
  if (isAuditMode()) {
    const users = normalizeUsers(clone(getAuditData()?.users));
    const user = {
      ...(users[uid] || {}),
      uid,
      isLocked: true,
      lockedBy: adminUid,
    };
    writeAuditData({
      users: {
        ...users,
        [uid]: user,
      },
    });
    return { success: true, user };
  }

  if (!hasBff()) {
    return createBffUnavailableResult("lockUser", {
      user: null,
      uid,
      lockedBy: adminUid,
    });
  }

  const response = await lockAdminUserGateway(uid, adminUid);
  return (
    normalizeResponse(response, {
      user: response?.user || { uid, lockedBy: adminUid },
    }) ||
    createBffUnavailableResult("lockUser", {
      user: null,
      uid,
      lockedBy: adminUid,
    })
  );
}

export async function listUsers() {
  if (isAuditMode()) {
    return {
      success: true,
      users: normalizeUsers(clone(getAuditData()?.users)),
    };
  }

  if (!hasBff()) {
    return createBffUnavailableResult("listUsers", { users: {} });
  }

  const response = await fetchAdminUsersGateway();
  const normalized = normalizeResponse(response, {
    users: normalizeUsers(
      response?.users || response?.list || response?.data?.users,
    ),
  });
  if (normalized) {
    normalized.users = normalizeUsers(normalized.users);
    return normalized;
  }

  return createBffUnavailableResult("listUsers", { users: {} });
}

export async function fetchMaintenanceState() {
  if (isAuditMode()) {
    return {
      success: true,
      maintenanceActive: Boolean(getAuditData()?.maintenanceActive),
    };
  }

  if (!hasBff()) {
    return createBffUnavailableResult("fetchMaintenanceState", {
      maintenanceActive: false,
    });
  }

  const response = await fetchMaintenanceStateGateway();
  const normalized = normalizeResponse(response, {
    maintenanceActive: Boolean(
      response?.maintenanceActive ?? response?.enabled ?? response?.active,
    ),
  });
  if (normalized) {
    normalized.maintenanceActive = Boolean(
      normalized.maintenanceActive ?? normalized.enabled ?? normalized.active,
    );
    return normalized;
  }

  return createBffUnavailableResult("fetchMaintenanceState", {
    maintenanceActive: false,
  });
}

export async function toggleMaintenanceState(enabled) {
  if (isAuditMode()) {
    writeAuditData({
      maintenanceActive: Boolean(enabled),
    });
    return {
      success: true,
      maintenanceActive: Boolean(enabled),
    };
  }

  if (!hasBff()) {
    return createBffUnavailableResult("toggleMaintenanceState", {
      maintenanceActive: Boolean(enabled),
    });
  }

  const response = await toggleMaintenanceStateGateway(enabled);
  const normalized = normalizeResponse(response, {
    maintenanceActive: Boolean(
      response?.maintenanceActive ?? response?.enabled ?? enabled,
    ),
  });
  if (normalized) {
    normalized.maintenanceActive = Boolean(
      normalized.maintenanceActive ?? normalized.enabled ?? enabled,
    );
    return normalized;
  }

  return createBffUnavailableResult("toggleMaintenanceState", {
    maintenanceActive: Boolean(enabled),
  });
}

export default {
  approveUser,
  blockUser,
  fetchMaintenanceState,
  listUsers,
  lockUser,
  toggleMaintenanceState,
};

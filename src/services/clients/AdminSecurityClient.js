import {
  approveUser as approveLegacyUser,
  blockUser as blockLegacyUser,
  listUsers as listLegacyUsers,
  lockUser as lockLegacyUser,
} from "../adminService.js";
import { sendApprovalConfirmationEmail } from "../emailService.js";
import {
  approveAdminUser as approveAdminUserGateway,
  blockAdminUser as blockAdminUserGateway,
  fetchAdminUsers as fetchAdminUsersGateway,
  fetchMaintenanceState as fetchMaintenanceStateGateway,
  lockAdminUser as lockAdminUserGateway,
  toggleMaintenanceState as toggleMaintenanceStateGateway,
} from "../gateways/adminGateway.js";
import { hasBff } from "../gateways/base.js";
import { sendSecurityAlert } from "../telegramService.js";

const MAINTENANCE_STORAGE_KEY = "TradersApp_MaintenanceMode";

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

function readLocalMaintenanceState() {
  try {
    return localStorage.getItem(MAINTENANCE_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function writeLocalMaintenanceState(enabled) {
  try {
    localStorage.setItem(MAINTENANCE_STORAGE_KEY, String(Boolean(enabled)));
  } catch {
    // localStorage is a best-effort compatibility cache.
  }
}

export async function approveUser(uid, adminUid) {
  const legacyResult = await approveLegacyUser(uid, adminUid);
  if (legacyResult?.success) {
    if (hasBff()) {
      void approveAdminUserGateway(uid, adminUid);
    }
    return legacyResult;
  }

  if (hasBff()) {
    const response = await approveAdminUserGateway(uid, adminUid);
    const normalized = normalizeResponse(response, {
      user: response?.user || { uid, approvedBy: adminUid },
    });
    if (normalized) {
      if (normalized.user?.email) {
        void sendApprovalConfirmationEmail(
          normalized.user.email,
          normalized.user.fullName,
        );
      }
      if (normalized.user?.email) {
        void sendSecurityAlert("USER_APPROVED", {
          uid,
          email: normalized.user.email,
          approvedBy: adminUid,
        });
      }
      return normalized;
    }
  }

  return legacyResult;
}

export async function blockUser(uid, adminUid) {
  const legacyResult = await blockLegacyUser(uid, adminUid);
  if (legacyResult?.success) {
    if (hasBff()) {
      void blockAdminUserGateway(uid, adminUid);
    }
    return legacyResult;
  }

  if (hasBff()) {
    const response = await blockAdminUserGateway(uid, adminUid);
    const normalized = normalizeResponse(response, {
      user: response?.user || { uid, blockedBy: adminUid },
    });
    if (normalized) {
      return normalized;
    }
  }

  return legacyResult;
}

export async function lockUser(uid, adminUid) {
  const legacyResult = await lockLegacyUser(uid, adminUid);
  if (legacyResult?.success) {
    if (hasBff()) {
      void lockAdminUserGateway(uid, adminUid);
    }
    return legacyResult;
  }

  if (hasBff()) {
    const response = await lockAdminUserGateway(uid, adminUid);
    const normalized = normalizeResponse(response, {
      user: response?.user || { uid, lockedBy: adminUid },
    });
    if (normalized) {
      return normalized;
    }
  }

  return legacyResult;
}

export async function listUsers() {
  const legacy = await listLegacyUsers();
  if (legacy?.success && legacy?.users) {
    legacy.users = normalizeUsers(legacy.users);
    return legacy;
  }

  if (hasBff()) {
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
  }

  if (legacy?.users) {
    legacy.users = normalizeUsers(legacy.users);
  }
  return legacy;
}

export async function fetchMaintenanceState() {
  if (hasBff()) {
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
      writeLocalMaintenanceState(normalized.maintenanceActive);
      return normalized;
    }
  }

  return { success: true, maintenanceActive: readLocalMaintenanceState() };
}

export async function toggleMaintenanceState(enabled) {
  if (hasBff()) {
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
      writeLocalMaintenanceState(normalized.maintenanceActive);
      return normalized;
    }
  }

  writeLocalMaintenanceState(enabled);
  return {
    success: true,
    maintenanceActive: Boolean(enabled),
  };
}

export default {
  approveUser,
  blockUser,
  fetchMaintenanceState,
  listUsers,
  lockUser,
  toggleMaintenanceState,
};

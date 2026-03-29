import {
  approveUser as approveLegacyUser,
  blockUser as blockLegacyUser,
  listUsers as listLegacyUsers,
  lockUser as lockLegacyUser,
} from "../adminService.js";
import {
  approveAdminUser as approveAdminUserGateway,
  blockAdminUser as blockAdminUserGateway,
  fetchAdminUsers as fetchAdminUsersGateway,
  fetchMaintenanceState as fetchMaintenanceStateGateway,
  lockAdminUser as lockAdminUserGateway,
  toggleMaintenanceState as toggleMaintenanceStateGateway,
} from "../gateways/adminGateway.js";
import { hasBff } from "../gateways/base.js";

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

export async function approveUser(uid, adminUid) {
  if (hasBff()) {
    const response = await approveAdminUserGateway(uid, adminUid);
    const normalized = normalizeResponse(response, {
      user: response?.user || { uid, approvedBy: adminUid },
    });
    if (normalized) {
      return normalized;
    }
  }

  return approveLegacyUser(uid, adminUid);
}

export async function blockUser(uid, adminUid) {
  if (hasBff()) {
    const response = await blockAdminUserGateway(uid, adminUid);
    const normalized = normalizeResponse(response, {
      user: response?.user || { uid, blockedBy: adminUid },
    });
    if (normalized) {
      return normalized;
    }
  }

  return blockLegacyUser(uid, adminUid);
}

export async function lockUser(uid, adminUid) {
  if (hasBff()) {
    const response = await lockAdminUserGateway(uid, adminUid);
    const normalized = normalizeResponse(response, {
      user: response?.user || { uid, lockedBy: adminUid },
    });
    if (normalized) {
      return normalized;
    }
  }

  return lockLegacyUser(uid, adminUid);
}

export async function listUsers() {
  if (hasBff()) {
    const response = await fetchAdminUsersGateway();
    const normalized = normalizeResponse(response, {
      users: normalizeUsers(response?.users || response?.list || response?.data?.users),
    });
    if (normalized) {
      normalized.users = normalizeUsers(normalized.users);
      return normalized;
    }
  }

  const legacy = await listLegacyUsers();
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
      return normalized;
    }
  }

  return { success: true, maintenanceActive: false };
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
      return normalized;
    }
  }

  return {
    success: false,
    error: "Maintenance control is unavailable without the BFF.",
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

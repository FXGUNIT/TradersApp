import { bffFetch } from "./base.js";

export async function fetchAdminUsers() {
  return bffFetch("/admin/users");
}

export async function approveAdminUser(uid, adminUid) {
  if (!uid || !adminUid) {
    return null;
  }

  return bffFetch(`/admin/users/${encodeURIComponent(uid)}/approve`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ adminUid }),
  });
}

export async function blockAdminUser(uid, adminUid) {
  if (!uid || !adminUid) {
    return null;
  }

  return bffFetch(`/admin/users/${encodeURIComponent(uid)}/block`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ adminUid }),
  });
}

export async function lockAdminUser(uid, adminUid) {
  if (!uid || !adminUid) {
    return null;
  }

  return bffFetch(`/admin/users/${encodeURIComponent(uid)}/lock`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ adminUid }),
  });
}

export async function fetchMaintenanceState() {
  return bffFetch("/admin/maintenance");
}

export async function toggleMaintenanceState(enabled) {
  const options = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  };

  if (typeof enabled === "boolean") {
    options.body = JSON.stringify({ enabled });
  }

  return bffFetch("/admin/maintenance/toggle", options);
}

export default {
  approveAdminUser,
  blockAdminUser,
  fetchAdminUsers,
  fetchMaintenanceState,
  lockAdminUser,
  toggleMaintenanceState,
};

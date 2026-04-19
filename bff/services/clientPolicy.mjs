function parseVersion(value) {
  return String(value || "")
    .trim()
    .split(/[^\dA-Za-z]+/)
    .filter(Boolean)
    .map((part) => {
      const numeric = Number(part);
      return Number.isFinite(numeric) ? numeric : part.toLowerCase();
    });
}

export function compareVersions(left, right) {
  const leftParts = parseVersion(left);
  const rightParts = parseVersion(right);
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const leftPart = leftParts[index] ?? 0;
    const rightPart = rightParts[index] ?? 0;

    if (typeof leftPart === "number" && typeof rightPart === "number") {
      if (leftPart > rightPart) return 1;
      if (leftPart < rightPart) return -1;
      continue;
    }

    const comparison = String(leftPart).localeCompare(String(rightPart));
    if (comparison !== 0) {
      return comparison > 0 ? 1 : -1;
    }
  }

  return 0;
}

export function resolveClientPolicy({
  userStatus = {},
  maintenanceActive = false,
  minimumDesktopVersion = null,
  platform = "",
  currentVersion = "",
} = {}) {
  const normalizedStatus = String(userStatus?.status || "")
    .trim()
    .toUpperCase();
  const role = String(userStatus?.role || "user")
    .trim()
    .toLowerCase();
  const normalizedPlatform = String(platform || "")
    .trim()
    .toLowerCase();
  const normalizedMinimumDesktopVersion =
    String(minimumDesktopVersion || "").trim() || null;
  const normalizedCurrentVersion = String(currentVersion || "").trim() || null;

  const blocked = normalizedStatus === "BLOCKED";
  const locked = Boolean(userStatus?.isLocked);
  const maintenanceBlocked = Boolean(maintenanceActive) && role !== "admin";
  const minimumVersionRejected =
    normalizedPlatform === "windows" &&
    Boolean(normalizedMinimumDesktopVersion) &&
    Boolean(normalizedCurrentVersion) &&
    compareVersions(normalizedCurrentVersion, normalizedMinimumDesktopVersion) < 0;

  let reason = null;
  if (blocked) {
    reason = "ACCOUNT_BLOCKED";
  } else if (locked) {
    reason = "ACCOUNT_LOCKED";
  } else if (maintenanceBlocked) {
    reason = "MAINTENANCE_MODE_ACTIVE";
  } else if (minimumVersionRejected) {
    reason = "MINIMUM_DESKTOP_VERSION_REQUIRED";
  }

  return {
    minimumDesktopVersion: normalizedMinimumDesktopVersion,
    maintenanceActive: Boolean(maintenanceActive),
    forceLogout: blocked || locked || maintenanceBlocked || minimumVersionRejected,
    reason,
  };
}

export default {
  compareVersions,
  resolveClientPolicy,
};

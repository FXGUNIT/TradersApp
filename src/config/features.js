const readFeatureFlag = (value) =>
  value === true || String(value).toLowerCase() === "true" || false;

export const FEATURE_FLAGS = Object.freeze({
  floatingSupportChat: readFeatureFlag(
    import.meta.env.VITE_FEATURE_FLOATING_SUPPORT_CHAT,
  ),
  collectiveConsciousness: readFeatureFlag(
    import.meta.env.VITE_FEATURE_COLLECTIVE_CONSCIOUSNESS,
  ),
  mainTerminal: readFeatureFlag(import.meta.env.VITE_FEATURE_MAIN_TERMINAL),
  cleanOnboarding: readFeatureFlag(
    import.meta.env.VITE_FEATURE_CLEAN_ONBOARDING,
  ),
});

function isAuditModeEnabled() {
  if (typeof window === "undefined") return false;
  if (window.__TRADERS_UI_AUDIT__ === true || window.__TradersAppAudit) {
    return true;
  }

  try {
    return localStorage.getItem("TradersApp_AuditMode") === "true";
  } catch {
    return false;
  }
}

export const isFeatureEnabled = (featureName) =>
  Object.hasOwn(FEATURE_FLAGS, featureName) &&
  (FEATURE_FLAGS[featureName] === true || isAuditModeEnabled());

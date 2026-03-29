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

export const isFeatureEnabled = (featureName) =>
  FEATURE_FLAGS[featureName] === true;

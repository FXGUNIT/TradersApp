// Pages layer - Page components that represent full screens
// Each page corresponds to a route in the application

export { default as CleanOnboarding } from "./CleanOnboarding.jsx";
export { default as CollectiveConsciousness } from "./CollectiveConsciousness.jsx";
export { default as PrivacyPolicy } from "./PrivacyPolicy.jsx";
export { default as RegimentEULA } from "./RegimentEULA.jsx";
export { default as RegimentHub } from "./RegimentHub.jsx";
export { default as TermsOfService } from "./TermsOfService.jsx";
export { default as WaitingRoom } from "./WaitingRoom.jsx";

// Page utilities
export const PAGE_NAMES = {
  ONBOARDING: "CleanOnboarding",
  COLLECTIVE: "CollectiveConsciousness",
  PRIVACY: "PrivacyPolicy",
  EULA: "RegimentEULA",
  HUB: "RegimentHub",
  TERMS: "TermsOfService",
  WAITING: "WaitingRoom",
};

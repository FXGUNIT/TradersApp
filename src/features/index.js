// Features layer - Business features with domain logic
// Each feature represents a cohesive business capability

// Terminal Feature (Already extracted)
export { default as MainTerminal } from "./terminal/MainTerminal.jsx";
export { default as journalMetrics } from "./terminal/journalMetrics.js";
export { default as terminalUploadUtils } from "./terminal/terminalUploadUtils.js";

// TODO: Extract other features from App.jsx:
// - Auth feature (Login, Signup, OTP, PasswordReset)
// - Admin feature (AdminDashboard, user management)
// - AI feature (AI prompts, council logic)
// - Support feature (SupportChatModal)
// - Security feature (security utilities)

// Feature registry
export const FEATURES = {
  terminal: {
    name: "Trading Terminal",
    description:
      "Institutional-grade trading terminal with drag-drop, performance dashboard, and journal tracking",
    components: ["MainTerminal", "journalMetrics", "terminalUploadUtils"],
  },
  auth: {
    name: "Authentication",
    description: "User authentication, authorization, and session management",
    components: [], // To be populated
  },
  admin: {
    name: "Administration",
    description:
      "Admin dashboard for user management, approvals, and system monitoring",
    components: [], // To be populated
  },
  ai: {
    name: "AI System",
    description:
      "Multi-provider AI with fallback hierarchy and council deliberation",
    components: [], // To be populated
  },
};

// Feature utilities
export function registerFeature(featureName, component) {
  if (!FEATURES[featureName]) {
    FEATURES[featureName] = {
      name: featureName,
      description: "",
      components: [],
    };
  }
  FEATURES[featureName].components.push(component);
}

// Shared layer - Reusable infrastructure across the application
// This layer contains utilities, UI components, APIs, and libraries

// API clients
export * from "./api/index.js";

// Libraries
export * from "./lib/index.js";

// UI components
export * from "./ui/index.js";

// Utilities
export * from "./utils/index.js";

// Constants
export * from "./constants/index.js";

// Types
export * from "./types/index.js";

// Shared configuration
export const SHARED_CONFIG = {
  version: "1.0.0",
  lastUpdated: "2026-03-25",
  layers: ["api", "lib", "ui", "utils", "constants", "types"],
};

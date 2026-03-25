// Entities layer - Core business entities and domain models
// Entities represent the fundamental concepts of the business domain

// TODO: Extract entities from App.jsx:
// - User entity (profile, permissions, status)
// - Session entity (session data, device info)
// - Trade entity (trade data, journal entries)
// - Account entity (account state, balance)
// - Security entity (security alerts, forensic data)

// Entity definitions (to be populated during extraction)
export const ENTITIES = {
  User: {
    fields: [
      "uid",
      "email",
      "displayName",
      "photoURL",
      "status",
      "createdAt",
      "lastLogin",
    ],
    description: "User account with authentication and profile data",
  },
  Session: {
    fields: [
      "sessionId",
      "uid",
      "deviceInfo",
      "geoData",
      "createdAt",
      "lastActive",
    ],
    description: "User session with device and location information",
  },
  Trade: {
    fields: [
      "id",
      "userId",
      "symbol",
      "direction",
      "entry",
      "exit",
      "size",
      "pnl",
      "timestamp",
    ],
    description: "Trading transaction with financial details",
  },
  Account: {
    fields: ["userId", "balance", "equity", "margin", "leverage", "riskScore"],
    description: "Trading account with financial metrics",
  },
};

// Entity factory functions (to be implemented)
export function createUser(data) {
  return {
    uid: data.uid || "",
    email: data.email || "",
    displayName: data.displayName || "",
    photoURL: data.photoURL || "",
    status: data.status || "PENDING",
    createdAt: data.createdAt || new Date().toISOString(),
    lastLogin: data.lastLogin || null,
    ...data,
  };
}

export function validateEntity(entityType, data) {
  const entitySchema = ENTITIES[entityType];
  if (!entitySchema) {
    throw new Error(`Unknown entity type: ${entityType}`);
  }

  const missingFields = entitySchema.fields.filter(
    (field) => data[field] === undefined,
  );
  if (missingFields.length > 0) {
    console.warn(`Entity ${entityType} missing fields:`, missingFields);
  }

  return true;
}

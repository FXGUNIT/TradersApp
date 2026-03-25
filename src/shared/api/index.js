// Shared API layer - API clients and HTTP utilities
// This module exports all API clients used across the application

// Firebase API client
export { default as firebaseApi } from "../../services/firebase.js";

// Telegram API client
export { default as telegramApi } from "../../services/telegramService.js";

// AI Router API client
export { default as aiRouterApi } from "../../services/ai-router.js";

// Database service API
export { default as databaseApi } from "../../services/databaseService.js";

// Auth service API
export { default as authApi } from "../../services/authService.js";

// Admin service API
export { default as adminApi } from "../../services/adminService.js";

// HTTP utilities
export const createApiClient = (baseURL, defaultHeaders = {}) => {
  return {
    get: async (endpoint, options = {}) => {
      const response = await fetch(`${baseURL}${endpoint}`, {
        method: "GET",
        headers: { ...defaultHeaders, ...options.headers },
        ...options,
      });
      return response.json();
    },
    post: async (endpoint, data, options = {}) => {
      const response = await fetch(`${baseURL}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...defaultHeaders,
          ...options.headers,
        },
        body: JSON.stringify(data),
        ...options,
      });
      return response.json();
    },
    put: async (endpoint, data, options = {}) => {
      const response = await fetch(`${baseURL}${endpoint}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...defaultHeaders,
          ...options.headers,
        },
        body: JSON.stringify(data),
        ...options,
      });
      return response.json();
    },
    delete: async (endpoint, options = {}) => {
      const response = await fetch(`${baseURL}${endpoint}`, {
        method: "DELETE",
        headers: { ...defaultHeaders, ...options.headers },
        ...options,
      });
      return response.json();
    },
  };
};

// API configuration
export const API_CONFIG = {
  firebase: {
    baseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || "",
    timeout: 10000,
  },
  telegram: {
    baseURL: "https://api.telegram.org",
    timeout: 5000,
  },
  ai: {
    baseURL: import.meta.env.VITE_AI_GATEWAY_URL || "",
    timeout: 15000,
  },
};

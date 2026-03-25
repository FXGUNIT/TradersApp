import { initializeApp } from "firebase/app";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth";
import { getDatabase } from "firebase/database";
import { getStorage } from "firebase/storage";
import { GoogleAuthProvider } from "firebase/auth";
import { firebaseOptimizer } from "./firebaseOptimization.js";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
};

export const DATABASE_URL = firebaseConfig.databaseURL;
export const FB_KEY = import.meta.env.VITE_FIREBASE_API_KEY;
export const FB_AUTH_URL = "https://identitytoolkit.googleapis.com/v1/accounts";
// Admin credentials should be configured via environment variables in production
export const ADMIN_EMAIL =
  import.meta.env.VITE_ADMIN_EMAIL || "gunitsingh1994@gmail.com";
export const ADMIN_UID =
  import.meta.env.VITE_ADMIN_UID || "N3z04ZYCleZjOApobL3VZepaOwi1";
export const ADMIN_PASS_HASH =
  import.meta.env.VITE_ADMIN_PASS_HASH ||
  "0189c7742ecf4542ecab0150b32ecadc9ce7c4390217bfb3914f5b52b14e3cb6";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);
export const storage = getStorage(app);

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  hd: "gmail.com",
  prompt: "select_account",
});
export { googleProvider };

export const initializeFirebase = async () => {
  try {
    setPersistence(auth, browserLocalPersistence);
  } catch (error) {
    console.warn("Failed to set auth persistence:", error);
  }
};

// Export the imported firebaseOptimizer
export { firebaseOptimizer };
window.__FirebaseOptimizer = firebaseOptimizer;

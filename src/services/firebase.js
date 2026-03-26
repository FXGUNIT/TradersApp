import { initializeApp } from "firebase/app";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  GoogleAuthProvider,
} from "firebase/auth";
import { getDatabase } from "firebase/database";
import { getStorage } from "firebase/storage";
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

const hasRequiredConfig = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.appId,
);

export const isFirebaseConfigured = hasRequiredConfig;
export const DATABASE_URL = firebaseConfig.databaseURL;
export const FB_KEY = import.meta.env.VITE_FIREBASE_API_KEY;
export const FB_AUTH_URL = "https://identitytoolkit.googleapis.com/v1/accounts";
export const ADMIN_EMAIL =
  import.meta.env.VITE_ADMIN_EMAIL || "gunitsingh1994@gmail.com";
export const ADMIN_UID =
  import.meta.env.VITE_ADMIN_UID || "N3z04ZYCleZjOApobL3VZepaOwi1";
export const ADMIN_PASS_HASH =
  import.meta.env.VITE_ADMIN_PASS_HASH ||
  "0189c7742ecf4542ecab0150b32ecadc9ce7c4390217bfb3914f5b52b14e3cb6";

const app = hasRequiredConfig ? initializeApp(firebaseConfig) : null;
export const auth = app ? getAuth(app) : null;
export const db = app ? getDatabase(app) : null;
export const storage = app ? getStorage(app) : null;
export const hasFirebaseRuntime = Boolean(app && auth && db);

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  hd: "gmail.com",
  prompt: "select_account",
});
export { googleProvider };

export const initializeFirebase = async () => {
  if (!auth) return;

  try {
    setPersistence(auth, browserLocalPersistence);
  } catch (error) {
    console.warn("Failed to set auth persistence:", error);
  }
};

export { firebaseOptimizer };
window.__FirebaseOptimizer = firebaseOptimizer;

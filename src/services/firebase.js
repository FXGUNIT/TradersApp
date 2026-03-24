import { initializeApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import { getStorage } from 'firebase/storage';
import { GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBPN7fIZ-UfVQ5EMti1TzrFPsi4wtUEtKI",
  authDomain: "traders-regiment.firebaseapp.com",
  projectId: "traders-regiment",
  storageBucket: "traders-regiment.appspot.com",
  messagingSenderId: "1074706591741",
  appId: "1:1074706591741:web:53194a737f7d3d3d3d3d3d",
  databaseURL: "https://traders-regiment-default-rtdb.asia-southeast1.firebasedatabase.app/"
};

export const DATABASE_URL = firebaseConfig.databaseURL;
export const FB_KEY = "AIzaSyBPN7fIZ-UfVQ5EMti1TzrFPsi4wtUEtKI";
export const FB_AUTH_URL = "https://identitytoolkit.googleapis.com/v1/accounts";
export const ADMIN_EMAIL = "gunitsingh1994@gmail.com";
export const ADMIN_UID = "N3z04ZYCleZjOApobL3VZepaOwi1";
export const ADMIN_PASS_HASH = "0189c7742ecf4542ecab0150b32ecadc9ce7c4390217bfb3914f5b52b14e3cb6";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);
export const storage = getStorage(app);

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ 'hd': 'gmail.com', prompt: 'select_account' });
export { googleProvider };

export const initializeFirebase = async () => {
  try {
    setPersistence(auth, browserLocalPersistence);
  } catch (error) {
    console.warn('Failed to set auth persistence:', error);
  }
};

export const firebaseOptimizer = {
  initializeConnectionPool: () => {},
  queueUpdate: () => {},
  createOptimizedListener: (path, cb, database, dbRef, onValueFn) => {
    const pathRef = dbRef(database, path);
    return onValueFn(pathRef, (snapshot) => cb(snapshot.val() || {}));
  },
  getMetrics: () => ({ status: 'active' }),
};

window.__FirebaseOptimizer = firebaseOptimizer;

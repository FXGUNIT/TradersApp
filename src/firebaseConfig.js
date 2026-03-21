import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBPN7fIZ-UfVQ5EMti1TzrFPsi4wtUEtKI",
  authDomain: "traders-regiment.firebaseapp.com",
  projectId: "traders-regiment",
  storageBucket: "traders-regiment.appspot.com",
  messagingSenderId: "1074706591741",
  appId: "1:1074706591741:web:53194a737f7d3d3d3d3d3d",
  databaseURL: "https://traders-regiment-default-rtdb.asia-southeast1.firebasedatabase.app/"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);
export const storage = getStorage(app);
export default app;

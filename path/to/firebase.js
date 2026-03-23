import { initializeApp } from 'firebase/app';
import { getFirestore, setPersistence, browserLocalPersistence } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBPN7fIZ-UfVQ5EMti1TzrFPsi4wtUEtKI",
  authDomain: "your-auth-domain.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-storage-bucket.appspot.com",
  messagingSenderId: "your-messaging-sender-id",
  appId: "your-app-id"
};

try {
  const firebaseApp = initializeApp(firebaseConfig);
  setPersistence(firebaseAuth, browserLocalPersistence).catch((error) => {
    console.warn("Failed to set auth persistence", error);
  });
} catch (error) {
  console.error("Error initializing Firebase app", error);
}

export const db = getFirestore(firebaseApp);

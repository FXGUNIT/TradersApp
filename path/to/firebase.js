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

const firebaseApp = initializeApp(firebaseConfig);
setPersistence(firebaseAuth, browserLocalPersistence);

export const db = getFirestore(firebaseApp);

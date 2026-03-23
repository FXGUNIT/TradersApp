const firebaseConfig = {
  apiKey: "AIzaSyBPN7fIZ-UfVQ5EMti1TzrFPsi4wtUEtKI",
  authDomain: "your-auth-domain.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-storage-bucket.appspot.com",
  messagingSenderId: "your-messaging-sender-id",
  appId: "your-app-id"
};

const DATABASE_URL = firebaseConfig.databaseURL;
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  hd: "gmail.com"
});

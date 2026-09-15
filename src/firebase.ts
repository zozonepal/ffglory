import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyCuJBkQtpopn2azuv3YUjOYAZ3Hnv8DYu8",
  authDomain: "tech-store-e4449.firebaseapp.com",
  databaseURL: "https://tech-store-e4449-default-rtdb.firebaseio.com/",
  projectId: "tech-store-e4449",
  storageBucket: "tech-store-e4449.firebasestorage.app",
  messagingSenderId: "337071303877",
  appId: "1:337071303877:web:3a29ef5f22643f234dd4ac",
  measurementId: "G-FXM6PH044Q",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);
export const googleProvider = new GoogleAuthProvider();

export default app;

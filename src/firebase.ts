import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyCLGJCtiJGH6xtdGrhDTvFva4Yhu49f2yE",
  authDomain: "ffgloryshop.firebaseapp.com",
  databaseURL: "https://ffgloryshop-default-rtdb.firebaseio.com",
  projectId: "ffgloryshop",
  storageBucket: "ffgloryshop.firebasestorage.app",
  messagingSenderId: "535100234729",
  appId: "1:535100234729:web:f20eef43c5cbe5b77bc978",
  measurementId: "G-RLS4PXKHSS",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);
export const googleProvider = new GoogleAuthProvider();

export default app;

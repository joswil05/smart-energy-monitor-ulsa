import { initializeApp, getApps } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDKPdI9xkrFVOEJ83moYlzHKyHbyOWIiP0",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "smart-energy-ulsa.firebaseapp.com",
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || "https://smart-energy-ulsa-default-rtdb.firebaseio.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "smart-energy-ulsa-default-rtdb",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "smart-energy-ulsa-default-rtdb.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "1234567890",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:1234567890:web:abcdef123456"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const db = getDatabase(app);


// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDO2hBTPKoQe8npuCjy6Jg8wQkx75l2L58",
  authDomain: "kidsfullcare.firebaseapp.com",
  projectId: "kidsfullcare",
  storageBucket: "kidsfullcare.firebasestorage.app",
  messagingSenderId: "580772669124",
  appId: "1:580772669124:web:4fdd866e525e74ba93cb91",
  measurementId: "G-TNDC6X235X"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

export const auth = getAuth(app);
export const db = getFirestore(app);
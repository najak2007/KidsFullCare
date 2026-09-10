// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";

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

export const firebaseApp = app;
export const auth = getAuth(app);
export const db = getFirestore(app);

// searchSchool 등 Cloud Functions(2nd gen) 호출용 인스턴스.
// 주의: 아래 리전은 실제 배포된 함수의 리전과 반드시 일치해야 합니다.
// 현재 searchSchool은 us-central1로 배포되어 있어서 우선 이렇게 맞춰둡니다.
// 나중에 서울 리전(asia-northeast3)으로 재배포하시면 이 값도 함께 바꿔주세요.
export const functions = getFunctions(app, "us-central1");
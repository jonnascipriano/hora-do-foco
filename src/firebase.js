// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBs9zMVSgx9TuMo4R7D-stE2Kuio5D_qoU",
  authDomain: "hora-do-foco.firebaseapp.com",
  projectId: "hora-do-foco",
  storageBucket: "hora-do-foco.firebasestorage.app",
  messagingSenderId: "126146739000",
  appId: "1:126146739000:web:e7202f687b8c3ce9cbdfcd",
  measurementId: "G-EF0NW1WJMP"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
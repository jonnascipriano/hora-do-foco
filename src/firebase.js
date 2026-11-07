// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBs9zMVSgx9TuMo4R7D-stE2Kuio5D_qoU",
  authDomain: "hora-do-foco.firebaseapp.com",
  projectId: "hora-do-foco",
  storageBucket: "hora-do-foco.firebasestorage.app",
  messagingSenderId: "126146739000",
  appId: "1:126146739000:web:e7202f687b8c3ce9cbdfcd",
  measurementId: "G-EF0NW1WJMP"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
// eslint-disable-next-line no-unused-vars
const analytics = getAnalytics(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
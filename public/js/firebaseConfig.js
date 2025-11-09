// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: "AIzaSyBJ34YLsYNL9gDsBVxWGD4sOeUidUgHCVM",
    authDomain: "sposlearning-group20.firebaseapp.com",
    projectId: "sposlearning-group20",
    storageBucket: "sposlearning-group20.firebasestorage.app",
    messagingSenderId: "739083982229",
    appId: "1:739083982229:web:3bf576d1b93a31d5e5529c",
    measurementId: "G-985HT1GDW4"
};




// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
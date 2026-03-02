import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyBJ34YLsYNL9gDsBVxWGD4sOeUidUgHCVM",
    authDomain: "sposlearning-group20.firebaseapp.com",
    projectId: "sposlearning-group20",
    storageBucket: "sposlearning-group20.firebasestorage.app",
    messagingSenderId: "739083982229",
    appId: "1:739083982229:web:3bf576d1b93a31d5e5529c",
    measurementId: "G-985HT1GDW4"
};


export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

onAuthStateChanged(auth, (user) => {
    const hasLoginCookie = document.cookie.includes('isLoggedIn=true');

    if (!user) {
        if (hasLoginCookie) {
            setTimeout(() => {
                if (!auth.currentUser) {
                    window.location.href = "https://sposlearning.cz/login";
                }
            }, 2000);
        } else {
            window.location.href = "https://sposlearning.cz/login";
        }
    }
});
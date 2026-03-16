import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyBJ34YLsYNL9gDsBVxWGD4sOeUidUgHCVM",
    authDomain: "sposlearning-group20.firebaseapp.com",
    projectId: "sposlearning-group20",
    storageBucket: "sposlearning-group20.firebasestorage.app",
    messagingSenderId: "739083982229",
    appId: "1:739083982229:web:3bf576d1b93a31d5e5529c",
    measurementId: "G-985HT1GDW4"
};

const KRATOS_URL = "https://auth.sposlearning.cz";
const LOGIN_URL = "https://sposlearning.cz/login";

async function checkAdminSession() {
    try {
        const response = await fetch(`${KRATOS_URL}/sessions/whoami`, {
            method: 'GET',
            credentials: 'include',
            headers: { 'Accept': 'application/json' }
        });

        if (!response.ok) {
            throw new Error('No active session');
        }

        const session = await response.json();
        const user = session.identity;

        const isAdmin = user.metadata_public?.admin === true;

        if (!isAdmin) {
            console.warn("User is not an administrator.");
            window.location.href = LOGIN_URL;
            return;
        }

        console.log("Admin session verified:", user.traits.email);
        return user;

    } catch (error) {
        console.error("Auth check failed:", error);
        window.location.href = LOGIN_URL;
    }
}

const adminUser = await checkAdminSession();

if (adminUser) {
    document.getElementById('admin-email').textContent = adminUser.traits.email;
}
if (token) {
    handleTokenExchange().then(() => {
        setupAuthObserver();
    });
} else {
    setupAuthObserver();
}
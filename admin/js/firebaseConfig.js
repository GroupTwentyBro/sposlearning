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

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

const urlParams = new URLSearchParams(window.location.search);
const token = urlParams.get('token');

async function exchangeToken(idToken) {
    const response = await fetch('https://admin.sposlearning.cz/debug_exchange.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken })
    });
    if (!response.ok) throw new Error('Exchange failed');
    const { customToken } = await response.json();
    if (!customToken) throw new Error('No custom token');
    return customToken;
}

async function handleTokenExchange() {
    try {
        const customToken = await exchangeToken(token);
        await signInWithCustomToken(auth, customToken);
        window.history.replaceState({}, document.title, window.location.pathname);
        console.log('Signed in via token exchange');
    } catch (error) {
        console.error('Token exchange error:', error);
        window.location.href = 'https://sposlearning.cz/login';
    }
}

function setupAuthObserver() {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            console.log("Admin session active:", user.email);
        } else {
            window.location.href = 'https://sposlearning.cz/login';
        }
    });
}

if (token) {
    handleTokenExchange().then(() => {
        setupAuthObserver();
    });
} else {
    setupAuthObserver();
}
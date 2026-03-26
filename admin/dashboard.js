import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { initThemeListeners } from '/js/theming.js';

const firebaseConfig = {
    apiKey: "AIzaSyBJ34YLsYNL9gDsBVxWGD4sOeUidUgHCVM",
    authDomain: "sposlearning-group20.firebaseapp.com",
    projectId: "sposlearning-group20",
    storageBucket: "sposlearning-group20.firebasestorage.app",
    messagingSenderId: "739083982229",
    appId: "1:739083982229:web:3bf576d1b93a31d5e5529c"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const container = document.getElementById('secure-container');
const loader = document.querySelector('.dot-container');

async function loadDashboard() {
    try {
        const docRef = doc(db, "admin-pages", "dashboard");
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();

            container.innerHTML = data.html;

            if (loader) loader.classList.add('hidden');
            container.classList.add('visible');

            initThemeListeners();
            setupLogout();

        } else {
            throw new Error("Document 'admin-pages/dashboard' not found in Firestore.");
        }
    } catch (error) {
        console.error("Firestore Error:", error);
        if (loader) loader.classList.add('hidden');
        container.innerHTML = `<div class="text-center m-5">Error: ${error.message}</div>`;
    }
}

const KRATOS_URL = "https://auth.sposlearning.cz";

async function setupLogout() {
    const logoutBtn = document.getElementById('logout-button');
    if (!logoutBtn) return;

    logoutBtn.addEventListener('click', async (e) => {
        e.preventDefault();

        try {
            const res = await fetch(`${KRATOS_URL}/self-service/logout/browser`, {
                credentials: 'include',
                headers: { 'Accept': 'application/json' }
            });

            if (res.ok) {
                const logoutFlow = await res.json();
                window.location.href = logoutFlow.logout_url;
            } else {
                window.location.href = 'https://sposlearning.cz/login';
            }
        } catch (err) {
            console.error("Logout failed:", err);
            window.location.href = 'https://sposlearning.cz';
        }
    });
}

loadDashboard();
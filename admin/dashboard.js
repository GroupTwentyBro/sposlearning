import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { initThemeListeners } from '/js/theming.js';

// --- CONFIGURATION ---
const firebaseConfig = {
    apiKey: "AIzaSyBJ34YLsYNL9gDsBVxWGD4sOeUidUgHCVM",
    authDomain: "sposlearning-group20.firebaseapp.com",
    projectId: "sposlearning-group20",
    storageBucket: "sposlearning-group20.firebasestorage.app",
    messagingSenderId: "739083982229",
    appId: "1:739083982229:web:3bf576d1b93a31d5e5529c"
};

const KRATOS_URL = "https://auth.sposlearning.cz";
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const container = document.getElementById('secure-container');
const loader = document.querySelector('.dot-container');

/**
 * 1. AUTH GUARD
 * Checks Kratos for a valid session and Admin privileges.
 */
async function checkAdminAccess() {
    try {
        const res = await fetch(`${KRATOS_URL}/sessions/whoami`, {
            credentials: 'include',
            headers: { 'Accept': 'application/json' }
        });

        if (!res.ok) {
            // Not logged in at all
            window.location.href = 'https://sposlearning.cz/login';
            return false;
        }

        const session = await res.json();

        // Verify the 'admin' flag in Kratos metadata_public
        if (session.identity?.metadata_public?.admin !== true) {
            console.error("Access denied: User is not an admin.");
            window.location.href = 'https://sposlearning.cz/';
            return false;
        }

        return true;
    } catch (err) {
        console.error("Security check failed:", err);
        window.location.href = 'https://sposlearning.cz/login';
        return false;
    }
}

/**
 * 2. LOGOUT LOGIC
 * Properly destroys the Kratos session cookie.
 */
async function handleLogout(e) {
    if (e) e.preventDefault();

    try {
        // Request a logout URL from Kratos (contains a required anti-CSRF token)
        const res = await fetch(`${KRATOS_URL}/self-service/logout/browser`, {
            credentials: 'include',
            headers: { 'Accept': 'application/json' }
        });

        if (res.ok) {
            const flow = await res.json();
            // This redirect actually clears the 'ory_kratos_session' cookie
            window.location.href = flow.logout_url;
        } else {
            window.location.href = 'https://sposlearning.cz/login';
        }
    } catch (err) {
        console.error("Logout failed:", err);
        window.location.href = 'https://sposlearning.cz';
    }
}

/**
 * 3. DASHBOARD INITIALIZATION
 */
async function init() {
    // SECURITY FIRST: Check if user is allowed to be here
    const authorized = await checkAdminAccess();
    if (!authorized) return;

    try {
        // Fetch the HTML shell from Firestore
        const docRef = doc(db, "admin-pages", "dashboard");
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();

            // Render content
            container.innerHTML = data.html;

            // UI Adjustments
            if (loader) loader.classList.add('hidden');
            container.classList.add('visible');

            // Re-init listeners for the freshly injected HTML
            initThemeListeners();

            const logoutBtn = document.getElementById('logout-button');
            if (logoutBtn) {
                logoutBtn.addEventListener('click', handleLogout);
            }

        } else {
            throw new Error("Dashboard configuration missing.");
        }
    } catch (error) {
        console.error("Dashboard Load Error:", error);
        if (loader) loader.classList.add('hidden');
        container.innerHTML = `
            <div class="alert alert-danger m-5">
                <h4>System Error</h4>
                <p>${error.message}</p>
                <a href="https://sposlearning.cz" class="btn btn-outline-danger">Return Home</a>
            </div>`;
    }
}

// Start the sequence
init();
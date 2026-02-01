import { app, auth } from '../js/firebaseConfig.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// Import the new modular theming functions
import { initThemeListeners } from '/js/theming.js';

const db = getFirestore(app);
const container = document.getElementById('secure-container');

// 1. Check Auth
onAuthStateChanged(auth, async (user) => {
    if (user) {
        console.log('User verified:', user.uid);
        try {
            await loadDashboardContent();
        } catch (error) {
            console.error("Access denied:", error);
            container.innerHTML = `
                <div class="alert alert-danger text-center m-5">
                    <h1>403</h1>
                    <p>You are not an authorized administrator.</p>
                </div>`;
        }
    } else {
        console.log('No user, redirecting...');
        window.location.href = '/';
    }
});

// 2. Fetch HTML from Firestore
async function loadDashboardContent() {
    const docRef = doc(db, "admin", "dashboard");
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        // INJECT THE HTML
        container.innerHTML = docSnap.data().html;

        // 3. Initialize UI Logic
        // This attaches logout and other non-theme specific listeners
        initializeGeneralScripts();

        // This attaches the modular theme listeners to the newly injected buttons
        initThemeListeners();
    } else {
        container.innerHTML = "<h3>Error: Dashboard content not found in database.</h3>";
    }
}

// 4. General Listeners (Logout, etc.)
function initializeGeneralScripts() {
    const logoutBtn = document.getElementById('logout-button');
    if(logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            signOut(auth).then(() => window.location.href = '/');
        });
    }

    // You can add other non-theme button listeners here (e.g., Refresh, Edit, etc.)
}
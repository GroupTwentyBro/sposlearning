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
        // 1. INJECT THE HTML
        container.innerHTML = docSnap.data().html;

        // 2. HIDE THE LOADING DOT
        const loader = document.querySelector('.dot-container');
        if (loader) {
            loader.classList.add('hidden'); // This triggers the CSS fade-out
        }

        // 3. Initialize UI Logic
        initializeGeneralScripts();
        initThemeListeners();

        // Optional: Ensure the container is visible if you use the 'visible' class
        container.classList.add('visible');
    } else {
        container.innerHTML = "<h3>Error: Dashboard content not found.</h3>";
        // Hide loader even on error so user can see the message
        document.querySelector('.dot-container')?.classList.add('hidden');
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
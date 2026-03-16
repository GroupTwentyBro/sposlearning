import { app } from '/js/firebaseConfig.js';
import { getFirestore, doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { initThemeListeners } from '/js/theming.js';

const KRATOS_URL = "https://auth.sposlearning.cz";
const db = getFirestore(app);
const container = document.getElementById('secure-container');

async function verifyKratosAdmin() {
    try {
        const response = await fetch(`${KRATOS_URL}/sessions/whoami`, {
            method: 'GET',
            credentials: 'include',
            headers: { 'Accept': 'application/json' }
        });

        if (!response.ok) throw new Error('Not logged in');

        const session = await response.json();
        const isAdmin = session.identity.metadata_public?.admin === true;

        if (!isAdmin) throw new Error('Not an admin');

        console.log('Kratos Admin Verified:', session.identity.traits.email);
        await loadDashboardContent();

    } catch (error) {
        console.error("Access denied:", error);
        document.querySelector('.dot-container')?.classList.add('hidden');
        container.innerHTML = `
            <div class="alert alert-danger text-center m-5" style="background: none !important; border: none;">
                <h1 style="color: var(--root-fg-clr);">403</h1>
                <p style="color: var(--root-txt-clr);">You are not an authorized administrator.</p>
                <a href="https://sposlearning.cz/login" style="color: var(--primary-hl-clr);">Go back to login...</a>
            </div>`;
    }
}

async function loadDashboardContent() {
    const docRef = doc(db, "admin-pages", "dashboard");
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        container.innerHTML = docSnap.data().html;

        document.querySelector('.dot-container')?.classList.add('hidden');

        initializeGeneralScripts();
        initThemeListeners();
        container.classList.add('visible');
    } else {
        container.innerHTML = "<h3>Error: Dashboard content not found.</h3>";
        document.querySelector('.dot-container')?.classList.add('hidden');
    }
}

function initializeGeneralScripts() {
    const logoutBtn = document.getElementById('logout-button');
    if(logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            const res = await fetch(`${KRATOS_URL}/self-service/logout/browser`, {
                method: 'GET',
                credentials: 'include'
            });
            const data = await res.json();
            if (data.logout_url) {
                window.location.href = data.logout_url;
            } else {
                window.location.href = 'https://www.sposlearning.cz/login';
            }
        });
    }
}

verifyKratosAdmin();
import { app, auth } from '../js/firebaseConfig.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

import { initThemeListeners } from '/js/theming.js';

const db = getFirestore(app);
const container = document.getElementById('secure-container');

onAuthStateChanged(auth, async (user) => {
    if (user) {
        console.log('User verified:', user.uid);
        try {
            await loadDashboardContent();
        } catch (error) {
            document.querySelector('.dot-container')?.classList.add('hidden');
            console.error("Access denied:", error);
            container.innerHTML = `
                <div class="alert alert-danger text-center m-5" style="background: none !important; border: none;">
                    <h1 style="color: var(--root-fg-clr);">403</h1>
                    <p style="color: var(--root-txt-clr);">You are not an authorized administrator.</p>
                    <a href="/" style="color: var(--primary-hl-clr);">Go back...</a>
                </div>`;
        }
    } else {
        console.log('No user, redirecting...');
        window.location.href = '/';
    }
});

async function loadDashboardContent() {
    const docRef = doc(db, "admin-pages", "dashboard");
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        container.innerHTML = docSnap.data().html;

        const loader = document.querySelector('.dot-container');
        if (loader) {
            loader.classList.add('hidden');
        }

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
        logoutBtn.addEventListener('click', () => {
            signOut(auth).then(() => window.location.href = '/');
        });
    }

}
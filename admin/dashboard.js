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
ě
        } else {
            throw new Error("Document 'admin-pages/dashboard' not found in Firestore.");
        }
    } catch (error) {
        console.error("Firestore Error:", error);
        if (loader) loader.classList.add('hidden');
        container.innerHTML = `<div class="text-center m-5">Error: ${error.message}</div>`;
    }
}

function setupLogout() {
    const logoutBtn = document.getElementById('logout-button');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            window.location.href = 'https://sposlearning.cz';
        });
    }
}

loadDashboard();
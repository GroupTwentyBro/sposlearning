import { app } from './firebaseConfig.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// Modular Theme Import
import { initThemeListeners, applyTheme } from './theming.js';

const db = getFirestore(app);
const auth = getAuth(app);

const form = document.getElementById('feedback-form');
const submitBtn = document.getElementById('submit-btn');
const statusMsg = document.getElementById('status-message');
const pageInput = document.getElementById('feedback-page');

// Initialize Modular Theming listeners
initThemeListeners();

// Handle the unique toggle button for this page
const toggleBtn = document.getElementById("theme-toggle");
if (toggleBtn) {
    const updateToggleUI = () => {
        const isDark = localStorage.getItem("theme") === "dark";
        toggleBtn.classList.toggle("is-dark", isDark);
    };
    toggleBtn.addEventListener("click", () => {
        const current = localStorage.getItem("theme");
        applyTheme(current === "dark" ? "light" : "dark");
        updateToggleUI();
    });
    updateToggleUI();
}

// Pre-fill page context from URL
const urlParams = new URLSearchParams(window.location.search);
const relatedPage = urlParams.get("page");
if (relatedPage) pageInput.value = relatedPage;

// Listen for Auth State to Autofill
onAuthStateChanged(auth, (user) => {
    const emailInput = document.getElementById('feedback-contact');
    const nameInput = document.getElementById('feedback-name');

    if (user) {
        if (user.email) {
            emailInput.value = user.email;
            emailInput.readOnly = true;
            emailInput.style.backgroundColor = "var(--root-box-bg-clr)";
            emailInput.style.opacity = "0.7";
            emailInput.title = "Přihlášeno jako " + user.email;
        }
        if (user.displayName && !nameInput.value) {
            nameInput.value = user.displayName;
        }
    } else {
        emailInput.readOnly = false;
        emailInput.style.opacity = "1";
        emailInput.style.backgroundColor = ""; // Revert to theme default
    }
});

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    submitBtn.disabled = true;
    submitBtn.textContent = 'Odesílání...';
    statusMsg.textContent = '';

    try {
        let ipAddress = 'Unknown';
        try {
            const ipRes = await fetch('https://api.ipify.org?format=json');
            const ipData = await ipRes.json();
            ipAddress = ipData.ip;
        } catch (err) { console.warn("Could not fetch IP:", err); }

        await addDoc(collection(db, 'feedback'), {
            title: document.getElementById('feedback-title').value,
            page: document.getElementById('feedback-page').value,
            name: document.getElementById('feedback-name').value || 'Anonymous',
            contact: document.getElementById('feedback-contact').value || 'Not provided',
            message: document.getElementById('feedback-message').value,
            relatedPage: pageInput.value || 'General',
            ip: ipAddress,
            userAgent: navigator.userAgent,
            timestamp: serverTimestamp(),
            uid: auth.currentUser ? auth.currentUser.uid : null,
            resolved: false
        });

        statusMsg.className = 'text-success font-weight-bold';
        statusMsg.textContent = 'Zpětná vazba byla úspěšně odeslána!';
        form.reset();

        if (auth.currentUser && auth.currentUser.email) {
            document.getElementById('feedback-contact').value = auth.currentUser.email;
        }

        setTimeout(() => {
            window.location.href = '/';
        }, 2000);

    } catch (error) {
        console.error('Error:', error);
        statusMsg.className = 'text-danger';
        statusMsg.textContent = 'Chyba při odesílání.';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Odeslat zpětnou vazbu';
    }
});
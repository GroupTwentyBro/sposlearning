import { app } from './firebaseConfig.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { initThemeListeners, applyTheme } from './theming.js';

const db = getFirestore(app);
const auth = getAuth(app);

const form = document.getElementById('feedback-form');
const submitBtn = document.getElementById('submit-btn');
const statusMsg = document.getElementById('status-message');
const pageInput = document.getElementById('feedback-page');
const nameInput = document.getElementById('feedback-name');
const formWrapper = document.getElementById('feedback-form-wrapper');

initThemeListeners();

// Theme toggle logic (standard)
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

const urlParams = new URLSearchParams(window.location.search);
const relatedPage = urlParams.get("page");
if (relatedPage) pageInput.value = relatedPage;

/**
 * AUTH & REDIRECT LOGIC
 */
onAuthStateChanged(auth, (user) => {
    if (!user) {
        // Redirect if not logged in
        window.location.href = '/login';
        return;
    }

    // Show form if logged in
    formWrapper.style.display = 'block';

    // CHECK PROVIDER TYPE
    // password = manual sign up | google.com / github.com = external service
    const providerId = user.providerData[0]?.providerId;

    if (providerId === 'google.com' || providerId === 'github.com') {
        // Services provide names: Autofill and Disable
        nameInput.value = user.displayName || '';
        nameInput.readOnly = true;
        nameInput.style.opacity = "0.7";
        nameInput.title = "Jméno je načteno z vašeho účtu.";
    } else {
        // Regular email/pass: Allow user to set their name
        nameInput.readOnly = false;
        nameInput.style.opacity = "1";
    }
});

const isJunk = (name, message) => {
    const hp = document.getElementById('hp_field')?.value;
    if (hp) return "Bot detected.";

    const nameLow = name.toLowerCase().trim();
    if (/(.)\1{4,}/.test(nameLow)) return "Neplatné znaky ve jménu.";
    if (message.length < 10) return "Zpráva je příliš krátká.";

    return null;
};

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;

    const title = document.getElementById('feedback-title').value;
    const page = document.getElementById('feedback-page').value;
    const name = nameInput.value || 'Anonymous';
    const message = document.getElementById('feedback-message').value;

    const validationError = isJunk(name, message);
    if (validationError) {
        statusMsg.className = 'text-danger';
        statusMsg.textContent = validationError;
        return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Odesílání...';

    try {
        let ipAddress = 'Unknown';
        try {
            const ipRes = await fetch('https://api.ipify.org?format=json');
            const ipData = await ipRes.json();
            ipAddress = ipData.ip;
        } catch (err) { console.warn("IP fetch failed"); }

        await addDoc(collection(db, 'feedback'), {
            title: title.trim(),
            page: page.trim(),
            name: name.trim(),
            contact: user.email, // Always take email from Auth, never user input
            message: message.trim(),
            relatedPage: pageInput.value || 'General',
            ip: ipAddress,
            userAgent: navigator.userAgent,
            timestamp: serverTimestamp(),
            uid: user.uid,
            resolved: false
        });

        statusMsg.className = 'text-success font-weight-bold';
        statusMsg.textContent = 'Děkujeme! Vaše zpětná vazba byla odeslána.';
        form.reset();

        setTimeout(() => { window.location.href = '/'; }, 2000);

    } catch (error) {
        console.error('Error:', error);
        statusMsg.className = 'text-danger';
        statusMsg.textContent = 'Chyba při odesílání.';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Odeslat zpětnou vazbu';
    }
});
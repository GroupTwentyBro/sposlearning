import { app } from './firebaseConfig.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { initThemeListeners, applyTheme } from './theming.js';

const db = getFirestore(app);
const auth = getAuth(app);

// Elements
const form = document.getElementById('feedback-form');
const submitBtn = document.getElementById('submit-btn');
const statusMsg = document.getElementById('status-message');
const pageInput = document.getElementById('feedback-page');
const nameInput = document.getElementById('feedback-name');
const formWrapper = document.getElementById('feedback-form-wrapper');

// Initialize Modular Theming listeners
initThemeListeners();

// Theme toggle logic
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

/**
 * 1. AUTH & REDIRECT LOGIC
 */
onAuthStateChanged(auth, (user) => {
    if (!user) {
        // Strict requirement: must be logged in to even see the form
        window.location.href = '/login';
        return;
    }

    // Show form once auth is confirmed
    if (formWrapper) formWrapper.style.display = 'block';

    // Handle Name field based on Provider
    const providerId = user.providerData[0]?.providerId;
    if (providerId === 'google.com' || providerId === 'github.com') {
        nameInput.value = user.displayName || '';
        nameInput.readOnly = true;
        nameInput.style.opacity = "0.7";
        nameInput.title = "Jméno je načteno z vašeho účtu.";
    } else {
        nameInput.readOnly = false;
        nameInput.style.opacity = "1";
    }
});

/**
 * 2. VALIDATION
 */
const isJunk = (name, message) => {
    const hp = document.getElementById('hp_field')?.value;
    if (hp) return "Bot detected.";

    const nameLow = name.toLowerCase().trim();
    if (/(.)\1{4,}/.test(nameLow)) return "Neplatné znaky ve jménu.";
    if (message.length < 10) return "Zpráva je příliš krátká.";

    return null;
};

/**
 * 3. FORM SUBMISSION & EMAIL BRIDGE
 */
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
    statusMsg.textContent = '';

    try {
        // Get IP for logs
        let ipAddress = 'Unknown';
        try {
            const ipRes = await fetch('https://api.ipify.org?format=json');
            const ipData = await ipRes.json();
            ipAddress = ipData.ip;
        } catch (err) { console.warn("IP fetch failed"); }

        const feedbackData = {
            title: title.trim(),
            page: page.trim(),
            name: name.trim(),
            contact: user.email,
            message: message.trim(),
            relatedPage: pageInput.value || 'General',
            ip: ipAddress,
            userAgent: navigator.userAgent,
            timestamp: serverTimestamp(),
            uid: user.uid,
            resolved: false
        };

        // Step A: Save to Firestore
        await addDoc(collection(db, 'feedback'), feedbackData);

        // Step B: Trigger Email Notification via PHP Bridge
        // We don't 'await' this so the user doesn't wait for the mail server response
        fetch('/api/send-mail.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: feedbackData.title,
                name: feedbackData.name,
                message: feedbackData.message,
                page: feedbackData.relatedPage,
                contact: feedbackData.contact
            })
        }).then(response => {
            if (!response.ok) console.error("Email bridge error status:", response.status);
        }).catch(err => console.error("Email bridge fetch failed:", err));

        // Step C: Success UI
        statusMsg.className = 'text-success font-weight-bold';
        statusMsg.textContent = 'Děkujeme! Vaše zpětná vazba byla odeslána.';
        form.reset();

        // Optional: Autofill name again if they stayed on page
        if (user.displayName && (user.providerData[0]?.providerId !== 'password')) {
            nameInput.value = user.displayName;
        }

        setTimeout(() => { window.location.href = '/'; }, 2000);

    } catch (error) {
        console.error('Error:', error);
        statusMsg.className = 'text-danger';
        statusMsg.textContent = 'Chyba při odesílání do databáze.';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Odeslat zpětnou vazbu';
    }
});
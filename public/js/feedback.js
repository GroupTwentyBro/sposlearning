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
        emailInput.style.backgroundColor = "";
    }
});

/**
 * 1. ANTI-SPAM & JUNK VALIDATION
 */
const isJunk = (email, name, message) => {
    // Honeypot check (Assumes you add <input id="hp_field" style="display:none"> to HTML)
    const hp = document.getElementById('hp_field')?.value;
    if (hp) return "Bot detected.";

    const emailLow = email.toLowerCase().trim();
    const nameLow = name.toLowerCase().trim();

    // Comprehensive blocklist
    const blockedTerms = [
        'a@a.a', 'null@null.null', 'test@test.com', 'none@none.com', 'asdf@asdf.com',
        'qwerty@qwerty.com', '123@123.com', 'mail@mail.com', 'xyz@xyz.com',
        'admin@', 'support@', 'placeholder', 'undefined', 'NaN', '123456'
    ];

    // Substring patterns
    const junkPatterns = [
        /^.{1,3}@.{1,3}\..{1,3}$/,        // Too short (e.g. x@y.z)
        /^(.)\1+@/i,                      // Repetitive chars (e.g. aaaa@)
        /asdf|qwerty|zxcvbn|12345/i       // Keyboard mashes
    ];

    // Entropy check: detect long strings of same characters (e.g. "kkkkkkkkkk")
    if (/(.)\1{4,}/.test(emailLow) || /(.)\1{4,}/.test(nameLow)) return "Neplatné znaky.";

    if (blockedTerms.some(term => emailLow.includes(term) || nameLow === term)) return "Tento vstup není povolen.";
    if (junkPatterns.some(pattern => pattern.test(emailLow))) return "Prosím zadejte platné údaje.";

    // Basic format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailLow)) return "Neplatný formát e-mailu.";
    if (message.length < 10) return "Zpráva je příliš krátká.";

    return null; // Passed validation
};

/**
 * 2. FORM SUBMISSION
 */
form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const title = document.getElementById('feedback-title').value;
    const page = document.getElementById('feedback-page').value;
    const name = document.getElementById('feedback-name').value || 'Anonymous';
    const contact = document.getElementById('feedback-contact').value || 'Not provided';
    const message = document.getElementById('feedback-message').value;

    // Run Validation
    const validationError = isJunk(contact, name, message);
    if (validationError) {
        statusMsg.className = 'text-danger';
        statusMsg.textContent = validationError;
        return;
    }

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
            title: title.trim(),
            page: page.trim(),
            name: name.trim(),
            contact: contact.trim(),
            message: message.trim(),
            relatedPage: pageInput.value || 'General',
            ip: ipAddress,
            userAgent: navigator.userAgent,
            timestamp: serverTimestamp(),
            uid: auth.currentUser ? auth.currentUser.uid : null,
            resolved: false // Rules require this to be false
        });

        statusMsg.className = 'text-success font-weight-bold';
        statusMsg.textContent = 'Zpětná vazba byla úspěšně odeslána!';
        form.reset();

        if (auth.currentUser && auth.currentUser.email) {
            document.getElementById('feedback-contact').value = auth.currentUser.email;
        }

        setTimeout(() => { window.location.href = '/'; }, 2000);

    } catch (error) {
        console.error('Error:', error);
        statusMsg.className = 'text-danger';
        statusMsg.textContent = 'Chyba při odesílání (Pravděpodobně neplatná data).';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Odeslat zpětnou vazbu';
    }
});
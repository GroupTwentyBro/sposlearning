import { auth } from './firebaseConfig.js';
import {
    signInWithEmailAndPassword,
    setPersistence,
    browserLocalPersistence,
    GoogleAuthProvider,
    signInWithPopup,
    signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Modular Theme Import
import { initThemeListeners, applyTheme } from './theming.js';

const ALLOWED_ADMINS = [
    "itsmeteddyhere@gmail.com"
];

// Initialize UI
initThemeListeners();

// Handle the toggle specifically for the login page sun/moon button
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

const loginForm = document.getElementById('login-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const errorMessage = document.getElementById('error-message');
const googleBtn = document.getElementById('google-login-btn');

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = emailInput.value;
    const password = passwordInput.value;
    errorMessage.textContent = '';

    const user = result.user;

    if (!user.emailVerified) {
        errorMessage.textContent = "Váš e-mail není ověřen. Zkontrolujte prosím svou schránku.";
        await signOut(auth); // Kick them out until they verify
        return;
    }

    try {
        await setPersistence(auth, browserLocalPersistence);
        const result = await signInWithEmailAndPassword(auth, email, password);
        const user = result.user;

        // Redirect based on role
        if (ALLOWED_ADMINS.includes(user.email)) {
            window.location.href = '/admin/dashboard';
        } else {
            window.location.href = '/'; // Regular users go home
        }
    } catch (error) {
        console.error('Chyba přihlášení:', error);
        errorMessage.textContent = 'Špatný email nebo heslo';
    }
});

if (googleBtn) {
    googleBtn.addEventListener('click', async () => {
        errorMessage.textContent = '';
        const provider = new GoogleAuthProvider();

        try {
            await setPersistence(auth, browserLocalPersistence);
            const result = await signInWithPopup(auth, provider);
            const user = result.user;

            // REMOVED: signOut(auth) logic
            // We keep them logged in regardless of email
            if (ALLOWED_ADMINS.includes(user.email)) {
                window.location.href = '/admin/dashboard';
            } else {
                // Not an admin, but still logged in!
                // Redirect to homepage so they can send feedback
                window.location.href = '/';
            }
        } catch (error) {
            console.error('Chyba přihlášení přes Google:', error);
            errorMessage.textContent = 'Příhlášení přes Google selhalo.';
        }
    });
}
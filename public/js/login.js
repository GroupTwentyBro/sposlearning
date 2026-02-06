import { auth } from './firebaseConfig.js';
import {
    signInWithEmailAndPassword,
    setPersistence,
    browserLocalPersistence,
    GoogleAuthProvider,
    GithubAuthProvider,
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

async function checkAdminAndRedirect(user) {
    try {
        const adminDocRef = doc(db, "users", user.uid);
        const adminDocSnap = await getDoc(adminDocRef);

        if (adminDocSnap.exists()) {
            console.log("Admin verified via database.");
            window.location.href = '/admin/dashboard';
        } else {
            console.log("Regular user detected.");
            window.location.href = '/';
        }
    } catch (error) {
        console.error("Error checking admin status:", error);
        // Fallback to home if database check fails (e.g. permission denied)
        window.location.href = '/';
    }
}

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
const githubBtn = document.getElementById('github-login-btn');

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = emailInput.value;
    const password = passwordInput.value;
    errorMessage.textContent = '';

    try {
        await setPersistence(auth, browserLocalPersistence);
        const result = await signInWithEmailAndPassword(auth, email, password);
        const user = result.user;

        if (!user.emailVerified) {
            errorMessage.textContent = "Váš e-mail není ověřen. Zkontrolujte prosím svou schránku.";
            await signOut(auth);
            return;
        }

        await checkAdminAndRedirect(user);
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
            await checkAdminAndRedirect(result.user);
        } catch (error) {
            errorMessage.textContent = 'Příhlášení přes Google selhalo.';
        }
    });
}

if (githubBtn) {
    githubBtn.addEventListener('click', async () => {
        errorMessage.textContent = '';
        const provider = new GithubAuthProvider();
        provider.addScope('user:email');
        try {
            await setPersistence(auth, browserLocalPersistence);
            const result = await signInWithPopup(auth, provider);
            await checkAdminAndRedirect(result.user);
        } catch (error) {
            errorMessage.textContent = 'Přihlášení přes GitHub selhalo.';
        }
    });
}
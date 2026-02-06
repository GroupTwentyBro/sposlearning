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

    try {
        await setPersistence(auth, browserLocalPersistence);
        await signInWithEmailAndPassword(auth, email, password);
        window.location.href = '/admin/dashboard';
    } catch (error) {
        console.error('Login error:', error);
        errorMessage.textContent = error.code === 'auth/invalid-credential'
            ? 'Invalid email or password.'
            : 'An error occurred. Please try again.';
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

            if (ALLOWED_ADMINS.includes(user.email)) {
                window.location.href = '/admin/dashboard';
            } else {
                await signOut(auth);
                errorMessage.textContent = `Access Denied: ${user.email} is not an administrator.`;
            }
        } catch (error) {
            console.error('Google Sign-In Error:', error);
            errorMessage.textContent = 'Google Sign-In failed.';
        }
    });
}
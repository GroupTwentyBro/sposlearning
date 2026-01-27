import { auth } from './firebaseConfig.js';

import {
    signInWithEmailAndPassword,
    setPersistence,
    browserLocalPersistence,
    GoogleAuthProvider,
    signInWithPopup,
    signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js"; // <-- FIX #2

const ALLOWED_ADMINS = [
    "itsmeteddyhere@gmail.com"
];

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

        const userCredential = await signInWithEmailAndPassword(auth, email, password);

        console.log('User logged in:', userCredential.user);

        window.location.href = '/admin/dashboard';

    } catch (error) {
        console.error('Login error:', error);

        if (error.code === 'auth/invalid-credential') {
            errorMessage.textContent = 'Invalid email or password. Please try again.';
        } else {
            errorMessage.textContent = 'An error occurred. Please try again later.';
        }
    }
});

if (googleBtn) {
    googleBtn.addEventListener('click', async () => {
        errorMessage.textContent = '';
        const provider = new GoogleAuthProvider();

        try {
            await setPersistence(auth, browserLocalPersistence);

            // Open the popup
            const result = await signInWithPopup(auth, provider);
            const user = result.user;

            // --- THE RESTRICTION LOGIC ---
            if (ALLOWED_ADMINS.includes(user.email)) {
                console.log('Admin authorized:', user.email);
                window.location.href = '/admin/dashboard';
            } else {
                // If email is NOT in the list, kick them out immediately
                console.warn('Unauthorized user tried to login:', user.email);
                await signOut(auth);
                errorMessage.textContent = `Access Denied: ${user.email} is not an administrator.`;
            }

        } catch (error) {
            console.error('Google Sign-In Error:', error);
            errorMessage.textContent = 'Google Sign-In failed. Please try again.';
        }
    });
}
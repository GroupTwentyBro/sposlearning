import { auth } from './firebaseConfig.js';

import {
    signInWithEmailAndPassword,
    setPersistence,
    browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js"; // <-- FIX #2

const loginForm = document.getElementById('login-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const errorMessage = document.getElementById('error-message');

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = emailInput.value;
    const password = passwordInput.value;
    errorMessage.textContent = '';

    try {
        await setPersistence(auth, browserLocalPersistence);

        const userCredential = await signInWithEmailAndPassword(auth, email, password);

        console.log('User logged in:', userCredential.user);

        window.location.href = 'admin/dashboard.html';

    } catch (error) {
        console.error('Login error:', error);

        if (error.code === 'auth/invalid-credential') {
            errorMessage.textContent = 'Invalid email or password. Please try again.';
        } else {
            errorMessage.textContent = 'An error occurred. Please try again later.';
        }
    }
});
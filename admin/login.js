import { app, auth } from '/js/firebaseConfig.js';
import {
    browserLocalPersistence,
    GithubAuthProvider,
    GoogleAuthProvider,
    OAuthProvider,
    setPersistence,
    signInWithEmailAndPassword,
    signInWithPopup,
    signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Missing Firestore imports added:
import { getFirestore, doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

import { applyTheme, initThemeListeners } from '/js/theming.js';

// 1. Import your global logger function
import { createServerLog } from '/js/logging.js';

const db = getFirestore(app);

initThemeListeners();

async function checkAdminAndRedirect(user) {
    try {
        const adminDocRef = doc(db, "administrators", user.uid);
        const adminDocSnap = await getDoc(adminDocRef);
        const isAdmin = adminDocSnap.exists();

        // 2. Log successful login (applies to ALL providers)
        await createServerLog('auth', `Login`, {
            isUser: true,
            userEmail: user.email,
            userName: user.displayName || 'none',
            userEmailVerified: user.emailVerified,
            isAdmin: isAdmin
        });

        if (isAdmin) {
            console.log("Admin verified via database.");
            window.location.href = '/';
        } else {
            console.log("Regular user detected.");
            window.location.href = 'https://sposlearning.cz/';
        }
    } catch (error) {
        console.error("Error checking admin status:", error);
        window.location.href = 'https://sposlearning.cz/';
    }
}

const loginForm = document.getElementById('login-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const errorMessage = document.getElementById('error-message');
const googleBtn = document.getElementById('google-login-btn');
const microsoftBtn = document.getElementById('microsoft-login-btn');
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

        // 3. Log failed login attempt
        await createServerLog('auth', `Neúspěšný pokus o přihlášení`, {
            isUser: false,
            userEmail: email
        });
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

const microsoftProvider = new OAuthProvider('microsoft.com');

microsoftProvider.setCustomParameters({
    tenant: 'common',
    prompt: 'select_account'
});

if (microsoftBtn) {
    microsoftBtn.addEventListener('click', async () => {
        errorMessage.textContent = '';
        try {
            await setPersistence(auth, browserLocalPersistence);
            const result = await signInWithPopup(auth, microsoftProvider);
            await checkAdminAndRedirect(result.user);
        } catch (error) {
            errorMessage.textContent = 'Příhlášení přes Microsoft selhalo.';
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
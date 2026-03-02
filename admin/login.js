import { app, auth } from '/js/firebaseConfig.js';
import {
    browserLocalPersistence,
    GithubAuthProvider,
    GoogleAuthProvider,
    OAuthProvider,
    setPersistence,
    signInWithEmailAndPassword,
    signInWithPopup,
    signOut,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import { getFirestore, doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { initThemeListeners } from '/js/theming.js';
import { createServerLog } from '/js/logging.js';

const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('check') === '1') {
    const submitBtn = document.getElementById('submitBtn');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Synchronizace...";
    }

    const unsubscribe = auth.onAuthStateChanged((user) => {
        if (user) {
            unsubscribe();
            window.history.replaceState({}, document.title, "/login");
            window.location.href = '/';
        }
    });

    setTimeout(() => {
        unsubscribe();
        if (!auth.currentUser && submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = "Log in";
            console.log("Session sync timed out - user must log in manually.");
        }
    }, 4000);
}

const db = getFirestore(app);
initThemeListeners();

async function checkAdminAndRedirect(user) {
    try {
        const adminDocRef = doc(db, "administrators", user.uid);
        const adminDocSnap = await getDoc(adminDocRef);
        const isAdmin = adminDocSnap.exists();

        await createServerLog('auth', `Login`, {
            isUser: true,
            userEmail: user.email,
            userName: user.displayName || 'none',
            userEmailVerified: user.emailVerified,
            isAdmin: isAdmin
        });

        if (isAdmin) {
            window.location.href = '/dashboard';
        } else {
            window.location.href = 'https://sposlearning.cz/';
        }
    } catch (error) {
        console.error("Error checking admin status:", error);
        window.location.href = 'https://sposlearning.cz/';
    }
}

const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const errorMessage = document.getElementById('error-message');
        errorMessage.textContent = '';

        try {
            await setPersistence(auth, browserLocalPersistence);
            const result = await signInWithEmailAndPassword(auth, email, password);

            if (!result.user.emailVerified) {
                errorMessage.textContent = "Váš e-mail není ověřen.";
                await signOut(auth);
                return;
            }

            await checkAdminAndRedirect(result.user);
        } catch (error) {
            console.error('Chyba přihlášení:', error);
            errorMessage.textContent = 'Špatný email nebo heslo';
            await createServerLog('auth', `Neúspěšný pokus (Email/Heslo)`, { userEmail: email });
        }
    });
}

const handleSocialLogin = async (provider) => {
    try {
        await setPersistence(auth, browserLocalPersistence);
        const result = await signInWithPopup(auth, provider);
        await checkAdminAndRedirect(result.user);
    } catch (error) {
        console.error("Social login failed:", error);
    }
};

document.getElementById('google-login-btn')?.addEventListener('click', () => handleSocialLogin(new GoogleAuthProvider()));
document.getElementById('github-login-btn')?.addEventListener('click', () => handleSocialLogin(new GithubAuthProvider()));

document.getElementById('microsoft-login-btn')?.addEventListener('click', async () => {
    const provider = new OAuthProvider('microsoft.com');
    provider.setCustomParameters({ tenant: 'common', prompt: 'select_account' });
    await handleSocialLogin(provider);
});
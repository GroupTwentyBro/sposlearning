import {auth} from './firebaseConfig.js';
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

import {applyTheme, initThemeListeners} from './theming.js';
import {createServerLog} from "./logging.js";

initThemeListeners();

async function checkAdminAndRedirect(user) {
    try {
        const adminDocRef = doc(db, "administrators", user.uid);
        const adminDocSnap = await getDoc(adminDocRef);

        if (adminDocSnap.exists()) {
            console.log("Admin verified via database.");
            await createServerLog('auth', 'Login', {
                isUser: true,
                userEmail: auth.currentUser.email,
                userEmailVerified: auth.currentUser.emailVerified,
                userIsAdmin: true
            });
            window.location.href = 'https://admin.sposlearning.cz/';
        } else {
            console.log("Regular user detected.");
            await createServerLog('auth', 'Login', {
                isUser: true,
                userEmail: auth.currentUser.email,
                userEmailVerified: auth.currentUser.emailVerified,
                userIsAdmin: false
            });
            window.location.href = '/';
        }
    } catch (error) {
        console.error("Error checking admin status:", error);
        window.location.href = '/';
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
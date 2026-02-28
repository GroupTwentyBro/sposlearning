import {auth} from './firebaseConfig.js';
import { onAuthStateChanged, sendEmailVerification, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('display-name-text').textContent = user.displayName || "Not set";

        const emailInput = document.getElementById('account-email');
        const statusDiv = document.getElementById('email-verification-status');
        const resendContainer = document.getElementById('resend-container');

        emailInput.value = user.email;

        if (user.emailVerified) {
            statusDiv.innerHTML = `<span class="text-success d-flex align-items-center">
                <span class="material-symbols-outlined me-1 fs-6">check_circle</span> Email is verified</span>`;
            resendContainer.innerHTML = '';
        } else {
            statusDiv.innerHTML = `<span class="text-warning d-flex align-items-center">
                <span class="material-symbols-outlined me-1 fs-6">error</span> Email is not verified</span>`;
            resendContainer.innerHTML = `<button class="btn btn-sm btn-link text-primary-hl p-0" id="btn-resend">Resend verification email</button>`;

            document.getElementById('btn-resend').onclick = async () => {
                try {
                    const user = auth.currentUser;
                    if (user) {
                        await user.reload();
                        await sendEmailVerification(auth.currentUser);
                        alert("Ověřovací e-mail byl odeslán! Zkontrolujte prosím svou schránku.");
                    }
                } catch (error) {
                    console.error("Chyba při odesílání:", error);
                    if (error.code === 'auth/too-many-requests') {
                        alert("Příliš mnoho požadavků. Zkuste to prosím za chvíli.");
                    } else {
                        alert("Nepodařilo se odeslat e-mail. Zkuste se znovu přihlásit.");
                    }
                }
            };
        }

        document.getElementById('btn-reset-pw').onclick = () => {
            sendPasswordResetEmail(auth, user.email)
                .then(() => alert("Reset link sent to your email!"))
                .catch((error) => console.error(error));
        };

        const providerList = document.getElementById('provider-list');
        const providers = user.providerData.map(p => p.providerId);

        const renderProvider = (id, iconName, label) => {
            const isLinked = providers.includes(id);
            return `<div class="text-center ${isLinked ? 'text-white' : 'opacity-25'}" title="${label}">
                <span class="material-symbols-outlined">${iconName}</span>
                <div style="font-size: 10px;">${isLinked ? 'Linked' : ''}</div>
            </div>`;
        };

        providerList.innerHTML =
            renderProvider('google.com', 'google', 'Google') +
            renderProvider('github.com', 'terminal', 'GitHub') +
            renderProvider('password', 'mail', 'Email');

    } else {
        window.location.href = "/login";
    }
});
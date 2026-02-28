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

        const renderProvider = (id, iconPath, label) => {
            const isLinked = providers.includes(id);
            const isUrl = iconPath.startsWith('http');

            const iconHtml = isUrl
                ? `<img src="${iconPath}" alt="${label}" style="width: 24px; height: 24px; filter: ${isLinked ? 'none' : 'grayscale(100%)'};">`
                : `<span class="material-symbols-outlined" style="font-size: 24px;">${iconPath}</span>`;

            return `
        <div class="text-center ${isLinked ? 'text-white' : 'opacity-25'}" 
             title="${label}" 
             style="min-width: 60px; transition: opacity 0.3s ease;">
            <div class="mb-1 d-flex justify-content-center align-items-center" style="height: 30px;">
                ${iconHtml}
            </div>
            <div style="font-size: 10px; font-weight: bold; height: 12px;">
                ${isLinked ? 'LINKED' : ''}
            </div>
        </div>`;
        };

        providerList.innerHTML =
            renderProvider('google.com', 'https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg', 'Google') +
            renderProvider('microsoft.com', 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/25/Microsoft_icon.svg/1280px-Microsoft_icon.svg.png?20220610071042', 'Microsoft') +
            renderProvider('github.com', 'https://github.githubassets.com/favicons/favicon-dark.png', 'GitHub') +
            renderProvider('password', 'mail', 'Email');

    } else {
        window.location.href = "/login";
    }
});
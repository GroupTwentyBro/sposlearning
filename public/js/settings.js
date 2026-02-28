import { auth } from './firebaseConfig.js';
import {
    onAuthStateChanged,
    sendEmailVerification,
    sendPasswordResetEmail,
    updateProfile
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { applyTheme, getGlobalItem, initThemeListeners } from './theming.js';

window.toggleNameEdit = function() {
    const textSpan = document.getElementById('display-name-text');
    const container = textSpan.parentElement;
    const currentName = textSpan.textContent === "Not set" ? "" : textSpan.textContent;

    container.innerHTML = `
        <div class="d-flex align-items-center justify-content-end">
            <input type="text" id="name-edit-input" class="form-control form-control-sm me-2" 
                   value="${currentName}" style="max-width: 200px;">
            <button class="btn btn-sm btn-success me-1" onclick="saveNameChange()">
                <span class="material-symbols-outlined fs-6">check</span>
            </button>
            <button class="btn btn-sm btn-outline-secondary" onclick="location.reload()">
                <span class="material-symbols-outlined fs-6">close</span>
            </button>
        </div>
    `;
};

window.saveNameChange = async function() {
    const newName = document.getElementById('name-edit-input').value;
    if (auth.currentUser) {
        try {
            await updateProfile(auth.currentUser, { displayName: newName });
            location.reload();
        } catch (error) {
            console.error(error);
            alert("Chyba při ukládání.");
        }
    }
};

onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('display-name-text').textContent = user.displayName || "Not set";
        document.getElementById('account-email').value = user.email;

        const statusDiv = document.getElementById('email-verification-status');
        const resendContainer = document.getElementById('resend-container');

        if (user.emailVerified) {
            statusDiv.innerHTML = `<span class="text-success"><span class="material-symbols-outlined me-1 fs-6">check_circle</span> Email is verified</span>`;
        } else {
            statusDiv.innerHTML = `<span class="text-warning"><span class="material-symbols-outlined me-1 fs-6">error</span> Email is not verified</span>`;
            resendContainer.innerHTML = `<button class="btn btn-sm btn-link text-primary-hl p-0" id="btn-resend">Resend verification email</button>`;
            document.getElementById('btn-resend').onclick = async () => {
                await user.reload();
                await sendEmailVerification(auth.currentUser);
                alert("Email odeslán!");
            };
        }

        document.getElementById('btn-reset-pw').onclick = () => {
            sendPasswordResetEmail(auth, user.email).then(() => alert("Reset link odeslán!"));
        };

        const providerList = document.getElementById('provider-list');
        const providers = user.providerData.map(p => p.providerId);
        const renderProvider = (id, iconPath, label) => {
            const isLinked = providers.includes(id);
            const isUrl = iconPath.startsWith('http');
            const iconHtml = isUrl
                ? `<img src="${iconPath}" style="width: 24px; filter: ${isLinked ? 'none' : 'grayscale(100%)'};">`
                : `<span class="material-symbols-outlined" style="font-size: 24px;">${iconPath}</span>`;
            return `<div class="text-center ${isLinked ? '' : 'opacity-25'}" title="${label}" style="min-width: 60px;">
                        <div class="mb-1">${iconHtml}</div>
                        <div style="font-size: 10px;">${isLinked ? 'LINKED' : ''}</div>
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

document.addEventListener("DOMContentLoaded", () => {
    const themeSelect = document.querySelector('.form-select');
    const hueSlider = document.getElementById('hueSlider');
    const hueDisplay = document.getElementById('hue-value-display');

    const updateHueVisibility = (theme) => {
        const isColor = (theme === "color" || theme === "hueshift");
        if (hueSlider) hueSlider.style.display = isColor ? "block" : "none";
        if (hueDisplay) hueDisplay.style.display = isColor ? "inline-block" : "none";
    };

    if (themeSelect) {
        const savedTheme = getGlobalItem("theme") || "dark";
        themeSelect.value = (savedTheme === "hueshift") ? "color" : savedTheme;
        updateHueVisibility(themeSelect.value);

        themeSelect.addEventListener('change', (e) => {
            const val = e.target.value;
            applyTheme(val === "color" ? "hueshift" : val);
            updateHueVisibility(val);
        });
    }

    if (hueSlider) {
        const savedHue = getGlobalItem("hue-val") || 0;
        hueSlider.value = savedHue;
        if (hueDisplay) hueDisplay.textContent = `${savedHue}°`;

        hueSlider.addEventListener('input', (e) => {
            if (hueDisplay) hueDisplay.textContent = `${e.target.value}°`;
        });
    }

    initThemeListeners();
});
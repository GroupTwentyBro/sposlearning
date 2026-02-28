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
            console.error("Name update error:", error);
            alert("Chyba při ukládání jména.");
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
            statusDiv.innerHTML = `
                <span class="text-success d-flex align-items-center">
                    <span class="material-symbols-outlined me-1 fs-6">check_circle</span> Email je ověřený
                </span>`;
            resendContainer.innerHTML = '';
        } else {
            statusDiv.innerHTML = `
                <span class="text-warning d-flex align-items-center">
                    <span class="material-symbols-outlined me-1 fs-6">error</span> Email není ověřený
                </span>`;
            resendContainer.innerHTML = `<button class="btn btn-sm btn-link text-primary-hl p-0" id="btn-resend">Poslat ověřovací email</button>`;

            document.getElementById('btn-resend').onclick = async () => {
                try {
                    await user.reload();
                    await sendEmailVerification(auth.currentUser);
                    alert("Ověřovací email byl odeslán!");
                } catch (err) {
                    console.error(err);
                    alert("Chyba při odesílání. Zkuste to později.");
                }
            };
        }

        const providers = user.providerData.map(p => p.providerId);
        const passwordResetRow = document.getElementById('btn-reset-pw')?.closest('.row');

        if (providers.includes('password')) {
            if (passwordResetRow) passwordResetRow.style.display = 'flex';
            document.getElementById('btn-reset-pw').onclick = () => {
                sendPasswordResetEmail(auth, user.email)
                    .then(() => alert("Resetovací odkaz byl odeslán na tvůj email!"))
                    .catch((err) => console.error(err));
            };
        } else if (passwordResetRow) {
            passwordResetRow.style.display = 'none';
        }

        const providerList = document.getElementById('provider-list');
        const renderProvider = (id, iconPath, label) => {
            const isLinked = providers.includes(id);
            const isUrl = iconPath.startsWith('http');
            const iconHtml = isUrl
                ? `<img src="${iconPath}" alt="${label}" style="width: 24px; height: 24px; filter: ${isLinked ? 'none' : 'grayscale(100%)'};">`
                : `<span class="material-symbols-outlined" style="font-size: 24px;">${iconPath}</span>`;

            return `
                <div class="text-center ${isLinked ? 'text-white' : 'opacity-25'}" title="${label}" style="min-width: 60px;">
                    <div class="mb-1 d-flex justify-content-center align-items-center" style="height: 30px;">
                        ${iconHtml}
                    </div>
                    <div style="font-size: 10px; font-weight: bold;">${isLinked ? 'PROPOJENO' : ''}</div>
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
    const hueControls = document.getElementById('hue-controls');

    const updateHueVisibility = (theme) => {
        const isColor = (theme === "color" || theme === "hueshift");
        if (hueControls) {
            hueControls.style.setProperty('display', isColor ? 'flex' : 'none', 'important');
        }
    };

    if (themeSelect) {
        const savedTheme = getGlobalItem("theme") || "dark";
        themeSelect.value = (savedTheme === "hueshift") ? "color" : savedTheme;
        updateHueVisibility(themeSelect.value);

        themeSelect.addEventListener('change', (e) => {
            const val = e.target.value;
            const themeToApply = (val === "color") ? "hueshift" : val;
            applyTheme(themeToApply);
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
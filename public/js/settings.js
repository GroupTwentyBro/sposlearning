import {app, auth} from './firebaseConfig.js';
import {
    onAuthStateChanged,
    sendEmailVerification,
    sendPasswordResetEmail,
    updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {getFirestore} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {applyTheme, getGlobalItem, initThemeListeners} from './theming.js';
import {createServerLog} from './logging.js';

const db = getFirestore(app);

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
            await createServerLog('auth', `Změna jména na: ${newName}`, {
                isUser: true,
                userEmail: auth.currentUser.email,
                userName: newName
            });
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
            statusDiv.innerHTML = `<span class="text-success small">✓ Email je ověřený</span>`;
            resendContainer.innerHTML = '';
        } else {
            statusDiv.innerHTML = `<span class="text-warning small">⚠ Email není ověřený</span>`;
            resendContainer.innerHTML = `<button class="btn btn-sm btn-link p-0" id="btn-resend">Poslat ověřovací email</button>`;
            document.getElementById('btn-resend').onclick = async () => {
                try {
                    await sendEmailVerification(user);
                    await createServerLog('auth', `Vyžádán ověřovací email`, { userEmail: user.email });
                    alert("Ověřovací email odeslán!");
                } catch (err) { alert("Chyba při odesílání."); }
            };
        }

        const providers = user.providerData.map(p => p.providerId);
        const providerList = document.getElementById('provider-list');
        const renderProvider = (id, iconUrl, label) => {
            const isLinked = providers.includes(id);
            return `<div class="text-center ${isLinked ? '' : 'opacity-25'}" title="${label}">
                        <img src="${iconUrl}" width="24" height="24" style="${isLinked ? '' : 'filter: grayscale(1);'}">
                    </div>`;
        };

        providerList.innerHTML =
            renderProvider('google.com', 'https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg', 'Google') +
            renderProvider('microsoft.com', 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/25/Microsoft_icon.svg/1280px-Microsoft_icon.svg.png', 'Microsoft') +
            renderProvider('github.com', 'https://github.githubassets.com/favicons/favicon-dark.png', 'GitHub');

        document.getElementById('btn-reset-pw').onclick = async () => {
            try {
                await sendPasswordResetEmail(auth, user.email);
                await createServerLog('auth', `Vyžádán reset hesla`, { userEmail: user.email });
                alert("Email pro změnu hesla byl odeslán.");
            } catch (e) { alert("Chyba při odesílání."); }
        };
    } else {
        window.location.href = '/login';
    }
});

document.addEventListener("DOMContentLoaded", () => {
    const themeSelect = document.querySelector('.theme-select');
    const windowSelect = document.querySelector('.window-select');
    const hueSlider = document.getElementById('hueSlider');
    const hueDisplay = document.getElementById('hue-value-display');
    const hueControls = document.getElementById('hue-controls');

    const updateHueVisibility = (themeValue) => {
        if (hueControls) {
            if (themeValue === "color") {
                hueControls.classList.remove('d-none');
                hueControls.classList.add('d-flex');
            } else {
                hueControls.classList.remove('d-flex');
                hueControls.classList.add('d-none');
            }
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

    if (windowSelect) {
        windowSelect.addEventListener('change', (e) => {
            const val = e.target.value;
            localStorage.setItem("openPreference", val);
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
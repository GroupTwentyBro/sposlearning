import { applyTheme, getGlobalItem, initThemeListeners } from './theming.js';
import { createServerLog } from './logging.js';

const KRATOS_URL = "https://auth.sposlearning.cz";
const API_URL = "https://api.sposlearning.cz";

let currentUser = null;

async function initSettings() {
    try {
        const res = await fetch(`${KRATOS_URL}/sessions/whoami`, {
            credentials: 'include',
            headers: { 'Accept': 'application/json' }
        });
        if (!res.ok) throw new Error();
        const session = await res.json();
        currentUser = session.identity;

        document.getElementById('display-name-text').textContent = currentUser.traits.name || "Not set";
        document.getElementById('account-email').value = currentUser.traits.email;

        const statusDiv = document.getElementById('email-verification-status');
        const resendContainer = document.getElementById('resend-container');
        const isVerified = currentUser.verifiable_addresses?.some(a => a.verified);

        if (isVerified) {
            statusDiv.innerHTML = `<span class="text-success small">✓ Email je ověřený</span>`;
        } else {
            statusDiv.innerHTML = `<span class="text-warning small">⚠ Email není ověřený</span>`;
            resendContainer.innerHTML = `<button class="btn btn-sm btn-link p-0" id="btn-resend">Poslat ověřovací email</button>`;
            document.getElementById('btn-resend').onclick = triggerVerification;
        }

        renderProviders(session.authentication_methods);

    } catch (err) {
        window.location.href = '/login';
    }
}

window.toggleNameEdit = function() {
    const textSpan = document.getElementById('display-name-text');
    const container = textSpan.parentElement;
    const currentName = textSpan.textContent === "Not set" ? "" : textSpan.textContent;

    container.innerHTML = `
        <div class="d-flex align-items-center justify-content-end">
            <input type="text" id="name-edit-input" class="form-control form-control-sm me-2" value="${currentName}" style="max-width: 200px;">
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
    try {
        const res = await fetch(`${API_URL}/update-profile`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newName }),
            credentials: 'include'
        });
        if (!res.ok) throw new Error();

        await createServerLog('auth', `Změna jména na: ${newName}`, { userEmail: currentUser.traits.email });
        location.reload();
    } catch (err) {
        alert("Chyba při ukládání.");
    }
};

async function triggerPasswordReset() {
    try {
        const flowRes = await fetch(`${KRATOS_URL}/self-service/recovery/browser`, { credentials: 'include' });
        const flow = await flowRes.json();

        const csrfToken = flow.ui.nodes.find(n => n.attributes.name === 'csrf_token').attributes.value;

        await fetch(`${KRATOS_URL}/self-service/recovery?flow=${flow.id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                method: 'link',
                csrf_token: csrfToken,
                email: currentUser.traits.email
            }),
            credentials: 'include'
        });

        alert("Email pro obnovu hesla byl odeslán.");
    } catch (err) {
        alert("Chyba při odesílání.");
    }
}

function renderProviders(methods) {
    const providerList = document.getElementById('provider-list');
    const activeMethods = methods.map(m => m.method);

    const hasOidc = activeMethods.includes('oidc');

    const renderIcon = (url, label, active) => `
        <div class="text-center ${active ? '' : 'opacity-25'}" title="${label}">
            <img src="${url}" width="24" height="24" style="${active ? '' : 'filter: grayscale(1);'}">
        </div>`;

    providerList.innerHTML =
        renderIcon('https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg', 'Google', hasOidc) +
        renderIcon('https://github.githubassets.com/favicons/favicon-dark.png', 'GitHub', hasOidc);
}

document.addEventListener("DOMContentLoaded", () => {
    const themeSelect = document.querySelector('#theme-select');
    const windowSelect = document.querySelector('#window-select');
    const hueSlider = document.getElementById('hueSlider');

    if (themeSelect) {
        const savedTheme = getGlobalItem("theme") || "dark";
        themeSelect.value = (savedTheme === "hueshift") ? "color" : savedTheme;

        themeSelect.addEventListener('change', (e) => {
            const val = e.target.value;
            applyTheme(val === "color" ? "hueshift" : val);
        });
    }

    if (windowSelect) {
        windowSelect.value = localStorage.getItem('openPreference') || "same";
        windowSelect.addEventListener('change', (e) => localStorage.setItem("openPreference", e.target.value));
    }

    document.getElementById('btn-reset-pw').onclick = triggerPasswordReset;

    initSettings();
    initThemeListeners();
});
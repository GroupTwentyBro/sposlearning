import { applyTheme, getGlobalItem, initThemeListeners } from './theming.js';
import { createServerLog } from './logging.js';

const KRATOS_URL = "https://auth.sposlearning.cz";

let currentUser = null;

async function initSettings() {
    try {
        const res = await fetch(`${KRATOS_URL}/sessions/whoami`, {
            credentials: 'include',
            headers: { 'Accept': 'application/json' }
        });

        if (!res.ok) throw new Error("Not logged in");
        const session = await res.json();
        currentUser = session.identity;

        const nameText = document.getElementById('display-name-text');
        const emailInput = document.getElementById('account-email');

        if (nameText) nameText.textContent = currentUser.traits.name || "Not set";
        if (emailInput) emailInput.value = currentUser.traits.email;

        const statusDiv = document.getElementById('email-verification-status');
        const resendContainer = document.getElementById('resend-container');
        const isVerified = currentUser.verifiable_addresses?.some(a => a.verified);

        if (isVerified) {
            if (statusDiv) statusDiv.innerHTML = `<span class="text-success small">✓ Email je ověřený</span>`;
            if (resendContainer) resendContainer.innerHTML = '';
        } else {
            if (statusDiv) statusDiv.innerHTML = `<span class="text-warning small">⚠ Email není ověřený</span>`;
            if (resendContainer) {
                resendContainer.innerHTML = `<button class="btn btn-sm btn-link p-0" id="btn-resend">Poslat ověřovací email</button>`;
                document.getElementById('btn-resend').onclick = triggerVerification;
            }
        }

        renderProviders(session.authentication_methods);

        document.querySelector('.dot-container')?.classList.add('hidden');

    } catch (err) {
        console.error("Auth check failed:", err);
        window.location.href = '/login';
    }
}

window.toggleNameEdit = function() {
    const textSpan = document.getElementById('display-name-text');
    const container = textSpan.parentElement;
    const currentName = textSpan.textContent === "Not set" ? "" : textSpan.textContent;

    container.innerHTML = `
        <div class="d-flex align-items-center justify-content-end">
            <input type="text" id="name-edit-input" class="form-control form-control-sm me-2" 
                   value="${currentName}" style="max-width: 200px;">
            <button class="btn btn-sm btn-success me-1" onclick="window.saveNameChange()">
                <span class="material-symbols-outlined fs-6">check</span>
            </button>
            <button class="btn btn-sm btn-outline-secondary" onclick="location.reload()">
                <span class="material-symbols-outlined fs-6">close</span>
            </button>
        </div>
    `;
};

window.saveNameChange = async function() {
    const nameInput = document.getElementById('name-edit-input');
    if (!nameInput) return;

    const newName = nameInput.value.trim();
    const saveBtn = document.querySelector('button.btn-success');
    if (saveBtn) saveBtn.disabled = true;

    try {
        // 1. Get a fresh flow
        const flowRes = await fetch(`${KRATOS_URL}/self-service/settings/browser`, {
            credentials: 'include',
            headers: { 'Accept': 'application/json' }
        });
        const flow = await flowRes.json();

        // 2. Extract CSRF
        const csrfToken = flow.ui.nodes.find(n => n.attributes.name === 'csrf_token')?.attributes.value;

        // 3. Submit Update
        const submitRes = await fetch(`${KRATOS_URL}/self-service/settings?flow=${flow.id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({
                method: 'profile',
                csrf_token: csrfToken,
                traits: {
                    ...currentUser.traits,
                    name: newName
                }
            }),
            credentials: 'include'
        });

        const result = await submitRes.json();

        // 4. HANDLE SUDO MODE (403 Forbidden)
        if (submitRes.status === 403 && result.error?.id === 'session_refresh_required') {
            // Redirect user to re-authenticate as requested by Kratos
            window.location.href = result.redirect_browser_to || `${KRATOS_URL}/self-service/login/browser?refresh=true`;
            return;
        }

        if (!submitRes.ok) {
            const errorMsg = result.ui?.messages?.[0]?.text || "Validation failed";
            throw new Error(errorMsg);
        }

        // 5. Success
        location.reload();

    } catch (err) {
        console.error("Kratos Settings Error:", err);
        alert("Chyba: " + err.message);
        if (saveBtn) saveBtn.disabled = false;
    }
};

async function triggerVerification() {
    const resendBtn = document.getElementById('btn-resend');
    resendBtn.disabled = true;
    resendBtn.textContent = "Odesílám...";

    try {
        const flowRes = await fetch(`${KRATOS_URL}/self-service/verification/browser`, { credentials: 'include' });
        const flow = await flowRes.json();
        const csrfToken = flow.ui.nodes.find(n => n.attributes.name === 'csrf_token')?.attributes.value;

        await fetch(`${KRATOS_URL}/self-service/verification?flow=${flow.id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                method: 'link',
                csrf_token: csrfToken,
                email: currentUser.traits.email
            }),
            credentials: 'include'
        });
        alert("Ověřovací email byl odeslán!");
    } catch (err) {
        alert("Chyba při odesílání.");
    } finally {
        resendBtn.disabled = false;
        resendBtn.textContent = "Poslat ověřovací email";
    }
}

async function triggerPasswordReset() {
    const resetBtn = document.getElementById('btn-reset-pw');
    resetBtn.disabled = true;

    try {
        const flowRes = await fetch(`${KRATOS_URL}/self-service/recovery/browser`, { credentials: 'include' });
        const flow = await flowRes.json();
        const csrfToken = flow.ui.nodes.find(n => n.attributes.name === 'csrf_token')?.attributes.value;

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
        alert("Chyba při odesílání požadavku.");
    } finally {
        resetBtn.disabled = false;
    }
}

function renderProviders(methods) {
    const providerList = document.getElementById('provider-list');
    if (!providerList) return;

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
    const resetPwBtn = document.getElementById('btn-reset-pw');

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

    if (resetPwBtn) resetPwBtn.onclick = triggerPasswordReset;

    initSettings();
    initThemeListeners();
});
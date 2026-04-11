import { applyTheme, getGlobalItem, setGlobalItem, initThemeListeners } from './theming.js';
import { createServerLog } from './logging.js';
import {CONFIG} from "/js/config.js";

const KRATOS_URL = CONFIG.AUTH_URL;
let currentUser = null;

function setCookie(name, value, days = 365) {
    const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
    const domain = "sposlearning.cz";
    document.cookie = `${name}=${value}; domain=${domain}; path=/; expires=${expires}; SameSite=Lax; Secure`;
}

function getCookie(name) {
    let nameEQ = name + "=";
    let ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i].trim();
        if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
}

function initFontSizeControl() {
    const fsSlider = document.getElementById('fsSlider');
    const fsDisplay = document.getElementById('fsDisplay');
    const root = document.documentElement;

    // 1. Load saved size from cookie or default to 1
    const savedSize = getCookie("user-font-size") || "1";

    // 2. Apply it immediately
    root.style.setProperty('--base-fs', savedSize);
    if (fsSlider) fsSlider.value = savedSize;
    if (fsDisplay) fsDisplay.textContent = `${savedSize}x`;

    // 3. Listen for changes
    if (fsSlider) {
        fsSlider.addEventListener('input', (e) => {
            const val = e.target.value;
            if (fsDisplay) fsDisplay.textContent = `${val}x`;

            // Update CSS variable
            root.style.setProperty('--base-fs', val);

            // Save to cookie
            setCookie("user-font-size", val);
        });
    }
}

/**
 * HELPER: Forces Kratos URLs to use HTTPS
 * Prevents "Mixed Content" errors when Kratos returns internal HTTP links
 */
const fixUrl = (url) => url ? url.replace("http://", "https://") : url;

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
        const n = currentUser.traits.name;
        const formattedName = (n && typeof n === 'object') ? `${n.first} ${n.last}`.trim() : (n || "Not set");
        if (nameText) nameText.textContent = formattedName;

        const emailInput = document.getElementById('account-email');
        if (emailInput) emailInput.value = currentUser.traits.email;

        updateVerificationUI();
        renderProviders(session.authentication_methods);

        document.querySelector('.dot-container')?.classList.add('hidden');
    } catch (err) {
        console.error("Auth check failed:", err);
        window.location.href = '/login';
    }
}

/**
 * THEME CONTROLS
 */
function initThemeControls() {
    const themeSelect = document.querySelector('#theme-select');
    const hueSlider = document.getElementById('hueSlider');
    const hueDisplay = document.getElementById('hue-value-display');
    const hueControls = document.getElementById('hue-controls');

    if (!themeSelect || !hueControls) return;

    const toggleHueVisibility = (val) => {
        hueControls.style.setProperty('display', val === "color" ? 'flex' : 'none', 'important');
    };

    const savedTheme = getGlobalItem("theme") || "dark";
    themeSelect.value = (savedTheme === "hueshift") ? "color" : savedTheme;
    toggleHueVisibility(themeSelect.value);

    themeSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        applyTheme(val === "color" ? "hueshift" : val);
        toggleHueVisibility(val);
    });

    if (hueSlider) {
        const savedHue = getGlobalItem("hue-val") || 0;
        hueSlider.value = savedHue;
        if (hueDisplay) hueDisplay.textContent = `${savedHue}°`;
        hueSlider.addEventListener('input', (e) => {
            const val = e.target.value;
            if (hueDisplay) hueDisplay.textContent = `${val}°`;
            setGlobalItem("hue-val", val);
            applyTheme("hueshift");
        });
    }
}

/**
 * NAME CHANGE (With HTTPS Force Fix)
 */
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
        </div>`;
};

window.saveNameChange = async function() {
    const nameInput = document.getElementById('name-edit-input');
    if (!nameInput) return;

    const newName = nameInput.value.trim();
    const saveBtn = document.querySelector('button.btn-success');
    if (saveBtn) saveBtn.disabled = true;

    try {
        // 1. Initialize settings flow
        const flowRes = await fetch(`${KRATOS_URL}/self-service/settings/browser`, {
            credentials: 'include',
            headers: { 'Accept': 'application/json' }
        });

        // Handle potential 303 Redirect manually if browser blocks it
        if (flowRes.type === 'opaqueredirect') throw new Error("Kratos redirected to insecure URL. Check HTTPS config.");

        const flow = await flowRes.json();
        const actionUrl = fixUrl(flow.ui.action);
        const csrfToken = flow.ui.nodes.find(n => n.attributes.name === 'csrf_token')?.attributes.value;

        // 2. Submit to the forced HTTPS URL
        const submitRes = await fetch(actionUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({
                method: 'profile',
                csrf_token: csrfToken,
                traits: { ...currentUser.traits, name: newName }
            }),
            credentials: 'include'
        });

        const result = await submitRes.json();

        if (submitRes.status === 403 && result.error?.id === 'session_refresh_required') {
            window.location.href = fixUrl(result.redirect_browser_to) || `${KRATOS_URL}/self-service/login/browser?refresh=true`;
            return;
        }

        if (!submitRes.ok) throw new Error("Chyba při ukládání.");
        location.reload();
    } catch (err) {
        console.error("Settings error:", err);
        alert("Chyba: " + err.message);
        if (saveBtn) saveBtn.disabled = false;
    }
};

/**
 * VERIFICATION & RECOVERY (With HTTPS Force Fix)
 */
async function triggerVerification() {
    try {
        const flowRes = await fetch(`${KRATOS_URL}/self-service/verification/browser`, {
            credentials: 'include',
            headers: { 'Accept': 'application/json' }
        });
        const flow = await flowRes.json();
        const actionUrl = fixUrl(flow.ui.action);
        const csrfToken = flow.ui.nodes.find(n => n.attributes.name === 'csrf_token')?.attributes.value;

        await fetch(actionUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ method: 'link', csrf_token: csrfToken, email: currentUser.traits.email }),
            credentials: 'include'
        });
        alert("Ověřovací email odeslán!");
    } catch (err) { alert("Chyba při odesílání."); }
}

async function triggerPasswordReset() {
    try {
        const flowRes = await fetch(`${KRATOS_URL}/self-service/recovery/browser`, {
            credentials: 'include',
            headers: { 'Accept': 'application/json' }
        });
        const flow = await flowRes.json();
        const actionUrl = fixUrl(flow.ui.action);
        const csrfToken = flow.ui.nodes.find(n => n.attributes.name === 'csrf_token')?.attributes.value;

        await fetch(actionUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ method: 'link', csrf_token: csrfToken, email: currentUser.traits.email }),
            credentials: 'include'
        });
        alert("Resetovací email odeslán.");
    } catch (err) { alert("Chyba při odesílání."); }
}

/**
 * UI HELPERS
 */
function updateVerificationUI() {
    const statusDiv = document.getElementById('email-verification-status');
    const resendContainer = document.getElementById('resend-container');
    const isVerified = currentUser.verifiable_addresses?.some(a => a.verified);

    if (isVerified) {
        if (statusDiv) statusDiv.innerHTML = `<span class="text-success small">✓ Email je ověřený</span>`;
    } else {
        if (statusDiv) statusDiv.innerHTML = `<span class="text-warning small">⚠ Email není ověřený</span>`;
        if (resendContainer) {
            resendContainer.innerHTML = `<button class="btn btn-sm btn-link p-0" id="btn-resend">Poslat ověřovací email</button>`;
            document.getElementById('btn-resend').onclick = triggerVerification;
        }
    }
}

function renderProviders(methods) {
    const providerList = document.getElementById('provider-list');
    const hasOidc = methods.some(m => m.method === 'oidc');
    const renderIcon = (url, active) => `<div class="${active ? '' : 'opacity-25'}"><img src="${url}" width="24"></div>`;
    providerList.innerHTML =
        renderIcon('https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg', hasOidc) +
        renderIcon('https://github.githubassets.com/favicons/favicon-dark.png', hasOidc);
}

document.addEventListener("DOMContentLoaded", () => {
    const windowSelect = document.querySelector('#window-select');
    const resetPwBtn = document.getElementById('btn-reset-pw');
    if (windowSelect) {
        windowSelect.value = localStorage.getItem('openPreference') || "same";
        windowSelect.addEventListener('change', (e) => localStorage.setItem("openPreference", e.target.value));
    }
    if (resetPwBtn) resetPwBtn.onclick = triggerPasswordReset;

    initSettings();
    initFontSizeControl();
    initThemeControls();
    initThemeListeners();
});
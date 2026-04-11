import { applyTheme, getGlobalItem, setGlobalItem, initThemeListeners } from './theming.js';
import { createServerLog } from './logging.js';
import { CONFIG } from "/js/config.js";
import { showVerificationOverlay } from "/js/verify.js";

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

    const savedSize = getCookie("user-font-size") || "1";
    root.style.setProperty('--base-fs', savedSize);

    if (fsSlider) fsSlider.value = savedSize;
    if (fsDisplay) fsDisplay.textContent = `${savedSize}x`;

    if (fsSlider) {
        fsSlider.addEventListener('input', (e) => {
            const val = e.target.value;
            if (fsDisplay) fsDisplay.textContent = `${val}x`;
            root.style.setProperty('--base-fs', val);
            setCookie("user-font-size", val);
        });
    }
}

async function triggerVerification() {
    try {
        const flowRes = await fetch(`${KRATOS_URL}/self-service/verification/browser`, {
            credentials: 'include',
            headers: { 'Accept': 'application/json' }
        });
        const flow = await flowRes.json();
        const csrfToken = flow.ui.nodes.find(n => n.attributes.name === 'csrf_token')?.attributes.value;

        const res = await fetch(`${KRATOS_URL}/self-service/verification?flow=${flow.id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({
                method: 'code',
                csrf_token: csrfToken,
                email: currentUser.traits.email
            }),
            credentials: 'include'
        });

        if (res.ok) {
            showVerificationOverlay(currentUser.traits.email);
        } else {
            alert("Chyba při odesílání kódu.");
        }
    } catch (err) { alert("Chyba sítě."); }
}

function updateVerificationUI() {
    const statusDiv = document.getElementById('email-verification-status');
    const resendContainer = document.getElementById('resend-container');
    const isVerified = currentUser.verifiable_addresses?.some(a => a.verified);

    if (isVerified) {
        if (statusDiv) statusDiv.innerHTML = `<span class="text-success small">✓ Email je ověřený</span>`;
    } else {
        if (statusDiv) statusDiv.innerHTML = `<span class="text-warning small">⚠ Email není ověřený</span>`;
        if (resendContainer) {
            resendContainer.innerHTML = `<button class="btn btn-sm btn-link p-0" id="btn-resend">Odeslat ověřovací kód</button>`;
            document.getElementById('btn-resend').onclick = triggerVerification;
        }
    }
}

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
        window.location.href = '/login';
    }
}

const fixUrl = (url) => url ? url.replace("http://", "https://") : url;

function renderProviders(methods) {
    const providerList = document.getElementById('provider-list');
    const hasOidc = methods.some(m => m.method === 'oidc');
    const renderIcon = (url, active) => `<div class="${active ? '' : 'opacity-25'}"><img src="${url}" width="24"></div>`;
    providerList.innerHTML =
        renderIcon('https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg', hasOidc) +
        renderIcon('https://github.githubassets.com/favicons/favicon-dark.png', hasOidc);
}

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

document.addEventListener("DOMContentLoaded", () => {
    const windowSelect = document.querySelector('#window-select');
    if (windowSelect) {
        windowSelect.value = localStorage.getItem('openPreference') || "same";
        windowSelect.addEventListener('change', (e) => localStorage.setItem("openPreference", e.target.value));
    }
    initSettings();
    initFontSizeControl();
    initThemeControls();
    initThemeListeners();
});
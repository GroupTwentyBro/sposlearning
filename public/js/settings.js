import { applyTheme, getGlobalItem, setGlobalItem, initThemeListeners } from './theming.js';
import { CONFIG } from "/js/config.js";

const KRATOS_URL = CONFIG.AUTH_URL;
const API_URL = CONFIG.API_URL;
let currentUser = null;

const fixUrl = (url) => url ? url.replace("http://", "https://") : url;

function setCookie(name, value, days = 365) {
    const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toUTCString();
    document.cookie = `${name}=${value}; domain=sposlearning.cz; path=/; expires=${expires}; SameSite=Lax; Secure`;
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

        if (currentUser.traits.picture) {
            document.getElementById('pfp-preview').src = currentUser.traits.picture;
        }

        updateVerificationUI();
        renderProviders(session.authentication_methods);

    } catch (err) {
        console.error("Auth check failed:", err);
        window.location.href = '/login';
    }
}

async function handlePfpUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const status = document.getElementById('pfp-status');
    const preview = document.getElementById('pfp-preview');
    status.innerHTML = '<span class="text-info">Zpracovávání...</span>';

    const formData = new FormData();
    formData.append('image', file);

    try {
        const res = await fetch(`${API_URL}/upload-pfp`, {
            method: 'POST',
            body: formData,
            credentials: 'include'
        });

        if (!res.ok) throw new Error("Server rejected image");
        const data = await res.json();

        await updateKratosTrait('picture', data.imageUrl);

        preview.src = data.imageUrl + "?t=" + Date.now();
        status.innerHTML = '<span class="text-success">Obrázek úspěšně nahrán!</span>';
    } catch (err) {
        status.innerHTML = `<span class="text-danger">Chyba: ${err.message}</span>`;
    }
}

async function updateKratosTrait(key, value) {
    const flowRes = await fetch(`${KRATOS_URL}/self-service/settings/browser`, {
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
    });
    const flow = await flowRes.json();
    const csrfToken = flow.ui.nodes.find(n => n.attributes.name === 'csrf_token')?.attributes.value;

    const body = {
        method: 'profile',
        csrf_token: csrfToken,
        traits: {
            ...currentUser.traits,
            [key]: value
        }
    };

    const submitRes = await fetch(fixUrl(flow.ui.action), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(body),
        credentials: 'include'
    });

    if (submitRes.status === 403) {
        const result = await submitRes.json();
        if (result.error?.id === 'session_refresh_required') {
            const returnTo = encodeURIComponent(window.location.href);
            window.location.href = `/login?refresh=true&return_to=${returnTo}`;
            return;
        }
    }

    if (!submitRes.ok) throw new Error("Kratos update failed");
    return await submitRes.json();
}

window.toggleNameEdit = function() {
    const container = document.getElementById('name-container');
    const textSpan = document.getElementById('display-name-text');
    const currentName = textSpan.textContent === 'Not set' ? '' : textSpan.textContent;

    container.innerHTML = `
        <div class="d-flex align-items-center justify-content-end">
            <input type="text" id="name-edit-input" class="form-control form-control-sm me-2" value="${currentName}">
            <button class="btn btn-sm btn-success me-1" onclick="window.saveNameChange()">✓</button>
            <button class="btn btn-sm btn-outline-secondary" onclick="location.reload()">✕</button>
        </div>`;
};

window.saveNameChange = async function() {
    const val = document.getElementById('name-edit-input').value.trim();
    try {
        await updateKratosTrait('name', val);
        location.reload();
    } catch (err) { alert(err.message); }
};

function initThemeControls() {
    const themeSelect = document.querySelector('#theme-select');
    const hueSlider = document.getElementById('hueSlider');
    const hueDisplay = document.getElementById('hue-value-display');
    const hueControls = document.getElementById('hue-controls');

    const toggleHue = (val) => hueControls.style.display = (val === "color") ? "flex" : "none";

    const savedTheme = getGlobalItem("theme") || "dark";
    themeSelect.value = (savedTheme === "hueshift") ? "color" : savedTheme;
    toggleHue(themeSelect.value);

    themeSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        applyTheme(val === "color" ? "hueshift" : val);
        toggleHue(val);
    });

    if (hueSlider) {
        hueSlider.value = getGlobalItem("hue-val") || 0;
        hueSlider.addEventListener('input', (e) => {
            const val = e.target.value;
            hueDisplay.textContent = `${val}°`;
            setGlobalItem("hue-val", val);
            applyTheme("hueshift");
        });
    }
}

function initFontSizeControl() {
    const slider = document.getElementById('fsSlider');
    const display = document.getElementById('fsDisplay');
    const root = document.documentElement;

    const val = getCookie("user-font-size") || "1";
    root.style.setProperty('--base-fs', val);
    if (slider) {
        slider.value = val;
        display.textContent = `${val}x`;
        slider.addEventListener('input', (e) => {
            root.style.setProperty('--base-fs', e.target.value);
            display.textContent = `${e.target.value}x`;
            setCookie("user-font-size", e.target.value);
        });
    }
}

async function triggerVerification() {
    try {
        const flowRes = await fetch(`${KRATOS_URL}/self-service/verification/browser`, { credentials: 'include', headers: { 'Accept': 'application/json' }});
        const flow = await flowRes.json();
        await fetch(fixUrl(flow.ui.action), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ method: 'link', csrf_token: flow.ui.nodes.find(n => n.attributes.name === 'csrf_token').attributes.value, email: currentUser.traits.email }),
            credentials: 'include'
        });
        alert("Ověřovací email odeslán!");
    } catch (err) { alert("Chyba."); }
}

function updateVerificationUI() {
    const statusDiv = document.getElementById('email-verification-status');
    const resendContainer = document.getElementById('resend-container');
    const isVerified = currentUser.verifiable_addresses?.some(a => a.verified);

    if (isVerified) {
        statusDiv.innerHTML = `<span class="text-success small">✓ Email je ověřený</span>`;
    } else {
        statusDiv.innerHTML = `<span class="text-warning small">⚠ Email není ověřený</span>`;
        resendContainer.innerHTML = `<button class="btn btn-sm btn-link p-0" id="btn-resend">Poslat ověřovací email</button>`;
        if (document.getElementById('btn-resend')) document.getElementById('btn-resend').onclick = triggerVerification;
    }
}

function renderProviders(methods) {
    const list = document.getElementById('provider-list');
    if (!list) return;
    const hasOidc = methods.some(m => m.method === 'oidc');
    const icon = (src, active) => `<div class="${active ? '' : 'opacity-25'}"><img src="${src}" width="24"></div>`;
    list.innerHTML =
        icon('https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg', hasOidc) +
        icon('https://github.githubassets.com/favicons/favicon-dark.png', hasOidc);
}

document.addEventListener("DOMContentLoaded", () => {
    initSettings();
    initFontSizeControl();
    initThemeControls();
    initThemeListeners();

    const uploadBtn = document.getElementById('pfp-upload');
    if (uploadBtn) uploadBtn.addEventListener('change', handlePfpUpload);

    const winSel = document.getElementById('window-select');
    if (winSel) {
        winSel.value = localStorage.getItem('openPreference') || "same";
        winSel.onchange = (e) => localStorage.setItem("openPreference", e.target.value);
    }

    // Password Reset Recovery trigger
    const resetPwBtn = document.getElementById('btn-reset-pw');
    if (resetPwBtn) {
        resetPwBtn.onclick = async () => {
            try {
                const flowRes = await fetch(`${KRATOS_URL}/self-service/recovery/browser`, { credentials: 'include', headers: { 'Accept': 'application/json' }});
                const flow = await flowRes.json();
                await fetch(fixUrl(flow.ui.action), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ method: 'link', csrf_token: flow.ui.nodes.find(n => n.attributes.name === 'csrf_token').attributes.value, email: currentUser.traits.email }),
                    credentials: 'include'
                });
                alert("Resetovací email odeslán.");
            } catch (err) { alert("Chyba při odesílání."); }
        };
    }
});
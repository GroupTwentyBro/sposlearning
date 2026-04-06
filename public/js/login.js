import { applyTheme, initThemeListeners } from '/js/theming.js';
import { createServerLog } from "/js/logging.js";
import { CONFIG } from "/js/config.js";

const KRATOS_URL = CONFIG.AUTH_URL;
const REDIRECT_MAIN = CONFIG.BASE_URL;
const REDIRECT_ADMIN = CONFIG.ADMIN_URL;

const loginForm = document.getElementById('login-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const errorMessage = document.getElementById('error-message');

checkExistingSession();
initThemeListeners();

let currentFlowData = null;

async function initializeFlow() {
    try {
        const response = await fetch(`${KRATOS_URL}/self-service/login/browser`, {
            method: 'GET',
            credentials: 'include',
            headers: { 'Accept': 'application/json' }
        });
        currentFlowData = await response.json();
        return currentFlowData.id;
    } catch (err) {
        console.error("Initialization failed:", err);
        errorMessage.textContent = "Nelze inicializovat autentizaci.";
    }
}

let flowId = await initializeFlow();

function getCsrfToken() {
    if (!currentFlowData) return null;
    return currentFlowData.ui.nodes.find(
        node => node.attributes.name === 'csrf_token'
    )?.attributes.value;
}

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorMessage.textContent = '';

    const csrfToken = getCsrfToken();
    if (!csrfToken) {
        errorMessage.textContent = "Chyba relace. Zkuste obnovit stránku.";
        return;
    }

    const body = {
        method: 'password',
        identifier: emailInput.value,
        password: passwordInput.value,
        csrf_token: csrfToken
    };

    try {
        const response = await fetch(`${KRATOS_URL}/self-service/login?flow=${flowId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(body),
            credentials: 'include'
        });

        const data = await response.json();

        if (response.ok) {
            const user = data.session.identity;
            const isAdmin = user.metadata_public?.admin === true;

            document.cookie = "isLoggedIn=true; path=/; domain=.sposlearning.cz; max-age=2592000; Secure; SameSite=Lax";
            window.location.href = isAdmin ? REDIRECT_ADMIN : REDIRECT_MAIN;
        } else {
            errorMessage.textContent = data.ui?.messages?.[0]?.text || "Špatný email nebo heslo.";
            if (data.error?.id === 'self_service_flow_expired' || response.status === 410) {
                flowId = await initializeFlow();
            }
        }
    } catch (error) {
        console.error('Chyba:', error);
        errorMessage.textContent = 'Server neodpovídá.';
    }
});

function handleOAuthLogin(provider) {
    const csrfToken = getCsrfToken();
    if (!csrfToken) {
        errorMessage.textContent = "Chyba relace. Zkuste obnovit stránku.";
        return;
    }

    const form = document.createElement('form');
    form.method = 'POST';
    form.action = `${KRATOS_URL}/self-service/login?flow=${flowId}`;

    const csrfInput = document.createElement('input');
    csrfInput.type = 'hidden';
    csrfInput.name = 'csrf_token';
    csrfInput.value = csrfToken;
    form.appendChild(csrfInput);

    const providerInput = document.createElement('input');
    providerInput.type = 'hidden';
    providerInput.name = 'provider';
    providerInput.value = provider;
    form.appendChild(providerInput);

    const methodInput = document.createElement('input');
    methodInput.type = 'hidden';
    methodInput.name = 'method';
    methodInput.value = 'oidc';
    form.appendChild(methodInput);

    document.body.appendChild(form);
    form.submit();
}

document.getElementById('google-login-btn').addEventListener('click', () => handleOAuthLogin('google'));
document.getElementById('microsoft-login-btn').addEventListener('click', () => handleOAuthLogin('microsoft'));
document.getElementById('github-login-btn').addEventListener('click', () => handleOAuthLogin('github'));


async function checkExistingSession() {
    try {
        const response = await fetch(`${KRATOS_URL}/sessions/whoami`, {
            credentials: 'include',
            headers: {'Accept': 'application/json'}
        });

        if (response.ok) {
            const data = await response.json();
            const isAdmin = data.identity.metadata_public?.admin === true;
            window.location.href = isAdmin ? REDIRECT_ADMIN : REDIRECT_MAIN;
        }
    } catch (e) {
    }
}
import { applyTheme, initThemeListeners } from '/js/theming.js';
import { createServerLog } from "/js/logging.js";

const KRATOS_URL = "https://auth.sposlearning.cz";
const REDIRECT_MAIN = "https://sposlearning.cz/";
const REDIRECT_ADMIN = "https://admin.sposlearning.cz/";

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

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorMessage.textContent = '';

    if (!currentFlowData) {
        errorMessage.textContent = "Chyba relace. Zkuste obnovit stránku.";
        return;
    }

    const csrfToken = currentFlowData.ui.nodes.find(
        node => node.attributes.name === 'csrf_token'
    )?.attributes.value;

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

async function checkExistingSession() {
    try {
        const response = await fetch(`${KRATOS_URL}/sessions/whoami`, {
            credentials: 'include',
            headers: {'Accept': 'application/json'}
        });

        if (response.ok) {
            const data = await response.json();
            // User is already logged in! Redirect them.
            const isAdmin = data.identity.metadata_public?.admin === true;
            window.location.href = isAdmin ? 'https://admin.sposlearning.cz' : 'https://sposlearning.cz';
        }
    } catch (e) {
        // No session, stay on login page
    }
}
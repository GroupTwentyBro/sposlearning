import { applyTheme, initThemeListeners } from '/js/theming.js';
import { createServerLog } from "/js/logging.js";

const KRATOS_URL = "https://auth.sposlearning.cz";
const REDIRECT_MAIN = "https://sposlearning.cz/";
const REDIRECT_ADMIN = "https://admin.sposlearning.cz/";

const loginForm = document.getElementById('login-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const errorMessage = document.getElementById('error-message');
const googleBtn = document.getElementById('google-login-btn');
const microsoftBtn = document.getElementById('microsoft-login-btn');
const githubBtn = document.getElementById('github-login-btn');

initThemeListeners();

async function initializeFlow() {
    try {
        const response = await fetch(`${KRATOS_URL}/self-service/login/browser`, {
            method: 'GET',
            credentials: 'include',
            headers: { 'Accept': 'application/json' }
        });
        const data = await response.json();
        return data.id;
    } catch (err) {
        console.error("Initialization failed:", err);
    }
}

let flowId = await initializeFlow();

async function handlePostLogin(session) {
    const user = session.identity;
    const isAdmin = user.metadata_public?.admin === true;

    document.cookie = "isLoggedIn=true; path=/; domain=.sposlearning.cz; max-age=2592000; Secure; SameSite=Lax";

    await createServerLog('auth', `Login`, {
        isUser: true,
        userEmail: user.traits.email,
        userName: `${user.traits.name?.first || ''} ${user.traits.name?.last || ''}`.trim(),
        isAdmin: isAdmin
    });

    window.location.href = isAdmin ? REDIRECT_ADMIN : REDIRECT_MAIN;
}

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorMessage.textContent = '';

    if (!flowId) flowId = await initializeFlow();

    const csrfToken = flowData.ui.nodes.find(node => node.attributes.name === 'csrf_token').attributes.value;

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
            await handlePostLogin(data.session);
        } else {
            const msg = data.ui?.messages?.[0]?.text || 'Špatný email nebo heslo';
            errorMessage.textContent = msg;

            if (data.error?.id === 'self_service_flow_expired') {
                flowId = await initializeFlow();
            }
        }
    } catch (error) {
        console.error('Chyba přihlášení:', error);
        errorMessage.textContent = 'Server neodpovídá. Zkuste to prosím později.';
    }
});

const startSocialLogin = (provider) => {
    window.location.href = `${KRATOS_URL}/self-service/methods/oidc/auth/${flowId}?provider=${provider}`;
};

if (googleBtn) googleBtn.addEventListener('click', () => startSocialLogin('google'));
if (githubBtn) githubBtn.addEventListener('click', () => startSocialLogin('github'));
if (microsoftBtn) microsoftBtn.addEventListener('click', () => startSocialLogin('microsoft'));
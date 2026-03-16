import {applyTheme, initThemeListeners} from '/js/theming.js';
import {createServerLog} from "/js/logging.js";

initThemeListeners();

const KRATOS_URL = "https://auth.sposlearning.cz";
const loginForm = document.getElementById('login-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const errorMessage = document.getElementById('error-message');
const googleBtn = document.getElementById('google-login-btn');
const microsoftBtn = document.getElementById('microsoft-login-btn');
const githubBtn = document.getElementById('github-login-btn');

const urlParams = new URLSearchParams(window.location.search);
let flowId = urlParams.get('flow');

if (!flowId) {
    window.location.href = `${KRATOS_URL}/self-service/login/browser`;
}

async function handleKratosSession(session) {
    try {
        const user = session.identity;
        const isAdmin = user.metadata_public?.admin === true;

        document.cookie = "isLoggedIn=true; path=/; domain=.sposlearning.cz; max-age=2592000; Secure; SameSite=Lax";

        await createServerLog('auth', `Login`, {
            isUser: true,
            userEmail: user.traits.email,
            userName: `${user.traits.name?.first || ''} ${user.traits.name?.last || ''}`.trim(),
            isAdmin: isAdmin
        });

        if (isAdmin) {
            window.location.href = `https://admin.sposlearning.cz/`;
        } else {
            window.location.href = 'https://sposlearning.cz/';
        }
    } catch (error) {
        console.error("Error handling session:", error);
        window.location.href = 'https://sposlearning.cz/';
    }
}

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorMessage.textContent = '';

    const body = {
        method: 'password',
        identifier: emailInput.value,
        password: passwordInput.value,
    };

    try {
        const response = await fetch(`${KRATOS_URL}/self-service/login?flow=${flowId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify(body),
            credentials: 'include'
        });

        const data = await response.json();

        if (response.ok) {
            await handleKratosSession(data.session);
        } else {
            errorMessage.textContent = data.ui?.messages?.[0]?.text || 'Špatný email nebo heslo';

            if (data.error?.id === 'session_refresh_required' || data.error?.id === 'self_service_flow_expired') {
                const response = await fetch(`${KRATOS_URL}/self-service/login/api`, {
                    method: 'GET',
                    credentials: 'include'
                });
                const flowData = await response.json();
                flowId = flowData.id;
            }
        }
    } catch (error) {
        console.error('Chyba přihlášení:', error);
        errorMessage.textContent = 'Server neodpovídá. Zkontrolujte připojení k domácímu serveru.';
    }
});

const startSocialLogin = (provider) => {
    window.location.href = `${KRATOS_URL}/self-service/methods/oidc/auth/${flowId}?provider=${provider}`;
};

if (googleBtn) googleBtn.addEventListener('click', () => startSocialLogin('google'));
if (githubBtn) githubBtn.addEventListener('click', () => startSocialLogin('github'));
if (microsoftBtn) microsoftBtn.addEventListener('click', () => startSocialLogin('microsoft'));
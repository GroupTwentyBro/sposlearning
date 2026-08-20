import { login, initAuth, setCookie } from '/js/auth.js';
import { CONFIG } from '/js/config.js';
import { applyTheme } from "/js/theme.js";

applyTheme();

const API_URL = CONFIG.API_URL;

(async () => {
    const loggedIn = await initAuth();
    if (loggedIn) {
        window.location.href = '/';
    }
})();

document.getElementById('login-google')?.addEventListener('click', () => {
    login('google');
});

document.getElementById('login-microsoft')?.addEventListener('click', () => {
    login('microsoft');
});

let activeMfaToken = '';
let availableMfaMethods = {};

document.getElementById('sign-in')?.addEventListener('click', async () => {
    const email = document.getElementById('email-login').value.trim();
    const password = document.getElementById('password-login').value;
    const errorDiv = document.getElementById('login-error-message');
    const signInBtn = document.getElementById('sign-in');

    if (!email || !password) {
        showMsg(errorDiv, 'Please enter email and password.', true);
        return;
    }

    if (signInBtn) {
        signInBtn.disabled = true;
        signInBtn.textContent = 'Signing in...';
    }

    try {
        const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Invalid email or password');
        }

        if (!data.requiresMfa) {
            setCookie('kc_access', data.access_token, 0.1);
            setCookie('kc_refresh', data.refresh_token, 30);
            window.location.href = '/';
        } else {
            activeMfaToken = data.mfaToken;
            availableMfaMethods = data.methods;
            
            document.getElementById('login-step-1')?.classList.add('hidden');
            document.getElementById('mfa-step-container')?.classList.remove('hidden');
            
            setupMfaSwitcherUI();
            switchMfaMethod(data.defaultMethod);
        }
    } catch (err) {
        showMsg(errorDiv, err.message, true);
    } finally {
        if (signInBtn) {
            signInBtn.disabled = false;
            signInBtn.textContent = 'Sign in';
        }
    }
});

function setupMfaSwitcherUI() {
    const btnPasskey = document.getElementById('switch-passkey');
    const btnTotp = document.getElementById('switch-totp');
    const btnEmail = document.getElementById('switch-email');

    if (btnPasskey) btnPasskey.style.display = availableMfaMethods.passkey ? 'inline-flex' : 'none';
    if (btnTotp) btnTotp.style.display = availableMfaMethods.totp ? 'inline-flex' : 'none';
    if (btnEmail) btnEmail.style.display = availableMfaMethods.email ? 'inline-flex' : 'none';

    if (btnPasskey) btnPasskey.onclick = () => switchMfaMethod('passkey');
    if (btnTotp) btnTotp.onclick = () => switchMfaMethod('totp');
    if (btnEmail) btnEmail.onclick = () => switchMfaMethod('email');
}

async function switchMfaMethod(method) {
    const passkeyBox = document.getElementById('mfa-passkey-box');
    const totpBox = document.getElementById('mfa-totp-box');
    const emailBox = document.getElementById('mfa-email-box');
    const mfaError = document.getElementById('mfa-error-message');

    if (mfaError) mfaError.classList.add('hidden');

    if (passkeyBox) passkeyBox.classList.add('hidden');
    if (totpBox) totpBox.classList.add('hidden');
    if (emailBox) emailBox.classList.add('hidden');

    if (method === 'passkey') {
        if (passkeyBox) passkeyBox.classList.remove('hidden');
        triggerPasskeyLogin();
    } else if (method === 'totp') {
        if (totpBox) totpBox.classList.remove('hidden');
    } else if (method === 'email') {
        if (emailBox) emailBox.classList.remove('hidden');
        sendLoginEmailOtp();
    }
}

async function triggerPasskeyLogin() {
    const mfaError = document.getElementById('mfa-error-message');
    try {
        const optRes = await fetch(`${API_URL}/mfa/login-passkey-options`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mfaToken: activeMfaToken })
        });
        const optData = await optRes.json();
        if (!optRes.ok) throw new Error(optData.error || 'Failed to get Passkey options');

        const options = optData.options;
        options.challenge = Uint8Array.from(atob(options.challenge.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));

        if (options.allowCredentials) {
            options.allowCredentials = options.allowCredentials.map(cred => ({
                ...cred,
                id: Uint8Array.from(atob(cred.id.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))
            }));
        }

        const assertion = await navigator.credentials.get({ publicKey: options });

        const assertionJSON = {
            id: assertion.id,
            rawId: arrayBufferToBase64Url(assertion.rawId),
            type: assertion.type,
            response: {
                authenticatorData: arrayBufferToBase64Url(assertion.response.authenticatorData),
                clientDataJSON: arrayBufferToBase64Url(assertion.response.clientDataJSON),
                signature: arrayBufferToBase64Url(assertion.response.signature),
                userHandle: assertion.response.userHandle ? arrayBufferToBase64Url(assertion.response.userHandle) : null
            }
        };

        const verifyRes = await fetch(`${API_URL}/mfa/login-passkey-verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mfaToken: activeMfaToken, response: assertionJSON })
        });

        const verifyData = await verifyRes.json();
        if (!verifyRes.ok) throw new Error(verifyData.error || 'Passkey verification failed');

        setCookie('kc_access', verifyData.access_token, 0.1);
        setCookie('kc_refresh', verifyData.refresh_token, 30);
        window.location.href = '/';
    } catch (err) {
        if (err.name !== 'NotAllowedError') {
            showMsg(mfaError, err.message, true);
        }
    }
}

document.getElementById('btn-verify-totp-login')?.addEventListener('click', async () => {
    const code = document.getElementById('mfa-totp-input')?.value;
    const mfaError = document.getElementById('mfa-error-message');

    try {
        const res = await fetch(`${API_URL}/mfa/login-totp-verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mfaToken: activeMfaToken, code })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Invalid code');

        setCookie('kc_access', data.access_token, 0.1);
        setCookie('kc_refresh', data.refresh_token, 30);
        window.location.href = '/';
    } catch (err) {
        showMsg(mfaError, err.message, true);
    }
});

async function sendLoginEmailOtp() {
    const mfaError = document.getElementById('mfa-error-message');
    try {
        const res = await fetch(`${API_URL}/mfa/login-email-send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mfaToken: activeMfaToken })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to send email code');
    } catch (err) {
        showMsg(mfaError, err.message, true);
    }
}

document.getElementById('btn-verify-email-login')?.addEventListener('click', async () => {
    const code = document.getElementById('mfa-email-input')?.value;
    const mfaError = document.getElementById('mfa-error-message');

    try {
        const res = await fetch(`${API_URL}/mfa/login-email-verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mfaToken: activeMfaToken, code })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Invalid code');

        setCookie('kc_access', data.access_token, 0.1);
        setCookie('kc_refresh', data.refresh_token, 30);
        window.location.href = '/';
    } catch (err) {
        showMsg(mfaError, err.message, true);
    }
});

document.getElementById('btn-trigger-passkey')?.addEventListener('click', () => {
    triggerPasskeyLogin();
});

function arrayBufferToBase64Url(buffer) {
    return btoa(String.fromCharCode(...new Uint8Array(buffer)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

const forgotLink = document.getElementById('forgot-password-link');
const forgotModal = document.getElementById('forgot-modal');
const closeForgotBtn = document.getElementById('close-forgot-modal');
const sendCodeBtn = document.getElementById('send-code-btn');
const verifyResetBtn = document.getElementById('verify-reset-btn');

const step1 = document.getElementById('forgot-step-1');
const step2 = document.getElementById('forgot-step-2');
const emailInput = document.getElementById('forgot-email');
const codeInput = document.getElementById('forgot-code');
const newPwdInput = document.getElementById('forgot-new-pwd');
const confirmPwdInput = document.getElementById('forgot-confirm-pwd');
const msg1 = document.getElementById('forgot-msg-1');
const msg2 = document.getElementById('forgot-msg-2');

if (forgotLink) {
    forgotLink.addEventListener('click', (e) => {
        e.preventDefault();
        forgotModal?.classList.remove('hidden');
        if (step1) step1.classList.remove('hidden');
        if (step2) step2.classList.add('hidden');
        if (msg1) msg1.classList.add('hidden');
        if (msg2) msg2.classList.add('hidden');
    });
}

if (closeForgotBtn) {
    closeForgotBtn.addEventListener('click', () => {
        forgotModal?.classList.add('hidden');
    });
}

if (forgotModal) {
    forgotModal.addEventListener('click', (e) => {
        if (e.target === forgotModal) forgotModal.classList.add('hidden');
    });
}

if (sendCodeBtn) {
    sendCodeBtn.addEventListener('click', async () => {
        const email = emailInput?.value.trim();
        if (!email) {
            showMsg(msg1, 'Please enter your email address.', true);
            return;
        }

        sendCodeBtn.disabled = true;
        sendCodeBtn.textContent = 'Sending Code...';

        try {
            const res = await fetch(`${API_URL}/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to send code');

            showMsg(msg1, 'Code sent! Check your email inbox.', false);
            setTimeout(() => {
                step1?.classList.add('hidden');
                step2?.classList.remove('hidden');
            }, 1000);

        } catch (err) {
            showMsg(msg1, err.message, true);
        } finally {
            sendCodeBtn.disabled = false;
            sendCodeBtn.textContent = 'Send Verification Code';
        }
    });
}

if (verifyResetBtn) {
    verifyResetBtn.addEventListener('click', async () => {
        const email = emailInput?.value.trim();
        const code = codeInput?.value.trim();
        const newPassword = newPwdInput?.value;
        const confirmPassword = confirmPwdInput?.value;

        if (!code || !newPassword) {
            showMsg(msg2, 'Please enter code and new password.', true);
            return;
        }

        if (newPassword.length < 8) {
            showMsg(msg2, 'Password must be at least 8 characters long.', true);
            return;
        }

        if (newPassword !== confirmPassword) {
            showMsg(msg2, 'Passwords do not match.', true);
            return;
        }

        verifyResetBtn.disabled = true;
        verifyResetBtn.textContent = 'Resetting Password...';

        try {
            const res = await fetch(`${API_URL}/reset-password-verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, code, newPassword })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to reset password');

            showMsg(msg2, 'Password updated! Redirecting to login...', false);
            setTimeout(() => {
                forgotModal?.classList.add('hidden');
            }, 1500);

        } catch (err) {
            showMsg(msg2, err.message, true);
        } finally {
            verifyResetBtn.disabled = false;
            verifyResetBtn.textContent = 'Reset Password';
        }
    });
}

function showMsg(el, text, isError) {
    if (!el) return;
    el.textContent = text;
    el.style.color = isError ? '#ef4444' : '#10b981';
    el.classList.remove('hidden');
}
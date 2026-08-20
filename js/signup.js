import { setCookie, initAuth } from '/js/auth.js';
import { applyTheme } from "/js/theme.js";

applyTheme();

(async () => {
    const loggedIn = await initAuth();
    if (loggedIn) {
        window.location.href = 'https://dev.sposlearning.cz/';
    }
})();

let registeredEmail = '';

function showVerificationStep(email) {
    registeredEmail = email;
    document.getElementById('signup-step').classList.add('hidden');
    document.getElementById('verify-step').classList.remove('hidden');
    document.getElementById('signup-container').classList.add('step-2');
    document.getElementById('verify-email-display').textContent = email;
    document.getElementById('verify-code').value = '';
    document.getElementById('verify-error-message').classList.add('hidden');
}

document.getElementById('sign-up').addEventListener('click', async () => {
    const username = document.getElementById('username-signup').value.trim();
    const email = document.getElementById('email-signup').value.trim();
    const password = document.getElementById('password-signup').value;
    const errorDiv = document.getElementById('signup-error-message');

    if (!username || !email || !password) {
        errorDiv.classList.remove('hidden');
        errorDiv.textContent = 'All fields are required.';
        return;
    }

    try {
        const response = await fetch('https://api.sposlearning.cz/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Registration failed.');
        }

        showVerificationStep(email);
    } catch (err) {
        errorDiv.classList.remove('hidden');
        errorDiv.textContent = err.message;
    }
});

document.getElementById('verify-button').addEventListener('click', async () => {
    const code = document.getElementById('verify-code').value.trim();
    const errorDiv = document.getElementById('verify-error-message');

    if (!code) {
        errorDiv.classList.remove('hidden');
        errorDiv.textContent = 'Please enter the verification code.';
        return;
    }

    try {
        const response = await fetch('https://api.sposlearning.cz/verify-code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: registeredEmail, code })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Verification failed.');
        }

        window.location.href = '/login.html?verified=true';
    } catch (err) {
        errorDiv.classList.remove('hidden');
        errorDiv.textContent = err.message;
    }
});

document.getElementById('resend-link').addEventListener('click', async (e) => {
    e.preventDefault();
    try {
        const response = await fetch('https://api.sposlearning.cz/resend-code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: registeredEmail })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to resend code.');
        alert('A new verification code has been sent.');
    } catch (err) {
        alert(err.message);
    }
});

const passwordInput = document.getElementById('password-signup');
const requirementsDiv = document.getElementById('password-requirements');

passwordInput.addEventListener('focus', () => {
    requirementsDiv.classList.remove('hidden');
});
passwordInput.addEventListener('blur', () => {
    requirementsDiv.classList.add('hidden');
});
passwordInput.addEventListener('input', () => {
    const val = passwordInput.value;
    const rules = {
        length: val.length >= 8,
        uppercase: /[A-Z]/.test(val),
        lowercase: /[a-z]/.test(val),
        number: /\d/.test(val),
        special: /[^A-Za-z0-9]/.test(val)
    };
    document.querySelectorAll('#password-requirements .requirement').forEach(el => {
        const rule = el.dataset.rule;
        el.classList.toggle('valid', rules[rule]);
    });
});
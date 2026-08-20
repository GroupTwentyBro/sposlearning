import { CONFIG } from "/js/config.js";
import { initAuth, getUser, getAccessToken } from "/js/auth.js";

const API_URL = CONFIG.API_URL;

async function checkAuth() {
    const loggedIn = await initAuth();
    if (!loggedIn) {
        window.location.href = '/login';
        return;
    }
}

const form = document.getElementById('change-pwd-form');
const currentPwdInput = document.getElementById('current-password');
const newPwdInput = document.getElementById('new-password');
const confirmPwdInput = document.getElementById('confirm-password');
const statusDiv = document.getElementById('change-pwd-status');
const submitBtn = document.getElementById('submit-change-btn');

if (form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const currentPassword = currentPwdInput.value;
        const newPassword = newPwdInput.value;
        const confirmPassword = confirmPwdInput.value;

        if (newPassword.length < 8) {
            showStatus('New password must be at least 8 characters long.', true);
            return;
        }

        if (newPassword !== confirmPassword) {
            showStatus('New passwords do not match.', true);
            return;
        }

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Updating...';
        }

        try {
            const token = await getAccessToken();
            const response = await fetch(`${API_URL}/change-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ currentPassword, newPassword })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to update password');
            }

            showStatus(data.message || 'Password updated successfully!', false);
            form.reset();

        } catch (err) {
            showStatus(err.message, true);
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Update Password';
            }
        }
    });
}

function showStatus(msg, isError) {
    if (!statusDiv) return;
    statusDiv.textContent = msg;
    statusDiv.className = isError ? 'login-error' : 'login-success';
    statusDiv.style.padding = '10px 14px';
    statusDiv.style.borderRadius = '8px';
    statusDiv.style.fontSize = '0.88rem';
    statusDiv.style.color = isError ? '#ef4444' : '#10b981';
    statusDiv.style.background = isError ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)';
    statusDiv.classList.remove('hidden');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkAuth);
} else {
    checkAuth();
}

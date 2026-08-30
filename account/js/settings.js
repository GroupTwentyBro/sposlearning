import { CONFIG } from "/js/config.js";
import { initAuth, getUser, getAccessToken, login } from "/js/auth.js";
import { getGradeCookie, setGradeCookie } from "/js/search.js";
import { getThemeCookie, setThemeCookie } from "/js/theme.js";

const API_URL = CONFIG.API_URL;

const tabBtns = document.querySelectorAll('.tab-btn');
const tabPanels = document.querySelectorAll('.tab-panel');
const gradeSelect = document.getElementById('setting-default-grade');
const themeSelect = document.getElementById('setting-theme');
const mikuSettingsGroup = document.getElementById('miku-settings-group');
const mikuToggles = document.querySelectorAll('.miku-exclusive-toggle');
const mikuProofreadToggle = document.getElementById('miku-mode-proofread');
const saveGeneralBtn = document.getElementById('save-general-btn');

const profileName = document.getElementById('profile-name');
const profileEmail = document.getElementById('profile-email');
const profileBadges = document.getElementById('profile-badges');

const profileForm = document.getElementById('settings-profile-form');
const inputName = document.getElementById('input-profile-name');
const inputEmail = document.getElementById('input-profile-email');
const profileStatus = document.getElementById('profile-status-msg');
const saveProfileBtn = document.getElementById('save-profile-btn');

const statusGoogle = document.getElementById('idp-status-google');
const statusMicrosoft = document.getElementById('idp-status-microsoft');
const btnGoogle = document.getElementById('idp-btn-google');
const btnMicrosoft = document.getElementById('idp-btn-microsoft');

const pwdForm = document.getElementById('settings-change-pwd-form');
const pwdCurrent = document.getElementById('pwd-current');
const pwdNew = document.getElementById('pwd-new');
const pwdConfirm = document.getElementById('pwd-confirm');
const pwdStatus = document.getElementById('pwd-status-msg');
const savePwdBtn = document.getElementById('save-pwd-btn');

async function checkAuth() {
    const loggedIn = await initAuth();
    if (!loggedIn) {
        window.location.href = '/login';
        return;
    }

    const user = getUser();
    if (user) {
        if (profileName) profileName.textContent = user.name || 'User';
        if (profileEmail) profileEmail.textContent = user.email || '';
        if (inputName) inputName.value = user.name || '';
        if (inputEmail) inputEmail.value = user.email || '';
        
        if (profileBadges) {
            const roles = user.roles || [];
            const badges = [];

            if (roles.some(r => r.toLowerCase() === 'admin' || r.toLowerCase() === 'administrator')) {
                badges.push(`<span class="badge badge-admin">Admin</span>`);
            }
            if (roles.some(r => r.toLowerCase() === 'developer' || r.toLowerCase() === 'dev')) {
                badges.push(`<span class="badge badge-developer">Developer</span>`);
            }

            profileBadges.innerHTML = badges.join('');
        }
    }

    initGeneralSettings();
    loadLinkedProviders();
}

function initTabNavigation() {
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.dataset.tab;

            tabBtns.forEach(b => b.classList.remove('active'));
            tabPanels.forEach(p => {
                p.classList.remove('active');
                p.classList.add('hidden');
            });

            btn.classList.add('active');
            const targetPanel = document.getElementById(`tab-${targetTab}`);
            if (targetPanel) {
                targetPanel.classList.remove('hidden');
                targetPanel.classList.add('active');
            }
        });
    });
}

function getMikuModeCookie() {
    const match = document.cookie.match(/(?:^|; )spos_miku_mode=([^;]*)/);
    return match ? decodeURIComponent(match[1]) : 'default';
}

function setMikuModeCookie(mode) {
    document.cookie = `spos_miku_mode=${encodeURIComponent(mode)}; path=/; max-age=31536000; SameSite=Lax`;
}

function getMikuProofreadCookie() {
    const match = document.cookie.match(/(?:^|; )spos_miku_proofread=([^;]*)/);
    return match ? decodeURIComponent(match[1]) : 'false';
}

function setMikuProofreadCookie(enabled) {
    document.cookie = `spos_miku_proofread=${encodeURIComponent(enabled)}; path=/; max-age=31536000; SameSite=Lax`;
}

let currentMikuMode = 'default';
let currentMikuProofread = 'false';

function initGeneralSettings() {
    const currentGrade = getGradeCookie();
    if (gradeSelect) gradeSelect.value = currentGrade;

    const currentTheme = getThemeCookie();
    if (themeSelect) themeSelect.value = currentTheme;

    if (mikuSettingsGroup) {
        if (currentTheme === 'miku') {
            mikuSettingsGroup.classList.remove('hidden');
        } else {
            mikuSettingsGroup.classList.add('hidden');
        }
    }

    if (themeSelect) {
        themeSelect.addEventListener('change', () => {
            setThemeCookie(themeSelect.value);
            if (mikuSettingsGroup) {
                if (themeSelect.value === 'miku') {
                    mikuSettingsGroup.classList.remove('hidden');
                } else {
                    mikuSettingsGroup.classList.add('hidden');
                }
            }
        });
    }

    currentMikuMode = getMikuModeCookie();
    mikuToggles.forEach(toggle => {
        if (toggle.dataset.mode === currentMikuMode) {
            toggle.checked = true;
        }
        toggle.addEventListener('change', (e) => {
            if (e.target.checked) {
                mikuToggles.forEach(t => {
                    if (t !== e.target) t.checked = false;
                });
                currentMikuMode = e.target.dataset.mode;
            } else {
                currentMikuMode = 'default';
            }
        });
    });

    currentMikuProofread = getMikuProofreadCookie();
    if (mikuProofreadToggle) {
        mikuProofreadToggle.checked = (currentMikuProofread === 'true');
        mikuProofreadToggle.addEventListener('change', (e) => {
            currentMikuProofread = e.target.checked ? 'true' : 'false';
        });
    }

    if (saveGeneralBtn) {
        saveGeneralBtn.addEventListener('click', () => {
            const selectedGrade = parseInt(gradeSelect.value, 10);
            setGradeCookie(selectedGrade);

            const selectedTheme = themeSelect ? themeSelect.value : 'dark';
            setMikuModeCookie(currentMikuMode);
            setMikuProofreadCookie(currentMikuProofread);
            setThemeCookie(selectedTheme);

            saveGeneralBtn.innerHTML = `<span class="icon">check</span> Saved!`;
            setTimeout(() => {
                saveGeneralBtn.innerHTML = `<span class="icon">save</span> Save Preferences`;
            }, 2000);
        });
    }
}

if (profileForm) {
    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newName = inputName?.value.trim();
        if (!newName) return;

        if (saveProfileBtn) {
            saveProfileBtn.disabled = true;
            saveProfileBtn.innerHTML = `<span class="icon spinner">sync</span> Saving...`;
        }

        try {
            const token = await getAccessToken();
            const res = await fetch(`${API_URL}/update-profile`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ name: newName })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to update profile');

            showMsg(profileStatus, data.message || 'Profile updated!', false);
            if (profileName) profileName.textContent = newName;

        } catch (err) {
            showMsg(profileStatus, err.message, true);
        } finally {
            if (saveProfileBtn) {
                saveProfileBtn.disabled = false;
                saveProfileBtn.innerHTML = `<span class="icon">person_add</span> Save Profile`;
            }
        }
    });
}

async function loadLinkedProviders() {
    try {
        const token = await getAccessToken();
        const res = await fetch(`${API_URL}/user-linked-providers`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) return;
        const data = await res.json();
        const linked = data.providers || [];

        updateIdpUI('google', linked.includes('google'), statusGoogle, btnGoogle);
        updateIdpUI('microsoft', linked.includes('microsoft'), statusMicrosoft, btnMicrosoft);

    } catch (err) {
        console.warn('Could not fetch linked providers:', err.message);
    }
}

function updateIdpUI(provider, isLinked, statusEl, btnEl) {
    if (!statusEl || !btnEl) return;

    if (isLinked) {
        statusEl.textContent = 'Linked';
        statusEl.style.color = '#10b981';
        btnEl.textContent = 'Unlink';
        btnEl.style.background = 'rgba(239, 68, 68, 0.15)';
        btnEl.style.borderColor = 'rgba(239, 68, 68, 0.3)';
        btnEl.style.color = '#ef4444';
        btnEl.onclick = () => unlinkProvider(provider);
    } else {
        statusEl.textContent = 'Not Linked';
        statusEl.style.color = 'var(--text-tertiary)';
        btnEl.textContent = `Link ${provider.charAt(0).toUpperCase() + provider.slice(1)}`;
        btnEl.style.background = 'rgba(255,255,255,0.08)';
        btnEl.style.borderColor = 'var(--border-color)';
        btnEl.style.color = 'var(--text-primary)';
        btnEl.onclick = () => login(provider);
    }
}

async function unlinkProvider(provider) {
    if (!confirm(`Are you sure you want to unlink your ${provider} account?`)) return;

    try {
        const token = await getAccessToken();
        const res = await fetch(`${API_URL}/unlink-provider?provider=${provider}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to unlink provider');

        loadLinkedProviders();
    } catch (err) {
        alert(err.message);
    }
}

if (pwdForm) {
    pwdForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const currentPassword = pwdCurrent.value;
        const newPassword = pwdNew.value;
        const confirmPassword = pwdConfirm.value;

        if (newPassword.length < 8) {
            showMsg(pwdStatus, 'New password must be at least 8 characters long.', true);
            return;
        }

        if (newPassword !== confirmPassword) {
            showMsg(pwdStatus, 'New passwords do not match.', true);
            return;
        }

        if (savePwdBtn) {
            savePwdBtn.disabled = true;
            savePwdBtn.innerHTML = `<span class="icon spinner">sync</span> Updating...`;
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

            showMsg(pwdStatus, data.message || 'Password changed successfully!', false);
            pwdForm.reset();

        } catch (err) {
            showMsg(pwdStatus, err.message, true);
        } finally {
            if (savePwdBtn) {
                savePwdBtn.disabled = false;
                savePwdBtn.innerHTML = `<span class="icon">lock_reset</span> Change Password`;
            }
        }
    });
}

function showMsg(el, msg, isError) {
    if (!el) return;
    el.textContent = msg;
    el.style.padding = '10px 14px';
    el.style.borderRadius = '8px';
    el.style.fontSize = '0.88rem';
    el.style.color = isError ? '#ef4444' : '#10b981';
    el.style.background = isError ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)';
    el.classList.remove('hidden');
}

function escapeHtml(text) {
    if (!text) return '';
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(text).replace(/[&<>"']/g, m => map[m]);
}

let currentTotpSecret = '';

async function initMFAHandlers() {
    loadMFAStatus();

    const btnSetupTotp = document.getElementById('btn-setup-totp');
    const totpModal = document.getElementById('totp-modal');
    const closeTotpModal = document.getElementById('close-totp-modal');
    const verifyTotpForm = document.getElementById('verify-totp-form');
    const totpQrImg = document.getElementById('totp-qr-img');
    const totpSecretText = document.getElementById('totp-secret-text');
    const totpModalStatus = document.getElementById('totp-modal-status');

    if (btnSetupTotp) {
        btnSetupTotp.addEventListener('click', async () => {
            if (btnSetupTotp.dataset.enabled === 'true') {
                if (confirm('Are you sure you want to disable Authenticator 2FA?')) {
                    await disableMFA('totp');
                }
                return;
            }

            try {
                const token = await getAccessToken();
                const res = await fetch(`${API_URL}/mfa/setup-totp`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Failed to setup TOTP');

                currentTotpSecret = data.secret;
                if (totpQrImg) totpQrImg.src = data.qrCodeUrl;
                if (totpSecretText) totpSecretText.textContent = data.secret;
                if (totpModal) totpModal.classList.remove('hidden');
            } catch (err) {
                alert(err.message);
            }
        });
    }

    if (closeTotpModal) {
        closeTotpModal.addEventListener('click', () => {
            if (totpModal) totpModal.classList.add('hidden');
        });
    }

    if (verifyTotpForm) {
        verifyTotpForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const code = document.getElementById('totp-code-input').value;
            try {
                const token = await getAccessToken();
                const res = await fetch(`${API_URL}/mfa/verify-totp`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ secret: currentTotpSecret, code })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Failed to verify code');

                if (totpModal) totpModal.classList.add('hidden');
                loadMFAStatus();
                alert(data.message || 'Authenticator 2FA enabled!');
            } catch (err) {
                showMsg(totpModalStatus, err.message, true);
            }
        });
    }

    const btnSetupEmailMfa = document.getElementById('btn-setup-email-mfa');
    const emailMfaModal = document.getElementById('email-mfa-modal');
    const closeEmailMfaModal = document.getElementById('close-email-mfa-modal');
    const verifyEmailMfaForm = document.getElementById('verify-email-mfa-form');
    const emailMfaModalStatus = document.getElementById('email-mfa-modal-status');

    if (btnSetupEmailMfa) {
        btnSetupEmailMfa.addEventListener('click', async () => {
            if (btnSetupEmailMfa.dataset.enabled === 'true') {
                if (confirm('Are you sure you want to disable Email 2FA?')) {
                    await disableMFA('email');
                }
                return;
            }

            try {
                const token = await getAccessToken();
                const res = await fetch(`${API_URL}/mfa/send-email-otp`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Failed to send verification code');

                if (emailMfaModal) emailMfaModal.classList.remove('hidden');
            } catch (err) {
                alert(err.message);
            }
        });
    }

    if (closeEmailMfaModal) {
        closeEmailMfaModal.addEventListener('click', () => {
            if (emailMfaModal) emailMfaModal.classList.add('hidden');
        });
    }

    if (verifyEmailMfaForm) {
        verifyEmailMfaForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const code = document.getElementById('email-mfa-code-input').value;
            try {
                const token = await getAccessToken();
                const res = await fetch(`${API_URL}/mfa/enable-email-otp`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ code })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Failed to verify email code');

                if (emailMfaModal) emailMfaModal.classList.add('hidden');
                loadMFAStatus();
                alert(data.message || 'Email 2FA enabled!');
            } catch (err) {
                showMsg(emailMfaModalStatus, err.message, true);
            }
        });
    }

    const btnRegisterPasskey = document.getElementById('btn-register-passkey');
    if (btnRegisterPasskey) {
        btnRegisterPasskey.addEventListener('click', async () => {
            if (!window.PublicKeyCredential) {
                alert('WebAuthn Passkeys are not supported by your browser.');
                return;
            }

            try {
                const token = await getAccessToken();
                const optRes = await fetch(`${API_URL}/mfa/passkey-register-options`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const optData = await optRes.json();
                if (!optRes.ok) throw new Error(optData.error || 'Failed to get Passkey options');

                const options = optData.options;
                options.challenge = Uint8Array.from(atob(options.challenge.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
                options.user.id = Uint8Array.from(atob(options.user.id.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));

                if (options.excludeCredentials) {
                    options.excludeCredentials = options.excludeCredentials.map(cred => ({
                        ...cred,
                        id: Uint8Array.from(atob(cred.id.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))
                    }));
                }

                const credential = await navigator.credentials.create({ publicKey: options });
                const deviceName = prompt('Enter a name for this Passkey device (e.g. MacBook TouchID, YubiKey):', 'My Security Key') || 'Security Key';

                const credentialJSON = {
                    id: credential.id,
                    rawId: arrayBufferToBase64Url(credential.rawId),
                    type: credential.type,
                    response: {
                        attestationObject: arrayBufferToBase64Url(credential.response.attestationObject),
                        clientDataJSON: arrayBufferToBase64Url(credential.response.clientDataJSON)
                    }
                };

                const verifyRes = await fetch(`${API_URL}/mfa/passkey-register-verify`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ response: credentialJSON, deviceName })
                });

                const verifyData = await verifyRes.json();
                if (!verifyRes.ok) throw new Error(verifyData.error || 'Failed to register Passkey');

                loadMFAStatus();
                alert(verifyData.message || 'Passkey added successfully!');
            } catch (err) {
                if (err.name !== 'NotAllowedError') {
                    alert('Passkey registration failed: ' + err.message);
                }
            }
        });
    }
}

async function loadMFAStatus() {
    try {
        const token = await getAccessToken();
        const res = await fetch(`${API_URL}/mfa/status`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) return;

        const data = await res.json();

        const btnSetupTotp = document.getElementById('btn-setup-totp');
        const totpStatusDesc = document.getElementById('totp-status-desc');
        if (btnSetupTotp) {
            btnSetupTotp.dataset.enabled = data.totpEnabled ? 'true' : 'false';
            if (data.totpEnabled) {
                btnSetupTotp.className = 'btn';
                btnSetupTotp.style.cssText = 'background: rgba(239,68,68,0.15); color: #ef4444; border: 1px solid rgba(239,68,68,0.3); font-size: 0.82rem; padding: 6px 14px;';
                btnSetupTotp.innerHTML = `<span class="icon" style="font-size: 1rem;">block</span> Disable 2FA`;
                if (totpStatusDesc) totpStatusDesc.textContent = 'Active • 2FA enabled via Authenticator App';
            } else {
                btnSetupTotp.className = 'btn btn-primary';
                btnSetupTotp.style.cssText = 'font-size: 0.82rem; padding: 6px 14px;';
                btnSetupTotp.innerHTML = `<span class="icon" style="font-size: 1rem;">add</span> Enable 2FA`;
                if (totpStatusDesc) totpStatusDesc.textContent = 'Google Authenticator, 1Password, Microsoft Authenticator';
            }
        }

        const btnSetupEmailMfa = document.getElementById('btn-setup-email-mfa');
        const emailMfaStatusDesc = document.getElementById('email-mfa-status-desc');
        if (btnSetupEmailMfa) {
            btnSetupEmailMfa.dataset.enabled = data.emailOtpEnabled ? 'true' : 'false';
            if (data.emailOtpEnabled) {
                btnSetupEmailMfa.className = 'btn';
                btnSetupEmailMfa.style.cssText = 'background: rgba(239,68,68,0.15); color: #ef4444; border: 1px solid rgba(239,68,68,0.3); font-size: 0.82rem; padding: 6px 14px;';
                btnSetupEmailMfa.innerHTML = `<span class="icon" style="font-size: 1rem;">block</span> Disable Email 2FA`;
                if (emailMfaStatusDesc) emailMfaStatusDesc.textContent = 'Active • Verification code sent to email upon login';
            } else {
                btnSetupEmailMfa.className = 'btn btn-primary';
                btnSetupEmailMfa.style.cssText = 'font-size: 0.82rem; padding: 6px 14px;';
                btnSetupEmailMfa.innerHTML = `<span class="icon" style="font-size: 1rem;">mail</span> Enable Email 2FA`;
                if (emailMfaStatusDesc) emailMfaStatusDesc.textContent = 'Receive a 6-digit verification code via email';
            }
        }

        const passkeysContainer = document.getElementById('passkeys-list-container');
        if (passkeysContainer && data.passkeys) {
            if (data.passkeys.length === 0) {
                passkeysContainer.innerHTML = '';
            } else {
                passkeysContainer.innerHTML = data.passkeys.map(pk => `
                    <div style="display: flex; align-items: center; justify-content: space-between; background: var(--surface-2); border: 1px solid var(--border-color); padding: 10px 14px; border-radius: 10px; margin-top: 8px;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span class="icon" style="color: #c084fc;">vpn_key</span>
                            <span style="font-size: 0.88rem; font-weight: 500;">${escapeHtml(pk.device_name)}</span>
                        </div>
                        <button type="button" class="btn-delete-passkey" data-id="${pk.id}" style="background: none; border: none; color: #ef4444; cursor: pointer; font-size: 0.82rem;">Remove</button>
                    </div>
                `).join('');

                document.querySelectorAll('.btn-delete-passkey').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        if (confirm('Remove this Passkey?')) {
                            await deletePasskey(btn.dataset.id);
                        }
                    });
                });
            }
        }

    } catch (err) {
        console.error('Failed to load MFA status:', err);
    }
}

async function disableMFA(type) {
    try {
        const token = await getAccessToken();
        const res = await fetch(`${API_URL}/mfa/disable-${type}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to disable 2FA');
        loadMFAStatus();
        alert(data.message || '2FA disabled.');
    } catch (err) {
        alert(err.message);
    }
}

async function deletePasskey(id) {
    try {
        const token = await getAccessToken();
        const res = await fetch(`${API_URL}/mfa/passkey?id=${encodeURIComponent(id)}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to remove passkey');
        loadMFAStatus();
    } catch (err) {
        alert(err.message);
    }
}

function arrayBufferToBase64Url(buffer) {
    return btoa(String.fromCharCode(...new Uint8Array(buffer)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initTabNavigation();
        checkAuth();
        initMFAHandlers();
    });
} else {
    initTabNavigation();
    checkAuth();
    initMFAHandlers();
}

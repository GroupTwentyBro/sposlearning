import { CONFIG } from "/js/config.js";
import { showVerificationOverlay } from "/js/verify.js";

const KRATOS_URL = CONFIG.AUTH_URL;
let userEmailForVerification = "";

async function checkGlobalVerification() {
    try {
        const res = await fetch(`${KRATOS_URL}/sessions/whoami`, {
            credentials: 'include',
            headers: { 'Accept': 'application/json' }
        });

        if (!res.ok) return;

        const session = await res.json();
        const isSocialLogin = session.authentication_methods?.some(method => method.method === 'oidc');

        if (!isSocialLogin) {
            const address = session.identity.verifiable_addresses?.[0];
            if (address && !address.verified) {
                userEmailForVerification = address.value;
                showVerificationWarning(userEmailForVerification);
            }
        }
    } catch (e) {
        console.error("Verification check failed", e);
    }
}

function showVerificationWarning(email) {
    const banner = document.createElement('div');
    banner.id = 'verification-warning-banner';
    banner.innerHTML = `
        <div style="position: fixed; bottom: 20px; right: 20px; z-index: 99999; 
                    background: var(--root-box-bg-clr); border: 1px solid var(--discl-important-fg-clr); 
                    padding: 20px; border-radius: var(--box-border-radius); max-width: 350px;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.5); border-left: 5px solid #ff4757;">
            <h5 style="color: #ff4757; margin-top: 0; display: flex; align-items: center; gap: 8px;">
                <span class="material-symbols-outlined">warning</span> Email není ověřen
            </h5>
            <p style="font-size: 0.9rem; margin: 10px 0;">
                Pro plnou funkčnost si prosím ověřte svůj email: <b>${email}</b>
            </p>
            <button id="resend-verification-btn" class="btn btn-sm btn-primary w-100">Odeslat ověřovací kód</button>
            <p id="resend-status" style="font-size: 0.8rem; margin-top: 8px; text-align: center;"></p>
        </div>
    `;
    document.body.appendChild(banner);

    document.getElementById('resend-verification-btn').addEventListener('click', resendVerification);
}

async function resendVerification() {
    const btn = document.getElementById('resend-verification-btn');
    const status = document.getElementById('resend-status');

    btn.disabled = true;
    btn.textContent = "Odesílání...";

    try {
        const flowRes = await fetch(`${KRATOS_URL}/self-service/verification/browser`, {
            credentials: 'include',
            headers: { 'Accept': 'application/json' }
        });
        const flow = await flowRes.json();
        const csrfToken = flow.ui.nodes.find(n => n.attributes.name === 'csrf_token')?.attributes.value;

        const submitRes = await fetch(`${KRATOS_URL}/self-service/verification?flow=${flow.id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({
                method: 'code',
                csrf_token: csrfToken,
                email: userEmailForVerification
            }),
            credentials: 'include'
        });

        if (submitRes.ok) {
            status.style.color = "var(--primary-hl-clr)";
            status.textContent = "Kód byl odeslán!";

            showVerificationOverlay(userEmailForVerification);

            btn.textContent = "Odeslat znovu";
            btn.disabled = false;
        } else {
            const errData = await submitRes.json();
            throw new Error(errData.ui?.messages?.[0]?.text || "Chyba");
        }
    } catch (err) {
        status.style.color = "#ff4757";
        status.textContent = "Chyba: " + err.message;
        btn.disabled = false;
        btn.textContent = "Zkusit znovu";
    }
}

checkGlobalVerification();
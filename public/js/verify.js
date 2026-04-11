import { CONFIG } from "/js/config.js";
const KRATOS_URL = CONFIG.AUTH_URL;

export async function showVerificationOverlay(email) {
    document.getElementById('verification-overlay')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'verification-overlay';
    overlay.style = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.85); backdrop-filter: blur(8px);
        display: flex; align-items: center; justify-content: center; z-index: 100000;
    `;

    overlay.innerHTML = `
        <div class="box d-flex flex-column align-items-center p-5 text-center" 
             style="max-width: 500px; width: 95%; background: var(--box-clr); border: 2px solid var(--primary-hl-clr); border-radius: var(--box-border-radius); box-shadow: 0 20px 50px rgba(0,0,0,0.5);">
            
            <h2 class="mb-4 text-white fw-bold">Ověření účtu</h2>
            
            <p class="mb-4">Zadejte 6-místný kód odeslaný na:<br>
               <span class="text-primary fw-bold">${email}</span>
            </p>
            
            <input type="text" id="verify-otp" class="form-control form-control-lg text-center fw-bold mb-2" 
                   placeholder="000000" maxlength="6" 
                   style="font-size: 2rem; letter-spacing: 8px; background: rgba(0,0,0,0.2); border: 1px solid var(--box-border-clr); color: white;">

            <div id="verify-status" class="mb-3" style="min-height: 1.5rem; font-size: 0.9rem;"></div>

            <div class="d-flex flex-column w-100 gap-3">
                <button id="btn-confirm-verify" class="btn btn-primary btn-lg py-3">Ověřit kód</button>
                <div class="d-flex justify-content-between align-items-center mt-2">
                    <button id="btn-resend-otp" class="btn btn-link btn-sm text-decoration-none p-0">Poslat nový kód</button>
                    <button id="btn-close-verify" class="btn btn-link btn-sm text-muted text-decoration-none p-0">Zavřít</button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    const input = document.getElementById('verify-otp');
    const status = document.getElementById('verify-status');
    const confirmBtn = document.getElementById('btn-confirm-verify');
    const resendBtn = document.getElementById('btn-resend-otp');

    const submitCode = async () => {
        const code = input.value.trim();
        if (code.length < 6) return;

        confirmBtn.disabled = true;
        status.textContent = "Ověřování...";
        status.className = "text-info";

        try {
            const flowRes = await fetch(`${KRATOS_URL}/self-service/verification/browser`, {
                credentials: 'include',
                headers: { 'Accept': 'application/json' }
            });
            const flow = await flowRes.json();
            const csrfToken = flow.ui.nodes.find(n => n.attributes.name === 'csrf_token')?.attributes.value;

            const res = await fetch(`${KRATOS_URL}/self-service/verification?flow=${flow.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ method: 'code', csrf_token: csrfToken, code: code }),
                credentials: 'include'
            });

            if (res.ok) {
                status.className = "text-success";
                status.textContent = "Email ověřen! Přesměrovávám...";
                setTimeout(() => location.reload(), 1500);
            } else {
                const data = await res.json();
                if (res.status === 410 || res.status === 403) {
                    throw new Error("Kód vypršel. Nechte si poslat nový.");
                }
                throw new Error(data.ui?.nodes?.find(n => n.messages?.length > 0)?.messages[0]?.text || "Neplatný kód.");
            }
        } catch (err) {
            status.className = "text-danger";
            status.textContent = err.message;
            confirmBtn.disabled = false;
        }
    };

    const resendCode = async () => {
        resendBtn.disabled = true;
        status.textContent = "Posílám nový kód...";
        status.className = "text-info";

        try {
            const flowRes = await fetch(`${KRATOS_URL}/self-service/verification/browser`, {
                credentials: 'include',
                headers: { 'Accept': 'application/json' }
            });
            const flow = await flowRes.json();
            const csrfToken = flow.ui.nodes.find(n => n.attributes.name === 'csrf_token')?.attributes.value;

            const res = await fetch(`${KRATOS_URL}/self-service/verification?flow=${flow.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ method: 'code', csrf_token: csrfToken, email: email }),
                credentials: 'include'
            });

            if (res.ok) {
                status.className = "text-success";
                status.textContent = "Nový kód byl odeslán!";
                input.value = "";
            } else {
                throw new Error("Nepodařilo se odeslat kód.");
            }
        } catch (err) {
            status.className = "text-danger";
            status.textContent = err.message;
        } finally {
            setTimeout(() => { resendBtn.disabled = false; }, 5000);
        }
    };

    confirmBtn.onclick = submitCode;
    resendBtn.onclick = resendCode;
    document.getElementById('btn-close-verify').onclick = () => overlay.remove();

    input.addEventListener('input', () => {
        if (input.value.length === 6) submitCode();
    });
}
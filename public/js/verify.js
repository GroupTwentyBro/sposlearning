import { CONFIG } from "/js/config.js";
const KRATOS_URL = CONFIG.AUTH_URL;

export async function showVerificationOverlay(email) {
    const overlay = document.createElement('div');
    overlay.id = 'verification-overlay';
    overlay.style = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.85); backdrop-filter: blur(8px);
        display: flex; align-items: center; justify-content: center; z-index: 100000;
    `;

    overlay.innerHTML = `
        <div class="box p-4 text-center" style="max-width: 400px; border: 1px solid var(--primary-hl-clr);">
            <h3 class="mb-3">Ověření účtu</h3>
            <p class="small">Zadejte 6-místný kód odeslaný na <b>${email}</b></p>
            
            <div class="d-flex gap-2 justify-content-center mb-3">
                <input type="text" id="verify-otp" class="form-control text-center fw-bold fs-4" 
                       placeholder="000000" maxlength="6" style="letter-spacing: 5px;">
            </div>

            <div id="verify-status" class="small mb-3"></div>

            <div class="d-grid gap-2">
                <button id="btn-confirm-verify" class="btn btn-primary">Ověřit kód</button>
                <button id="btn-close-verify" class="btn btn-outline-secondary">Zavřít</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    const input = document.getElementById('verify-otp');
    const status = document.getElementById('verify-status');
    const closeBtn = document.getElementById('btn-close-verify');
    const confirmBtn = document.getElementById('btn-confirm-verify');

    closeBtn.onclick = () => overlay.remove();

    confirmBtn.onclick = async () => {
        const code = input.value.trim();
        if (code.length < 6) return;

        confirmBtn.disabled = true;
        confirmBtn.textContent = "Ověřování...";

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
                body: JSON.stringify({
                    method: 'code',
                    csrf_token: csrfToken,
                    code: code
                }),
                credentials: 'include'
            });

            if (res.ok) {
                status.className = "text-success small mb-3";
                status.textContent = "Email byl úspěšně ověřen!";
                setTimeout(() => location.reload(), 1500);
            } else {
                const data = await res.json();
                throw new Error(data.ui?.nodes?.find(n => n.messages?.length > 0)?.messages[0]?.text || "Neplatný kód");
            }
        } catch (err) {
            status.className = "text-danger small mb-3";
            status.textContent = err.message;
            confirmBtn.disabled = false;
            confirmBtn.textContent = "Ověřit kód";
        }
    };
}
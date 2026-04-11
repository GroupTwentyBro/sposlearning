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
        <div class="box d-flex flex-column align-items-center p-5 text-center" 
             style="max-width: 500px; width: 90%; background: var(--box-clr); border: 2px solid var(--primary-hl-clr); box-shadow: 0 20px 50px rgba(0,0,0,0.5);">
            
            <h2 class="mb-4 text-white fw-bold">Ověření účtu</h2>
            
            <p class="mb-4">Zadejte 6-místný kód odeslaný na:<br>
               <span class="text-primary fw-bold">${email}</span>
            </p>
            
            <input type="text" id="verify-otp" class="form-control form-control-lg text-center fw-bold mb-4" 
                   placeholder="000 000" maxlength="6" 
                   style="font-size: 2rem; letter-spacing: 8px; background: rgba(0,0,0,0.2); border: 1px solid var(--box-border-clr); color: white;">

            <div id="verify-status" class="mb-3" style="min-height: 1.5rem;"></div>

            <div class="d-flex flex-column w-100 gap-3">
                <button id="btn-confirm-verify" class="btn btn-primary btn-lg py-3">Ověřit kód</button>
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
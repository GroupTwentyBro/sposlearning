import { createServerLog } from '/js/logging.js';
import { CONFIG } from "/js/config.js";
import { showVerificationOverlay } from "/js/verify.js";

const KRATOS_URL = CONFIG.AUTH_URL;

const regForm = document.getElementById('register-form');
const emailInput = document.getElementById('reg-email');
const passInput = document.getElementById('reg-password');
const confirmPassInput = document.getElementById('reg-password-confirm');
const statusMsg = document.getElementById('status-message');
const regBtn = document.getElementById('reg-btn');

let currentFlowData = null;
let flowId = null;

async function initializeFlow() {
    try {
        const response = await fetch(`${KRATOS_URL}/self-service/registration/browser`, {
            method: 'GET',
            credentials: 'include',
            headers: { 'Accept': 'application/json' }
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("Kratos Initialization Error:", data);

            if (data.error?.id === 'session_already_available') {
                window.location.href = '/';
                return;
            }
        }

        currentFlowData = data;
        flowId = data.id;
    } catch (err) {
        console.error("Failed to initialize registration flow:", err);
    }
}

function getCsrfToken() {
    return currentFlowData?.ui?.nodes?.find(
        node => node.attributes.name === 'csrf_token'
    )?.attributes.value;
}

initializeFlow();

regForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    statusMsg.className = "mt-3 text-center text-danger";
    statusMsg.textContent = "";

    const email = emailInput.value;
    const pass = passInput.value;
    const confirmPass = confirmPassInput.value;

    if (pass !== confirmPass) {
        statusMsg.textContent = "Hesla se neshodují.";
        return;
    }

    const csrfToken = getCsrfToken();
    if (!csrfToken) {
        statusMsg.textContent = "Chyba relace (CSRF). Zkuste obnovit stránku.";
        return;
    }

    regBtn.disabled = true;
    regBtn.textContent = "Ověřování e-mailu...";

    try {
        const debounceResponse = await fetch(`https://disposable.debounce.io/?email=${encodeURIComponent(email)}`);
        const debounceData = await debounceResponse.json();

        if (debounceData.disposable === "true") {
            statusMsg.textContent = "Dočasné e-mailové adresy nejsou povoleny.";
            regBtn.disabled = false;
            regBtn.textContent = "Vytvořit účet";

            await createServerLog('auth', `Zablokována registrace z dočasného emailu`, {
                isUser: false,
                userEmail: email
            });
            return;
        }

        regBtn.textContent = "Vytváření...";

        const response = await fetch(`${KRATOS_URL}/self-service/registration?flow=${flowId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                method: 'password',
                csrf_token: csrfToken,
                password: pass,
                traits: { email: email }
            }),
            credentials: 'include'
        });

        const data = await response.json();

        if (response.ok) {
            await createServerLog('auth', `New Registration`, {
                isUser: true,
                userEmail: email,
                userEmailVerified: false,
                userName: 'none'
            });

            statusMsg.className = "mt-3 text-center text-success";
            statusMsg.innerHTML = `Účet vytvořen! Odesílám ověřovací kód...`;

            regForm.reset();
            regBtn.disabled = false;
            regBtn.textContent = "Vytvořit účet";

            showVerificationOverlay(email);

            await initializeFlow();

        } else {
            regBtn.disabled = false;
            regBtn.textContent = "Vytvořit účet";

            if (data.redirect_browser_to || response.status === 303) {
                console.log("Intercepting Kratos redirect to show OTP overlay.");
                showVerificationOverlay(email);
                return;
            }

            const errorText = data.ui?.messages?.[0]?.text
                || data.ui?.nodes?.find(n => n.messages?.length > 0)?.messages[0]?.text
                || "Nastala chyba při registraci.";

            statusMsg.textContent = errorText;

            if (data.error?.id === 'self_service_flow_expired' || response.status === 410) {
                await initializeFlow();
            } else {
                currentFlowData = data;
            }
        }

    } catch (error) {
        console.error("Submit error:", error);
        statusMsg.className = "mt-3 text-center text-danger";
        statusMsg.textContent = "Server neodpovídá. Zkuste to prosím později.";
        regBtn.disabled = false;
        regBtn.textContent = "Vytvořit účet";
    }
});
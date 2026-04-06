import { createServerLog } from '/js/logging.js';
import {CONFIG} from "/js/config.js";

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
        currentFlowData = await response.json();
        flowId = currentFlowData.id;
    } catch (err) {
        console.error("Initialization failed:", err);
        statusMsg.textContent = "Nelze inicializovat registraci.";
    }
}

function getCsrfToken() {
    if (!currentFlowData) return null;
    return currentFlowData.ui.nodes.find(
        node => node.attributes.name === 'csrf_token'
    )?.attributes.value;
}

initializeFlow();

regForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    statusMsg.className = "text-danger";
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
        statusMsg.textContent = "Chyba relace. Zkuste obnovit stránku.";
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

        const body = {
            method: 'password',
            csrf_token: csrfToken,
            password: pass,
            traits: {
                email: email
            }
        };

        const response = await fetch(`${KRATOS_URL}/self-service/registration?flow=${flowId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(body),
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

            statusMsg.className = "text-success";
            statusMsg.innerHTML = `Účet vytvořen! <br> Zkontrolujte <b>${email}</b> pro ověřovací odkaz (často padá do spamu).`;
            regForm.reset();
            regBtn.disabled = false;
            regBtn.textContent = "Vytvořit účet";

            await initializeFlow();

        } else {
            regBtn.disabled = false;
            regBtn.textContent = "Vytvořit účet";

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
        console.error(error);
        statusMsg.className = "text-danger";
        statusMsg.textContent = "Server neodpovídá. Zkuste to prosím později.";
        regBtn.disabled = false;
        regBtn.textContent = "Vytvořit účet";
    }
});
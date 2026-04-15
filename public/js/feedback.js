import { initThemeListeners } from './theming.js';
import { createServerLog } from '/js/logging.js';
import { CONFIG } from '/js/config.js';

const KRATOS_URL = CONFIG.AUTH_URL;
const API_URL = CONFIG.API_URL;

const form = document.getElementById('feedback-form');
const submitBtn = document.getElementById('submit-btn');
const statusMsg = document.getElementById('status-message');
const pageInput = document.getElementById('feedback-page');
const formWrapper = document.getElementById('feedback-form-wrapper');
const pageGroup = document.getElementById('feedback-page-group');
const categoryField = document.getElementById('feedback-category');

let currentUser = null;

async function checkAuth() {
    try {
        const res = await fetch(`${KRATOS_URL}/sessions/whoami`, {
            credentials: 'include',
            headers: { 'Accept': 'application/json' }
        });

        if (!res.ok) {
            window.location.href = '/login';
            return;
        }

        const session = await res.json();
        currentUser = session.identity;

        const isVerified = currentUser.verifiable_addresses?.some(addr => addr.verified === true);

        if (!isVerified) {
            formWrapper.innerHTML = `
                <div class="box">
                    <div class="col-md-12">
                        <h2>Nemáte ověřený email.</h2>
                        <p>Pro použití feedbacku musíte mít z bezpečnostních důvodů ověřený email. Zkontrolujte prosím svoji schránku.</p>
                    </div>
                </div>`;
            formWrapper.style.display = 'block';
            return;
        }

        formWrapper.style.display = 'block';
    } catch (err) {
        console.error("Auth check failed", err);
    }
}

const urlParams = new URLSearchParams(window.location.search);
const relatedPage = urlParams.get("page");
if (relatedPage && pageInput) pageInput.value = relatedPage;

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) return;

    const title = document.getElementById('feedback-title').value;
    const page = document.getElementById('feedback-page').value;
    const category = document.getElementById('feedback-category').value;
    const message = document.getElementById('feedback-message').value;

    if (message.length < 10) {
        statusMsg.className = 'text-danger';
        statusMsg.textContent = "Zpráva je příliš krátká.";
        return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Odesílání...';

    try {
        let ipAddress = 'Unknown';
        try {
            const ipRes = await fetch('https://api.ipify.org?format=json');
            const ipData = await ipRes.json();
            ipAddress = ipData.ip;
        } catch (err) { console.warn("IP fetch failed"); }

        const feedbackData = {
            title: title,
            page: page || null,
            category: category,
            subject: page.split('/', 2)[1] || null,
            message: message,
            ip: ipAddress
        };

        const res = await fetch(`${API_URL}/feedback`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(feedbackData),
            credentials: 'include'
        });

        if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || "Chyba při odesílání.");
        }

        const result = await res.json();

        await createServerLog('feedback', `Feedback Sent: ${title}`, {
            userEmail: currentUser.traits.email,
            feedbackID: result.id
        });

        statusMsg.className = 'text-success font-weight-bold';
        statusMsg.textContent = 'Děkujeme! Vaše zpětná vazba byla odeslána.';
        form.reset();

        setTimeout(() => { window.location.href = '/'; }, 2000);

    } catch (error) {
        statusMsg.className = 'text-danger';
        statusMsg.textContent = error.message;
        submitBtn.disabled = false;
        submitBtn.textContent = 'Odeslat zpětnou vazbu';
    }
});

categoryField.addEventListener('change', async (e) => {
    if (e.target.value === 'articles') {
        pageGroup.innerHTML = `
                <label for="feedback-page">Stránka</label>
                <input type="text" class="form-control" id="feedback-page" placeholder="/mat/mnoziny">
        `;
    } else {
        pageGroup.innerHTML = '';
    }
});

initThemeListeners();
checkAuth();
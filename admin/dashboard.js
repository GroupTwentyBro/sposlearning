import { initThemeListeners } from '/js/theming.js';

const KRATOS_URL = "https://auth.sposlearning.cz";
const container = document.getElementById('secure-container');
const loader = document.querySelector('.dot-container');

async function init() {
    try {
        const res = await fetch(`${KRATOS_URL}/sessions/whoami`, {
            credentials: 'include',
            headers: { 'Accept': 'application/json' }
        });

        if (!res.ok) {
            window.location.href = 'https://sposlearning.cz/login';
            return;
        }

        const session = await res.json();

        if (session.identity?.metadata_public?.admin !== true) {
            window.location.href = 'https://sposlearning.cz/';
            return;
        }

        if (loader) loader.classList.add('hidden');
        if (container) {
            container.style.display = 'block';
        }

        initThemeListeners();

        const logoutBtn = document.getElementById('logout-button');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', handleLogout);
        }

    } catch (err) {
        console.error("Dashboard Auth Error:", err);
        window.location.href = 'https://sposlearning.cz/login';
    }
}

async function handleLogout(e) {
    if (e) e.preventDefault();
    try {
        const res = await fetch(`${KRATOS_URL}/self-service/logout/browser`, {
            credentials: 'include',
            headers: { 'Accept': 'application/json' }
        });
        if (res.ok) {
            const flow = await res.json();
            window.location.href = flow.logout_url;
        } else {
            window.location.href = 'https://sposlearning.cz/login';
        }
    } catch (err) {
        window.location.href = 'https://sposlearning.cz';
    }
}

init();
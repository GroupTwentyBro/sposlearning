import { initThemeListeners } from '/js/theming.js';
import {CONFIG} from "/js/config.js";

const KRATOS_URL = CONFIG.AUTH_URL;
const container = document.getElementById('secure-container');
const loader = document.querySelector('.dot-container');

async function init() {
    setTimeout(() => {
        if (loader && !loader.classList.contains('hidden')) {
            console.warn("Auth check timed out. Forcing loader hide.");
            loader.classList.add('hidden');
        }
    }, 5000);

    try {
        console.log("Checking Kratos session...");
        const res = await fetch(`${KRATOS_URL}/sessions/whoami`, {
            credentials: 'include',
            headers: { 'Accept': 'application/json' }
        });

        if (!res.ok) {
            console.log("No active session found. Redirecting...");
            window.location.href = `${CONFIG.BASE_URL}/login`;
            return;
        }

        const session = await res.json();
        console.log("Session found:", session);

        const isAdmin = session.identity?.metadata_public?.admin === true;

        if (!isAdmin) {
            console.error("User is not an admin. Redirecting to home.");
            window.location.href = `${CONFIG.BASE_URL}/`;
            return;
        }

        console.log("Admin authorized. Rendering Dashboard.");

        if (loader) loader.classList.add('hidden');
        if (container) {
            container.style.display = 'block';
            container.classList.add('visible');
        }

        initThemeListeners();

        const logoutBtn = document.getElementById('logout-button');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', handleLogout);
        }

    } catch (err) {
        console.error("Dashboard Init Error:", err);
        if (loader) loader.classList.add('hidden');
        if (container) {
            container.innerHTML = `<div class="alert alert-danger m-5">Connection Error: ${err.message}</div>`;
            container.style.display = 'block';
        }
    }
}

async function handleLogout(e) {
    if (e) e.preventDefault();
    try {
        const res = await fetch(`${KRATOS_URL}/self-service/logout/browser`, {
            credentials: 'include',
            headers: { 'Accept': 'application/json' }
        });
        const flow = await res.json();
        window.location.href = flow.logout_url;
    } catch (err) {
        window.location.href = `${CONFIG.BASE_URL}/login`;
    }
}

init();
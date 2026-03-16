import { initThemeListeners } from '/js/theming.js';

const PROXY_URL = 'https://admin.sposlearning.cz/get_content.php';
const LOGIN_URL = 'https://sposlearning.cz/login';
const KRATOS_LOGOUT_URL = 'https://auth.sposlearning.cz/self-service/browser/flows/logout';

const container = document.getElementById('secure-container');
const loader = document.querySelector('.dot-container');

async function loadAdminDashboard() {
    try {
        const response = await fetch(PROXY_URL, {
            method: 'GET',
            credentials: 'include'
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error("Server returned an error:", errorData);

            if (response.status === 401 || response.status === 403) {
                showAccessDenied("Průchod zakázán. Nejste přihlášen jako administrátor.");
                return;
            }
            throw new Error(errorData.message || "Failed to load dashboard content.");
        }

        const data = await response.json();
        renderDashboard(data.html);

    } catch (error) {
        console.error("Dashboard Load Error:", error);
        showAccessDenied("Nastala neočekávaná chyba při načítání obsahu.");
    }
}

function renderDashboard(htmlContent) {
    container.innerHTML = htmlContent;

    if (loader) loader.classList.add('hidden');

    container.classList.add('visible');

    initializeGeneralScripts();
    initThemeListeners();
}

function initializeGeneralScripts() {
    const logoutBtn = document.getElementById('logout-button');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            window.location.href = KRATOS_LOGOUT_URL;
        });
    }
}

function showAccessDenied(message) {
    if (loader) loader.classList.add('hidden');

    container.innerHTML = `
        <div class="alert alert-danger text-center m-5" style="background: none !important; border: none;">
            <h1 style="color: var(--root-fg-clr); font-size: 4rem;">403</h1>
            <p style="color: var(--root-txt-clr); font-size: 1.2rem;">${message}</p>
            <a href="${LOGIN_URL}" style="color: var(--primary-hl-clr); text-decoration: underline;">
                Zpět na přihlášení
            </a>
        </div>`;
    container.classList.add('visible');
}

document.addEventListener('DOMContentLoaded', loadAdminDashboard);
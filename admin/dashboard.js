import { initThemeListeners } from '/js/theming.js';

const container = document.getElementById('secure-container');
const loader = document.querySelector('.dot-container');

async function loadDashboardContent() {
    try {

        const response = await fetch('https://admin.sposlearning.cz/get_content.php');
        if (!response.ok) throw new Error("Status: " + response.status);
        const data = await response.json();
        const htmlContent = data.html;

        container.innerHTML = htmlContent;
        if (loader) loader.classList.add('hidden');
        container.classList.add('visible');

        const logoutBtn = document.getElementById('logout-button');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                window.location.href = 'https://sposlearning.cz/login';
            });
        }
        initThemeListeners();

    } catch (error) {
        console.error("Failed to load:", error);
        if (loader) loader.classList.add('hidden');
        container.innerHTML = `<p class="text-center m-5">Error loading content. Check Console.</p>`;
        container.classList.add('visible');
    }
}

document.addEventListener('DOMContentLoaded', loadDashboardContent);
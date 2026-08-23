import { initAuth, login, logout, getUser, getAccessToken } from '/js/auth.js';
import { getPages, getFilteredPages, getGradeCookie, setGradeCookie, getGradeName, applyGradeFromUrl } from "/js/search.js";
import { initFeedbackModal, openFeedbackModal } from "/js/feedback-modal.js";
import { applyTheme } from "/js/theme.js";

applyTheme();

const accountDropIcon = document.getElementById("account-button-drop-icon");
const accountButton = document.getElementById("account-button");
const accountMenu = document.getElementById("account-menu");
const gradeDropIcon = document.getElementById("grade-select-drop-icon");
const gradeButton = document.getElementById("nav-grade-select");
const gradeText = document.getElementById("grade-text");
const gradeMenu = document.getElementById("grade-menu");
const searchBox = document.getElementById("search-input");
const resultsContainer = document.getElementById("search-results-container");
const loginButton = document.getElementById("login-button");

let user = null;

async function correctNavBar() {
    const loggedIn = await initAuth();

    if (!loggedIn) {
        if (loginButton) loginButton.classList.remove("nd");
        const navProfile = document.getElementById("nav-profile");
        if (navProfile) navProfile.classList.add("nd");
        return;
    }

    user = getUser();
    if (loginButton) loginButton.classList.add("nd");
    const navProfile = document.getElementById("nav-profile");
    if (navProfile) navProfile.classList.remove("nd");

    const dashboardButton = document.getElementById("dashboard-button");
    if (dashboardButton && user && user.roles.includes("admin")) {
        dashboardButton.classList.remove("nd");
        dashboardButton.addEventListener("click", () => {
            window.location.href = "/admin/dashboard";
        });
    }

    const logsButton = document.getElementById("logs-button");
    if (logsButton && user && user.roles.includes("admin")) {
        logsButton.classList.remove("nd");
        logsButton.addEventListener("click", () => {
            window.location.href = "/admin/logs";
        });
    }

    const feedbackButton = document.getElementById("feedback-button");
    if (feedbackButton) {
        feedbackButton.addEventListener("click", (e) => {
            e.stopPropagation();
            if (accountMenu) accountMenu.classList.add("hidden");
            openFeedbackModal();
        });
    }

    const settingsButton = document.getElementById("settings-button");
    if (settingsButton) {
        settingsButton.addEventListener("click", () => {
            window.location.href = "/account/settings";
        });
    }

    const submissionsButton = document.getElementById("submissions-button");
    if (submissionsButton) {
        submissionsButton.addEventListener("click", () => {
            window.location.href = "/account/submissions";
        });
    }

    const logoutButton = document.getElementById("logout-button");
    if (logoutButton) {
        logoutButton.addEventListener("click", () => {
            logout();
        });
    }

    const nameSpan = document.getElementById("account-button-name");
    if (nameSpan && user) nameSpan.innerHTML = user.name;

    if (accountButton && accountMenu) {
        accountButton.addEventListener("click", (e) => {
            e.stopPropagation();
            if (gradeMenu) gradeMenu.classList.add("hidden");
            if (gradeDropIcon) gradeDropIcon.innerHTML = "arrow_drop_down";
            if (accountMenu.classList.contains("hidden")) {
                accountMenu.classList.remove("hidden");
                if (accountDropIcon) accountDropIcon.innerHTML = "arrow_drop_up";
            } else {
                accountMenu.classList.add("hidden");
                if (accountDropIcon) accountDropIcon.innerHTML = "arrow_drop_down";
            }
        });
    }
}

function updateGradeUI() {
    const currentGrade = getGradeCookie();
    if (gradeText) {
        gradeText.textContent = getGradeName(currentGrade);
    }
}

function initGradeSelector() {
    updateGradeUI();

    const buttons = [
        { id: 'first-button', grade: 1 },
        { id: 'second-button', grade: 2 },
        { id: 'third-button', grade: 3 },
        { id: 'fourth-button', grade: 4 }
    ];

    buttons.forEach(({ id, grade }) => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                setGradeCookie(grade);
                updateGradeUI();
                if (gradeMenu) gradeMenu.classList.add('hidden');
                if (gradeDropIcon) gradeDropIcon.innerHTML = "arrow_drop_down";

                if (searchBox && searchBox.value.trim() !== '') {
                    const role = user?.roles?.includes('admin') ? 'admin' : 'user';
                    renderResults(getFilteredPages(searchBox.value, role));
                }
            });
        }
    });

    if (gradeButton && gradeMenu) {
        gradeButton.addEventListener("click", (e) => {
            e.stopPropagation();
            if (accountMenu) accountMenu.classList.add("hidden");
            if (accountDropIcon) accountDropIcon.innerHTML = "arrow_drop_down";
            if (gradeMenu.classList.contains("hidden")) {
                gradeMenu.classList.remove("hidden");
                if (gradeDropIcon) gradeDropIcon.innerHTML = "arrow_drop_up";
            } else {
                gradeMenu.classList.add("hidden");
                if (gradeDropIcon) gradeDropIcon.innerHTML = "arrow_drop_down";
            }
        });
    }

    document.addEventListener('click', () => {
        if (gradeMenu) gradeMenu.classList.add("hidden");
        if (accountMenu) accountMenu.classList.add("hidden");
        if (resultsContainer) resultsContainer.classList.add("hidden");
    });
}

function renderResults(pages) {
    if (!resultsContainer) return;
    resultsContainer.innerHTML = "";

    if (pages.length === 0) {
        resultsContainer.innerHTML = `
            <span id="no-results" style="padding: 8px 12px; color: var(--text-tertiary); font-size: 0.85rem;">No results found.</span>
        `;
        resultsContainer.classList.remove("hidden");
        return;
    }

    const userRole = user?.roles?.includes('admin') ? 'admin' : 'user';

    for (const page of pages) {
        if (userRole !== 'admin' && page.accessLevel === 'admin') continue;
        const cleanPath = '/' + (page.path || '').replace(/^[\.\/]+/, '');
        resultsContainer.innerHTML += `<a href="${cleanPath}">
                <div class="search-result">
                    <span class="search-result-name">${escapeHtml(page.title)}</span>
                    <span class="search-result-path">${escapeHtml(cleanPath)}</span>
                </div>
            </a>`;
    }

    if (resultsContainer.innerHTML.length === 0) {
        resultsContainer.innerHTML = `
            <span id="no-results" style="padding: 8px 12px; color: var(--text-tertiary); font-size: 0.85rem;">No results found.</span>
        `;
    }

    resultsContainer.classList.remove("hidden");
}

function escapeHtml(text) {
    if (!text) return '';
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(text).replace(/[&<>"']/g, m => map[m]);
}

applyGradeFromUrl();
correctNavBar();
getPages();
initGradeSelector();
initFeedbackModal();

if (searchBox) {
    searchBox.addEventListener("input", (e) => {
        const userRole = user?.roles?.includes('admin') ? 'admin' : 'user';
        if (searchBox.value.trim() === '') {
            if (resultsContainer) resultsContainer.classList.add('hidden');
        } else {
            renderResults(getFilteredPages(searchBox.value, userRole));
        }
    });
}

if (loginButton) {
    loginButton.addEventListener("click", () => {
        window.location.href = "/login.html";
    });
}
import { initThemeListeners } from '/js/theming.js';
import {CONFIG} from "/js/config.js";

const KRATOS_URL = CONFIG.AUTH_URL;
const API_URL = CONFIG.API_URL;
const LOGIN_REDIRECT = `${CONFIG.BASE_URL}/login`;

const filteringButton = document.getElementById('filter-button');

let allFeedback = [];
let currentSort = 'priority';
let sortOrder = 'desc';
let hideResolved = false;
let currentPriority = 'all';

async function checkAuthAndInit() {
    try {
        const response = await fetch(`${KRATOS_URL}/sessions/whoami`, {
            credentials: 'include',
            headers: { 'Accept': 'application/json' }
        });

        if (!response.ok) throw new Error("Unauthorized");
        const session = await response.json();

        if (session.identity.metadata_public?.admin !== true) {
            window.location.href = LOGIN_REDIRECT;
            return;
        }

        setupControls();
        await loadFeedbackData();
        initThemeListeners();
        document.querySelector('.dot-container')?.classList.add('hidden');
    } catch (err) {
        window.location.href = LOGIN_REDIRECT;
    }
}

function setupControls() {
    const searchInput = document.getElementById('search-input');

    document.getElementById('sort-select')?.addEventListener('change', (e) => {
        currentSort = e.target.value;
        renderFeedback(searchInput?.value);
    });

    document.getElementById('hide-resolved')?.addEventListener('change', (e) => {
        hideResolved = e.target.checked;
        renderFeedback(searchInput?.value);
    });

    searchInput?.addEventListener('input', (e) => {
        renderFeedback(e.target.value);
    });
}

async function loadFeedbackData() {
    const loadingText = document.getElementById('loading');
    try {
        const res = await fetch(`${API_URL}/feedback`, { credentials: 'include' });
        if (!res.ok) throw new Error("Fetch failed");

        allFeedback = await res.json();
        if (loadingText) loadingText.style.display = 'none';
        renderFeedback();
    } catch (error) {
        if (loadingText) loadingText.textContent = 'Chyba při načítání feedbacku.';
    }
}

function renderFeedback(term = "") {
    const listContainer = document.getElementById('feedback-list');
    if (!listContainer) return;

    const searchTerm = (term || '').trim().toLowerCase();
    listContainer.innerHTML = '';

    const statusConfig = {
        'open': { class: 'badge-primary', label: 'Open', weight: 10 },
        'in-progress': { class: 'badge-info', label: 'In Progress', weight: 20 },
        'resolved': { class: 'badge-success', label: 'Resolved', weight: 30 },
        'denied': { class: 'badge-danger', label: 'Denied', weight: 40 }
    };

    const priorityWeight = { 'high': 1, 'medium': 2, 'low': 3 };

    let filtered = allFeedback.filter(item => {
        const status = item.status || (item.resolved ? 'resolved' : 'open');
        const priority = item.priority || 'medium';

        const matchesResolved = hideResolved ? (status !== 'resolved' && status !== 'denied') : true;
        const matchesPriority = currentPriority === 'all' || priority === currentPriority;
        const matchesSearch = searchTerm === "" ||
            (item.title || '').toLowerCase().includes(searchTerm) ||
            (item.page || '').toLowerCase().includes(searchTerm) ||
            (item.message || '').toLowerCase().includes(searchTerm);

        return matchesResolved && matchesPriority && matchesSearch;
    });

    filtered.sort((a, b) => {
        let result = 0;

        if (currentSort === 'priority') {
            const prioA = priorityWeight[a.priority || 'medium'];
            const prioB = priorityWeight[b.priority || 'medium'];

            result = prioA - prioB;

            if (result === 0) {
                result = new Date(b.timestamp) - new Date(a.timestamp);
            }
        }
        else if (currentSort === 'date') {
            result = new Date(b.timestamp) - new Date(a.timestamp);
        }

        return sortOrder === 'desc' ? result : result * -1;
    });

    if (filtered.length === 0) {
        listContainer.innerHTML = '<p class="text-center mt-3">No matching feedback found.</p>';
        return;
    }

    filtered.forEach(data => {
        const currentStatus = data.status || (data.resolved ? 'resolved' : 'open');
        const config = statusConfig[currentStatus] || statusConfig['open'];
        const priority = data.priority || 'medium';
        const preview = (data.message || '').substring(0, 100) + (data.message?.length > 100 ? '...' : '');

        const a = document.createElement('a');
        a.href = `/feedback/post?id=${data.id}`;
        a.className = `feedback-item list-group-item list-group-item-action ${ (currentStatus === 'resolved' || currentStatus === 'denied') ? 'read' : ''}`;

        if (priority === 'high') {
            a.style.borderLeft = "6px solid #ff4d4d";
            a.style.backgroundColor = "rgba(255, 77, 77, 0.05)";
        }

        a.innerHTML = `
            <div class="feedback-header">
                <div class="feedback-title">
                    <span class="badge ${config.class} mr-2" style="font-size: calc(var(--fs-text) * 1);">${config.label}</span>
                    ${priority === 'high' ? '<span class="badge badge-warning mr-2" style="color: #FFF; font-weight: bold; font-size: calc(var(--fs-text) * 1);">HIGH PRIORITY</span>' : ''}
                    <span style="font-size: calc(var(--fs-text) * 1.25);">${escapeHtml(data.title)}</span>
                    <span class="text-muted" style="font-size: calc(var(--fs-footer));">${escapeHtml(data.page)}</span>
                </div>
                <div class="feedback-meta">
                    <div>${escapeHtml(data.contact)}</div>
                </div>
            </div>
            <div class="feedback-preview">${escapeHtml(preview)}</div>
        `;
        listContainer.appendChild(a);
    });
}

function escapeHtml(text) {
    if (!text) return '';
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return text.replace(/[&<>"']/g, m => map[m]);
}

filteringButton.addEventListener('click', (e) => {
    handleFiltering();
});

function handleFiltering() {
    return new Promise((resolve) => {
        const overlay = document.getElementById('filter-modal-overlay');
        overlay.style.display = 'flex';
        const clean = (val) => { overlay.style.display = 'none'; resolve(val); };
        document.getElementById('modal-cancel-btn').onclick = () => clean(null);
    });

    renderFeedback();
}

document.getElementById('direction-toggle')?.addEventListener('click', () => {
    sortOrder = (sortOrder === 'desc') ? 'asc' : 'desc';

    const icon = document.getElementById('direction-icon');
    if (sortOrder === 'asc') {
        icon.classList.add('rotate-180');
    } else {
        icon.classList.remove('rotate-180');
    }

    renderFeedback(document.getElementById('search-input')?.value);
});

checkAuthAndInit();
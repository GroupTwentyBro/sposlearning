import { initThemeListeners } from '/js/theming.js';

const KRATOS_URL = "https://auth.sposlearning.cz";
const API_URL = "https://api.sposlearning.cz";
const LOGIN_REDIRECT = "https://sposlearning.cz/login";

let allFeedback = [];
let currentSort = 'desc';
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
        'open': { class: 'badge-primary', label: 'Open' },
        'resolved': { class: 'badge-success', label: 'Resolved' },
        'denied': { class: 'badge-danger', label: 'Denied' }
    };

    let filtered = allFeedback.filter(item => {
        const isResolved = item.resolved === 1 || item.status === 'resolved';
        const matchesResolved = hideResolved ? !isResolved : true;
        const matchesSearch = searchTerm === "" ||
            (item.title || '').toLowerCase().includes(searchTerm) ||
            (item.message || '').toLowerCase().includes(searchTerm);

        return matchesResolved && matchesSearch;
    });

    // Sort by timestamp (desc/asc)
    filtered.sort((a, b) => {
        const dateA = new Date(a.timestamp);
        const dateB = new Date(b.timestamp);
        return currentSort === 'desc' ? dateB - dateA : dateA - dateB;
    });

    if (filtered.length === 0) {
        listContainer.innerHTML = '<p class="text-center mt-3">Žádný feedback nenalezen.</p>';
        return;
    }

    filtered.forEach(data => {
        const isResolved = data.resolved === 1 || data.status === 'resolved';
        const config = isResolved ? statusConfig['resolved'] : statusConfig['open'];
        const preview = (data.message || '').substring(0, 100) + (data.message?.length > 100 ? '...' : '');

        const a = document.createElement('a');
        a.href = `/feedback/post?id=${data.id}`;
        a.className = `feedback-item list-group-item list-group-item-action ${isResolved ? 'read' : ''}`;

        a.innerHTML = `
            <div class="feedback-header">
                <div class="feedback-title">
                    <span class="badge ${config.class} mr-2">${config.label}</span>
                    ${escapeHtml(data.page)} - ${escapeHtml(data.title)}
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

checkAuthAndInit();
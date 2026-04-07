import { initThemeListeners } from '/js/theming.js';
import {CONFIG} from "/js/config.js";

const KRATOS_URL = CONFIG.AUTH_URL;
const API_URL = CONFIG.API_URL;
const LOGIN_REDIRECT = `${CONFIG.BASE_URL}/login`;

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

    // 1. Restore your original Status Configuration
    const statusConfig = {
        'open': { class: 'badge-primary', label: 'Open', weight: 10 },
        'in-progress': { class: 'badge-info', label: 'In Progress', weight: 20 },
        'resolved': { class: 'badge-success', label: 'Resolved', weight: 30 },
        'denied': { class: 'badge-danger', label: 'Denied', weight: 40 }
    };

    const priorityWeight = { 'high': 1, 'medium': 2, 'low': 3 };

    // 2. Filter logic (including the priority filter if you have that UI element)
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

    // 3. Restore the Deep Sorting Logic
    filtered.sort((a, b) => {
        const statusA = a.status || (a.resolved ? 'resolved' : 'open');
        const statusB = b.status || (b.resolved ? 'resolved' : 'open');
        const prioA = a.priority || 'medium';
        const prioB = b.priority || 'medium';

        // Rule A: Group Active vs Closed (Resolved/Denied always go to bottom)
        const isClosedA = (statusA === 'resolved' || statusA === 'denied');
        const isClosedB = (statusB === 'resolved' || statusB === 'denied');
        if (isClosedA !== isClosedB) return isClosedA ? 1 : -1;

        // Rule B: Sort by Priority (High > Medium > Low)
        if (priorityWeight[prioA] !== priorityWeight[prioB]) {
            return priorityWeight[prioA] - priorityWeight[prioB];
        }

        // Rule C: Sort by Status Weight (Open > In Progress)
        if (statusConfig[statusA].weight !== statusConfig[statusB].weight) {
            return statusConfig[statusA].weight - statusConfig[statusB].weight;
        }

        // Rule D: Finally, sort by Time
        const timeA = new Date(a.timestamp).getTime();
        const timeB = new Date(b.timestamp).getTime();
        return currentSort === 'desc' ? timeB - timeA : timeA - timeB;
    });

    // 4. Render Items
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

        // High Priority Visual styling
        if (priority === 'high') {
            a.style.borderLeft = "6px solid #ff4d4d";
            a.style.backgroundColor = "rgba(255, 77, 77, 0.05)";
        }

        a.innerHTML = `
            <div class="feedback-header">
                <div class="feedback-title">
                    <span class="badge ${config.class} mr-2">${config.label}</span>
                    ${priority === 'high' ? '<span class="badge badge-warning mr-2" style="color: #000; font-weight: bold;">HIGH PRIORITY</span>' : ''}
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
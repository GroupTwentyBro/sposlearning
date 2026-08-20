import { CONFIG } from "/js/config.js";
import { initAuth, getUser, getAccessToken } from "/js/auth.js";

const API_URL = CONFIG.API_URL;

let currentPage = 1;
let totalPages = 1;
let searchTimeout = null;
let currentLogs = [];

const searchInput = document.getElementById('log-search-input');
const categoryFilter = document.getElementById('category-filter');
const actionFilter = document.getElementById('action-filter');
const hideViewsToggle = document.getElementById('hide-views-toggle');
const refreshBtn = document.getElementById('refresh-logs-btn');
const tableBody = document.getElementById('logs-table-body');
const loadingEl = document.getElementById('logs-loading');
const emptyEl = document.getElementById('logs-empty');
const prevBtn = document.getElementById('prev-page-btn');
const nextBtn = document.getElementById('next-page-btn');
const pageIndicator = document.getElementById('page-indicator');
const paginationInfo = document.getElementById('pagination-info');

const statTotal = document.getElementById('stat-total');
const statAuth = document.getElementById('stat-auth');
const statPages = document.getElementById('stat-pages');
const statFeedback = document.getElementById('stat-feedback');

const modal = document.getElementById('details-modal');
const jsonCode = document.getElementById('json-details-content');
const closeModalBtn = document.getElementById('close-details-btn');

async function checkAdminAuth() {
    try {
        const loggedIn = await initAuth();
        if (!loggedIn) {
            window.location.href = '/login';
            return;
        }

        const user = getUser();
        if (!user || !user.roles.includes('admin')) {
            window.location.href = '/';
            return;
        }

        setupEventListeners();
        loadLogs();
    } catch (e) {
        console.error('Auth verification failed:', e);
        window.location.href = '/login';
    }
}

async function fetchLogs() {
    if (loadingEl) loadingEl.classList.remove('hidden');
    if (emptyEl) emptyEl.classList.add('hidden');

    const params = new URLSearchParams({
        page: currentPage,
        limit: 50,
        category: categoryFilter.value,
        action: actionFilter.value,
        search: searchInput.value.trim(),
        hideViews: hideViewsToggle.checked ? 'true' : 'false'
    });

    try {
        const token = await getAccessToken();
        const response = await fetch(`${API_URL}/logs?${params.toString()}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to load logs (${response.status})`);
        }

        const data = await response.json();
        currentLogs = data.logs || [];
        totalPages = data.totalPages || 1;

        renderLogsTable(currentLogs);
        updatePagination(data.total, data.page, data.totalPages);
        updateStats(currentLogs, data.total);

    } catch (err) {
        console.error('Error fetching logs:', err);
        tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color: var(--accent-rose); padding: 24px;">Failed to load logs: ${escapeHtml(err.message)}</td></tr>`;
    } finally {
        if (loadingEl) loadingEl.classList.add('hidden');
    }
}

function renderLogsTable(logs) {
    tableBody.innerHTML = '';

    if (!logs || logs.length === 0) {
        if (emptyEl) emptyEl.classList.remove('hidden');
        return;
    }

    logs.forEach((log, index) => {
        const tr = document.createElement('tr');
        
        let detailsObj = {};
        try {
            detailsObj = typeof log.details === 'string' ? JSON.parse(log.details) : (log.details || {});
        } catch (e) {
            detailsObj = { raw: log.details };
        }

        const summaryText = formatDetailsSummary(detailsObj);

        tr.innerHTML = `
            <td><small style="color: var(--text-secondary);">${formatDate(log.timestamp)}</small></td>
            <td>${getCategoryBadge(log.category)}</td>
            <td><span class="badge badge-act">${escapeHtml(log.action)}</span></td>
            <td><strong>${escapeHtml(log.user_email || 'Anonymous')}</strong></td>
            <td><span class="ip-badge">${escapeHtml(log.user_ip || 'N/A')}</span></td>
            <td>
                <div class="details-summary">
                    <span style="font-size: 0.85rem; color: var(--text-secondary);">${escapeHtml(summaryText)}</span>
                    <button class="btn-json" data-index="${index}">JSON</button>
                </div>
            </td>
        `;

        tableBody.appendChild(tr);
    });

    tableBody.querySelectorAll('.btn-json').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = parseInt(e.target.dataset.index, 10);
            if (!isNaN(idx) && currentLogs[idx]) {
                openModal(currentLogs[idx]);
            }
        });
    });
}

function getCategoryBadge(cat) {
    const map = {
        auth: { label: 'Auth', class: 'badge-cat-auth', icon: 'lock' },
        pages: { label: 'Pages', class: 'badge-cat-pages', icon: 'article' },
        feedback: { label: 'Feedback', class: 'badge-cat-feedback', icon: 'rate_review' },
        views: { label: 'Page Views', class: 'badge-cat-views', icon: 'visibility' }
    };
    const c = map[cat] || { label: cat, class: 'badge-cat-views', icon: 'info' };
    return `<span class="badge ${c.class}"><span class="icon" style="font-size: 1rem;">${c.icon}</span> ${c.label}</span>`;
}

function formatDetailsSummary(details) {
    if (!details || Object.keys(details).length === 0) return 'No extra details';
    if (details.title || details.path) {
        return `${details.title ? details.title + ' ' : ''}${details.path ? '(' + details.path + ')' : ''}`;
    }
    if (details.reason) return `Reason: ${details.reason}`;
    if (details.status || details.category) return `Status: ${details.status || 'N/A'}, Cat: ${details.category || 'N/A'}`;
    return JSON.stringify(details).substring(0, 60);
}

function formatDate(ts) {
    if (!ts) return 'N/A';
    const d = new Date(ts);
    return d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
}

function updatePagination(total, page, totalPagesCount) {
    if (paginationInfo) paginationInfo.textContent = `Showing ${currentLogs.length} of ${total} logs`;
    if (pageIndicator) pageIndicator.textContent = `Page ${page} of ${totalPagesCount || 1}`;
    
    if (prevBtn) prevBtn.disabled = page <= 1;
    if (nextBtn) nextBtn.disabled = page >= totalPagesCount;
}

function updateStats(logs, total) {
    if (statTotal) statTotal.textContent = total;

    let authCount = 0;
    let pagesCount = 0;
    let feedbackCount = 0;

    logs.forEach(l => {
        if (l.category === 'auth') authCount++;
        else if (l.category === 'pages') pagesCount++;
        else if (l.category === 'feedback') feedbackCount++;
    });

    if (statAuth) statAuth.textContent = authCount;
    if (statPages) statPages.textContent = pagesCount;
    if (statFeedback) statFeedback.textContent = feedbackCount;
}

function setupEventListeners() {
    if (categoryFilter) categoryFilter.addEventListener('change', () => { currentPage = 1; loadLogs(); });
    if (actionFilter) actionFilter.addEventListener('change', () => { currentPage = 1; loadLogs(); });
    if (hideViewsToggle) hideViewsToggle.addEventListener('change', () => { currentPage = 1; loadLogs(); });

    if (searchInput) {
        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                currentPage = 1;
                loadLogs();
            }, 300);
        });
    }

    if (refreshBtn) refreshBtn.addEventListener('click', () => { loadLogs(); });

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                loadLogs();
            }
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            if (currentPage < totalPages) {
                currentPage++;
                loadLogs();
            }
        });
    }

    if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal && !modal.classList.contains('hidden')) {
            closeModal();
        }
    });
}

function loadLogs() {
    fetchLogs();
}

function openModal(logItem) {
    let detailsObj = {};
    try {
        detailsObj = typeof logItem.details === 'string' ? JSON.parse(logItem.details) : (logItem.details || {});
    } catch (e) {
        detailsObj = { raw: logItem.details };
    }

    const payload = {
        id: logItem.id,
        action: logItem.action,
        category: logItem.category,
        user_email: logItem.user_email,
        user_ip: logItem.user_ip,
        timestamp: logItem.timestamp,
        details: detailsObj
    };

    jsonCode.textContent = JSON.stringify(payload, null, 2);
    modal.classList.remove('hidden');
}

function closeModal() {
    modal.classList.add('hidden');
}

function escapeHtml(text) {
    if (!text) return '';
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(text).replace(/[&<>"']/g, m => map[m]);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkAdminAuth);
} else {
    checkAdminAuth();
}

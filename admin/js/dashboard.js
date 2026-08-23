import { CONFIG } from "/js/config.js";
import { initAuth, getUser, getAccessToken } from "/js/auth.js";

const API_URL = CONFIG.API_URL;

const statPages = document.getElementById('dash-stat-pages');
const statFeedback = document.getElementById('dash-stat-feedback');
const statLogs = document.getElementById('dash-stat-logs');
const statSubmissions = document.getElementById('dash-stat-submissions');
const recentFeedbackList = document.getElementById('recent-feedback-list');
const recentLogsList = document.getElementById('recent-logs-list');

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

        loadDashboardData();
    } catch (e) {
        console.error('Auth check failed:', e);
        window.location.href = '/login';
    }
}

async function loadDashboardData() {
    try {
        const token = await getAccessToken();
        const headers = { 'Authorization': `Bearer ${token}` };

        const [pagesRes, feedbackRes, logsRes, subsRes] = await Promise.all([
            fetch(`${API_URL}/pages`),
            fetch(`${API_URL}/feedback`, { headers }),
            fetch(`${API_URL}/logs?limit=5&hideViews=true`, { headers }),
            fetch(`${API_URL}/submissions?status=pending`, { headers })
        ]);

        if (pagesRes.ok) {
            const pages = await pagesRes.json();
            if (statPages) statPages.textContent = pages.length;
        }

        if (feedbackRes.ok) {
            const feedbackItems = await feedbackRes.json();
            const openItems = feedbackItems.filter(f => (f.status || 'open') !== 'resolved');
            if (statFeedback) statFeedback.textContent = openItems.length;

            renderRecentFeedback(feedbackItems.slice(0, 4));
        }

        if (logsRes.ok) {
            const logsData = await logsRes.json();
            if (statLogs) statLogs.textContent = logsData.total || 0;
            renderRecentLogs(logsData.logs || []);
        }

        if (subsRes.ok) {
            const subsData = await subsRes.json();
            if (statSubmissions) statSubmissions.textContent = Array.isArray(subsData) ? subsData.length : 0;
        }

    } catch (err) {
        console.error('Failed to load dashboard data:', err);
    }
}

function renderRecentFeedback(items) {
    if (!recentFeedbackList) return;
    recentFeedbackList.innerHTML = '';

    if (!items || items.length === 0) {
        recentFeedbackList.innerHTML = `<div style="color: var(--text-tertiary); text-align: center; padding: 20px 0;">No feedback submissions yet.</div>`;
        return;
    }

    items.forEach(item => {
        const status = (item.status || 'open').toLowerCase();
        const statusClass = status === 'resolved' ? 'status-resolved' : (status === 'in_progress' ? 'status-progress' : 'status-open');
        const statusLabel = status === 'in_progress' ? 'In Progress' : status;

        const row = document.createElement('div');
        row.className = 'item-row';
        row.innerHTML = `
            <div class="item-left">
                <span class="item-title">${escapeHtml(item.title || item.subject || 'Feedback Item')}</span>
                <span class="item-sub">${escapeHtml(item.contact || 'User')} • ${formatDate(item.timestamp)}</span>
            </div>
            <span class="status-badge ${statusClass}">${statusLabel}</span>
        `;
        recentFeedbackList.appendChild(row);
    });
}

function renderRecentLogs(logs) {
    if (!recentLogsList) return;
    recentLogsList.innerHTML = '';

    if (!logs || logs.length === 0) {
        recentLogsList.innerHTML = `<div style="color: var(--text-tertiary); text-align: center; padding: 20px 0;">No recent audit activity.</div>`;
        return;
    }

    logs.forEach(log => {
        const row = document.createElement('div');
        row.className = 'item-row';

        let detailsObj = {};
        try {
            detailsObj = typeof log.details === 'string' ? JSON.parse(log.details) : (log.details || {});
        } catch (e) {}

        const detailsText = detailsObj.title || detailsObj.path || detailsObj.reason || log.action;

        row.innerHTML = `
            <div class="item-left">
                <span class="item-title">${escapeHtml(log.action)}</span>
                <span class="item-sub">${escapeHtml(log.user_email || 'Anonymous')} • ${escapeHtml(String(detailsText))}</span>
            </div>
            <span style="font-size: 0.78rem; color: var(--text-tertiary); font-family: monospace;">${formatDate(log.timestamp)}</span>
        `;
        recentLogsList.appendChild(row);
    });
}

function formatDate(ts) {
    if (!ts) return 'N/A';
    const d = new Date(ts);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
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
